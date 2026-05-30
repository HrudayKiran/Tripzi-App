import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

interface UseChatsReturn {
    chats: Chat[];
    loading: boolean;
    error: Error | null;
    createDirectChat: (otherUserId: string, otherUserDetails: ChatParticipant) => Promise<string>;
    getOrCreateDirectChat: (otherUserId: string, otherUserDetails: ChatParticipant) => Promise<string>;
    deleteChat: (chatId: string) => Promise<void>;
    refreshChats: () => void;
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

export function useChats(): UseChatsReturn {
    const [directChats, setDirectChats] = useState<Chat[]>([]);
    const [groupChats, setGroupChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUserId(user?.id || null);
        });
    }, []);

    // Fetch direct chats
    useEffect(() => {
        if (!userId) { setDirectChats([]); return; }

        const fetchDirect = async () => {
            const { data, error: err } = await supabase
                .from('direct_chats')
                .select('*')
                .contains('participants', [userId])
                .order('updated_at', { ascending: false });

            if (err) { setError(err as any); return; }

            const chats = (data || [])
                .map((row: any) => normalizeRow(row, 'direct_chats'))
                .filter((c) => !c.deletedBy?.includes(userId) && c.hidden !== true);

            setDirectChats(chats);
        };

        fetchDirect();

        const channelName = `chats-direct-${userId}-${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_chats' }, () => fetchDirect())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId, refreshKey]);

    // Fetch group chats
    useEffect(() => {
        if (!userId) { setGroupChats([]); setLoading(false); return; }

        const fetchGroups = async () => {
            const { data, error: err } = await supabase
                .from('group_chats')
                .select('*')
                .contains('participants', [userId])
                .order('updated_at', { ascending: false });

            if (err) { setError(err as any); return; }

            const chats = (data || [])
                .map((row: any) => normalizeRow(row, 'group_chats'))
                .filter((c) => !c.deletedBy?.includes(userId) && c.hidden !== true);

            setGroupChats(chats);
            setLoading(false);
        };

        fetchGroups();

        const channelName = `chats-group-${userId}-${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chats' }, () => fetchGroups())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId, refreshKey]);

    const chats = [...directChats, ...groupChats].sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
    });

    const createDirectChat = useCallback(
        async (otherUserId: string, otherUserDetails: ChatParticipant): Promise<string> => {
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
        [userId]
    );

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
                }
                return match.id;
            }

            return createDirectChat(otherUserId, otherUserDetails);
        },
        [userId, directChats, createDirectChat]
    );

    const deleteChat = useCallback(async (chatId: string) => {
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
    }, [userId]);

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
