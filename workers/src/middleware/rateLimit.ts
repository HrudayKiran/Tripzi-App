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

/**
 * Public rate limiter — 10 requests per 60 seconds per IP address.
 * Applied to /public/* routes (unauthenticated endpoints).
 * Uses CF-Connecting-IP so each device is limited independently.
 * Prevents scrapers from enumerating usernames or blocking all sign-ups.
 */
export const publicRateLimit = async (
  c: Context<{ Bindings: Env }>,
  next: Next
) => {
  const limiter = c.env.PUBLIC_RATE_LIMITER;
  if (!limiter) {
    // Gracefully skip if binding not configured (e.g., local dev)
    await next();
    return;
  }

  // Use client IP — each device gets its own limit
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
  const { success } = await limiter.limit({ key: ip });

  if (!success) {
    return c.json({ error: 'Too many requests. Please slow down.' }, 429);
  }

  await next();
};
