class StudentDocumentsService {
  async listDocuments(
    strapi: any,
    studentId: string,
    limit: number = 10
  ): Promise<
    {
      id: number | string;
      documentId?: string;
      title: string;
      summary?: string;
      chunksCount: number;
      updatedAt?: string;
    }[]
  > {
    if (!studentId) {
      return [];
    }

    const documents = await strapi.db
      .query("api::files-student.files-student")
      .findMany({
        where: { student: studentId },
        orderBy: { updatedAt: "desc" },
        limit,
        populate: {
          document_chunks: {
            select: ["id"],
          },
        },
      });

    return (documents || []).map((doc: any) => ({
      id: doc.id,
      documentId: doc.documentId,
      title: doc.title || "Documento sin título",
      summary: doc.summary || undefined,
      chunksCount: doc.document_chunks?.length || 0,
      updatedAt: doc.updatedAt,
    }));
  }

  async buildDocumentsOverview(
    strapi: any,
    studentId: string,
    limit: number = 10
  ): Promise<string> {
    const documents = await this.listDocuments(strapi, studentId, limit);

    if (!documents.length) {
      return "";
    }

    return documents
      .map((doc, index) => {
        const updatedLabel = doc.updatedAt
          ? new Date(doc.updatedAt).toLocaleDateString("es-MX", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Sin fecha";

        const summarySnippet = doc.summary
          ? doc.summary.length > 200
            ? `${doc.summary.slice(0, 200)}…`
            : doc.summary
          : "Sin resumen";

        return `${index + 1}. ${doc.title} (chunks: ${doc.chunksCount}, actualizado: ${updatedLabel})\n   Resumen: ${summarySnippet}`;
      })
      .join("\n");
  }

  async findDocumentsByQuery(
    strapi: any,
    studentId: string,
    query: string
  ): Promise<any[]> {
    if (!studentId || !query) {
      return [];
    }

    return (
      await strapi.db.query("api::files-student.files-student").findMany({
        where: {
          student: studentId,
          title: {
            $containsi: query,
          },
        },
        populate: {
          document_chunks: {
            orderBy: { chunk_index: "asc" },
          },
        },
      })
    ) as any[];
  }
}

export default StudentDocumentsService;
