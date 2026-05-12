import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useState, useEffect, useCallback } from 'react';

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

export function useChatMessagesQuery(
    chatId: string | undefined,
    chatType: 'direct' | 'group' | undefined
) {
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null));
    }, []);

    const { data: messages = [], isLoading: loading, error, refetch } = useQuery({
        queryKey: ['messages', chatId],
        queryFn: async () => {
            if (!chatId) return [];

            console.log(`[useChatMessagesQuery] Fetching messages for chat ${chatId} from Supabase...`);
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('[useChatMessagesQuery] Error fetching messages:', error);
                throw error;
            }

            console.log(`[useChatMessagesQuery] Fetched ${data?.length || 0} messages.`);

            // Map Supabase snake_case to camelCase
            return (data || []).map((m: any) => ({
                id: m.id,
                senderId: m.sender_id,
                senderName: m.sender_name,
                type: m.type as MessageType,
                text: m.text,
                mediaUrl: m.media_url,
                mediaThumbnail: m.media_thumbnail,
                location: m.location ? (typeof m.location === 'string' ? JSON.parse(m.location) : m.location) : null,
                voiceDuration: m.voice_duration,
                replyTo: m.reply_to ? (typeof m.reply_to === 'string' ? JSON.parse(m.reply_to) : m.reply_to) : null,
                status: m.status as MessageStatus,
                readBy: m.read_by || {},
                deliveredTo: m.delivered_to || [],
                editedAt: m.edited_at ? new Date(m.edited_at) : null,
                deletedFor: m.deleted_for || [],
                deletedForEveryoneAt: m.deleted_for_everyone_at ? new Date(m.deleted_for_everyone_at) : null,
                mentions: m.mentions || [],
                createdAt: new Date(m.created_at),
            }));
        },
        enabled: !!chatId,
    });

    const sendMessageMutation = useMutation({
        mutationFn: async ({ text, replyTo, mentions }: { text: string, replyTo?: ReplyTo, mentions?: string[] }) => {
            if (!chatId || !userId || !text.trim() || !chatType) return;

            const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
            const senderName = profile?.name || 'User';

            const { data, error } = await supabase
                .from('messages')
                .insert([{
                    chat_id: chatId,
                    chat_type: chatType,
                    sender_id: userId,
                    sender_name: senderName,
                    type: 'text',
                    text: text.trim(),
                    status: 'sent',
                    reply_to: replyTo ? JSON.stringify(replyTo) : null,
                    mentions: mentions || [],
                }])
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
        },
    });

    const sendMessage = useCallback(async (text: string, replyTo?: ReplyTo, mentions?: string[]) => {
        await sendMessageMutation.mutateAsync({ text, replyTo, mentions });
    }, [sendMessageMutation]);

    // Realtime subscription
    useEffect(() => {
        if (!chatId) return;

        const channel = supabase
            .channel(`messages-${chatId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => {
                queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatId, queryClient]);

    return {
        messages,
        loading,
        error,
        sendMessage,
        markAsRead: async () => {},
        loadMoreMessages: () => {},
        hasMore: false,
    };
}

export default useChatMessagesQuery;
