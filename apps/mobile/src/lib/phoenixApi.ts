import { supabase } from './supabase';

const getApiUrl = () => {
  // Use EXPO_PUBLIC_PHOENIX_API_URL directly.
  // For physical devices AND emulators, run `adb reverse tcp:4000 tcp:4000` once before testing.
  // This tunnels the device's localhost:4000 → your PC's localhost:4000 over USB/ADB.
  // Do NOT replace localhost with 10.0.2.2 — that only works in emulators and breaks physical devices.
  return process.env.EXPO_PUBLIC_PHOENIX_API_URL || 'http://localhost:4000/api';
};

const PHOENIX_API_URL = getApiUrl();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Makes a request to the Elixir Phoenix HTTP API.
 *
 * Attaches the current Supabase session JWT and throws 'Not authenticated'
 * if no session exists.
 *
 * Implements a 15-second timeout and up to 2 retries with exponential backoff.
 */
export const phoenixApi = async <T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    isPublic?: boolean;
  } = {}
): Promise<T> => {
  const { method = 'POST', body, isPublic = false } = options;

  let authorizationHeader: string | undefined;
  if (!isPublic) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    authorizationHeader = `Bearer ${session.access_token}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authorizationHeader) {
    headers['Authorization'] = authorizationHeader;
  }

  const url = `${PHOENIX_API_URL}${path}`;
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      if (__DEV__) {
        console.log(`[PhoenixAPI] ${method} ${path} - Attempt ${attempt}`);
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      let responseData: any;
      try {
        responseData = text ? JSON.parse(text) : {};
      } catch {
        responseData = { text };
      }

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || `HTTP ${response.status}`);
      }

      return responseData as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      const isTimeout = error.name === 'AbortError';
      const isNetworkError = error instanceof TypeError;

      if (attempt < maxAttempts && (isTimeout || isNetworkError)) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        if (__DEV__) {
          console.warn(`[PhoenixAPI] Transient error: ${error.message}. Retrying in ${backoffMs}ms...`);
        }
        await delay(backoffMs);
        continue;
      }

      throw error;
    }
  }

  throw new Error('Request failed after max retries');
};
