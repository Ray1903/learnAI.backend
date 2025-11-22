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
          file: true,
          document_chunks: {
            select: ["id"],
          },
        },
      });

    return (documents || []).map((doc: any) => ({
      id: doc.id,
      documentId: doc.documentId,
      title: doc.file?.name || doc.title || "Documento sin título",
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

    const baseQuery = {
      populate: {
        file: true,
        document_chunks: {
          orderBy: { chunk_index: "asc" },
        },
      },
    } as const;

    const directMatches = (await strapi.db
      .query("api::files-student.files-student")
      .findMany({
        ...baseQuery,
        where: {
          student: studentId,
          title: {
            $containsi: query,
          },
        },
      })) as any[];

    if (directMatches.length) {
      return directMatches;
    }

    const normalizedQuery = this.normalizeText(query);
    const fallbackCandidates = (await strapi.db
      .query("api::files-student.files-student")
      .findMany({
        ...baseQuery,
        where: {
          student: studentId,
        },
        limit: 25,
      })) as any[];

    if (!fallbackCandidates.length) {
      return [];
    }

    const scoredCandidates = fallbackCandidates
      .map(doc => ({
        doc,
        score: this.calculateTitleSimilarity(
          normalizedQuery,
          this.normalizeText(doc.file?.name || doc.title || "")
        ),
      }))
      .filter(candidate => candidate.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .map(candidate => candidate.doc);

    return scoredCandidates;
  }

  private normalizeText(text: string): string {
    return text
      .normalize("NFD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  private calculateTitleSimilarity(query: string, title: string): number {
    if (!query || !title) {
      return 0;
    }

    if (title.includes(query)) {
      const ratio = query.length / Math.max(title.length, 1);
      return Math.min(1, 0.6 + ratio * 0.4);
    }

    const queryTokens = this.splitTokens(query);
    const titleTokens = this.splitTokens(title);

    if (!queryTokens.length || !titleTokens.length) {
      return 0;
    }

    const intersection = queryTokens.filter(token => titleTokens.includes(token)).length;
    const tokenScore = intersection / queryTokens.length;

    const prefixScore = title.startsWith(query) ? 0.5 : 0;

    return Math.min(1, tokenScore + prefixScore);
  }

  private splitTokens(text: string): string[] {
    return text.split(" ").filter(Boolean);
  }
}

export default StudentDocumentsService;
