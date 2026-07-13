import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useCallback, useEffect } from 'react';
import { useCurrentUser } from './useCurrentUser';
import type { ChatParticipant, LastMessage, Chat } from '../types/chat';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import { joinChannel, connectPhoenixSocket } from '../lib/phoenixSocket';

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
        deletedBy: Array.isArray(row.deleted_for) ? row.deleted_for : [],
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

/** Write/update a chat record (direct or group) from a server event payload */
async function writeChatToLocal(
    collectionName: 'direct_chats' | 'group_chats',
    newRow: any,
    isGroup: boolean
) {
    await database.write(async () => {
        const collection = database.get(collectionName);
        let existing: any = null;
        try { existing = await collection.find(newRow.id); } catch {}

        const applyFields = (rec: any) => {
            rec.participantsRaw = JSON.stringify(newRow.participants || []);
            rec.participantDetailsRaw = JSON.stringify(newRow.participant_details || {});
            rec.lastMessage = JSON.stringify(newRow.last_message);
            rec.unreadCountRaw = JSON.stringify(newRow.unread_count || {});
            // deleted_for is now consistent: Supabase DB, Ecto schema, and WatermelonDB all use deleted_for
            rec.deletedForRaw = JSON.stringify(newRow.deleted_for || []);
            rec.clearedAtRaw = JSON.stringify(newRow.cleared_at || {});
            // typing is ephemeral — tracked via Phoenix Presence, not written to WatermelonDB
            rec.mutedByRaw = JSON.stringify(newRow.muted_by || []);
            rec.pinnedByRaw = JSON.stringify(newRow.pinned_by || []);
            rec._raw.updated_at = parsePostgresDateToMs(newRow.updated_at);

            if (isGroup) {
                rec.groupName = newRow.group_name;
                rec.groupDescription = newRow.group_description;
                rec.groupIcon = newRow.group_icon;
                rec.createdBy = newRow.created_by;
                rec.memberCount = newRow.member_count;
                rec.hidden = newRow.hidden;
                rec.adminsRaw = JSON.stringify(newRow.admins || []);
            } else {
                rec.lastMessageAt = newRow.last_message_at;
            }
        };

        if (existing) {
            await existing.update(applyFields);
        } else {
            await collection.create((rec: any) => {
                rec._raw.id = newRow.id;
                applyFields(rec);
                rec._raw.created_at = parsePostgresDateToMs(newRow.created_at);
            });
        }
    });
}

export function useChatsQuery() {
    const queryClient = useQueryClient();
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

    // ── Mutations ─────────────────────────────────────────────────────────────

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
                deleted_for: [],
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

            const { data: directCheck } = await supabase
                .from('direct_chats')
                .select('id')
                .eq('id', chatId)
                .maybeSingle();

            const table = directCheck ? 'direct_chats' : 'group_chats';

            const { data: current } = await supabase
                .from(table)
                .select('deleted_for')
                .eq('id', chatId)
                .maybeSingle();

            const deletedBy = Array.isArray(current?.deleted_for) ? [...current.deleted_for, userId] : [userId];
            await supabase.from(table).update({ deleted_for: deletedBy }).eq('id', chatId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chats', userId] });
            queryClient.invalidateQueries({ queryKey: ['groupChats', userId] });
        },
    });

    // ── Phoenix user channel subscription ────────────────────────────────────
    // Replaces ALL Supabase Realtime postgres_changes on direct_chats + group_chats.
    // Server broadcasts chat_updated events to user:{userId} when:
    //   - A new message arrives (updates last_message, unread_count)
    //   - A member is added/removed
    //   - Chat is deleted
    useEffect(() => {
        if (!userId) return;

        // Ensure Phoenix socket is connected
        connectPhoenixSocket();

        const userTopic = `user:${userId}`;

        const cleanup = joinChannel(userTopic, async (event, payload) => {
            switch (event) {
                case 'chat_updated': {
                    // A direct or group chat was updated (new message, member change, etc.)
                    const { chat_type, chat } = payload || {};
                    if (!chat?.id) break;
                    const collectionName = chat_type === 'group' ? 'group_chats' : 'direct_chats';
                    await writeChatToLocal(collectionName, chat, chat_type === 'group');
                    queryClient.invalidateQueries({
                        queryKey: [chat_type === 'group' ? 'groupChats' : 'chats', userId],
                    });
                    break;
                }

                case 'new_direct_chat': {
                    // A new direct chat was created where this user is a participant
                    if (!payload?.id) break;
                    await writeChatToLocal('direct_chats', payload, false);
                    queryClient.invalidateQueries({ queryKey: ['chats', userId] });
                    break;
                }

                case 'new_group_chat': {
                    // Added to a new group chat
                    if (!payload?.id) break;
                    await writeChatToLocal('group_chats', payload, true);
                    queryClient.invalidateQueries({ queryKey: ['groupChats', userId] });
                    break;
                }

                case 'chat_deleted': {
                    const { chat_id, chat_type } = payload || {};
                    if (!chat_id) break;
                    const collectionName = chat_type === 'group' ? 'group_chats' : 'direct_chats';
                    await database.write(async () => {
                        try {
                            const rec = await database.get(collectionName).find(chat_id);
                            await (rec as any).destroyPermanently();
                        } catch {}
                    });
                    queryClient.invalidateQueries({
                        queryKey: [chat_type === 'group' ? 'groupChats' : 'chats', userId],
                    });
                    break;
                }

                default:
                    break;
            }
        });

        return () => {
            cleanup();
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
                    await supabase.from('direct_chats').update({ deleted_for: newDeletedBy }).eq('id', existing.id);
                    queryClient.invalidateQueries({ queryKey: ['chats', userId] });
                }
                return existing.id;
            }

            // Query DB
            const { data: found } = await supabase
                .from('direct_chats')
                .select('id, participants, deleted_for')
                .contains('participants', [userId]);

            const match = (found || []).find((c: any) =>
                Array.isArray(c.participants) && c.participants.includes(otherUserId)
            );

            if (match) {
                if (Array.isArray(match.deleted_for) && match.deleted_for.includes(userId)) {
                    const newDeletedBy = match.deleted_for.filter((id: string) => id !== userId);
                    await supabase.from('direct_chats').update({ deleted_for: newDeletedBy }).eq('id', match.id);
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
