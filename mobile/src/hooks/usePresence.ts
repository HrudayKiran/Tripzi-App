import { useEffect } from 'react';
import { AppState } from 'react-native';
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
        // Presence writes should not interrupt app usage.
    }
};

export const usePresence = () => {
    useEffect(() => {
        writePresence('online');

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                writePresence('online');
                return;
            }

            if (nextState === 'background' || nextState === 'inactive') {
                writePresence('away');
            }
        });

        return () => {
            subscription.remove();
            writePresence('offline');
        };
    }, []);
};

export default usePresence;
