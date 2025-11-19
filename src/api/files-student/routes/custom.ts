export default {
  routes: [
    {
      method: "POST",
      path: "/documents/upload",
      handler: "files-student.create",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/documents/student/:studentId",
      handler: "files-student.findByStudent",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/documents/:documentId/content",
      handler: "files-student.getDocumentContent",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "DELETE",
      path: "/documents/:documentId",
      handler: "files-student.delete",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/documents/:documentId/embeddings",
      handler: "files-student.generateEmbeddings",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/documents/search",
      handler: "files-student.searchSimilar",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/documents/embeddings/stats",
      handler: "files-student.getEmbeddingStats",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/documents/embeddings/regenerate",
      handler: "files-student.regenerateAllEmbeddings",
      config: {
        policies: ["global::token-jwt"],
        auth: false,
      },
    },
  ],
};
