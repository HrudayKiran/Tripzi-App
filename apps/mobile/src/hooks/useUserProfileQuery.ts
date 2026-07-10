import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useUserProfileQuery(userId: string | undefined, isOwnProfile: boolean) {
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

    return {
        user: userProfile,
        loading: loadingProfile,
        profileError,
    };
}

export default useUserProfileQuery;
