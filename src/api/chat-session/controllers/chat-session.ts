/**
 * chat-session controller
 */

import { factories } from "@strapi/strapi";
import OpenAIService from "../../../services/openai";

export default factories.createCoreController(
  "api::chat-session.chat-session",
  ({ strapi }) => ({
    async create(ctx) {
      try {
        const { title, student } = ctx.request.body;

        if (!title || !student) {
          return ctx.badRequest(
            "Faltan campos obligatorios: title o studentDocumentId"
          );
        }

        const session = await strapi
          .documents("api::chat-session.chat-session")
          .create({
            data: {
              title: title,
              student: student,
            },
          });

        ctx.status = 201;
        return ctx.send({
          message: "Sesión creada correctamente",
          data: session,
        });
      } catch (error) {
        strapi.log.error("Error creando chat-session:", error);
        return ctx.internalServerError("No se pudo crear la sesión de chat");
      }
    },

    async getChatSession(ctx) {
      try {
        const { documentId } = ctx.params;

        if (!documentId)
          return ctx.badRequest("Faltan campos obligatorios: id");

        const session = await strapi.db
          .query("api::chat-session.chat-session")
          .findOne({
            where: { documentId },
            populate: {
              chat_messages: {
                orderBy: { createdAt: "asc" },
              },
            },
          });

        let conversation = {
          title: session.title,
          sessionDocumentId: session.DocumentId,
          studentDocumentId: session.student,
          messages: [],
        };

        for (const message of session.chat_messages) {
          conversation.messages.push({
            id: message.message_index,
            role: message.role,
            content: message.content,
            metadata: message.metadata,
          });
        }

        return ctx.send(conversation);
      } catch (error) {
        strapi.log.error("Error obteniendo chat-session:", error);
        return ctx.internalServerError("No se pudo obtener la sesión de chat");
      }
    },

    async sendMessage(ctx) {
      try {
        const { sessionId, message, role = "user" } = ctx.request.body;

        if (!sessionId || !message) {
          return ctx.badRequest("Faltan campos obligatorios: sessionId o message");
        }

        // Obtener la sesión y sus mensajes
        const session = await strapi.db
          .query("api::chat-session.chat-session")
          .findOne({
            where: { documentId: sessionId },
            populate: {
              chat_messages: {
                orderBy: { createdAt: "asc" },
              },
            },
          });

        if (!session) {
          return ctx.notFound("Sesión de chat no encontrada");
        }

        // Obtener el siguiente índice de mensaje
        const nextMessageIndex = session.chat_messages.length + 1;

        // Guardar el mensaje del usuario
        const userMessage = await strapi
          .documents("api::chat-message.chat-message")
          .create({
            data: {
              role: role,
              message_index: nextMessageIndex,
              content: message,
              chat_session: session.documentId,
              agent_name: role === "user" ? "student" : "assistant",
              publishedAt: new Date(),
            },
          });

        // Si es un mensaje del usuario, generar respuesta del asistente
        if (role === "user") {
          try {
            // Obtener el ID del estudiante desde la sesión
            const sessionWithStudent = await strapi.db
              .query("api::chat-session.chat-session")
              .findOne({
                where: { documentId: sessionId },
                populate: {
                  student: true,
                },
              });

            const studentDocumentId = sessionWithStudent?.student;

            // Preparar historial de mensajes para OpenAI
            const chatHistory = session.chat_messages
              .concat([userMessage])
              .map((msg) => ({
                role: msg.role === "user" ? "user" : "assistant",
                content: msg.content,
              }));

            // Generar respuesta del asistente usando búsqueda semántica
            const openaiService = new OpenAIService();
            const assistantResponse = await openaiService.generateStudioAssistantResponse(
              chatHistory,
              strapi,
              studentDocumentId
            );

            // Guardar respuesta del asistente
            const assistantMessage = await strapi
              .documents("api::chat-message.chat-message")
              .create({
                data: {
                  role: "assistant",
                  message_index: nextMessageIndex + 1,
                  content: assistantResponse,
                  chat_session: session.documentId,
                  agent_name: "studio_assistant",
                  publishedAt: new Date(),
                },
              });

            return ctx.send({
              message: "Mensaje enviado correctamente",
              userMessage: {
                id: userMessage.message_index,
                role: userMessage.role,
                content: userMessage.content,
              },
              assistantMessage: {
                id: assistantMessage.message_index,
                role: assistantMessage.role,
                content: assistantMessage.content,
              },
            });
          } catch (aiError) {
            strapi.log.error("Error generando respuesta del asistente:", aiError);
            
            // Respuesta de fallback si falla la IA
            const fallbackMessage = await strapi
              .documents("api::chat-message.chat-message")
              .create({
                data: {
                  role: "assistant",
                  message_index: nextMessageIndex + 1,
                  content: "Lo siento, estoy experimentando dificultades técnicas. Por favor, intenta de nuevo en unos momentos.",
                  chat_session: session.documentId,
                  agent_name: "studio_assistant",
                  publishedAt: new Date(),
                },
              });

            return ctx.send({
              message: "Mensaje enviado con respuesta de fallback",
              userMessage: {
                id: userMessage.message_index,
                role: userMessage.role,
                content: userMessage.content,
              },
              assistantMessage: {
                id: fallbackMessage.message_index,
                role: fallbackMessage.role,
                content: fallbackMessage.content,
              },
            });
          }
        } else {
          // Si es un mensaje del asistente, solo guardarlo
          return ctx.send({
            message: "Mensaje del asistente guardado correctamente",
            assistantMessage: {
              id: userMessage.message_index,
              role: userMessage.role,
              content: userMessage.content,
            },
          });
        }
      } catch (error) {
        strapi.log.error("Error enviando mensaje:", error);
        return ctx.internalServerError("No se pudo enviar el mensaje");
      }
    },

    async generateStudyQuestions(ctx) {
      try {
        const { sessionId } = ctx.params;

        if (!sessionId) {
          return ctx.badRequest("Falta el ID de la sesión");
        }

        // Obtener documentos del estudiante
        const studentDocuments = await strapi.db
          .query("api::files-student.files-student")
          .findMany({
            populate: {
              document_chunks: true,
            },
          });

        if (!studentDocuments || studentDocuments.length === 0) {
          return ctx.badRequest("No hay documentos disponibles para generar preguntas");
        }

        const openaiService = new OpenAIService();
        const allQuestions = [];

        // Generar preguntas para cada documento
        for (const doc of studentDocuments) {
          const content = doc.document_chunks
            ?.map((chunk) => chunk.content)
            .join(" ") || "";
          
          if (content.trim()) {
            const questions = await openaiService.generateStudyQuestions(
              content,
              doc.title || "Documento sin título"
            );
            
            allQuestions.push({
              documentTitle: doc.title,
              questions: questions,
            });
          }
        }

        return ctx.send({
          message: "Preguntas de estudio generadas correctamente",
          studyQuestions: allQuestions,
        });
      } catch (error) {
        strapi.log.error("Error generando preguntas de estudio:", error);
        return ctx.internalServerError("No se pudieron generar las preguntas de estudio");
      }
    },
  })
);
