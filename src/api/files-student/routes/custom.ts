export default {
  routes: [
    {
      method: "POST",
      path: "/documents/upload",
      handler: "files-student.create",
    },
    {
      method: "GET",
      path: "/documents/student/:studentId",
      handler: "files-student.findByStudent",
    },
    {
      method: "GET",
      path: "/documents/:documentId/content",
      handler: "files-student.getDocumentContent",
    },
    {
      method: "DELETE",
      path: "/documents/:documentId",
      handler: "files-student.delete",
    },
    {
      method: "POST",
      path: "/documents/:documentId/embeddings",
      handler: "files-student.generateEmbeddings",
    },
    {
      method: "POST",
      path: "/documents/search",
      handler: "files-student.searchSimilar",
    },
    {
      method: "GET",
      path: "/documents/embeddings/stats",
      handler: "files-student.getEmbeddingStats",
    },
    {
      method: "POST",
      path: "/documents/embeddings/regenerate",
      handler: "files-student.regenerateAllEmbeddings",
    },
  ],
};
