/**
 * Zilliz Cloud REST API client for Cloudflare Workers.
 * Uses the RESTful API (no Node.js SDK needed).
 * Docs: https://docs.zilliz.com/reference/restful
 */

export interface VectorRecord {
  id: string;
  content: string;
  embedding: number[];
  category: string;
  title: string;
  source: string;
}

export interface SearchResult {
  id: string;
  content: string;
  category: string;
  title: string;
  source: string;
  score: number;
}

const COLLECTION_NAME = 'tripzi_knowledge';

export class ZillizClient {
  private endpoint: string;
  private apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    // Ensure endpoint doesn't have trailing slash
    this.endpoint = endpoint.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request(path: string, body: Record<string, unknown>): Promise<any> {
    const url = `${this.endpoint}/v2/vectordb${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as any;

    if (data.code !== 0 && data.code !== 200) {
      throw new Error(`Zilliz API error: ${data.message || JSON.stringify(data)}`);
    }

    return data;
  }

  /**
   * Check if the knowledge collection exists.
   */
  async hasCollection(): Promise<boolean> {
    try {
      const data = await this.request('/collections/has', {
        collectionName: COLLECTION_NAME,
      });
      return data.data?.has === true;
    } catch {
      return false;
    }
  }

  /**
   * Create the tripzi_knowledge collection with the required schema.
   * Dimension 768 matches Workers AI bge-base-en-v1.5 output.
   */
  async createCollection(): Promise<void> {
    await this.request('/collections/create', {
      collectionName: COLLECTION_NAME,
      schema: {
        fields: [
          {
            fieldName: 'id',
            dataType: 'VarChar',
            isPrimary: true,
            elementTypeParams: { max_length: 128 },
          },
          {
            fieldName: 'content',
            dataType: 'VarChar',
            elementTypeParams: { max_length: 8192 },
          },
          {
            fieldName: 'embedding',
            dataType: 'FloatVector',
            elementTypeParams: { dim: 768 },
          },
          {
            fieldName: 'category',
            dataType: 'VarChar',
            elementTypeParams: { max_length: 64 },
          },
          {
            fieldName: 'title',
            dataType: 'VarChar',
            elementTypeParams: { max_length: 512 },
          },
          {
            fieldName: 'source',
            dataType: 'VarChar',
            elementTypeParams: { max_length: 256 },
          },
        ],
      },
      indexParams: [
        {
          fieldName: 'embedding',
          indexName: 'embedding_index',
          metricType: 'COSINE',
          indexType: 'AUTOINDEX',
        },
      ],
    });
  }

  /**
   * Insert vectors into the knowledge base collection.
   */
  async insert(records: VectorRecord[]): Promise<{ insertCount: number }> {
    const data = await this.request('/entities/insert', {
      collectionName: COLLECTION_NAME,
      data: records.map((r) => ({
        id: r.id,
        content: r.content,
        embedding: r.embedding,
        category: r.category,
        title: r.title,
        source: r.source,
      })),
    });

    return { insertCount: data.data?.insertCount || records.length };
  }

  /**
   * Search for similar vectors in the knowledge base.
   * Returns top-K results ranked by cosine similarity.
   */
  async search(
    embedding: number[],
    topK: number = 5,
    filter?: string
  ): Promise<SearchResult[]> {
    const body: Record<string, unknown> = {
      collectionName: COLLECTION_NAME,
      data: [embedding],
      annsField: 'embedding',
      limit: topK,
      outputFields: ['id', 'content', 'category', 'title', 'source'],
    };

    if (filter) {
      body.filter = filter;
    }

    const data = await this.request('/entities/search', body);

    const results = data.data?.[0] || [];
    return results.map((item: any) => ({
      id: item.id || item.entity?.id || '',
      content: item.content || item.entity?.content || '',
      category: item.category || item.entity?.category || '',
      title: item.title || item.entity?.title || '',
      source: item.source || item.entity?.source || '',
      score: item.distance ?? item.score ?? 0,
    }));
  }

  /**
   * Delete vectors by IDs.
   */
  async deleteByIds(ids: string[]): Promise<void> {
    await this.request('/entities/delete', {
      collectionName: COLLECTION_NAME,
      filter: `id in [${ids.map((id) => `"${id}"`).join(', ')}]`,
    });
  }

  /**
   * Get collection statistics.
   */
  async getStats(): Promise<{ rowCount: number }> {
    const data = await this.request('/collections/get_stats', {
      collectionName: COLLECTION_NAME,
    });

    return { rowCount: data.data?.rowCount || 0 };
  }
}
