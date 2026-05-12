import { useQuery } from '@tanstack/react-query';
import { searchUsersByPrefix } from '../utils/searchUsers';

export function useUserSearchQuery(searchQuery: string) {
    const { data: searchedUsers = [], isLoading: searchingUsers, error } = useQuery({
        queryKey: ['userSearch', searchQuery],
        queryFn: async () => {
            if (searchQuery.length < 2) return [];
            console.log(`[useUserSearchQuery] Searching users for: ${searchQuery}`);
            return await searchUsersByPrefix(searchQuery, 5);
        },
        enabled: searchQuery.length >= 2,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    return { searchedUsers, searchingUsers, error };
}

export default useUserSearchQuery;
