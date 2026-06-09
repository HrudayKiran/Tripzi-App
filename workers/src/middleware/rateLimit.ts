import { Context, Next } from 'hono';
import { Env } from '../lib/supabase';

/**
 * Global rate limiter — 100 requests per 60 seconds per user.
 * Applied to account and group_chats routes.
 */
export const globalRateLimit = async (
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
  next: Next
) => {
  const limiter = c.env.GLOBAL_RATE_LIMITER;
  if (!limiter) {
    // Gracefully skip if binding not configured (e.g., local dev)
    await next();
    return;
  }

  const userId = c.get('userId') || 'anonymous';
  const { success } = await limiter.limit({ key: userId });

  if (!success) {
    return c.json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  await next();
};

/**
 * AI rate limiter — 20 requests per 60 seconds per user.
 * Applied to /ai/* routes (protects Groq, Workers AI, Zilliz).
 */
export const aiRateLimit = async (
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
  next: Next
) => {
  const limiter = c.env.AI_RATE_LIMITER;
  if (!limiter) {
    await next();
    return;
  }

  const userId = c.get('userId') || 'anonymous';
  const { success } = await limiter.limit({ key: userId });

  if (!success) {
    return c.json({ error: 'AI rate limit exceeded. Please wait a moment.' }, 429);
  }

  await next();
};

/**
 * Media rate limiter — 10 requests per 60 seconds per user.
 * Applied to /media/* routes (protects R2 upload quota).
 */
export const mediaRateLimit = async (
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
  next: Next
) => {
  const limiter = c.env.MEDIA_RATE_LIMITER;
  if (!limiter) {
    await next();
    return;
  }

  const userId = c.get('userId') || 'anonymous';
  const { success } = await limiter.limit({ key: userId });

  if (!success) {
    return c.json({ error: 'Upload rate limit exceeded. Please wait.' }, 429);
  }

  await next();
};
