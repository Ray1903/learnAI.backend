export default {
  routes: [
    {
      method: "POST",
      path: "/chat",
      handler: "chat-session.create",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/chat",
      handler: "chat-session.listByUser",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/chat/:documentId",
      handler: "chat-session.getChatSession",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/chat/message",
      handler: "chat-session.sendMessage",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/chat/:sessionId/study-questions",
      handler: "chat-session.generateStudyQuestions",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
  ],
};
