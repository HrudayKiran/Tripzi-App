/**
 * usePresence.ts
 *
 * Tracks and broadcasts user presence using Phoenix Channels + Phoenix Presence.
 * Replaces the Supabase Realtime presence channel entirely.
 *
 * Architecture:
 *  - On mount: joins "user:{userId}" Phoenix channel, tracks presence via :after_join
 *  - Phoenix server tracks online state in ETS (not DB) via NxtVibesWeb.Presence
 *  - AppState changes (foreground/background) send presence updates to server
 *  - Other users' presence is readable via getOnlineUsersPresenceState(userId)
 *
 * Industry standard: Discord, WhatsApp, Telegram all use in-process presence
 * (Redis/ETS) — NOT database columns. This implementation follows that pattern.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { joinChannel, pushToChannel, connectPhoenixSocket } from '../lib/phoenixSocket';
import { useCurrentUser } from './useCurrentUser';

// ── Module-level presence state ───────────────────────────────────────────────
// Keyed by userId → { status, online_at }
// Populated by Phoenix presence_state and presence_diff events from the channel.
const _presenceState = new Map<string, { status: string; online_at: string }>();

/**
 * Returns the current presence info for a given user ID.
 * Returns null if user is not tracked (assumed offline).
 */
export function getOnlineUsersPresenceState(userId: string): {
  status: string;
  online_at: string;
} | null {
  return _presenceState.get(userId) ?? null;
}

export const usePresence = () => {
  const { userId } = useCurrentUser();

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    let appStateSubscription: any = null;
    let channelCleanup: (() => void) | null = null;

    const setup = async () => {
      // Ensure socket is connected before joining
      await connectPhoenixSocket();
      if (!isMounted) return;

      const topic = `user:${userId}`;

      // Join the user channel — Phoenix server tracks presence on join
      channelCleanup = joinChannel(topic, (event, payload) => {
        switch (event) {
          case 'presence_state': {
            // Full presence snapshot on first join
            // payload: { userId: [{ status, online_at }] }
            _presenceState.clear();
            for (const [uid, metas] of Object.entries(payload as Record<string, any[]>)) {
              const latest = metas[metas.length - 1];
              if (latest) _presenceState.set(uid, { status: latest.status ?? 'online', online_at: latest.online_at ?? new Date().toISOString() });
            }
            break;
          }
          case 'presence_diff': {
            // Incremental join/leave events
            const { joins, leaves } = payload as { joins: Record<string, any[]>; leaves: Record<string, any[]> };
            for (const [uid, metas] of Object.entries(joins ?? {})) {
              const latest = metas[metas.length - 1];
              if (latest) _presenceState.set(uid, { status: latest.status ?? 'online', online_at: latest.online_at ?? new Date().toISOString() });
            }
            for (const uid of Object.keys(leaves ?? {})) {
              _presenceState.delete(uid);
            }
            break;
          }
          default:
            break;
        }
      });

      // Track ourselves as online on the channel
      try {
        await pushToChannel(topic, 'update_presence', { status: 'online', online_at: new Date().toISOString() });
      } catch {
        // Non-critical — server tracks presence on join anyway
      }

      // Handle app state changes (foreground/background)
      const handleAppStateChange = async (nextState: AppStateStatus) => {
        if (!isMounted) return;
        const status = nextState === 'active' ? 'online' : 'away';
        try {
          await pushToChannel(topic, 'update_presence', { status, online_at: new Date().toISOString() });
        } catch {}

        // Also update last_seen_at in DB for historical purposes (lightweight — only on transition)
        if (nextState !== 'active') {
          supabase.from('profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', userId)
            .then(() => {}, () => {});
        }
      };

      appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    };

    setup();

    return () => {
      isMounted = false;
      appStateSubscription?.remove();
      channelCleanup?.();
      _presenceState.clear();
    };
  }, [userId]);
};

export default usePresence;