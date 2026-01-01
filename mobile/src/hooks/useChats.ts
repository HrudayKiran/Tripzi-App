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
    participants: string[];
    participantDetails: { [uid: string]: ChatParticipant };
    groupName?: string;
    groupIcon?: string;
    createdBy?: string;
    lastMessage?: LastMessage;
    unreadCount: { [uid: string]: number };
    mutedBy: string[];
    pinnedBy: string[];
    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}

interface UseChatsReturn {
    chats: Chat[];
    loading: boolean;
    error: Error | null;
    createDirectChat: (otherUserId: string, otherUserDetails: ChatParticipant) => Promise<string>;
    getOrCreateDirectChat: (otherUserId: string, otherUserDetails: ChatParticipant) => Promise<string>;
    refreshChats: () => void;
}

export function useChats(): UseChatsReturn {
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const currentUser = auth().currentUser;

    useEffect(() => {
        if (!currentUser) {
            setChats([]);
            setLoading(false);
            return;
        }

        console.log('📱 [CHATS] Setting up chats listener for:', currentUser.uid);

        const unsubscribe = firestore()
            .collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('updatedAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    const chatsList: Chat[] = snapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    })) as Chat[];

                    console.log('📱 [CHATS] Loaded', chatsList.length, 'chats');
                    setChats(chatsList);
                    setLoading(false);
                    setError(null);
                },
                (err) => {
                    console.error('📱 [CHATS] Error loading chats:', err);
                    setError(err as Error);
                    setLoading(false);
                }
            );

        return () => unsubscribe();
    }, [currentUser?.uid, refreshKey]);

    const createDirectChat = useCallback(
        async (otherUserId: string, otherUserDetails: ChatParticipant): Promise<string> => {
            if (!currentUser) throw new Error('Not authenticated');

            const currentUserDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const currentUserData = currentUserDoc.data();

            const chatData: Omit<Chat, 'id'> = {
                type: 'direct',
                participants: [currentUser.uid, otherUserId],
                participantDetails: {
                    [currentUser.uid]: {
                        displayName: currentUserData?.displayName || currentUser.displayName || 'User',
                        photoURL: currentUserData?.photoURL || currentUser.photoURL || '',
                    },
                    [otherUserId]: otherUserDetails,
                },
                unreadCount: {
                    [currentUser.uid]: 0,
                    [otherUserId]: 0,
                },
                mutedBy: [],
                pinnedBy: [],
                createdAt: firestore.FieldValue.serverTimestamp() as any,
                updatedAt: firestore.FieldValue.serverTimestamp() as any,
            };

            const chatRef = await firestore().collection('chats').add(chatData);
            console.log('📱 [CHATS] Created new chat:', chatRef.id);
            return chatRef.id;
        },
        [currentUser]
    );

    const getOrCreateDirectChat = useCallback(
        async (otherUserId: string, otherUserDetails: ChatParticipant): Promise<string> => {
            if (!currentUser) throw new Error('Not authenticated');

            // Check if a direct chat already exists between these two users
            const existingChat = chats.find(
                (chat) =>
                    chat.type === 'direct' &&
                    chat.participants.includes(currentUser.uid) &&
                    chat.participants.includes(otherUserId)
            );

            if (existingChat) {
                console.log('📱 [CHATS] Found existing chat:', existingChat.id);
                return existingChat.id;
            }

            // Also check Firestore in case local state is stale
            const querySnapshot = await firestore()
                .collection('chats')
                .where('type', '==', 'direct')
                .where('participants', 'array-contains', currentUser.uid)
                .get();

            const foundChat = querySnapshot.docs.find((doc) => {
                const data = doc.data();
                return data.participants.includes(otherUserId);
            });

            if (foundChat) {
                console.log('📱 [CHATS] Found existing chat in Firestore:', foundChat.id);
                return foundChat.id;
            }

            // Create new chat
            return createDirectChat(otherUserId, otherUserDetails);
        },
        [currentUser, chats, createDirectChat]
    );

    const refreshChats = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    return {
        chats,
        loading,
        error,
        createDirectChat,
        getOrCreateDirectChat,
        refreshChats,
    };
}

export default useChats;
