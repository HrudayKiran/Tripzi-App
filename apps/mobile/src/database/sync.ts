import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { supabase } from '../lib/supabase';
import { Q } from '@nozbe/watermelondb';
import { createMMKV } from 'react-native-mmkv';
import { phoenixApi } from '../lib/phoenixApi';
import { parsePostgresDateToMs } from '../utils/date';
import { queryClient } from '../lib/queryClient';

const storage = createMMKV();
const LAST_SYNC_USER_KEY = 'last_sync_user_id';

// Mutex to prevent concurrent synchronization
let isSyncing = false;

/**
 * Splits an array of mapped records into { created, updated } based on
 * which IDs already exist in the local WatermelonDB table.
 */
async function splitCreatedUpdated(tableName: string, records: any[]) {
  if (records.length === 0) return { created: [], updated: [] };

  const ids = records.map(r => r.id);
  const existing = await database.get(tableName)
    .query(Q.where('id', Q.oneOf(ids)))
    .fetch();
  const existingIds = new Set(existing.map(r => r.id));

  const created: any[] = [];
  const updated: any[] = [];

  for (const record of records) {
    if (existingIds.has(record.id)) {
      updated.push(record);
    } else {
      created.push(record);
    }
  }

  return { created, updated };
}

/**
 * Synchronizes the WatermelonDB database with the Phoenix API backend.
 * Uses a single HTTP request for pull and a single transaction-safe request for push.
 */
export async function syncDatabase() {
  if (isSyncing) {
    console.log('[Sync] Synchronization already in progress, skipping.');
    return;
  }

  isSyncing = true;
  if (__DEV__) console.log('[Sync] Starting synchronization via Phoenix sync API...');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (__DEV__) console.log('[Sync] No active session, skipping database synchronization.');
      isSyncing = false;
      return;
    }
    const user = session.user;

    await synchronize({

      database,
      pullChanges: async ({ lastPulledAt }) => {
        const lastSyncUserId = storage.getString(LAST_SYNC_USER_KEY);
        let actualLastPulledAt = lastPulledAt;

        // User switching detection: force full pull if the user has changed
        if (user && user.id !== lastSyncUserId) {
          if (__DEV__) console.log(`[Sync] User switched from ${lastSyncUserId} to ${user.id}. Forcing full pull.`);
          actualLastPulledAt = null;
        }

        // Clock drift mitigation: Subtract 10 seconds from lastPulledAt
        const lookbackMs = 10000;
        const adjustedLastPulledAt = actualLastPulledAt ? Math.max(0, actualLastPulledAt - lookbackMs) : null;

        // Call the Phoenix pull endpoint
        const response = await phoenixApi(`/sync/pull?last_pulled_at=${adjustedLastPulledAt || ''}`, {
          method: 'GET'
        });

        return {
          changes: response.changes,
          timestamp: response.timestamp
        };
      },
      pushChanges: async ({ changes }) => {
        // Send modifications directly to the Phoenix push endpoint
        await phoenixApi('/sync/push', {
          method: 'POST',
          body: { changes }
        });
      }
    });

    if (user) {
      storage.set(LAST_SYNC_USER_KEY, user.id);

      // Invalidate TanStack Query caches to force UI re-render with fresh database values
      queryClient.invalidateQueries({ queryKey: ['chats', user.id] });
      queryClient.invalidateQueries({ queryKey: ['groupChats', user.id] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    }

    if (__DEV__) console.log('[Sync] Synchronization completed successfully.');
  } catch (error: any) {
    if (error?.message?.includes('Concurrent synchronization')) {
      console.log('[Sync] Concurrent synchronization detected, skipping.');
    } else {
      console.error('[Sync] Synchronization failed:', error);
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Lightweight helper that syncs only the current user's profile.
 * Call this after profile edits, settings changes, etc.
 * Much faster than a full syncDatabase() call.
 */
export async function syncCurrentUserProfile(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) return;

    const mapped = {
      id: profile.id,
      name: profile.name || profile.display_name || 'Traveler',
      username: profile.username,
      photo_url: profile.photo_url,
      push_notifications_enabled: profile.push_notifications_enabled ?? false,
      save_to_gallery: profile.save_to_gallery ?? false,
      created_at: parsePostgresDateToMs(profile.created_at),
      updated_at: parsePostgresDateToMs(profile.updated_at),
    };

    const { created, updated } = await splitCreatedUpdated('profiles', [mapped]);

    await database.write(async () => {
      const collection = database.get('profiles');
      const batch: any[] = [];

      for (const record of created) {
        batch.push(
          collection.prepareCreate((rec: any) => {
            rec._raw.id = record.id;
            Object.keys(record).forEach(key => {
              if (key !== 'id') rec._raw[key] = record[key];
            });
          })
        );
      }

      for (const record of updated) {
        const existing = await collection.find(record.id);
        batch.push(
          existing.prepareUpdate((rec: any) => {
            Object.keys(record).forEach(key => {
              if (key !== 'id') rec._raw[key] = record[key];
            });
          })
        );
      }

      await database.batch(...batch);
    });

    queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    queryClient.invalidateQueries({ queryKey: ['chats', user.id] });

    if (__DEV__) console.log('[Sync] Current user profile synced locally.');
  } catch (error) {
    console.error('[Sync] Failed to sync current user profile:', error);
  }
}
