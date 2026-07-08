import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';

// ── Module-level singleton for the shared presence channel ──────────────────
// ChatScreen reads from this directly via getOnlineUsersPresenceState()
// without adding any listeners (which Supabase forbids after subscribe()).
let _presenceChannel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Returns the current Supabase Presence state for a given user ID.
 * Safe to call at any time — returns null if the channel isn't ready yet.
 */
export function getOnlineUsersPresenceState(userId: string): {
  status: string;
  online_at: string;
} | null {
  if (!_presenceChannel) return null;
  try {
    const state = (_presenceChannel as any).presenceState() as Record<string, any[]>;
    const entries = state[userId];
    if (entries && entries.length > 0) {
      return entries[entries.length - 1];
    }
  } catch {
    // Channel not ready
  }
  return null;
}

const writePresence = async (presence: 'online' | 'away' | 'offline') => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase
      .from('profiles')
      .update({
        presence,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', user.id);
  } catch {
    // Silence database update errors — non-critical
  }
};

export const usePresence = () => {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      // Initial DB update
      await writePresence('online');
      if (!isMounted) return; // BUG #11: guard after every await

      // ── Tear down any stale channel before creating a fresh one ──────────────
      // On Expo hot-reload or React Strict Mode double-effect, the old 'online-users'
      // channel may still be subscribed. Calling .on() on an already-subscribed channel
      // throws "cannot add presence callbacks after subscribe()". We remove it first.
      const existingChannels = supabase.getChannels();
      const staleChannel = existingChannels.find(
        (ch: any) => ch.topic === 'realtime:online-users'
      );
      if (staleChannel) {
        try {
          await supabase.removeChannel(staleChannel);
        } catch {
          // Ignore removal errors — channel may already be closing
        }
      }
      if (!isMounted) return;

      // Create a fresh Supabase Realtime Presence Channel
      channel = supabase.channel('online-users', {
        config: { presence: { key: user.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          // Presence state synced — readable via getOnlineUsersPresenceState()
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED' && isMounted) {
            await channel.track({
              online_at: new Date().toISOString(),
              status: 'online',
            });
          }
        });

      channelRef.current = channel;
      _presenceChannel = channel; // expose to getOnlineUsersPresenceState()

      // ── BUG #8: Heartbeat — keeps last_seen_at fresh every 60s while app is active ──
      // Without this, ChatScreen's 40-second offline timeout incorrectly marks
      // an active user as offline because last_seen_at is never updated after mount.
      heartbeatInterval = setInterval(async () => {
        if (!isMounted) return;
        if (AppState.currentState !== 'active') return; // only while in foreground
        await writePresence('online');
        if (!isMounted) return;
        if (channelRef.current) {
          try {
            await channelRef.current.track({
              online_at: new Date().toISOString(),
              status: 'online',
            });
          } catch {
            // Presence channel may have been removed — non-fatal
          }
        }
      }, 60_000); // Every 60 seconds
    };

    setupPresence();

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      if (nextState === 'active') {
        await writePresence('online');
        if (!isMounted) return;
        if (channelRef.current) {
          try {
            await channelRef.current.track({
              online_at: new Date().toISOString(),
              status: 'online',
            });
          } catch {}
        }
      } else if (nextState === 'background' || nextState === 'inactive') {
        await writePresence('away');
        if (!isMounted) return;
        if (channelRef.current) {
          try {
            await channelRef.current.track({
              online_at: new Date().toISOString(),
              status: 'away',
            });
          } catch {}
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      subscription.remove();

      // Clear heartbeat on unmount
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      const cleanup = async () => {
        _presenceChannel = null;
        if (channel) {
          try {
            await channel.untrack();
            await supabase.removeChannel(channel);
          } catch {}
        }
        await writePresence('offline');
      };

      cleanup();
    };
  }, []);
};

export default usePresence;
