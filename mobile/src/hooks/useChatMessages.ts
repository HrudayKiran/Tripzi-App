import { useState, useEffect, useCallback } from 'react';
import { database } from '../database';
import MessageModel from '../database/models/Message';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '../lib/supabase';

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

export interface ChatMessage {
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
    readBy: { [uid: string]: string | null };
    deliveredTo: string[];
    editedAt?: Date | null;
    deletedFor: string[];
    deletedForEveryoneAt?: Date | null;
    mentions?: string[];
    createdAt: Date | null;
}

interface UseChatMessagesReturn {
    messages: ChatMessage[];
    loading: boolean;
    error: Error | null;
    sendMessage: (text: string, replyTo?: ReplyTo, mentions?: string[]) => Promise<void>;
    markAsRead: () => Promise<void>;
    loadMoreMessages: () => void;
    hasMore: boolean;
}

const mapModelToMessage = (m: MessageModel): ChatMessage => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    type: m.type as MessageType,
    text: m.text,
    mediaUrl: m.mediaUrl,
    mediaThumbnail: m.mediaThumbnail,
    location: m.locationData,
    voiceDuration: m.voiceDuration,
    replyTo: m.replyToData,
    status: m.status as MessageStatus,
    readBy: m.readByData || {},
    deliveredTo: m.deliveredToData || [],
    editedAt: m.editedAt ? new Date(m.editedAt) : null,
    deletedFor: m.deletedForData || [],
    deletedForEveryoneAt: m.deletedForEveryoneAt ? new Date(m.deletedForEveryoneAt) : null,
    mentions: m.mentionsData || [],
    createdAt: new Date(m.createdAt),
});

export function useChatMessages(
    chatId: string | undefined,
    clearedAt?: Date | null
): UseChatMessagesReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null));
    }, []);

    useEffect(() => {
        if (!chatId) return;

        const subscription = database.get<MessageModel>('messages')
            .query(
                Q.where('chat_id', chatId),
                Q.sortBy('created_at', Q.asc)
            )
            .observe()
            .subscribe((newMessages) => {
                setMessages(newMessages.map(mapModelToMessage));
                setLoading(false);
            });

        return () => subscription.unsubscribe();
    }, [chatId]);

    const sendMessage = useCallback(async (text: string, replyTo?: ReplyTo, mentions?: string[]) => {
        if (!chatId || !userId || !text.trim()) return;

        const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
        const senderName = profile?.name || 'User';

        await database.write(async () => {
            await database.get<MessageModel>('messages').create((m: MessageModel) => {
                m.chatId = chatId;
                m.senderId = userId;
                m.senderName = senderName;
                m.type = 'text';
                m.text = text.trim();
                m.status = 'pending';
                if (replyTo) (m as any).replyToRaw = JSON.stringify(replyTo);
                if (mentions) (m as any).mentionsRaw = JSON.stringify(mentions);
            });
        });

        // Trigger sync in background
        require('../database/sync').syncDatabase().catch(console.error);
    }, [chatId, userId]);

    const markAsRead = useCallback(async () => {
        // Implementation for marking as read locally
    }, []);

    return {
        messages,
        loading,
        error,
        sendMessage,
        markAsRead,
        loadMoreMessages: () => {},
        hasMore: false,
    };
}

export default useChatMessages;
