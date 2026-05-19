import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export function useUserProfileQuery(userId: string | undefined, isOwnProfile: boolean) {
    const queryClient = useQueryClient();

    // Query for user profile
    const { data: userProfile, isLoading: loadingProfile, error: profileError } = useQuery({
        queryKey: ['profile', userId],
        queryFn: async () => {
            if (!userId) return null;

            console.log(`[useUserProfileQuery] Fetching profile for ${userId}...`);
            const table = isOwnProfile ? 'profiles' : 'public_profiles';
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('[useUserProfileQuery] Error fetching profile:', error);
                throw error;
            }

            if (!data && isOwnProfile) {
                // Fallback for own profile if not found in profiles table
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const meta = user.user_metadata || {};
                    return {
                        id: user.id,
                        name: meta.full_name || 'User',
                        displayName: meta.full_name || 'User',
                        email: user.email,
                        photoURL: meta.avatar_url || null,
                        photoObjectKey: null,
                        bio: '',
                    };
                }
            }

            if (!data) return null;

            const normalizedDisplayName = data.name || data.display_name || 'User';
            return {
                ...data,
                displayName: normalizedDisplayName,
                name: data.name || normalizedDisplayName,
                photoURL: data.photo_url,
                photoObjectKey: data.photo_object_key,
            };
        },
        enabled: !!userId,
    });

    // Query for user trips
    const { data: trips = [], isLoading: loadingTrips } = useQuery({
        queryKey: ['userTrips', userId],
        queryFn: async () => {
            if (!userId) return [];

            console.log(`[useUserProfileQuery] Fetching trips for ${userId}...`);
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[useUserProfileQuery] Error fetching trips:', error);
                throw error;
            }

            return data || [];
        },
        enabled: !!userId,
    });



    // Realtime subscription for trips
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`user-trips-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `user_id=eq.${userId}` }, () => {
                queryClient.invalidateQueries({ queryKey: ['userTrips', userId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, queryClient]);

    return {
        user: userProfile,
        trips,
        loading: loadingProfile || loadingTrips,
        profileError,
    };
}

export default useUserProfileQuery;
