import { supabase } from '../lib/supabase';

export interface SearchUserResult {
    id: string;
    displayName?: string;
    username?: string;
    email?: string;
    photoURL?: string;
    ageVerified?: boolean;
    [key: string]: any;
}

const dedupeById = (users: SearchUserResult[]): SearchUserResult[] => {
    const map = new Map<string, SearchUserResult>();
    users.forEach((user) => {
        if (!map.has(user.id)) {
            map.set(user.id, user);
        }
    });
    return Array.from(map.values());
};

/**
 * Search public profiles by display_name and username using Supabase ilike.
 */
export const searchUsersByPrefix = async (
    query: string,
    limit = 5
): Promise<SearchUserResult[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const pattern = `${trimmed}%`;

    const [nameResult, usernameResult] = await Promise.all([
        supabase
            .from('public_profiles')
            .select('id, display_name, username, photo_url, age_verified')
            .ilike('display_name', pattern)
            .limit(limit),
        supabase
            .from('public_profiles')
            .select('id, display_name, username, photo_url, age_verified')
            .ilike('username', pattern)
            .limit(limit),
    ]);

    const users: SearchUserResult[] = [
        ...(nameResult.data || []).map((p) => ({
            id: p.id,
            displayName: p.display_name,
            username: p.username,
            photoURL: p.photo_url,
            ageVerified: p.age_verified,
        })),
        ...(usernameResult.data || []).map((p) => ({
            id: p.id,
            displayName: p.display_name,
            username: p.username,
            photoURL: p.photo_url,
            ageVerified: p.age_verified,
        })),
    ];

    return dedupeById(users).slice(0, limit);
};
