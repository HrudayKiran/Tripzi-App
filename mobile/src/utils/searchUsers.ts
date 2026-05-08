import firestore from '@react-native-firebase/firestore';

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
 * Indexed prefix search on public profiles by `displayName` and `username`.
 * Requires Firestore indexes on these fields when used with orderBy+startAt.
 */
export const searchUsersByPrefix = async (
    query: string,
    limit = 5
): Promise<SearchUserResult[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const queryLower = trimmed.toLowerCase();
    const endLower = `${queryLower}\uf8ff`;

    const queryTitleCase = queryLower.charAt(0).toUpperCase() + queryLower.slice(1);
    const endTitleCase = `${queryTitleCase}\uf8ff`;

    const [nameSnap, usernameSnap, rawNameSnap] = await Promise.all([
        firestore()
            .collection('public_users')
            .orderBy('displayName')
            .startAt(queryTitleCase)
            .endAt(endTitleCase)
            .limit(limit)
            .get()
            .catch(() => ({ docs: [] } as any)),
        firestore()
            .collection('public_users')
            .orderBy('username')
            .startAt(queryLower)
            .endAt(endLower)
            .limit(limit)
            .get()
            .catch(() => ({ docs: [] } as any)),
        trimmed !== queryTitleCase && trimmed !== queryLower ? firestore()
            .collection('public_users')
            .orderBy('displayName')
            .startAt(trimmed)
            .endAt(`${trimmed}\uf8ff`)
            .limit(limit)
            .get()
            .catch(() => ({ docs: [] } as any)) : { docs: [] } as any
    ]);

    const users = [
        ...nameSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
        ...usernameSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
        ...rawNameSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
    ];

    return dedupeById(users).slice(0, limit);
};
