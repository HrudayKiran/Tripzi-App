import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';

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
    // Silence database updates on errors
  }
};

export const usePresence = () => {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      // Initial DB update
      await writePresence('online');

      // Create Supabase Realtime Presence Channel
      channel = supabase.channel('online-users', {
        config: { presence: { key: user.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          // Presence state synced automatically
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
    };

    setupPresence();

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (nextState === 'active') {
        await writePresence('online');
        if (channelRef.current) {
          await channelRef.current.track({
            online_at: new Date().toISOString(),
            status: 'online',
          });
        }
      } else if (nextState === 'background' || nextState === 'inactive') {
        await writePresence('away');
        if (channelRef.current) {
          await channelRef.current.track({
            online_at: new Date().toISOString(),
            status: 'away',
          });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      subscription.remove();
      
      const cleanup = async () => {
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
