import { useState, useEffect, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Firestore Timestamp type
type FirestoreTimestamp = { toDate: () => Date } | Date | null;

export interface ChatParticipant {
    displayName: string;
    photoURL: string;
    role?: 'admin' | 'member';
}

export interface LastMessage {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: FirestoreTimestamp;
    type: 'text' | 'image' | 'location' | 'voice' | 'system';
}

export interface Chat {
    id: string;
    type: 'direct' | 'group';
    collectionName: 'chats' | 'group_chats';
    participants: string[];
    participantDetails: { [uid: string]: ChatParticipant };
    groupName?: string;
    groupDescription?: string;
    groupIcon?: string;
    tripImage?: string;
    tripId?: string;
    createdBy?: string;
    memberCount?: number;
    hidden?: boolean;
    lastMessage?: LastMessage;
    unreadCount: { [uid: string]: number };
    deletedBy: string[];
    clearedAt?: { [uid: string]: FirestoreTimestamp };
    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}

interface UseChatsReturn {
    chats: Chat[];
    loading: boolean;
    error: Error | null;
    createDirectChat: (otherUserId: string, otherUserDetails: ChatParticipant) => Promise<string>;
    getOrCreateDirectChat: (otherUserId: string, otherUserDetails: ChatParticipant) => Promise<string>;
    deleteChat: (chatId: string) => Promise<void>;
    refreshChats: () => void;
}

export function useChats(): UseChatsReturn {
    const [directChats, setDirectChats] = useState<Chat[]>([]);
    const [legacyGroupChats, setLegacyGroupChats] = useState<Chat[]>([]);
    const [groupChats, setGroupChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [directLoaded, setDirectLoaded] = useState(false);
    const [groupLoaded, setGroupLoaded] = useState(false);

    const currentUser = auth().currentUser;

    const normalizeChat = useCallback((
        doc: any,
        collectionName: 'chats' | 'group_chats'
    ): Chat => {
        const data = doc.data() || {};
        const participants = Array.isArray(data.participants) ? data.participants : [];
        const type: 'direct' | 'group' = data.type === 'group' ? 'group' : 'direct';

        return {
            id: doc.id,
            type,
            collectionName,
            ...data,
            participants,
            participantDetails: data.participantDetails || {},
            unreadCount: data.unreadCount || {},
            deletedBy: Array.isArray(data.deletedBy) ? data.deletedBy : [],
            groupName: type === 'group' ? (data.groupName || data.tripTitle || 'Group Chat') : data.groupName,
            groupIcon: type === 'group' ? (data.groupIcon || data.tripImage || null) : data.groupIcon,
            memberCount: typeof data.memberCount === 'number' ? data.memberCount : participants.length,
            hidden: data.hidden === true,
        } as Chat;
    }, []);

    // Listen to direct chats (chats collection)
    useEffect(() => {
        if (!currentUser) {
            setDirectChats([]);
            setLegacyGroupChats([]);
            setDirectLoaded(true);
            return;
        }

        const unsubscribe = firestore()
            .collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('updatedAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    if (!snapshot) {
                        setDirectChats([]);
                        setDirectLoaded(true);
                        return;
                    }

                    const chatsList: Chat[] = snapshot.docs
                        .map((doc) => normalizeChat(doc, 'chats'))
                        .filter((chat: any) => !chat.deletedBy?.includes(currentUser.uid) && chat.hidden !== true) as Chat[];

                    setDirectChats(chatsList.filter((chat) => chat.type === 'direct'));
                    setLegacyGroupChats(chatsList.filter((chat) => chat.type === 'group'));
                    setDirectLoaded(true);
                    setError(null);
                },
                (err) => {
                    setError(err as Error);
                    setDirectLoaded(true);
                }
            );

        return () => unsubscribe();
    }, [currentUser?.uid, refreshKey]);

    // Listen to group chats (group_chats collection)
    useEffect(() => {
        if (!currentUser) {
            setGroupChats([]);
            setGroupLoaded(true);
            return;
        }

        const unsubscribe = firestore()
            .collection('group_chats')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('updatedAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    if (!snapshot) {
                        setGroupChats([]);
                        setGroupLoaded(true);
                        return;
                    }

                    const chatsList: Chat[] = snapshot.docs
                        .map((doc) => normalizeChat(doc, 'group_chats'))
                        .filter((chat: any) => !chat.deletedBy?.includes(currentUser.uid) && chat.hidden !== true) as Chat[];

                    setGroupChats(chatsList);
                    setGroupLoaded(true);
                    setError(null);
                },
                (err) => {
                    setError(err as Error);
                    setGroupLoaded(true);
                }
            );

        return () => unsubscribe();
    }, [currentUser?.uid, refreshKey]);

    // Track overall loading state
    useEffect(() => {
        if (directLoaded && groupLoaded) {
            setLoading(false);
        }
    }, [directLoaded, groupLoaded]);

    // Merge and sort by updatedAt
    const chats = [...directChats, ...legacyGroupChats, ...groupChats].sort((a, b) => {
        const aTime = a.updatedAt
            ? (typeof (a.updatedAt as any).toDate === 'function'
                ? (a.updatedAt as any).toDate().getTime()
                : new Date(a.updatedAt as any).getTime())
            : 0;
        const bTime = b.updatedAt
            ? (typeof (b.updatedAt as any).toDate === 'function'
                ? (b.updatedAt as any).toDate().getTime()
                : new Date(b.updatedAt as any).getTime())
            : 0;
        return bTime - aTime;
    });

    const createDirectChat = useCallback(
        async (otherUserId: string, otherUserDetails: ChatParticipant): Promise<string> => {
            if (!currentUser) throw new Error('Not authenticated');

            const currentUserDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const currentUserData = currentUserDoc.data();

            const chatData: Omit<Chat, 'id'> = {
                type: 'direct',
                collectionName: 'chats',
                participants: [currentUser.uid, otherUserId],
                participantDetails: {
                    [currentUser.uid]: {
                        displayName: currentUserData?.name || currentUserData?.displayName || currentUser.displayName || 'User',
                        photoURL: currentUserData?.photoURL || currentUser.photoURL || '',
                    },
                    [otherUserId]: otherUserDetails,
                },
                unreadCount: {
                    [currentUser.uid]: 0,
                    [otherUserId]: 0,
                },
                deletedBy: [],
                clearedAt: {},
                createdAt: firestore.FieldValue.serverTimestamp() as any,
                updatedAt: firestore.FieldValue.serverTimestamp() as any,
            };

            const chatRef = await firestore().collection('chats').add(chatData);
            return chatRef.id;
        },
        [currentUser]
    );

    const getOrCreateDirectChat = useCallback(
        async (otherUserId: string, otherUserDetails: ChatParticipant): Promise<string> => {
            if (!currentUser) throw new Error('Not authenticated');

            // Check in memory first (direct chats only)
            const existingChat = directChats.find(
                (chat) =>
                    chat.participants.includes(currentUser.uid) &&
                    chat.participants.includes(otherUserId)
            );

            if (existingChat) {
                if (existingChat.deletedBy?.includes(currentUser.uid)) {
                    await firestore().collection('chats').doc(existingChat.id).update({
                        deletedBy: firestore.FieldValue.arrayRemove(currentUser.uid)
                    });
                }
                return existingChat.id;
            }

            // Query Firestore for existing direct chat
            const querySnapshot = await firestore()
                .collection('chats')
                .where('participants', 'array-contains', currentUser.uid)
                .get();

            const foundChat = querySnapshot.docs.find((doc) => {
                const data = doc.data();
                return data.participants.includes(otherUserId);
            });

            if (foundChat) {
                const data = foundChat.data();
                if (data.deletedBy?.includes(currentUser.uid)) {
                    await foundChat.ref.update({
                        deletedBy: firestore.FieldValue.arrayRemove(currentUser.uid)
                    });
                }
                return foundChat.id;
            }

            return createDirectChat(otherUserId, otherUserDetails);
        },
        [currentUser, directChats, createDirectChat]
    );

    const deleteChat = useCallback(async (chatId: string) => {
        if (!currentUser) return;
        try {
            const targetChat = [...directChats, ...legacyGroupChats, ...groupChats].find((chat) => chat.id === chatId);
            const collection = targetChat?.collectionName || 'chats';

            await firestore()
                .collection(collection)
                .doc(chatId)
                .update({
                    deletedBy: firestore.FieldValue.arrayUnion(currentUser.uid),
                });
        } catch (err) {
            throw err;
        }
    }, [currentUser, directChats, legacyGroupChats, groupChats]);

    const refreshChats = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    return {
        chats,
        loading,
        error,
        createDirectChat,
        getOrCreateDirectChat,
        deleteChat,
        refreshChats,
    };
}

export default useChats;
