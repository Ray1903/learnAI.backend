import OpenAI from 'openai';
import EmbeddingsService from './embeddings';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DocumentContext {
  title: string;
  content: string;
  summary?: string;
}

class OpenAIService {
  private client: OpenAI;
  private embeddingsService: EmbeddingsService;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.embeddingsService = new EmbeddingsService();
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
      let relevantContext: DocumentContext[] = [];

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
          relevantContext = similarChunks.map(chunk => ({
            title: chunk.documentTitle,
            content: chunk.content,
            summary: `Chunk ${chunk.chunkIndex} (Similitud: ${(chunk.similarity * 100).toFixed(1)}%)`
          }));
        } catch (searchError) {
          console.error('Error in semantic search, using fallback:', searchError);
          // Usar contexto proporcionado como fallback
          relevantContext = documentContext || [];
        }
      } else {
        // Usar contexto proporcionado si no hay búsqueda semántica
        relevantContext = documentContext || [];
      }

      const systemPrompt = this.buildSystemPrompt(relevantContext);
      
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
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
        model: 'gpt-4o-mini',
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
        model: 'gpt-4o-mini',
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
  private buildSystemPrompt(documentContext?: DocumentContext[]): string {
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
}

export default OpenAIService;
