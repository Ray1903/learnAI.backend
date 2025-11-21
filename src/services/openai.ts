import OpenAI from 'openai';
import EmbeddingsService from './embeddings';
import StudentDocumentsService from './student-documents';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DocumentContext {
  title: string;
  content: string;
  summary?: string;
  documentId?: string;
}

interface DocumentDirective {
  action: "summarize" | "use";
  query: string;
}

class OpenAIService {
  private client: OpenAI;
  private embeddingsService: EmbeddingsService;
  private studentDocumentsService: StudentDocumentsService;
  private agentModel: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.embeddingsService = new EmbeddingsService();
    this.studentDocumentsService = new StudentDocumentsService();
    this.agentModel = process.env.OPENAI_AGENT_MODEL || 'gpt-4o-mini';
  }

  /**
   * Genera una respuesta del asistente de estudio usando búsqueda semántica
   */
  async generateStudioAssistantResponse(
    messages: ChatMessage[],
    strapi: any,
    studentId?: string,
    documentContext?: DocumentContext[]
  ): Promise<string> {
    try {
      // Obtener el último mensaje del usuario para búsqueda semántica
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      const directive = lastUserMessage
        ? this.detectDocumentDirective(lastUserMessage.content)
        : null;
      let semanticContext: DocumentContext[] = [];

      if (lastUserMessage && studentId) {
        try {
          // Buscar chunks relevantes usando embeddings
          const similarChunks = await this.embeddingsService.findSimilarChunksWithPgVector(
            strapi,
            lastUserMessage.content,
            studentId,
            5, // límite de chunks
            0.7 // umbral de similitud
          );

          // Convertir chunks similares a contexto de documentos
          semanticContext = similarChunks.map(chunk => ({
            documentId: chunk.id,
            title: chunk.documentTitle,
            content: chunk.content,
            summary: `Chunk ${chunk.chunkIndex} (Similitud: ${(chunk.similarity * 100).toFixed(1)}%)`
          }));
        } catch (searchError) {
          console.error('Error in semantic search, using fallback:', searchError);
          semanticContext = documentContext || [];
        }
      } else {
        semanticContext = documentContext || [];
      }

      let relevantContext: DocumentContext[] = semanticContext;
      let directiveInstruction = '';

      if (directive && studentId) {
        console.log('[OpenAI] Directive detected:', directive);
        const directiveContext = await this.getDirectiveContext(
          strapi,
          studentId,
          directive
        );
        console.log('[OpenAI] Directive context found:', directiveContext.length, 'documents');

        if (directiveContext.length > 0) {
          directiveInstruction = this.buildDirectiveInstruction(
            directive,
            directiveContext
          );

          const dedupedSemanticContext = semanticContext.filter(context =>
            !directiveContext.some(directiveDoc =>
              (directiveDoc.documentId && directiveDoc.documentId === context.documentId) ||
              (directiveDoc.title === context.title && directiveDoc.content === context.content)
            )
          );

          relevantContext = directiveContext.concat(dedupedSemanticContext);
        } else {
          // Si no se encontró el documento, agregar instrucción de "no encontrado"
          directiveInstruction = this.buildDirectiveInstruction(
            directive,
            []
          );
        }
      }

      const systemPrompt = this.buildSystemPrompt(relevantContext, directiveInstruction);
      
      const completion = await this.client.chat.completions.create({
        model: this.agentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
    } catch (error) {
      console.error('Error generating OpenAI response:', error);
      throw new Error('Error al generar respuesta del asistente');
    }
  }

  /**
   * Procesa y resume un documento subido por el estudiante
   */
  async processDocument(content: string, title: string): Promise<{
    summary: string;
    chunks: string[];
  }> {
    try {
      // Generar resumen del documento
      const summaryCompletion = await this.client.chat.completions.create({
        model: this.agentModel,
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente que ayuda a resumir documentos académicos. Crea un resumen conciso y útil del siguiente documento.'
          },
          {
            role: 'user',
            content: `Título: ${title}\n\nContenido:\n${content}`
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const summary = summaryCompletion.choices[0]?.message?.content || 'Resumen no disponible';

      // Dividir el contenido en chunks para mejor procesamiento
      const chunks = this.splitIntoChunks(content, 1000);

      return {
        summary,
        chunks
      };
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error('Error al procesar el documento');
    }
  }

  /**
   * Genera preguntas de estudio basadas en el contenido del documento
   */
  async generateStudyQuestions(content: string, title: string): Promise<string[]> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.agentModel,
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente educativo. Genera 5 preguntas de estudio relevantes basadas en el contenido del documento. Las preguntas deben ayudar al estudiante a comprender mejor el material.'
          },
          {
            role: 'user',
            content: `Título: ${title}\n\nContenido:\n${content}`
          }
        ],
        temperature: 0.5,
        max_tokens: 400,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Extraer preguntas del response (asumiendo que están numeradas)
      const questions = response
        .split('\n')
        .filter(line => line.trim().match(/^\d+\./))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 0);

      return questions.length > 0 ? questions : ['¿Cuáles son los puntos principales de este documento?'];
    } catch (error) {
      console.error('Error generating study questions:', error);
      return ['¿Cuáles son los puntos principales de este documento?'];
    }
  }

  /**
   * Construye el prompt del sistema para el asistente de estudio
   */
  private buildSystemPrompt(
    documentContext?: DocumentContext[],
    directiveInstruction?: string
  ): string {
    let prompt = `Eres un asistente de estudio inteligente y útil. Tu objetivo es ayudar a los estudiantes a comprender mejor sus materiales de estudio, responder preguntas académicas y proporcionar explicaciones claras.

Características de tu personalidad:
- Eres paciente y comprensivo
- Explicas conceptos de manera clara y accesible
- Proporcionas ejemplos cuando es útil
- Fomentas el pensamiento crítico
- Respondes en español de manera natural y amigable

Instrucciones:
- Si el estudiante hace una pregunta sobre un tema específico, proporciona una explicación completa pero concisa
- Si necesitas aclaración, haz preguntas de seguimiento
- Sugiere métodos de estudio cuando sea apropiado
- Si hay documentos disponibles, úsalos como contexto para tus respuestas`;

    if (directiveInstruction) {
      prompt += `

SOLICITUD ESPECÍFICA DEL ESTUDIANTE:
${directiveInstruction}`;
    }

    if (documentContext && documentContext.length > 0) {
      prompt += '\n\nCONTEXTO RELEVANTE ENCONTRADO:\n';
      documentContext.forEach((doc, index) => {
        prompt += `\n${index + 1}. Documento: ${doc.title}\n`;
        if (doc.summary) {
          prompt += `   Info: ${doc.summary}\n`;
        }
        prompt += `   Contenido: ${doc.content}\n`;
      });
      prompt += '\n\nIMPORTANTE: Usa SOLO la información del contexto anterior para responder. Si la pregunta no se puede responder con el contexto proporcionado, indica que necesitas más información o que el estudiante suba documentos relevantes.';
    } else {
      prompt += '\n\nNOTA: No hay documentos disponibles. Sugiere al estudiante que suba documentos relevantes para obtener ayuda más específica.';
    }

    return prompt;
  }

  /**
   * Divide el contenido en chunks más pequeños
   */
  private splitIntoChunks(content: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk.length > 0 ? '. ' : '') + sentence;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private detectDocumentDirective(message: string): DocumentDirective | null {
    if (!message) {
      return null;
    }

    const normalized = message
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const summarizeKeywords = ['resumen', 'resume', 'resumir', 'resumelo', 'resumirlo', 'resumelo'];
    const useKeywords = ['usa', 'usar', 'utiliza', 'utilizar', 'basate', 'basate', 'basandote', 'apoyate', 'apoyate', 'considera', 'consulta'];

    let action: DocumentDirective['action'] | null = null;
    if (summarizeKeywords.some(keyword => normalized.includes(keyword))) {
      action = 'summarize';
    } else if (useKeywords.some(keyword => normalized.includes(keyword))) {
      action = 'use';
    }

    if (!action) {
      return null;
    }

    const regexes = [
      /(?:documento|doc|archivo)\s+(?:titulado|llamado|de nombre)?\s*["""']?([^"""'\n]+)["""']?/i,
      /(?:resumen|resume|resumir)\s+(?:de|del|sobre)?\s*["""']?([^"""'\n]+)["""']?/i,
      /["""']([^"""']+)["""']?/i,
      /(?:documento|doc|archivo)\s*:\s*([^\n]+)/i,
    ];

    for (const regex of regexes) {
      const match = message.match(regex);
      if (match && match[1]) {
        let query = match[1]
          .replace(/por favor.*$/i, '')
          .replace(/gracias.*$/i, '')
          .trim();
        
        // Remove common file extensions for better matching
        query = query.replace(/\.(pdf|docx?|txt|pptx?|xlsx?)$/i, '');
        
        if (query) {
          return { action, query };
        }
      }
    }

    return null;
  }

  private async getDirectiveContext(
    strapi: any,
    studentId: string,
    directive: DocumentDirective
  ): Promise<DocumentContext[]> {
    try {
      const documents = await this.studentDocumentsService.findDocumentsByQuery(
        strapi,
        studentId,
        directive.query
      );

      if (!documents || documents.length === 0) {
        return [];
      }

      return documents.map((doc: any) => ({
        documentId: doc.documentId || doc.id?.toString(),
        title: doc.title || 'Documento sin título',
        summary: doc.summary || undefined,
        content: this.buildContextFromChunks(doc.document_chunks || []),
      }));
    } catch (error) {
      console.error('Error fetching directive context:', error);
      return [];
    }
  }

  private buildDirectiveInstruction(
    directive: DocumentDirective,
    contextDocs: DocumentContext[]
  ): string {
    if (contextDocs.length === 0) {
      return `El estudiante solicitó información sobre "${directive.query}" pero no se encontró ningún documento con ese título. Informa al estudiante que no tienes acceso a ese documento y sugiere que verifique el nombre exacto o suba el archivo si aún no lo ha hecho.`;
    }

    const titles = contextDocs.map(doc => `"${doc.title}"`).join(', ');
    const baseInstruction =
      directive.action === 'summarize'
        ? 'El estudiante solicitó un resumen detallado del documento'
        : 'El estudiante pidió que utilices específicamente el documento';

    return `${baseInstruction} ${titles}.
Satisface esta petición de manera prioritaria usando el contenido proporcionado.`;
  }

  private buildContextFromChunks(chunks: any[], maxChars: number = 2000): string {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return 'Contenido del documento no disponible.';
    }

    const orderedChunks = [...chunks].sort(
      (a, b) => (a?.chunk_index || 0) - (b?.chunk_index || 0)
    );

    let combined = '';
    for (const chunk of orderedChunks) {
      const text = (chunk?.content || '').trim();
      if (!text) {
        continue;
      }

      const separator = combined ? '\n\n' : '';
      if (combined.length + separator.length + text.length > maxChars) {
        const remaining = maxChars - combined.length - separator.length;
        if (remaining > 0) {
          combined += separator + text.slice(0, remaining);
        }
        break;
      }

      combined += separator + text;
    }

    return combined || 'Contenido del documento no disponible.';
  }

}

export default OpenAIService;
