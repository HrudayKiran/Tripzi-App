/**
 * AI Routes — Trip Planning + Conversation Management
 *
 * Trip Planning (with RAG):
 *   POST /ai/plan                         — Stateless chat (backward compatible)
 *
 * Conversations (persisted to D1):
 *   GET    /ai/conversations              — List user's conversations
 *   POST   /ai/conversations              — Create new conversation
 *   GET    /ai/conversations/:id          — Get conversation details
 *   PUT    /ai/conversations/:id          — Rename conversation
 *   DELETE /ai/conversations/:id          — Delete conversation
 *   GET    /ai/conversations/:id/messages — Get messages
 *   POST   /ai/conversations/:id/messages — Send message (with RAG)
 *
 * Images:
 *   POST /ai/images                       — Fetch place images from Unsplash
 */

import { Hono } from 'hono';
import { Env } from '../lib/supabase';
import { ragChat } from '../lib/rag';

const ai = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// ─── Helpers ─────────────────────────────────────────────────────────

const ALLOWED_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function validateModel(model?: string): string {
  if (typeof model === 'string' && ALLOWED_MODELS.includes(model)) {
    return model;
  }
  return 'llama-3.3-70b-versatile';
}

type Role = 'system' | 'assistant' | 'user';
interface ChatMessage { role: Role; content: string; }
interface IncomingMessage { text?: unknown; user?: { _id?: unknown }; }

const toHistoryMessages = (incoming: IncomingMessage[]): ChatMessage[] => {
  return incoming
    .filter((item) => typeof item.text === 'string' && (item.text as string).trim().length > 0)
    .slice(0, 20)
    .reverse()
    .map((item) => ({
      role: (item.user?._id === 'nxtvibes-ai' ? 'assistant' : 'user') as Role,
      content: (item.text as string).trim(),
    }));
};

/**
 * Auto-generate a conversation title from the first user message.
 * Takes the first ~50 chars or first sentence, whichever is shorter.
 */
function autoTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const firstSentence = clean.split(/[.!?]/)[0]?.trim() || clean;
  const title = firstSentence.length > 50
    ? firstSentence.substring(0, 47) + '...'
    : firstSentence;
  return title || 'New Chat';
}

function parseSuggestions(text: string): { cleanText: string; suggestions: string[] } {
  const match = text.match(/\[\[Suggestions:\s*(.*?)\s*\]\]/);
  if (match) {
    const suggestions = match[1].split('|').map(s => s.trim()).filter(s => s.length > 0);
    const cleanText = text.replace(match[0], '').trim();
    return { cleanText, suggestions };
  }
  return { cleanText: text, suggestions: [] };
}

// ═══════════════════════════════════════════════════════════════════════
// STATELESS PLAN ENDPOINT (backward compatible with existing mobile app)
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /ai/plan
 * Body: { text: string, previousMessages?: IncomingMessage[], model?: string }
 *
 * This is the EXISTING endpoint — kept for backward compatibility.
 * Now uses the RAG pipeline and AI Gateway instead of direct Groq calls.
 */
ai.post('/plan', async (c) => {
  const body = await c.req.json<{
    text?: string;
    previousMessages?: IncomingMessage[];
    model?: string;
  }>();

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return c.json({ error: 'Message text is required.' }, 400);
  if (text.length > 2000) return c.json({ error: 'Message is too long.' }, 400);

  const model = validateModel(body.model);
  const previousMessages = Array.isArray(body.previousMessages) ? body.previousMessages : [];
  const history = toHistoryMessages(previousMessages);

  try {
    const result = await ragChat({ query: text, history, model, env: c.env });
    const { cleanText, suggestions } = parseSuggestions(result.text);
    return c.json({ text: cleanText, suggestions, model: result.model });
  } catch (error: any) {
    return c.json({ error: error.message || 'AI request failed.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// CONVERSATION MANAGEMENT (D1-backed persistence)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /ai/conversations
 * Lists the user's conversations, ordered by most recent.
 * Query params: ?limit=20&offset=0
 */
ai.get('/conversations', async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const result = await c.env.DB.prepare(
      `SELECT id, title, model, created_at, updated_at
       FROM ai_conversations
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all();

    // Get message count + last message preview for each conversation
    const conversations = await Promise.all(
      (result.results || []).map(async (conv: any) => {
        const countResult = await c.env.DB.prepare(
          `SELECT COUNT(*) as count FROM ai_messages WHERE conversation_id = ?`
        ).bind(conv.id).first();

        const lastMsg = await c.env.DB.prepare(
          `SELECT content, role, created_at FROM ai_messages
           WHERE conversation_id = ?
           ORDER BY created_at DESC LIMIT 1`
        ).bind(conv.id).first();

        return {
          ...conv,
          messageCount: (countResult as any)?.count || 0,
          lastMessage: lastMsg
            ? { content: (lastMsg as any).content?.substring(0, 100), role: (lastMsg as any).role, createdAt: (lastMsg as any).created_at }
            : null,
        };
      })
    );

    return c.json({ conversations });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch conversations.' }, 500);
  }
});

/**
 * POST /ai/conversations
 * Creates a new conversation.
 * Body: { title?: string, model?: string }
 */
ai.post('/conversations', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ title?: string; model?: string }>().catch(() => ({} as { title?: string; model?: string }));

  const id = generateId();
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'New Chat';
  const model = validateModel(body.model);
  const now = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      `INSERT INTO ai_conversations (id, user_id, title, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, userId, title, model, now, now).run();

    return c.json({ id, title, model, created_at: now, updated_at: now }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create conversation.' }, 500);
  }
});

/**
 * GET /ai/conversations/:id
 * Get a single conversation with its details.
 */
ai.get('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const convId = c.req.param('id');

  try {
    const conv = await c.env.DB.prepare(
      `SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?`
    ).bind(convId, userId).first();

    if (!conv) {
      return c.json({ error: 'Conversation not found.' }, 404);
    }

    return c.json({ conversation: conv });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * PUT /ai/conversations/:id
 * Rename a conversation.
 * Body: { title: string }
 */
ai.put('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const convId = c.req.param('id');
  const body = await c.req.json<{ title?: string }>();

  if (typeof body.title !== 'string' || !body.title.trim()) {
    return c.json({ error: 'Title is required.' }, 400);
  }

  try {
    const result = await c.env.DB.prepare(
      `UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    ).bind(body.title.trim(), new Date().toISOString(), convId, userId).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Conversation not found.' }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * DELETE /ai/conversations/:id
 * Delete a conversation and all its messages.
 */
ai.delete('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const convId = c.req.param('id');

  try {
    // Delete messages first (FK cascade may not work in all D1 versions)
    await c.env.DB.prepare(
      `DELETE FROM ai_messages WHERE conversation_id = ?`
    ).bind(convId).run();

    const result = await c.env.DB.prepare(
      `DELETE FROM ai_conversations WHERE id = ? AND user_id = ?`
    ).bind(convId, userId).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Conversation not found.' }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /ai/conversations/:id/messages
 * Retrieve messages for a conversation, ordered oldest first.
 * Query: ?limit=50&before=<iso_date>
 */
ai.get('/conversations/:id/messages', async (c) => {
  const userId = c.get('userId');
  const convId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const before = c.req.query('before');

  try {
    // Verify ownership
    const conv = await c.env.DB.prepare(
      `SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?`
    ).bind(convId, userId).first();

    if (!conv) {
      return c.json({ error: 'Conversation not found.' }, 404);
    }

    let query: string;
    let params: any[];

    if (before) {
      query = `SELECT id, role, content, metadata, created_at
               FROM ai_messages
               WHERE conversation_id = ? AND created_at < ?
               ORDER BY created_at DESC LIMIT ?`;
      params = [convId, before, limit];
    } else {
      query = `SELECT id, role, content, metadata, created_at
               FROM ai_messages
               WHERE conversation_id = ?
               ORDER BY created_at ASC LIMIT ?`;
      params = [convId, limit];
    }

    const result = await c.env.DB.prepare(query).bind(...params).all();
    const messages = (result.results || []).map((m: any) => {
      const metadata = m.metadata ? JSON.parse(m.metadata) : {};
      return {
        ...m,
        metadata,
        suggestions: metadata.suggestions || [],
      };
    });

    return c.json({ messages });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /ai/conversations/:id/messages
 * Send a message in a conversation — triggers RAG + LLM response.
 * Body: { text: string, model?: string }
 *
 * Flow:
 * 1. Verify conversation ownership
 * 2. Save user message to D1
 * 3. Load conversation history from D1
 * 4. Run RAG pipeline (embed query → search Zilliz → inject context → call Groq via AI Gateway)
 * 5. Save AI response to D1
 * 6. Return AI response
 */
ai.post('/conversations/:id/messages', async (c) => {
  const userId = c.get('userId');
  const convId = c.req.param('id');
  const body = await c.req.json<{ text?: string; model?: string; location?: any }>();

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return c.json({ error: 'Message text is required.' }, 400);
  if (text.length > 2000) return c.json({ error: 'Message is too long.' }, 400);

  const model = validateModel(body.model);

  try {
    // 1. Verify conversation ownership
    const conv = await c.env.DB.prepare(
      `SELECT id, title FROM ai_conversations WHERE id = ? AND user_id = ?`
    ).bind(convId, userId).first();

    if (!conv) {
      return c.json({ error: 'Conversation not found.' }, 404);
    }

    const now = new Date().toISOString();
    const userMsgId = generateId();

    // 2. Save user message
    await c.env.DB.prepare(
      `INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
       VALUES (?, ?, 'user', ?, ?)`
    ).bind(userMsgId, convId, text, now).run();

    // 3. Load conversation history (last 20 messages for context)
    const historyResult = await c.env.DB.prepare(
      `SELECT role, content FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC LIMIT 20`
    ).bind(convId).all();

    const history: ChatMessage[] = (historyResult.results || [])
      .reverse()
      .slice(0, -1) // Exclude the message we just inserted (it's the current query)
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // 4. Run RAG pipeline
    const result = await ragChat({ 
      query: text, 
      history, 
      model, 
      env: c.env, 
      location: body.location 
    });

    // 5. Save AI response
    const aiMsgId = generateId();
    const aiNow = new Date().toISOString();
    const { cleanText, suggestions } = parseSuggestions(result.text);
    const metadata = JSON.stringify({ 
      sources: result.sources.map((s) => ({ title: s.title, category: s.category })),
      suggestions
    });

    await c.env.DB.prepare(
      `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?)`
    ).bind(aiMsgId, convId, cleanText, metadata, aiNow).run();

    // 6. Auto-update conversation title if it's still "New Chat"
    if ((conv as any).title === 'New Chat') {
      const newTitle = autoTitle(text);
      await c.env.DB.prepare(
        `UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ?`
      ).bind(newTitle, aiNow, convId).run();
    } else {
      // Just update the timestamp
      await c.env.DB.prepare(
        `UPDATE ai_conversations SET updated_at = ? WHERE id = ?`
      ).bind(aiNow, convId).run();
    }

    return c.json({
      userMessage: { id: userMsgId, role: 'user', content: text, created_at: now },
      aiMessage: { id: aiMsgId, role: 'assistant', content: cleanText, created_at: aiNow, suggestions },
      model: result.model,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'AI request failed.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// IMAGES (unchanged — Unsplash integration)
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /ai/images
 * Body: { places: string[] }
 */
ai.post('/images', async (c) => {
  const body = await c.req.json<{ places?: string[] }>();
  const places = Array.isArray(body.places) ? body.places : [];

  if (places.length === 0) {
    return c.json({ error: 'Places array is required.' }, 400);
  }

  const limitedPlaces = places
    .slice(0, 7)
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);

  const results: Array<{
    place: string;
    imageUrl: string;
    photographerName: string;
    photographerUrl: string;
  }> = [];

  for (const place of limitedPlaces) {
    try {
      const query = encodeURIComponent(place.trim());
      const searchUrl = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high`;

      const res = await fetch(searchUrl, {
        headers: { Authorization: `Client-ID ${c.env.UNSPLASH_ACCESS_KEY}` },
      });

      if (!res.ok) {
        results.push({ place: place.trim(), imageUrl: '', photographerName: '', photographerUrl: '' });
        continue;
      }

      const data = (await res.json()) as any;
      if (data.results?.length > 0) {
        const photo = data.results[0];

        // Trigger download endpoint per Unsplash API guidelines
        try {
          await fetch(photo.links.download_location, {
            headers: { Authorization: `Client-ID ${c.env.UNSPLASH_ACCESS_KEY}` },
          });
        } catch { /* best effort */ }

        results.push({
          place: place.trim(),
          imageUrl: photo.urls.regular,
          photographerName: photo.user.name,
          photographerUrl: photo.user.links.html,
        });
      } else {
        results.push({ place: place.trim(), imageUrl: '', photographerName: '', photographerUrl: '' });
      }
    } catch {
      results.push({ place: place.trim(), imageUrl: '', photographerName: '', photographerUrl: '' });
    }
  }

  return c.json({ images: results });
});

export default ai;
