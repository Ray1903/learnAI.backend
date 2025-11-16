export default {
  routes: [
    {
      method: "POST",
      path: "/chat",
      handler: "chat-session.create",
    },
    {
      method: "GET",
      path: "/chat/:documentId",
      handler: "chat-session.getChatSession",
    },
    {
      method: "POST",
      path: "/chat/message",
      handler: "chat-session.sendMessage",
    },
    {
      method: "GET",
      path: "/chat/:sessionId/study-questions",
      handler: "chat-session.generateStudyQuestions",
    },
  ],
};
