import { useState, useEffect, useCallback, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Module-level lock to prevent duplicate sends across hook instances
// Key: chatId + messageText hash, Value: timestamp of last send
const sendLockMap = new Map<string, number>();
const SEND_LOCK_DURATION = 2000; // 2 seconds lock per message

// Firestore types
type FirestoreTimestamp = { toDate: () => Date } | Date | null;

export type MessageType = 'text' | 'image' | 'video' | 'location' | 'voice' | 'system' | 'trip_share';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';

export interface ReplyTo {
    messageId: string;
    text: string;
    senderId: string;
}

export interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}

export interface Message {
    id: string;
    senderId: string;
    senderName: string;
    type: MessageType;
    text?: string;
    mediaUrl?: string;
    mediaThumbnail?: string;
    location?: LocationData;
    voiceDuration?: number;
    replyTo?: ReplyTo;
    status: MessageStatus;
    readBy: { [uid: string]: FirestoreTimestamp };
    deliveredTo: string[];
    editedAt?: FirestoreTimestamp;
    deletedFor: string[];
    deletedForEveryoneAt?: FirestoreTimestamp;
    createdAt: FirestoreTimestamp;
}

interface UseChatMessagesReturn {
    messages: Message[];
    loading: boolean;
    error: Error | null;
    sendMessage: (text: string, replyTo?: ReplyTo) => Promise<void>;
    markAsRead: () => Promise<void>;
    loadMoreMessages: () => void;
    hasMore: boolean;
}

const PAGE_SIZE = 50;

export function useChatMessages(chatId: string | undefined): UseChatMessagesReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);

    const currentUser = auth().currentUser;

    // Real-time message listener
    useEffect(() => {
        if (!chatId || !currentUser) {
            setMessages([]);
            setLoading(false);
            return;
        }


        const unsubscribe = firestore()
            .collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(PAGE_SIZE)
            .onSnapshot(
                (snapshot) => {
                    // Guard against null snapshot
                    if (!snapshot) {
                        setMessages([]);
                        setLoading(false);
                        return;
                    }

                    const messagesList: Message[] = snapshot.docs
                        .map((doc) => ({
                            id: doc.id,
                            ...doc.data(),
                        }))
                        .filter((msg: any) => {
                            // Filter out messages deleted for current user
                            return !msg.deletedFor?.includes(currentUser.uid);
                        }) as Message[];

                    // Reverse to show oldest first (for chat UI)
                    setMessages(messagesList.reverse());

                    if (snapshot.docs.length > 0) {
                        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
                    }
                    setHasMore(snapshot.docs.length === PAGE_SIZE);
                    setLoading(false);
                    setError(null);

                },
                (err) => {
                    console.error('💬 [MESSAGES] Error:', err);
                    setError(err as Error);
                    setLoading(false);
                }
            );

        return () => unsubscribe();
    }, [chatId, currentUser?.uid]);

    // Lock to prevent double-send
    const sendingLock = useRef(false);

    const sendMessage = useCallback(
        async (text: string, replyTo?: ReplyTo): Promise<void> => {
            if (!chatId || !currentUser || !text.trim()) return;

            // Create a unique key for this message to prevent duplicates
            const messageKey = `${chatId}:${text.trim().substring(0, 50)}`;
            const now = Date.now();
            const lastSendTime = sendLockMap.get(messageKey);

            // Check if this exact message was sent recently (within lock duration)
            if (lastSendTime && (now - lastSendTime) < SEND_LOCK_DURATION) {
                return;
            }

            // Also check ref lock
            if (sendingLock.current) {
                return;
            }

            // Set both locks
            sendLockMap.set(messageKey, now);
            sendingLock.current = true;

            try {
                const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
                const userData = userDoc.data();

                const messageData: Omit<Message, 'id'> = {
                    senderId: currentUser.uid,
                    senderName: userData?.displayName || currentUser.displayName || 'User',
                    type: 'text',
                    text: text.trim(),
                    status: 'sent',
                    readBy: {},
                    deliveredTo: [],
                    deletedFor: [],
                    createdAt: firestore.FieldValue.serverTimestamp() as any,
                };

                if (replyTo) {
                    messageData.replyTo = replyTo;
                }

                // Create message
                await firestore()
                    .collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .add(messageData);

                // Update chat's lastMessage and updatedAt
                await firestore()
                    .collection('chats')
                    .doc(chatId)
                    .update({
                        lastMessage: {
                            text: text.trim(),
                            senderId: currentUser.uid,
                            senderName: userData?.displayName || currentUser.displayName || 'User',
                            timestamp: firestore.FieldValue.serverTimestamp(),
                            type: 'text',
                        },
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                        // Increment unread count for other participants
                        [`unreadCount.${currentUser.uid}`]: 0,
                    });


            } finally {
                // Unlock after a short delay to prevent rapid re-sends
                setTimeout(() => {
                    sendingLock.current = false;
                }, 500);
            }
        },
        [chatId, currentUser]
    );

    const markAsRead = useCallback(async (): Promise<void> => {
        if (!chatId || !currentUser) return;

        try {
            // Reset unread count for current user
            await firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                    [`unreadCount.${currentUser.uid}`]: 0,
                });

            // Mark unread messages as read
            const unreadMessages = messages.filter(
                (msg) => msg.senderId !== currentUser.uid && !msg.readBy?.[currentUser.uid]
            );

            const batch = firestore().batch();
            unreadMessages.forEach((msg) => {
                const msgRef = firestore()
                    .collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .doc(msg.id);
                batch.update(msgRef, {
                    [`readBy.${currentUser.uid}`]: firestore.FieldValue.serverTimestamp(),
                    status: 'read',
                });
            });

            await batch.commit();

        } catch (err) {
            console.error('💬 [MESSAGES] Error marking as read:', err);
        }
    }, [chatId, currentUser, messages]);

    const loadMoreMessages = useCallback(() => {
        // Pagination can be implemented here if needed

    }, []);

    return {
        messages,
        loading,
        error,
        sendMessage,
        markAsRead,
        loadMoreMessages,
        hasMore,
    };
}

export default useChatMessages;
