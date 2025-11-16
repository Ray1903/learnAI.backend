/**
 * files-student controller
 */

import { factories } from '@strapi/strapi';
import DocumentProcessorService from '../../../services/document-processor';
import OpenAIService from '../../../services/openai';
import EmbeddingsService from '../../../services/embeddings';

export default factories.createCoreController(
  'api::files-student.files-student',
  ({ strapi }) => ({
    async create(ctx) {
      try {
        const { title, student } = ctx.request.body;
        const files = ctx.request.files;

        if (!files || !files.file) {
          return ctx.badRequest('No se ha subido ningún archivo');
        }

        if (!student) {
          return ctx.badRequest('Falta el ID del estudiante');
        }

        const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
        
        // Validar tipo de archivo
        const documentProcessor = new DocumentProcessorService();
        const fileName = uploadedFile.originalFilename || 'archivo';
        if (!documentProcessor.isFileTypeSupported(fileName)) {
          return ctx.badRequest(
            `Tipo de archivo no soportado. Tipos permitidos: ${documentProcessor.getSupportedFileTypes().join(', ')}`
          );
        }

        // Subir archivo a Strapi
        const uploadService = strapi.plugins.upload.services.upload;
        const uploadedFiles = await uploadService.upload({
          data: {},
          files: uploadedFile,
        });

        const strapiFile = uploadedFiles[0];

        // Procesar el documento para extraer texto
        let processedDocument;
        
        // Construir la ruta física del archivo
        const path = require('path');
        const filePath = path.join(process.cwd(), 'public', strapiFile.url);
        
        try {
          console.log('Attempting to process file at:', filePath);
          console.log('File exists?', require('fs').existsSync(filePath));
          
          processedDocument = await documentProcessor.processUploadedFile({
            path: filePath,
            name: strapiFile.name || fileName,
          });
          
          console.log('Document processed successfully. Chunks:', processedDocument.chunks.length);
        } catch (processingError) {
          console.error('Error processing document:', processingError);
          console.error('File path attempted:', filePath);
          // Continuar sin procesamiento si falla
          processedDocument = {
            title: title || strapiFile.name || fileName,
            content: '',
            chunks: [],
          };
        }

        // Generar resumen usando OpenAI si hay contenido
        let summary = '';
        if (processedDocument.content.trim()) {
          try {
            const openaiService = new OpenAIService();
            const result = await openaiService.processDocument(
              processedDocument.content,
              processedDocument.title
            );
            summary = result.summary;
          } catch (aiError) {
            console.error('Error generating summary:', aiError);
            summary = 'Resumen no disponible';
          }
        }

        // Crear el documento del estudiante
        const documentStudent = await strapi
          .documents('api::files-student.files-student')
          .create({
            data: {
              title: title || processedDocument.title,
              file: strapiFile.id,
              summary: summary,
              student: student,
              publishedAt: new Date(),
            },
          });

        // Crear chunks del documento si existen
        console.log('Document created:', documentStudent);
        console.log('Chunks to create:', processedDocument.chunks.length);
        
        if (processedDocument.chunks.length > 0) {
          for (let i = 0; i < processedDocument.chunks.length; i++) {
            const chunkData: any = {
              content: processedDocument.chunks[i],
              chunk_index: i + 1,
              document_id: documentStudent.id.toString(),  // Usar id convertido a string para la relación
              publishedAt: new Date(),
            };

            // Agregar embedding si está disponible
            if (processedDocument.embeddings && processedDocument.embeddings[i]) {
              // Convertir el array de números a string de vector para pgvector
              const embeddingArray = processedDocument.embeddings[i];
              chunkData.embedding = `[${embeddingArray.join(',')}]`;
              chunkData.embedding_model = 'text-embedding-3-small';
            }

            console.log(`Creating chunk ${i + 1}:`, chunkData);
            
            const createdChunk = await strapi
              .documents('api::document-chunk.document-chunk')
              .create({
                data: chunkData,
              });
              
            console.log(`Chunk ${i + 1} created with ID:`, createdChunk.id);
          }
        }

        return ctx.send({
          message: 'Documento subido y procesado correctamente',
          data: {
            id: documentStudent.id,
            documentId: documentStudent.documentId,
            title: documentStudent.title,
            summary: documentStudent.summary,
            file: {
              id: strapiFile.id,
              name: strapiFile.name,
              url: strapiFile.url,
              size: strapiFile.size,
            },
            chunksCount: processedDocument.chunks.length,
          },
        });
      } catch (error) {
        console.error('Error uploading document:', error);
        return ctx.internalServerError('Error al subir el documento');
      }
    },

    async findByStudent(ctx) {
      try {
        const { studentId } = ctx.params;

        if (!studentId) {
          return ctx.badRequest('Falta el ID del estudiante');
        }

        const documents = await strapi.db
          .query('api::files-student.files-student')
          .findMany({
            where: { student: studentId },
            populate: {
              file: true,
              document_chunks: {
                orderBy: { chunk_index: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

        const formattedDocuments = documents.map(doc => ({
          id: doc.id,
          documentId: doc.documentId,
          title: doc.title,
          summary: doc.summary,
          createdAt: doc.createdAt,
          file: doc.file ? {
            id: doc.file.id,
            name: doc.file.name,
            url: doc.file.url,
            size: doc.file.size,
            mime: doc.file.mime,
          } : null,
          chunksCount: doc.document_chunks?.length || 0,
        }));

        return ctx.send({
          message: 'Documentos obtenidos correctamente',
          data: formattedDocuments,
        });
      } catch (error) {
        console.error('Error fetching student documents:', error);
        return ctx.internalServerError('Error al obtener los documentos');
      }
    },

    async getDocumentContent(ctx) {
      try {
        const { documentId } = ctx.params;

        if (!documentId) {
          return ctx.badRequest('Falta el ID del documento');
        }

        const document = await strapi.db
          .query('api::files-student.files-student')
          .findOne({
            where: { documentId },
            populate: {
              file: true,
              document_chunks: {
                orderBy: { chunk_index: 'asc' },
              },
            },
          });

        if (!document) {
          return ctx.notFound('Documento no encontrado');
        }

        const fullContent = document.document_chunks
          ?.map(chunk => chunk.content)
          .join('\n\n') || '';

        return ctx.send({
          message: 'Contenido del documento obtenido correctamente',
          data: {
            id: document.id,
            documentId: document.documentId,
            title: document.title,
            summary: document.summary,
            content: fullContent,
            chunks: document.document_chunks?.map(chunk => ({
              index: chunk.chunk_index,
              content: chunk.content,
            })) || [],
            file: document.file ? {
              id: document.file.id,
              name: document.file.name,
              url: document.file.url,
            } : null,
          },
        });
      } catch (error) {
        console.error('Error fetching document content:', error);
        return ctx.internalServerError('Error al obtener el contenido del documento');
      }
    },

    async delete(ctx) {
      try {
        const { documentId } = ctx.params;

        if (!documentId) {
          return ctx.badRequest('Falta el ID del documento');
        }

        // Buscar el documento
        const document = await strapi.db
          .query('api::files-student.files-student')
          .findOne({
            where: { documentId },
            populate: {
              file: true,
              document_chunks: true,
            },
          });

        if (!document) {
          return ctx.notFound('Documento no encontrado');
        }

        // Eliminar chunks del documento
        if (document.document_chunks && document.document_chunks.length > 0) {
          for (const chunk of document.document_chunks) {
            await strapi
              .documents('api::document-chunk.document-chunk')
              .delete({ documentId: chunk.documentId });
          }
        }

        // Eliminar archivo de Strapi si existe
        if (document.file) {
          try {
            await strapi.plugins.upload.services.upload.remove(document.file);
          } catch (fileError) {
            console.error('Error deleting file:', fileError);
          }
        }

        // Eliminar el documento
        await strapi
          .documents('api::files-student.files-student')
          .delete({ documentId });

        return ctx.send({
          message: 'Documento eliminado correctamente',
        });
      } catch (error) {
        console.error('Error deleting document:', error);
        return ctx.internalServerError('Error al eliminar el documento');
      }
    },

    async generateEmbeddings(ctx) {
      try {
        const { documentId } = ctx.params;

        if (!documentId) {
          return ctx.badRequest('Falta el ID del documento');
        }

        const documentProcessor = new DocumentProcessorService();
        await documentProcessor.generateEmbeddingsForDocument(strapi, documentId);

        return ctx.send({
          message: 'Embeddings generados correctamente para el documento',
        });
      } catch (error) {
        console.error('Error generating embeddings:', error);
        return ctx.internalServerError('Error al generar embeddings');
      }
    },

    async searchSimilar(ctx) {
      try {
        const { query, studentId, limit = 5, threshold = 0.7 } = ctx.request.body;

        if (!query) {
          return ctx.badRequest('Falta el texto de búsqueda');
        }

        const embeddingsService = new EmbeddingsService();
        const similarChunks = await embeddingsService.findSimilarChunksWithPgVector(
          strapi,
          query,
          studentId,
          parseInt(limit),
          parseFloat(threshold)
        );

        return ctx.send({
          message: 'Búsqueda semántica completada',
          data: {
            query: query,
            results: similarChunks,
            count: similarChunks.length,
          },
        });
      } catch (error) {
        console.error('Error in semantic search:', error);
        return ctx.internalServerError('Error en la búsqueda semántica');
      }
    },

    async getEmbeddingStats(ctx) {
      try {
        const documentProcessor = new DocumentProcessorService();
        const stats = await documentProcessor.getEmbeddingStats(strapi);

        return ctx.send({
          message: 'Estadísticas de embeddings obtenidas',
          data: stats,
        });
      } catch (error) {
        console.error('Error getting embedding stats:', error);
        return ctx.internalServerError('Error al obtener estadísticas');
      }
    },

    async regenerateAllEmbeddings(ctx) {
      try {
        const embeddingsService = new EmbeddingsService();
        await embeddingsService.regenerateAllEmbeddings(strapi);

        return ctx.send({
          message: 'Todos los embeddings han sido regenerados correctamente',
        });
      } catch (error) {
        console.error('Error regenerating embeddings:', error);
        return ctx.internalServerError('Error al regenerar embeddings');
      }
    },
  })
);
