import { supabase } from '../lib/supabase';

export interface PublicProfile {
    id: string;
    userId?: string;
    displayName?: string;
    username?: string;
    photoURL?: string;
    bio?: string;
    ageVerified?: boolean;
    [key: string]: any;
}

const mapRow = (row: any): PublicProfile => ({
    id: row.id,
    userId: row.id,
    displayName: row.display_name,
    username: row.username,
    photoURL: row.photo_url,
    bio: row.bio,
    ageVerified: row.age_verified,
});

export const getPublicProfile = async (uid: string): Promise<PublicProfile | null> => {
    if (!uid) return null;

    const { data, error } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

    if (error || !data) return null;
    return mapRow(data);
};

export const getPublicProfilesByIds = async (
    uids: string[]
): Promise<Map<string, PublicProfile>> => {
    const uniqueIds = Array.from(new Set(uids.filter(Boolean)));
    const result = new Map<string, PublicProfile>();
    if (uniqueIds.length === 0) return result;

    // Supabase .in() supports up to ~300 values, chunk for safety
    const chunkSize = 50;
    const chunks = Array.from(
        { length: Math.ceil(uniqueIds.length / chunkSize) },
        (_, i) => uniqueIds.slice(i * chunkSize, i * chunkSize + chunkSize)
    );

    await Promise.all(
        chunks.map(async (chunk) => {
            const { data } = await supabase
                .from('public_profiles')
                .select('*')
                .in('id', chunk);

            (data || []).forEach((row) => {
                result.set(row.id, mapRow(row));
            });
        })
    );

    return result;
};
