import firestore from '@react-native-firebase/firestore';

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

export const getPublicProfile = async (uid: string): Promise<PublicProfile | null> => {
    if (!uid) return null;

    const doc = await firestore().collection('public_users').doc(uid).get();
    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() } as PublicProfile;
};

export const getPublicProfilesByIds = async (
    uids: string[]
): Promise<Map<string, PublicProfile>> => {
    const uniqueIds = Array.from(new Set(uids.filter(Boolean)));
    const result = new Map<string, PublicProfile>();
    if (uniqueIds.length === 0) return result;

    const chunkSize = 10;
    const chunks = Array.from(
        { length: Math.ceil(uniqueIds.length / chunkSize) },
        (_, i) => uniqueIds.slice(i * chunkSize, i * chunkSize + chunkSize)
    );

    await Promise.all(
        chunks.map(async (chunk) => {
            if (chunk.length === 0) return;
            const snapshot = await firestore()
                .collection('public_users')
                .where(firestore.FieldPath.documentId(), 'in', chunk)
                .get();

            snapshot.docs.forEach((doc) => {
                result.set(doc.id, { id: doc.id, ...doc.data() } as PublicProfile);
            });
        })
    );

    return result;
};
