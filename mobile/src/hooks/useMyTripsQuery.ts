import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

export function useMyTripsQuery() {
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null));
    }, []);

    const { data: trips = [], isLoading: loading, error, refetch } = useQuery({
        queryKey: ['myTrips', userId],
        queryFn: async () => {
            if (!userId) return [];

            console.log(`[useMyTripsQuery] Fetching trips for user ${userId} from Supabase...`);
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .contains('participants', [userId]);

            if (error) {
                console.error('[useMyTripsQuery] Error fetching trips:', error);
                throw error;
            }

            console.log(`[useMyTripsQuery] Fetched ${data?.length || 0} trips.`);
            return data || [];
        },
        enabled: !!userId,
    });

    // Realtime subscription
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`my-trips-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
                queryClient.invalidateQueries({ queryKey: ['myTrips', userId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, queryClient]);

    return { trips, loading, error, refetch, userId };
}

export default useMyTripsQuery;
