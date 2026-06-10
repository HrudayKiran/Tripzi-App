import { supabase } from './supabase';

const WORKERS_URL = process.env.EXPO_PUBLIC_WORKERS_URL!;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Makes an authenticated request to the Cloudflare Workers API.
 * Automatically attaches the current Supabase session JWT.
 * Implements a 15-second timeout and up to 2 retries with exponential backoff on transient errors.
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

  const maxAttempts = 3;
  let attempt = 0;
  let lastError: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${WORKERS_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(id);

      const data = await response.json();

      if (!response.ok) {
        // If it's a 5xx error, it could be transient. Throw error to trigger retry.
        if (response.status >= 500 && attempt < maxAttempts) {
          throw new Error(data?.error || `Server error ${response.status}`);
        }
        throw new Error(data?.error || `Request failed with status ${response.status}`);
      }

      return data as T;
    } catch (error: any) {
      clearTimeout(id);
      lastError = error;

      // Check if we still have attempts left and if it's retryable
      if (attempt < maxAttempts) {
        // Exponential backoff: 1000ms * 2^(attempt - 1)
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        if (__DEV__) {
          console.warn(`[workersApi] Attempt ${attempt} failed. Retrying in ${backoffMs}ms... Error:`, error.message);
        }
        await delay(backoffMs);
      }
    }
  }

  throw lastError || new Error('Request failed');
};
