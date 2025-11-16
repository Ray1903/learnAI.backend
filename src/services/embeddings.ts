import OpenAI from "openai";

interface EmbeddingResult {
  embedding: number[];
  model: string;
}

interface SimilarChunk {
  id: string;
  content: string;
  similarity: number;
  documentTitle: string;
  chunkIndex: number;
}

class EmbeddingsService {
  private client: OpenAI;
  private model: string = "text-embedding-3-small";

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Genera embeddings para un texto usando OpenAI
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: "float",
      });

      return {
        embedding: response.data[0].embedding,
        model: this.model,
      };
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Error al generar embedding");
    }
  }

  /**
   * Genera embeddings para múltiples textos
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
        encoding_format: "float",
      });

      return response.data.map((item) => ({
        embedding: item.embedding,
        model: this.model,
      }));
    } catch (error) {
      console.error("Error generating batch embeddings:", error);
      throw new Error("Error al generar embeddings en lote");
    }
  }

  /**
   * Calcula la similitud coseno entre dos vectores
   */
  calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error("Los vectores deben tener la misma dimensión");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Busca chunks similares usando embeddings
   */
  async findSimilarChunks(
    strapi: any,
    queryText: string,
    studentId?: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<SimilarChunk[]> {
    try {
      // Generar embedding para la consulta
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Construir filtros
      let whereClause = {};
      if (studentId) {
        whereClause = {
          document_student: {
            student: studentId,
          },
        };
      }

      // Obtener todos los chunks con embeddings
      const chunks = await strapi.db
        .query("api::document-chunk.document-chunk")
        .findMany({
          where: {
            ...whereClause,
            embedding: {
              $ne: null,
            },
          },
          populate: {
            document_student: {
              populate: {
                student: true,
              },
            },
          },
        });

      // Calcular similitudes
      const similarities: SimilarChunk[] = [];

      for (const chunk of chunks) {
        if (chunk.embedding && Array.isArray(chunk.embedding)) {
          const similarity = this.calculateCosineSimilarity(
            queryEmbedding.embedding,
            chunk.embedding
          );

          if (similarity >= threshold) {
            similarities.push({
              id: chunk.documentId,
              content: chunk.content,
              similarity: similarity,
              documentTitle: chunk.document_student?.title || "Sin título",
              chunkIndex: chunk.chunk_index,
            });
          }
        }
      }

      // Ordenar por similitud descendente y limitar resultados
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error("Error finding similar chunks:", error);
      throw new Error("Error en la búsqueda semántica");
    }
  }

  /**
   * Busca chunks similares usando SQL nativo con pgvector (más eficiente)
   */
  async findSimilarChunksWithPgVector(
    strapi: any,
    queryText: string,
    studentId?: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<SimilarChunk[]> {
    try {
      // Generar embedding para la consulta
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Convertir el embedding a formato de array de PostgreSQL
      const embeddingArray = `[${queryEmbedding.embedding.join(",")}]`;

      // Construir la consulta SQL con interpolación directa (más compatible)
      const sql = `
        SELECT 
          dc.id as document_id,
          dc.content,
          dc.chunk_index,
          fs.title as document_title,
          (dc.embedding::vector <=> '${embeddingArray}'::vector) as distance,
          (1 - (dc.embedding::vector <=> '${embeddingArray}'::vector)) as similarity
        FROM document_chunks dc
        JOIN files_students fs ON dc.document_id = fs.id::text
        WHERE dc.embedding IS NOT NULL
        AND (1 - (dc.embedding::vector <=> '${embeddingArray}'::vector)) >= ${threshold}
        ORDER BY dc.embedding::vector <=> '${embeddingArray}'::vector
        LIMIT ${limit}
      `;

      // Ejecutar la consulta sin parámetros (interpolación directa)
      console.log("Executing pgvector query:", sql.substring(0, 200) + "...");
      const results = await strapi.db.connection.raw(sql);
      
      console.log(`Found ${results.rows.length} results from pgvector`);
      if (results.rows.length > 0) {
        console.log("First result similarity:", results.rows[0].similarity);
        console.log("Last result similarity:", results.rows[results.rows.length - 1].similarity);
      }

      return results.rows.map((row: any) => ({
        id: row.document_id,
        content: row.content,
        similarity: parseFloat(row.similarity),
        documentTitle: row.document_title || "Sin título",
        chunkIndex: row.chunk_index,
      }));
    } catch (error) {
      console.error("Error with pgvector search:", error);
      console.log("Falling back to JavaScript similarity search...");
      console.log("Error details:", error.message, error.stack);
      // Fallback a búsqueda JavaScript si falla pgvector
      return this.findSimilarChunks(
        strapi,
        queryText,
        studentId,
        limit,
        threshold
      );
    }
  }

  /**
   * Procesa un documento y genera embeddings para todos sus chunks
   */
  async processDocumentEmbeddings(
    strapi: any,
    documentId: string
  ): Promise<void> {
    try {
      // Obtener todos los chunks del documento
      const chunks = await strapi.db
        .query("api::document-chunk.document-chunk")
        .findMany({
          where: {
            document_student: documentId,
          },
          orderBy: { chunk_index: "asc" },
        });

      if (chunks.length === 0) {
        console.log("No chunks found for document:", documentId);
        return;
      }

      // Extraer contenido de los chunks
      const contents = chunks.map((chunk) => chunk.content);

      // Generar embeddings en lote
      const embeddings = await this.generateBatchEmbeddings(contents);

      // Actualizar cada chunk con su embedding
      for (let i = 0; i < chunks.length; i++) {
        await strapi.documents("api::document-chunk.document-chunk").update({
          documentId: chunks[i].documentId,
          data: {
            embedding: embeddings[i].embedding,
            embedding_model: embeddings[i].model,
          },
        });
      }

      console.log(
        `Processed embeddings for ${chunks.length} chunks in document ${documentId}`
      );
    } catch (error) {
      console.error("Error processing document embeddings:", error);
      throw new Error("Error al procesar embeddings del documento");
    }
  }

  /**
   * Regenera embeddings para todos los documentos existentes
   */
  async regenerateAllEmbeddings(strapi: any): Promise<void> {
    try {
      // Obtener todos los documentos
      const documents = await strapi.db
        .query("api::files-student.files-student")
        .findMany({
          populate: {
            document_chunks: true,
          },
        });

      console.log(`Found ${documents.length} documents to process`);

      for (const doc of documents) {
        if (doc.document_chunks && doc.document_chunks.length > 0) {
          console.log(`Processing document: ${doc.title}`);
          await this.processDocumentEmbeddings(strapi, doc.documentId);
        }
      }

      console.log("Finished regenerating all embeddings");
    } catch (error) {
      console.error("Error regenerating embeddings:", error);
      throw new Error("Error al regenerar embeddings");
    }
  }

  /**
   * Obtiene estadísticas de embeddings
   */
  async getEmbeddingStats(strapi: any): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    embeddingCoverage: number;
  }> {
    try {
      const totalChunks = await strapi.db
        .query("api::document-chunk.document-chunk")
        .count();

      const chunksWithEmbeddings = await strapi.db
        .query("api::document-chunk.document-chunk")
        .count({
          where: {
            embedding: {
              $ne: null,
            },
          },
        });

      const coverage =
        totalChunks > 0 ? (chunksWithEmbeddings / totalChunks) * 100 : 0;

      return {
        totalChunks,
        chunksWithEmbeddings,
        embeddingCoverage: Math.round(coverage * 100) / 100,
      };
    } catch (error) {
      console.error("Error getting embedding stats:", error);
      return {
        totalChunks: 0,
        chunksWithEmbeddings: 0,
        embeddingCoverage: 0,
      };
    }
  }
}

export default EmbeddingsService;
