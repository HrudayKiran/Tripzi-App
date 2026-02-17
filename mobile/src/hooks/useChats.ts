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

        const unsubscribe = firestore()
            .collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('updatedAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    if (!snapshot) {
                        setChats([]);
                        setLoading(false);
                        return;
                    }

                    const chatsList: Chat[] = snapshot.docs
                        .map((doc) => ({
                            id: doc.id,
                            ...doc.data(),
                        }))
                        .filter((chat: any) => !chat.deletedBy?.includes(currentUser.uid)) as Chat[];

                    setChats(chatsList);
                    setLoading(false);
                    setError(null);
                },
                (err) => {
                    
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

            const existingChat = chats.find(
                (chat) =>
                    chat.type === 'direct' &&
                    chat.participants.includes(currentUser.uid) &&
                    chat.participants.includes(otherUserId)
            );

            if (existingChat) {
                // If it was deleted, restore it (optimization: only if needed, but safe to always do)
                if (existingChat.deletedBy?.includes(currentUser.uid)) {
                    await firestore().collection('chats').doc(existingChat.id).update({
                        deletedBy: firestore.FieldValue.arrayRemove(currentUser.uid)
                    });
                }
                return existingChat.id;
            }

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
                // Restore if deleted
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
        [currentUser, chats, createDirectChat]
    );

    const deleteChat = useCallback(async (chatId: string) => {
        if (!currentUser) return;
        try {
            await firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                    deletedBy: firestore.FieldValue.arrayUnion(currentUser.uid),
                    // [`clearedAt.${currentUser.uid}`]: firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            
            throw error;
        }
    }, [currentUser]);

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
