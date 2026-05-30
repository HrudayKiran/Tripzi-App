import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useCallback, useEffect, useState } from 'react';

export interface ChatParticipant {
    displayName: string;
    photoURL: string;
    role?: 'admin' | 'member';
}

export interface LastMessage {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Date | null;
    type: 'text' | 'image' | 'location' | 'voice' | 'system';
}

export interface Chat {
    id: string;
    type: 'direct' | 'group';
    collectionName: 'direct_chats' | 'group_chats';
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
    clearedAt?: { [uid: string]: Date | null };
    createdAt: Date | null;
    updatedAt: Date | null;
}

const normalizeRow = (row: any, collectionName: 'direct_chats' | 'group_chats'): Chat => {
    const participants = Array.isArray(row.participants) ? row.participants : [];
    const type: 'direct' | 'group' = collectionName === 'group_chats' ? 'group' : 'direct';

    return {
        id: row.id,
        type,
        collectionName,
        participants,
        participantDetails: row.participant_details || {},
        groupName: type === 'group' ? (row.group_name || row.trip_title || 'Group Chat') : row.group_name,
        groupDescription: row.group_description,
        groupIcon: type === 'group' ? (row.group_icon || row.trip_image || null) : row.group_icon,
        tripImage: row.trip_image,
        tripId: row.trip_id,
        createdBy: row.created_by,
        memberCount: typeof row.member_count === 'number' ? row.member_count : participants.length,
        hidden: row.hidden === true,
        lastMessage: row.last_message ? {
            text: row.last_message.text || '',
            senderId: row.last_message.sender_id || '',
            senderName: row.last_message.sender_name || '',
            timestamp: row.last_message.created_at ? new Date(row.last_message.created_at) : null,
            type: row.last_message.type || 'text',
        } : undefined,
        unreadCount: row.unread_count || {},
        deletedBy: Array.isArray(row.deleted_by) ? row.deleted_by : [],
        clearedAt: row.cleared_at || {},
        createdAt: row.created_at ? new Date(row.created_at) : null,
        updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
};

export function useChatsQuery() {
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUserId(user?.id || null);
        });
    }, []);

    // Fetch direct chats
    const { data: directChats = [], isLoading: loadingDirect, error: errorDirect } = useQuery({
        queryKey: ['chats', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('direct_chats')
                .select('*')
                .contains('participants', [userId])
                .order('updated_at', { ascending: false });

            if (error) throw error;

            return (data || [])
                .map((row: any) => normalizeRow(row, 'direct_chats'))
                .filter((c) => !c.deletedBy?.includes(userId) && c.hidden !== true);
        },
        enabled: !!userId,
    });

    // Fetch group chats
    const { data: groupChats = [], isLoading: loadingGroup, error: errorGroup } = useQuery({
        queryKey: ['groupChats', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('group_chats')
                .select('*')
                .contains('participants', [userId])
                .order('updated_at', { ascending: false });

            if (error) throw error;

            return (data || [])
                .map((row: any) => normalizeRow(row, 'group_chats'))
                .filter((c) => !c.deletedBy?.includes(userId) && c.hidden !== true);
        },
        enabled: !!userId,
    });

    const chats = [...directChats, ...groupChats].sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
    });

    const loading = loadingDirect || loadingGroup;
    const error = errorDirect || errorGroup;

    // Mutations
    const createDirectChatMutation = useMutation({
        mutationFn: async ({ otherUserId, otherUserDetails }: { otherUserId: string, otherUserDetails: ChatParticipant }) => {
            if (!userId) throw new Error('Not authenticated');

            const { data: profile } = await supabase
                .from('profiles')
                .select('name, photo_url')
                .eq('id', userId)
                .maybeSingle();

            const chatData = {
                participants: [userId, otherUserId],
                participant_details: {
                    [userId]: {
                        displayName: profile?.name || 'User',
                        photoURL: profile?.photo_url || '',
                    },
                    [otherUserId]: otherUserDetails,
                },
                unread_count: { [userId]: 0, [otherUserId]: 0 },
                deleted_by: [],
            };

            const { data, error: insertError } = await supabase
                .from('direct_chats')
                .insert(chatData)
                .select('id')
                .single();

            if (insertError || !data) throw new Error(insertError?.message || 'Failed to create chat');
            return data.id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chats', userId] });
        },
    });

    const deleteChatMutation = useMutation({
        mutationFn: async (chatId: string) => {
            if (!userId) return;

            // Determine correct table dynamically by checking direct_chats first
            const { data: directCheck } = await supabase
                .from('direct_chats')
                .select('id')
                .eq('id', chatId)
                .maybeSingle();

            const table = directCheck ? 'direct_chats' : 'group_chats';

            const { data: current } = await supabase
                .from(table)
                .select('deleted_by')
                .eq('id', chatId)
                .maybeSingle();

            const deletedBy = Array.isArray(current?.deleted_by) ? [...current.deleted_by, userId] : [userId];
            await supabase.from(table).update({ deleted_by: deletedBy }).eq('id', chatId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chats', userId] });
            queryClient.invalidateQueries({ queryKey: ['groupChats', userId] });
        },
    });

    // Realtime subscription
    useEffect(() => {
        if (!userId) return;

        // Unique suffixes to prevent "cannot add callbacks after subscribe()" errors on hot-reloads
        const channelDirect = supabase
            .channel(`chats-direct-query-${userId}-${Math.random().toString(36).substring(7)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_chats' }, () => {
                queryClient.invalidateQueries({ queryKey: ['chats', userId] });
            })
            .subscribe();

        const channelGroup = supabase
            .channel(`chats-group-query-${userId}-${Math.random().toString(36).substring(7)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chats' }, () => {
                queryClient.invalidateQueries({ queryKey: ['groupChats', userId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channelDirect);
            supabase.removeChannel(channelGroup);
        };
    }, [userId, queryClient]);

    const getOrCreateDirectChat = useCallback(
        async (otherUserId: string, otherUserDetails: ChatParticipant): Promise<string> => {
            if (!userId) throw new Error('Not authenticated');

            // Check in memory
            const existing = directChats.find(
                (chat) => chat.participants.includes(userId) && chat.participants.includes(otherUserId)
            );

            if (existing) {
                if (existing.deletedBy?.includes(userId)) {
                    const newDeletedBy = existing.deletedBy.filter((id) => id !== userId);
                    await supabase.from('direct_chats').update({ deleted_by: newDeletedBy }).eq('id', existing.id);
                    queryClient.invalidateQueries({ queryKey: ['chats', userId] });
                }
                return existing.id;
            }

            // Query DB
            const { data: found } = await supabase
                .from('direct_chats')
                .select('id, participants, deleted_by')
                .contains('participants', [userId]);

            const match = (found || []).find((c: any) =>
                Array.isArray(c.participants) && c.participants.includes(otherUserId)
            );

            if (match) {
                if (Array.isArray(match.deleted_by) && match.deleted_by.includes(userId)) {
                    const newDeletedBy = match.deleted_by.filter((id: string) => id !== userId);
                    await supabase.from('direct_chats').update({ deleted_by: newDeletedBy }).eq('id', match.id);
                    queryClient.invalidateQueries({ queryKey: ['chats', userId] });
                }
                return match.id;
            }

            return createDirectChatMutation.mutateAsync({ otherUserId, otherUserDetails });
        },
        [userId, directChats, createDirectChatMutation, queryClient]
    );

    return {
        chats,
        loading,
        error,
        createDirectChat: (otherUserId: string, otherUserDetails: ChatParticipant) => createDirectChatMutation.mutateAsync({ otherUserId, otherUserDetails }),
        getOrCreateDirectChat,
        deleteChat: deleteChatMutation.mutateAsync,
        refreshChats: () => {
            queryClient.invalidateQueries({ queryKey: ['chats', userId] });
            queryClient.invalidateQueries({ queryKey: ['groupChats', userId] });
        },
    };
}

export default useChatsQuery;
