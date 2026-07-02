/**
 * Public Routes — no authentication required.
 *
 * GET /public/check-username/:username
 *   Available to unauthenticated users (sign-up flow).
 *   Rate limited per IP via publicRateLimit middleware (10 req/60s).
 */

import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const publicRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /public/check-username/:username
 *
 * Checks if a username is available for registration.
 * No auth required — used during the sign-up flow before a session exists.
 *
 * Validation:
 *  - Trims and lowercases the input
 *  - Rejects if format doesn't match /^[a-z0-9_]{3,20}$/
 *  - Queries profiles table case-insensitively
 *
 * Returns: { available: boolean } | { error: string }
 */
publicRoutes.get('/check-username/:username', async (c) => {
  const raw = c.req.param('username');

  // Sanitize: trim whitespace and force lowercase
  const username = raw.trim().toLowerCase();

  // Validate format server-side (same regex as client)
  if (!USERNAME_REGEX.test(username)) {
    return c.json(
      { error: 'Invalid username format. Use 3-20 chars: lowercase letters, numbers, underscore.' },
      400
    );
  }

  const supabase = getSupabaseAdmin(c.env);

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error('[PublicCheckUsername] Supabase error:', error.message);
    return c.json({ error: 'Database error. Please try again.' }, 500);
  }

  return c.json({ available: !data });
});

export default publicRoutes;
