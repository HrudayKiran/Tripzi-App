/**
 * Knowledge Base Management Routes
 *
 * POST /ai/kb/ingest  — Ingest seed data into Zilliz Cloud
 * GET  /ai/kb/stats   — Get collection statistics
 * POST /ai/kb/search  — Test search (dev/debug)
 */

import { Hono } from 'hono';
import { Env } from '../lib/supabase';
import { requireAdmin } from '../middleware/auth';
import { ZillizClient } from '../lib/zilliz';
import { generateEmbedding } from '../lib/rag';
import { KNOWLEDGE_BASE } from '../data/knowledge-base';

const kb = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

/**
 * POST /ai/kb/ingest
 * Ingests the seed knowledge base into Zilliz Cloud.
 * Chunks text → generates embeddings via Workers AI → stores in Zilliz.
 */
kb.post('/ingest', requireAdmin, async (c) => {
  try {
    const zilliz = new ZillizClient(c.env.ZILLIZ_ENDPOINT, c.env.ZILLIZ_API_KEY);

    // Create collection if it doesn't exist
    const exists = await zilliz.hasCollection();
    if (!exists) {
      await zilliz.createCollection();
    }

    // Process in batches of 5 to stay within Workers AI rate limits
    const BATCH_SIZE = 5;
    let totalInserted = 0;

    for (let i = 0; i < KNOWLEDGE_BASE.length; i += BATCH_SIZE) {
      const batch = KNOWLEDGE_BASE.slice(i, i + BATCH_SIZE);

      // Generate embeddings for this batch
      const records = await Promise.all(
        batch.map(async (chunk) => {
          const embedding = await generateEmbedding(chunk.content, c.env.AI);
          return {
            id: chunk.id,
            content: chunk.content,
            embedding,
            category: chunk.category,
            title: chunk.title,
            source: chunk.source,
          };
        })
      );

      // Insert into Zilliz
      const result = await zilliz.insert(records);
      totalInserted += result.insertCount;
    }

    return c.json({
      success: true,
      message: `Ingested ${totalInserted} knowledge chunks into Zilliz Cloud.`,
      totalChunks: KNOWLEDGE_BASE.length,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Ingestion failed.' }, 500);
  }
});

/**
 * GET /ai/kb/stats
 * Returns collection statistics.
 */
kb.get('/stats', async (c) => {
  try {
    const zilliz = new ZillizClient(c.env.ZILLIZ_ENDPOINT, c.env.ZILLIZ_API_KEY);
    const exists = await zilliz.hasCollection();

    if (!exists) {
      return c.json({ exists: false, rowCount: 0 });
    }

    const stats = await zilliz.getStats();
    return c.json({ exists: true, ...stats });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /ai/kb/search
 * Test endpoint to search the knowledge base.
 * Body: { query: string, topK?: number }
 */
kb.post('/search', async (c) => {
  try {
    const body = await c.req.json<{ query?: string; topK?: number }>();
    const query = typeof body.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return c.json({ error: 'Query is required.' }, 400);
    }

    const embedding = await generateEmbedding(query, c.env.AI);
    const zilliz = new ZillizClient(c.env.ZILLIZ_ENDPOINT, c.env.ZILLIZ_API_KEY);
    const results = await zilliz.search(embedding, body.topK || 5);

    return c.json({ query, results });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default kb;
