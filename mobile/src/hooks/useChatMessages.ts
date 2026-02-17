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

    mentions?: string[];
    createdAt: FirestoreTimestamp;
}

interface UseChatMessagesReturn {
    messages: Message[];
    loading: boolean;
    error: Error | null;
    sendMessage: (text: string, replyTo?: ReplyTo, mentions?: string[]) => Promise<void>;
    markAsRead: () => Promise<void>;
    loadMoreMessages: () => void;
    hasMore: boolean;
}

const PAGE_SIZE = 50;

export function useChatMessages(chatId: string | undefined, clearedAt?: FirestoreTimestamp): UseChatMessagesReturn {
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
                            if (msg.deletedFor?.includes(currentUser.uid)) return false;

                            // Filter out messages before clearedAt
                            if (clearedAt && msg.createdAt) {
                                const msgTime = (msg.createdAt as any).toDate ? (msg.createdAt as any).toDate() : new Date(msg.createdAt as any);
                                const clearTime = (clearedAt as any).toDate ? (clearedAt as any).toDate() : new Date(clearedAt as any);
                                if (msgTime <= clearTime) return false;
                            }
                            return true;
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
                    
                    setError(err as Error);
                    setLoading(false);
                }
            );

        return () => unsubscribe();
    }, [chatId, currentUser?.uid, clearedAt]); // Re-run if clearedAt changes

    // Lock to prevent double-send
    const sendingLock = useRef(false);

    const sendMessage = useCallback(
        async (text: string, replyTo?: ReplyTo, mentions?: string[]): Promise<void> => {
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

                const messageData: Omit<Message, 'id'> & { mentions?: string[] } = {
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

                if (mentions && mentions.length > 0) {
                    messageData.mentions = mentions;
                }

                // Create message
                await firestore()
                    .collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .add(messageData);

                // Update chat's lastMessage and updatedAt AND unhide chat (remove from deletedBy)
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
                        // UNHIDE CHAT: Remove ONLY the current user from deletedBy so they see it again. 
                        // Actually, remove EVERYONE so it reappears for other person too if they deleted it? 
                        // "when the same user sends a message then again that conversation will appear" - implies for sender.
                        // "like whatsapp" -> if I delete chat, sending msg brings it back. 
                        // If *recipient* deleted it, receiving msg brings it back.
                        // So we should remove ALL participants from deletedBy to ensure visibility for everyone?
                        // Or just remove current user? 
                        // WhatsApp: if I delete chat, valid for me. Receiving msg brings it back. Sending msg brings it back.
                        // So we should ideally clear `deletedBy` for ALL participants (empty array) or remove specific users.
                        // Ideally we remove Current User AND Recipient if they blocked it.
                        // Simpler: Just set deletedBy to empty array? Or just remove current user?
                        // If I deleted it, `deletedBy` has `[me]`. Sending msg -> remove `me`.
                        // If recipient deleted it, `deletedBy` has `[them]`. Receiving msg (here) -> remove `them`.
                        // So we should remove ALL UIDs from `deletedBy`? Or just reset it to []?
                        // Resetting to [] is safest to ensure everyone sees the new message.
                        deletedBy: []
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
