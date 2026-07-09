import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * C6: Single source of truth for the current authenticated user.
 * Uses TanStack Query to cache the auth user so we don't call
 * supabase.auth.getUser() in every hook and component separately.
 * 
 * The auth session is very stable (changes only on login/logout),
 * so we use a long staleTime.
 */
export function useCurrentUser() {
    const { data: user = null, isLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) return null;
            return user;
        },
        staleTime: 5 * 60_000, // 5 minutes — auth state rarely changes
        gcTime: 30 * 60_000,   // 30 minutes
    });

    return { user, userId: user?.id || null, isLoading };
}

export default useCurrentUser;
