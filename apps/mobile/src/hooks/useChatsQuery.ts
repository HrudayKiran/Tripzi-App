import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useCallback, useEffect } from 'react';
import { useCurrentUser } from './useCurrentUser';
import type { ChatParticipant, LastMessage, Chat } from '../types/chat';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';

// Re-export types from centralized location
export type { ChatParticipant, LastMessage, Chat } from '../types/chat';

import { parsePostgresDate, parsePostgresDateToMs, parsePostgresDateToMsOrNull } from '../utils/date';
export { parsePostgresDate, parsePostgresDateToMs, parsePostgresDateToMsOrNull };

const normalizeRow = (row: any, collectionName: 'direct_chats' | 'group_chats', userId: string | null): Chat => {
    const participants = Array.isArray(row.participants) ? row.participants : [];
    const type: 'direct' | 'group' = collectionName === 'group_chats' ? 'group' : 'direct';

    const parseDateSafe = (val: any) => parsePostgresDate(val);

    let lastMessage = row.last_message ? {
        text: row.last_message.text || '',
        senderId: row.last_message.sender_id || '',
        senderName: row.last_message.sender_name || '',
        timestamp: parseDateSafe(row.last_message.created_at),
        type: row.last_message.type || 'text',
    } : undefined;

    // Filter out lastMessage if it was sent before the user cleared the chat
    if (userId && lastMessage && lastMessage.timestamp && row.cleared_at?.[userId]) {
        const clearedAtDate = parseDateSafe(row.cleared_at[userId]);
        if (clearedAtDate && lastMessage.timestamp <= clearedAtDate) {
            lastMessage = undefined;
        }
    }

    const clearedAtObj: { [uid: string]: Date | null } = {};
    const rawClearedAt = typeof row.cleared_at === 'string'
        ? (() => {
            try { return JSON.parse(row.cleared_at); } catch (e) { return {}; }
        })()
        : row.cleared_at || {};

    if (rawClearedAt && typeof rawClearedAt === 'object') {
        Object.keys(rawClearedAt).forEach(uid => {
            const val = rawClearedAt[uid];
            clearedAtObj[uid] = parseDateSafe(val);
        });
    }

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
        lastMessage,
        unreadCount: row.unread_count || {},
        deletedBy: Array.isArray(row.deleted_by) ? row.deleted_by : [],
        clearedAt: clearedAtObj,
        createdAt: row.created_at ? new Date(row.created_at) : null,
        updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
};

const normalizeLocalChat = (row: any, collectionName: 'direct_chats' | 'group_chats', userId: string | null): Chat => {
    const type: 'direct' | 'group' = collectionName === 'group_chats' ? 'group' : 'direct';
    const participants = row.participants || [];

    const parseDateSafe = (val: any) => parsePostgresDate(val);

    let lastMessageObj: any = null;
    if (row.lastMessage) {
        try {
            lastMessageObj = typeof row.lastMessage === 'string' ? JSON.parse(row.lastMessage) : row.lastMessage;
        } catch (e) { }
    }

    let lastMessage: LastMessage | undefined;
    if (lastMessageObj) {
        lastMessage = {
            text: lastMessageObj.text || '',
            senderId: lastMessageObj.sender_id || '',
            senderName: lastMessageObj.sender_name || '',
            timestamp: parseDateSafe(lastMessageObj.created_at),
            type: lastMessageObj.type || 'text',
        };
    }

    let clearedAtMap: Record<string, string> = {};
    if (row.clearedAtRaw) {
        try {
            clearedAtMap = JSON.parse(row.clearedAtRaw);
        } catch (e) { }
    }

    if (userId && lastMessage && lastMessage.timestamp && clearedAtMap[userId]) {
        const clearedAtDate = parseDateSafe(clearedAtMap[userId]);
        if (clearedAtDate && lastMessage.timestamp <= clearedAtDate) {
            lastMessage = undefined;
        }
    }

    const clearedAtObj: { [uid: string]: Date | null } = {};
    Object.keys(clearedAtMap).forEach(uid => {
        clearedAtObj[uid] = parseDateSafe(clearedAtMap[uid]);
    });

    let deletedBy: string[] = [];
    const deletedForRaw = row.deletedForRaw;
    if (deletedForRaw) {
        try {
            deletedBy = JSON.parse(deletedForRaw);
        } catch (e) { }
    }

    let participantDetails: Record<string, any> = {};
    const detailsRaw = row.participantDetailsRaw;
    if (detailsRaw) {
        try {
            participantDetails = JSON.parse(detailsRaw);
        } catch (e) { }
    }

    return {
        id: row.id,
        type,
        collectionName,
        participants,
        participantDetails,
        groupName: type === 'group' ? (row.groupName || 'Group Chat') : undefined,
        groupDescription: type === 'group' ? row.groupDescription : undefined,
        groupIcon: type === 'group' ? row.groupIcon : undefined,
        createdBy: type === 'group' ? row.createdBy : undefined,
        memberCount: type === 'group' ? (row.memberCount || participants.length) : participants.length,
        hidden: row.hidden === true,
        lastMessage,
        unreadCount: row.unreadCount || {},
        deletedBy,
        clearedAt: clearedAtObj,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
};

export function useChatsQuery() {
    const queryClient = useQueryClient();
    // C6: Use centralized useCurrentUser hook instead of inline auth.getUser()
    const { userId } = useCurrentUser();

    // Fetch direct chats from WatermelonDB locally
    const { data: directChats = [], isLoading: loadingDirect, error: errorDirect } = useQuery({
        queryKey: ['chats', userId],
        queryFn: async () => {
            if (!userId) return [];
            const localChats = await database.get('direct_chats').query().fetch();
            return localChats
                .map((row: any) => normalizeLocalChat(row, 'direct_chats', userId))
                .filter((c) => !c.deletedBy?.includes(userId) && c.hidden !== true);
        },
        enabled: !!userId,
        staleTime: 30_000,
    });

    // Fetch group chats from WatermelonDB locally
    const { data: groupChats = [], isLoading: loadingGroup, error: errorGroup } = useQuery({
        queryKey: ['groupChats', userId],
        queryFn: async () => {
            if (!userId) return [];
            const localGroupChats = await database.get('group_chats').query().fetch();
            return localGroupChats
                .map((row: any) => normalizeLocalChat(row, 'group_chats', userId))
                .filter((c) => !c.deletedBy?.includes(userId) && c.hidden !== true);
        },
        enabled: !!userId,
        staleTime: 30_000,
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

    // Realtime channel names with random suffixes (C4)
    useEffect(() => {
        if (!userId) return;

        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const directName = `chats-direct-${userId}-${randomSuffix}`;
        const groupName = `chats-group-${userId}-${randomSuffix}`;

        const channelDirect = supabase
            .channel(directName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_chats' }, async (payload) => {
                const newRow = payload.new as any;
                const oldRow = payload.old as any;

                try {
                    await database.write(async () => {
                        const collection = database.get('direct_chats');
                        if (payload.eventType === 'INSERT') {
                            try {
                                await collection.find(newRow.id);
                            } catch (e) {
                                await collection.create((rec: any) => {
                                    rec._raw.id = newRow.id;
                                    rec.participantsRaw = JSON.stringify(newRow.participants);
                                    rec.participantDetailsRaw = JSON.stringify(newRow.participant_details || {});
                                    rec.lastMessage = JSON.stringify(newRow.last_message);
                                    rec.lastMessageAt = newRow.last_message_at;
                                    rec.unreadCountRaw = JSON.stringify(newRow.unread_count);
                                    rec.clearedAtRaw = JSON.stringify(newRow.cleared_at);
                                    rec.deletedForRaw = JSON.stringify(newRow.deleted_by || []);
                                    rec.typingRaw = JSON.stringify(newRow.typing || {});
                                    rec._raw.created_at = parsePostgresDateToMs(newRow.created_at);
                                    rec._raw.updated_at = parsePostgresDateToMs(newRow.updated_at);
                                });
                            }
                        } else if (payload.eventType === 'UPDATE') {
                            try {
                                const existing = await collection.find(newRow.id);
                                await existing.update((rec: any) => {
                                    rec.participantsRaw = JSON.stringify(newRow.participants);
                                    rec.participantDetailsRaw = JSON.stringify(newRow.participant_details || {});
                                    rec.lastMessage = JSON.stringify(newRow.last_message);
                                    rec.lastMessageAt = newRow.last_message_at;
                                    rec.unreadCountRaw = JSON.stringify(newRow.unread_count);
                                    rec.clearedAtRaw = JSON.stringify(newRow.cleared_at);
                                    rec.deletedForRaw = JSON.stringify(newRow.deleted_by || []);
                                    rec.typingRaw = JSON.stringify(newRow.typing || {});
                                    rec._raw.updated_at = parsePostgresDateToMs(newRow.updated_at);
                                });
                            } catch (e) {
                                await collection.create((rec: any) => {
                                    rec._raw.id = newRow.id;
                                    rec.participantsRaw = JSON.stringify(newRow.participants);
                                    rec.participantDetailsRaw = JSON.stringify(newRow.participant_details || {});
                                    rec.lastMessage = JSON.stringify(newRow.last_message);
                                    rec.lastMessageAt = newRow.last_message_at;
                                    rec.unreadCountRaw = JSON.stringify(newRow.unread_count);
                                    rec.clearedAtRaw = JSON.stringify(newRow.cleared_at);
                                    rec.deletedForRaw = JSON.stringify(newRow.deleted_by || []);
                                    rec.typingRaw = JSON.stringify(newRow.typing || {});
                                    rec._raw.created_at = parsePostgresDateToMs(newRow.created_at);
                                    rec._raw.updated_at = parsePostgresDateToMs(newRow.updated_at);
                                });
                            }
                        } else if (payload.eventType === 'DELETE') {
                            try {
                                const existing = await collection.find(oldRow.id);
                                await existing.destroyPermanently();
                            } catch (e) { }
                        }
                    });
                } catch (e) {
                    console.error('[ChatsListSync] Failed to persist direct_chat changes:', e);
                }

                queryClient.invalidateQueries({ queryKey: ['chats', userId] });
            })
            .subscribe();

        const channelGroup = supabase
            .channel(groupName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chats' }, async (payload) => {
                const newRow = payload.new as any;
                const oldRow = payload.old as any;

                try {
                    await database.write(async () => {
                        const collection = database.get('group_chats');
                        if (payload.eventType === 'INSERT') {
                            try {
                                await collection.find(newRow.id);
                            } catch (e) {
                                await collection.create((rec: any) => {
                                    rec._raw.id = newRow.id;
                                    rec.groupName = newRow.group_name;
                                    rec.groupDescription = newRow.group_description;
                                    rec.groupIcon = newRow.group_icon;
                                    rec.participantsRaw = JSON.stringify(newRow.participants);
                                    rec.participantDetailsRaw = JSON.stringify(newRow.participant_details);
                                    rec.createdBy = newRow.created_by;
                                    rec.memberCount = newRow.member_count;
                                    rec.hidden = newRow.hidden;
                                    rec.adminsRaw = JSON.stringify(newRow.admins || []);
                                    rec.lastMessage = JSON.stringify(newRow.last_message);
                                    rec.unreadCountRaw = JSON.stringify(newRow.unread_count);
                                    rec.deletedForRaw = JSON.stringify(newRow.deleted_by || []);
                                    rec.clearedAtRaw = JSON.stringify(newRow.cleared_at || {});
                                    rec.typingRaw = JSON.stringify(newRow.typing || {});
                                    rec._raw.created_at = parsePostgresDateToMs(newRow.created_at);
                                    rec._raw.updated_at = parsePostgresDateToMs(newRow.updated_at);
                                });
                            }
                        } else if (payload.eventType === 'UPDATE') {
                            try {
                                const existing = await collection.find(newRow.id);
                                await existing.update((rec: any) => {
                                    rec.groupName = newRow.group_name;
                                    rec.groupDescription = newRow.group_description;
                                    rec.groupIcon = newRow.group_icon;
                                    rec.participantsRaw = JSON.stringify(newRow.participants);
                                    rec.participantDetailsRaw = JSON.stringify(newRow.participant_details);
                                    rec.createdBy = newRow.created_by;
                                    rec.memberCount = newRow.member_count;
                                    rec.hidden = newRow.hidden;
                                    rec.adminsRaw = JSON.stringify(newRow.admins || []);
                                    rec.lastMessage = JSON.stringify(newRow.last_message);
                                    rec.unreadCountRaw = JSON.stringify(newRow.unread_count);
                                    rec.deletedForRaw = JSON.stringify(newRow.deleted_by || []);
                                    rec.clearedAtRaw = JSON.stringify(newRow.cleared_at || {});
                                    rec.typingRaw = JSON.stringify(newRow.typing || {});
                                    rec._raw.updated_at = parsePostgresDateToMs(newRow.updated_at);
                                });
                            } catch (e) {
                                await collection.create((rec: any) => {
                                    rec._raw.id = newRow.id;
                                    rec.groupName = newRow.group_name;
                                    rec.groupDescription = newRow.group_description;
                                    rec.groupIcon = newRow.group_icon;
                                    rec.participantsRaw = JSON.stringify(newRow.participants);
                                    rec.participantDetailsRaw = JSON.stringify(newRow.participant_details);
                                    rec.createdBy = newRow.created_by;
                                    rec.memberCount = newRow.member_count;
                                    rec.hidden = newRow.hidden;
                                    rec.adminsRaw = JSON.stringify(newRow.admins || []);
                                    rec.lastMessage = JSON.stringify(newRow.last_message);
                                    rec.unreadCountRaw = JSON.stringify(newRow.unread_count);
                                    rec.deletedForRaw = JSON.stringify(newRow.deleted_by || []);
                                    rec.clearedAtRaw = JSON.stringify(newRow.cleared_at || {});
                                    rec.typingRaw = JSON.stringify(newRow.typing || {});
                                    rec._raw.created_at = parsePostgresDateToMs(newRow.created_at);
                                    rec._raw.updated_at = parsePostgresDateToMs(newRow.updated_at);
                                });
                            }
                        } else if (payload.eventType === 'DELETE') {
                            try {
                                const existing = await collection.find(oldRow.id);
                                await existing.destroyPermanently();
                            } catch (e) { }
                        }
                    });
                } catch (e) {
                    console.error('[ChatsListSync] Failed to persist group_chat changes:', e);
                }

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
