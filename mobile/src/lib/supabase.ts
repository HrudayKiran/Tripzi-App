import 'react-native-url-polyfill/auto';
import { createMMKV } from 'react-native-mmkv';
import { createClient } from '@supabase/supabase-js';

const storage = createMMKV({
  id: 'supabase-auth-storage'
});

const mmkvStorageAdapter = {
  getItem: (key: string) => {
    return storage.getString(key) || null;
  },
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Checks for the presence of a persistent Supabase session in MMKV synchronously.
 * This is used to make immediate routing decisions on startup without waiting
 * for asynchronous authentication checks.
 */
export function hasSessionSync(): boolean {
  try {
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1] || '';
    const storageKey = `sb-${projectRef}-auth-token`;
    const sessionStr = storage.getString(storageKey);
    if (!sessionStr) return false;
    const parsed = JSON.parse(sessionStr);
    return !!(parsed && (parsed.currentSession || parsed.access_token));
  } catch (e) {
    return false;
  }
}

/**
 * Retrieves the user's auth provider synchronously from MMKV.
 * Useful for rendering components immediately without flicker.
 */
export function getProviderSync(): string | null {
  try {
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1] || '';
    const storageKey = `sb-${projectRef}-auth-token`;
    const sessionStr = storage.getString(storageKey);
    if (!sessionStr) return null;
    const parsed = JSON.parse(sessionStr);
    const user = parsed?.currentSession?.user || parsed?.user;
    return user?.app_metadata?.provider || null;
  } catch (e) {
    return null;
  }
}
