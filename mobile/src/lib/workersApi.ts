import { supabase } from './supabase';

const WORKERS_URL = process.env.EXPO_PUBLIC_WORKERS_URL!;

/**
 * Makes an authenticated request to the Cloudflare Workers API.
 * Automatically attaches the current Supabase session JWT.
 */
export const workersApi = async <T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
  } = {}
): Promise<T> => {
  const { method = 'POST', body } = options;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${WORKERS_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data as T;
};
