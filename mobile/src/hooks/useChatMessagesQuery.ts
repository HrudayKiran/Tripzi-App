import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { MessageType, MessageStatus, ReplyTo, LocationData, ChatMessage } from '../types/chat';
import { useCurrentUser } from './useCurrentUser';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import Message from '../database/models/Message';
import { parsePostgresDate, parsePostgresDateToMs, parsePostgresDateToMsOrNull } from '../utils/date';
import { workersApi } from '../lib/workersApi';

// Re-export types from centralized location for backward compatibility
export type { MessageType, MessageStatus, ReplyTo, LocationData, ChatMessage } from '../types/chat';

const PAGE_SIZE = 50;

/**
 * Utility to parse PostgreSQL array string literal representation (like '{a,b}')
 * or JSON string representation into a JavaScript array of strings.
 */
function parsePostgresArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        if (val.startsWith('{') && val.endsWith('}')) {
            const content = val.slice(1, -1).trim();
            if (!content) return [];
            return content.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
    }
    return [];
}

function mapLocalMessage(m: Message): ChatMessage {
    const parseDateSafe = (val: any) => parsePostgresDate(val);

    return {
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        type: m.type as MessageType,
        text: m.text || undefined,
        mediaUrl: m.mediaUrl || undefined,
        mediaThumbnail: undefined,
        location: m.locationData || undefined,
        voiceDuration: m.voiceDuration || undefined,
        replyTo: m.replyToData || undefined,
        status: m.status as MessageStatus,
        readBy: m.readByData || {},
        deliveredTo: m.deliveredToData || [],
        editedAt: m.editedAt ? parseDateSafe(m.editedAt) : null,
        deletedFor: m.deletedForData || [],
        deletedForEveryoneAt: m.deletedForEveryoneAt ? parseDateSafe(m.deletedForEveryoneAt) : null,
        mentions: m.mentionsData || [],
        createdAt: m.createdAt,
    };
}

const writeRemoteMessageToLocal = async (newRow: any) => {
    if (!newRow) return;
    try {
        await database.write(async () => {
            const collection = database.get('messages');
            let existing: any = null;
            try {
                existing = await collection.find(newRow.id);
            } catch (e) {}

            const parseDateToMs = (val: any): number => {
                return parsePostgresDateToMs(val, Date.now());
            };

            const parseDateToMsOrNull = (val: any): number | null => {
                return parsePostgresDateToMsOrNull(val);
            };

            const stringifyIfNeeded = (val: any): string | null => {
                if (val === undefined || val === null) return null;
                return typeof val === 'string' ? val : JSON.stringify(val);
            };

            const stringifyArrayField = (val: any): string => {
                return JSON.stringify(parsePostgresArray(val));
            };

            if (existing) {
                await existing.update((rec: any) => {
                    rec.senderId = newRow.sender_id || rec.senderId;
                    rec.senderName = newRow.sender_name || rec.senderName;
                    rec.type = newRow.type || rec.type;
                    rec.text = newRow.text !== undefined ? newRow.text : rec.text;
                    rec.mediaUrl = newRow.media_url !== undefined ? newRow.media_url : rec.mediaUrl;
                    rec.locationRaw = newRow.location !== undefined ? stringifyIfNeeded(newRow.location) : rec.locationRaw;
                    rec.voiceDuration = newRow.voice_duration !== undefined ? newRow.voice_duration : rec.voiceDuration;
                    rec.replyToRaw = newRow.reply_to !== undefined ? stringifyIfNeeded(newRow.reply_to) : rec.replyToRaw;
                    rec.status = newRow.status || rec.status;
                    rec.readByRaw = newRow.read_by !== undefined ? stringifyIfNeeded(newRow.read_by) : rec.readByRaw;
                    rec.deliveredToRaw = newRow.delivered_to !== undefined ? stringifyArrayField(newRow.delivered_to) : rec.deliveredToRaw;
                    rec.deletedForRaw = newRow.deleted_for !== undefined ? stringifyArrayField(newRow.deleted_for) : rec.deletedForRaw;
                    rec.deletedForEveryoneAt = newRow.deleted_for_everyone_at !== undefined ? parseDateToMsOrNull(newRow.deleted_for_everyone_at) : rec.deletedForEveryoneAt;
                    rec.mentionsRaw = newRow.mentions !== undefined ? stringifyArrayField(newRow.mentions) : rec.mentionsRaw;
                    rec._raw.updated_at = parseDateToMs(newRow.updated_at);
                    rec.editedAt = newRow.edited_at !== undefined ? parseDateToMsOrNull(newRow.edited_at) : rec.editedAt;
                    
                    if (rec._raw._status === 'created') {
                        rec._raw._status = 'synced';
                    }
                });
            } else {
                await collection.create((rec: any) => {
                    rec._raw.id = newRow.id;
                    rec.chatId = newRow.chat_id;
                    rec.chatType = newRow.chat_type;
                    rec.senderId = newRow.sender_id;
                    rec.senderName = newRow.sender_name;
                    rec.type = newRow.type;
                    rec.text = newRow.text;
                    rec.mediaUrl = newRow.media_url;
                    rec.locationRaw = stringifyIfNeeded(newRow.location);
                    rec.voiceDuration = newRow.voice_duration;
                    rec.replyToRaw = stringifyIfNeeded(newRow.reply_to);
                    rec.status = newRow.status;
                    rec.readByRaw = stringifyIfNeeded(newRow.read_by);
                    rec.deliveredToRaw = stringifyArrayField(newRow.delivered_to);
                    rec.deletedForRaw = stringifyArrayField(newRow.deleted_for);
                    rec.deletedForEveryoneAt = parseDateToMsOrNull(newRow.deleted_for_everyone_at);
                    rec.mentionsRaw = stringifyArrayField(newRow.mentions);
                    rec._raw.created_at = parseDateToMs(newRow.created_at);
                    rec._raw.updated_at = parseDateToMs(newRow.updated_at);
                    rec.editedAt = parseDateToMsOrNull(newRow.edited_at);
                    rec._raw._status = 'synced';
                });
            }
        });
    } catch (e) {
        console.error('[useChatMessagesQuery] Failed to write remote message to local WatermelonDB:', e);
    }
};

export function useChatMessagesQuery(
    chatId: string | undefined,
    chatType: 'direct' | 'group' | undefined,
    clearedAt?: string | Date | null
) {
    const queryClient = useQueryClient();
    const { userId } = useCurrentUser();
    const senderProfileRef = useRef<{ name: string } | null>(null);
    const [hasMore, setHasMore] = useState(true);
    // Holds the active realtime channel so sendMessage can broadcast to it
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    // Dedup guard: tracks message IDs we have already handled locally (sent or received)
    const seenMessageIdsRef = useRef<Set<string>>(new Set());

    // Cache sender profile at init so we don't fetch on every send
    useEffect(() => {
        if (!userId) return;
        supabase.from('profiles').select('name').eq('id', userId).maybeSingle()
            .then(({ data }) => {
                senderProfileRef.current = data || { name: 'User' };
            });
    }, [userId]);

    // Force query refetch when clearedAt changes
    useEffect(() => {
        if (chatId) {
            queryClient.refetchQueries({ queryKey: ['messages', chatId] });
        }
    }, [chatId, clearedAt, queryClient]);

    const clearedAtTime = clearedAt instanceof Date
        ? clearedAt.getTime()
        : typeof clearedAt === 'string'
            ? parsePostgresDate(clearedAt)?.getTime() || null
            : null;

    // Fetch messages from WatermelonDB locally
    const { data: messages = [], isLoading: loading, error } = useQuery({
        queryKey: ['messages', chatId, clearedAtTime],
        queryFn: async () => {
            if (!chatId || !userId) return [];

            let queryConstraints: any[] = [
                Q.where('chat_id', chatId)
            ];

            const clearedAtDate = parsePostgresDate(clearedAt);

            if (clearedAtDate && !isNaN(clearedAtDate.getTime())) {
                queryConstraints.push(Q.where('created_at', Q.gt(clearedAtDate.getTime())));
            }

            const localMessages = await database.get('messages')
                .query(
                    ...queryConstraints,
                    Q.sortBy('created_at', Q.desc),
                    Q.take(PAGE_SIZE)
                )
                .fetch();

            const messagesList = [...localMessages].reverse();
            setHasMore(localMessages.length >= PAGE_SIZE);

            return messagesList.map((m: any) => mapLocalMessage(m));
        },
        enabled: !!chatId && !!userId,
        staleTime: 30_000,
    });

    // Load more (older) messages for pagination from WatermelonDB
    const loadMoreMessages = useCallback(async () => {
        if (!chatId || !hasMore || !userId) return;

        const currentMessages = queryClient.getQueryData<ChatMessage[]>(['messages', chatId]) || [];
        if (currentMessages.length === 0) return;

        const oldestMessage = currentMessages[0];
        const oldestCreatedAt = oldestMessage.createdAt instanceof Date
            ? oldestMessage.createdAt
            : oldestMessage.createdAt
                ? new Date(oldestMessage.createdAt)
                : null;

        if (!oldestCreatedAt || isNaN(oldestCreatedAt.getTime())) return;

        let queryConstraints: any[] = [
            Q.where('chat_id', chatId),
            Q.where('created_at', Q.lt(oldestCreatedAt.getTime()))
        ];

        const clearedAtDate = parsePostgresDate(clearedAt);

        if (clearedAtDate && !isNaN(clearedAtDate.getTime())) {
            queryConstraints.push(Q.where('created_at', Q.gt(clearedAtDate.getTime())));
        }

        const olderLocalMessages = await database.get('messages')
            .query(
                ...queryConstraints,
                Q.sortBy('created_at', Q.desc),
                Q.take(PAGE_SIZE)
            )
            .fetch();

        setHasMore(olderLocalMessages.length >= PAGE_SIZE);

        if (olderLocalMessages.length > 0) {
            const mapped = [...olderLocalMessages].reverse().map((m: any) => mapLocalMessage(m));

            queryClient.setQueryData<ChatMessage[]>(['messages', chatId], (old) => [
                ...mapped,
                ...(old || []),
            ]);
        }
    }, [chatId, hasMore, queryClient, clearedAt, userId]);

    // Send message to local WatermelonDB then Supabase
    const sendMessage = useCallback(async (text: string, replyTo?: ReplyTo, mentions?: string[]) => {
        if (!chatId || !userId || !text.trim() || !chatType) {
            throw new Error('Invalid send arguments');
        }

        const senderName = senderProfileRef.current?.name || 'User';

        let localId = '';
        try {
            await database.write(async () => {
                const messageRecord = await database.get('messages').create((rec: any) => {
                    rec.chatId = chatId;
                    rec.chatType = chatType;
                    rec.senderId = userId;
                    rec.senderName = senderName;
                    rec.type = 'text';
                    rec.text = text.trim();
                    rec.status = 'pending';
                    rec.replyToRaw = replyTo ? JSON.stringify(replyTo) : null;
                    rec.mentionsRaw = JSON.stringify(mentions || []);
                    rec.readByRaw = JSON.stringify({});
                    rec.deliveredToRaw = JSON.stringify([]);
                    rec.deletedForRaw = JSON.stringify([]);
                    rec._raw.created_at = Date.now();
                    rec._raw.updated_at = Date.now();
                });
                localId = messageRecord.id;
            });
        } catch (e) {
            console.error('[sendMessage] Failed to create local message:', e);
            throw new Error('Failed to save message locally.');
        }

        // Invalidate queries so UI updates immediately
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] });

        // Update local parent chat's last message and reset unread count
        const parentTable = chatType === 'group' ? 'group_chats' : 'direct_chats';
        const collection = database.get(parentTable);
        let chatRecord: any = null;
        try {
            chatRecord = await collection.find(chatId);
        } catch (e) {
            // Not found locally, fetch from Supabase
            let remoteChat: any = null;
            try {
                const { data } = await supabase
                    .from(parentTable)
                    .select('*')
                    .eq('id', chatId)
                    .maybeSingle();
                remoteChat = data;
            } catch (err) {
                console.warn('[sendMessage] Failed to fetch remote parent chat:', err);
            }

            // Write to WatermelonDB (either the remote chat details or a minimal fallback)
            try {
                await database.write(async () => {
                    try {
                        chatRecord = await collection.find(chatId);
                    } catch (findErr) {
                        chatRecord = await collection.create((rec: any) => {
                            rec._raw.id = chatId;
                            if (remoteChat) {
                                if (chatType === 'group') {
                                    rec.itineraryId = remoteChat.itinerary_id;
                                    rec.groupName = remoteChat.group_name;
                                    rec.groupDescription = remoteChat.group_description;
                                    rec.groupIcon = remoteChat.group_icon;
                                    rec.itineraryImage = remoteChat.itinerary_image;
                                    rec.participantsRaw = JSON.stringify(remoteChat.participants);
                                    rec.participantDetailsRaw = JSON.stringify(remoteChat.participant_details);
                                    rec.createdBy = remoteChat.created_by;
                                    rec.memberCount = remoteChat.member_count;
                                    rec.hidden = remoteChat.hidden;
                                    rec.adminsRaw = JSON.stringify(remoteChat.admins || []);
                                    rec.lastMessage = JSON.stringify(remoteChat.last_message);
                                    rec.unreadCountRaw = JSON.stringify(remoteChat.unread_count);
                                    rec.deletedForRaw = JSON.stringify(remoteChat.deleted_by || []);
                                    rec.clearedAtRaw = JSON.stringify(remoteChat.cleared_at || {});
                                    rec.typingRaw = JSON.stringify(remoteChat.typing || {});
                                } else {
                                    rec.participantsRaw = JSON.stringify(remoteChat.participants);
                                    rec.participantDetailsRaw = JSON.stringify(remoteChat.participant_details || {});
                                    rec.lastMessage = JSON.stringify(remoteChat.last_message);
                                    rec.lastMessageAt = remoteChat.last_message_at;
                                    rec.unreadCountRaw = JSON.stringify(remoteChat.unread_count);
                                    rec.clearedAtRaw = JSON.stringify(remoteChat.cleared_at);
                                    rec.deletedForRaw = JSON.stringify(remoteChat.deleted_by || []);
                                    rec.typingRaw = JSON.stringify(remoteChat.typing || {});
                                }
                                rec._raw.created_at = parsePostgresDateToMs(remoteChat.created_at);
                                rec._raw.updated_at = parsePostgresDateToMs(remoteChat.updated_at);
                            } else {
                                // Minimal fallback fallback if fetch failed/offline
                                rec.participantsRaw = JSON.stringify([userId]);
                                rec.unreadCountRaw = JSON.stringify({});
                                rec.deletedForRaw = JSON.stringify([]);
                                rec.clearedAtRaw = JSON.stringify({});
                                rec.typingRaw = JSON.stringify({});
                                if (chatType === 'group') {
                                    rec.groupName = 'Group Chat';
                                    rec.hidden = false;
                                    rec.adminsRaw = JSON.stringify([]);
                                }
                                rec._raw.created_at = Date.now();
                                rec._raw.updated_at = Date.now();
                            }
                        });
                    }
                });
            } catch (writeErr) {
                console.error('[sendMessage] Failed to create parent chat locally:', writeErr);
            }
        }

        if (chatRecord) {
            await database.write(async () => {
                try {
                    await chatRecord.update((rec: any) => {
                        rec.lastMessage = JSON.stringify({
                            text: text.trim(),
                            sender_id: userId,
                            sender_name: senderName,
                            created_at: new Date().toISOString(),
                            type: 'text',
                        });
                        rec._raw.updated_at = Date.now();
                        if (rec.unreadCountRaw) {
                            try {
                                const currentUnread = JSON.parse(rec.unreadCountRaw) || {};
                                currentUnread[userId] = 0;
                                rec.unreadCountRaw = JSON.stringify(currentUnread);
                            } catch (e) {}
                        }
                    });
                } catch (e) {
                    console.error('[sendMessage] Failed to update parent chat fields:', e);
                }
            });
        }
        queryClient.invalidateQueries({ queryKey: [chatType === 'group' ? 'groupChats' : 'chats', userId] });

        // Attempt Supabase insert in the background
        try {
            const now = new Date().toISOString();
            const messagePayload = {
                id: localId,
                chat_id: chatId,
                chat_type: chatType,
                sender_id: userId,
                sender_name: senderName,
                type: 'text',
                text: text.trim(),
                status: 'sent',
                reply_to: replyTo ? replyTo.messageId : null,
                mentions: mentions || [],
                created_at: now,
                updated_at: now,
                read_by: {},
                delivered_to: [],
                deleted_for: [],
            };

            const { error: insertError } = await supabase
                .from('messages')
                .insert([messagePayload]);

            if (insertError) throw insertError;

            // Broadcast to channel so recipient gets it instantly (WhatsApp-style fast path)
            // Sender marks their own id as seen to avoid double-processing their own broadcast
            seenMessageIdsRef.current.add(localId);
            if (channelRef.current) {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'new_message',
                    payload: messagePayload,
                });
            }

            // Increment unread count for other participants atomically in Supabase
            const { data: chatData } = await supabase
                .from(parentTable)
                .select('participants')
                .eq('id', chatId)
                .maybeSingle();

            if (chatData) {
                const participants = chatData.participants || [];
                for (const pId of participants) {
                    if (pId !== userId) {
                        await supabase.rpc('increment_unread_count', {
                            p_chat_id: chatId,
                            p_chat_type: chatType,
                            p_user_id: pId,
                        });
                    }
                }
            }

            // Update parent table in Supabase
            await supabase
                .from(parentTable)
                .update({
                    last_message: {
                        text: text.trim(),
                        sender_id: userId,
                        sender_name: senderName,
                        created_at: new Date().toISOString(),
                        type: 'text',
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', chatId);

            // Update local message status to sent and mark as synced
            await database.write(async () => {
                try {
                    const collection = database.get('messages');
                    const existing = await collection.find(localId);
                    await existing.update((rec: any) => {
                        rec.status = 'sent';
                        rec._raw._status = 'synced';
                    });
                } catch (e) {}
            });

            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });

            // Send push notification to other participants (fire-and-forget)
            workersApi('/chat/send-notification', {
              method: 'POST',
              body: {
                chatId,
                chatType,
                senderName,
                messagePreview: text.trim(),
              },
            }).then((res: any) => {
              if (__DEV__) console.log('[sendMessage] Push notification sent:', JSON.stringify(res));
            }).catch((err: any) => {
              if (__DEV__) console.error('[sendMessage] Push notification failed:', err?.message || err);
            });

            return { success: true, status: 'sent' };

        } catch (error: any) {
            const isPermanentError = error?.code === '42501' || error?.code?.startsWith('23') || error?.code?.startsWith('42') || error?.status === 403 || error?.status === 401;
            
            if (isPermanentError) {
                console.error('[sendMessage] Permanent failure sending message:', error);
                // Delete the local message so it doesn't get stuck in sync
                try {
                    await database.write(async () => {
                        const collection = database.get('messages');
                        const existing = await collection.find(localId);
                        await existing.destroyPermanently();
                    });
                } catch (e) {}
                
                // Invalidate query to remove from UI
                queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
                
                throw new Error(error?.message || 'You do not have permission to send messages in this chat.');
            }

            console.warn('[sendMessage] Failed to send message to Supabase (offline), keeping in local queue:', error);
            return { success: true, status: 'pending' };
        }
    }, [chatId, userId, chatType, queryClient]);

    // Mark messages as read using batch RPC
    const markAsRead = useCallback(async () => {
        if (!chatId || !userId || !chatType) return;

        try {
            const { data: unreadMessages, error: fetchError } = await supabase
                .from('messages')
                .select('id, read_by')
                .eq('chat_id', chatId)
                .neq('sender_id', userId);

            if (fetchError) throw fetchError;

            const toUpdate = (unreadMessages || []).filter((m: any) => {
                const readBy = m.read_by || {};
                return !readBy[userId];
            });

            if (toUpdate.length > 0) {
                const messageIds = toUpdate.map((m: any) => m.id);
                await supabase.rpc('batch_mark_as_read', {
                    p_message_ids: messageIds,
                    p_user_id: userId,
                });
            }

            const parentTable = chatType === 'group' ? 'group_chats' : 'direct_chats';
            const { data: chatData } = await supabase
                .from(parentTable)
                .select('unread_count')
                .eq('id', chatId)
                .maybeSingle();

            if (chatData) {
                const currentUnread = chatData.unread_count || {};
                if (currentUnread[userId] !== 0) {
                    const newUnread = { ...currentUnread, [userId]: 0 };
                    await supabase
                        .from(parentTable)
                        .update({ unread_count: newUnread })
                        .eq('id', chatId);
                }
            }

            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });

        } catch (error) {
            if (__DEV__) console.error('[markAsRead] Error:', error);
        }
    }, [chatId, userId, chatType, queryClient]);

    // Hybrid realtime: Broadcast (fast INSERT delivery) + postgres_changes (UPDATE/DELETE correctness)
    useEffect(() => {
        if (!chatId) return;

        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const channelName = `messages-${chatId}-${randomSuffix}`;

        // Remove any stale channel first (handles hot-reload / StrictMode double-mount)
        const existing = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
        if (existing) supabase.removeChannel(existing);

        // Clear dedup set when switching chats
        seenMessageIdsRef.current.clear();

        const channel = supabase
            .channel(channelName)
            // ── PRIMARY PATH: Broadcast for fast new message delivery (WhatsApp-style ~10–50ms) ──
            // Sender broadcasts after DB insert; all recipients receive it here instantly.
            // Sender's own broadcast is ignored via seenMessageIdsRef dedup guard.
            .on('broadcast', { event: 'new_message' }, async (payload) => {
                const newMsg = payload.payload as any;
                if (!newMsg?.id) return;
                // Dedup: skip if we have already processed this message locally (e.g. we sent it)
                if (seenMessageIdsRef.current.has(newMsg.id)) return;
                seenMessageIdsRef.current.add(newMsg.id);
                await writeRemoteMessageToLocal(newMsg);
                queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            })
            // ── CORRECTNESS PATH: postgres_changes for UPDATE (edits, read receipts, deletedFor) ──
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`,
            }, async (payload) => {
                const updated = payload.new as any;
                if (!updated) return;
                await writeRemoteMessageToLocal(updated);
                queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            })
            // ── CORRECTNESS PATH: postgres_changes for DELETE (delete for everyone) ──
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`,
            }, async (payload) => {
                const deleted = payload.old as any;
                if (!deleted?.id) return;
                seenMessageIdsRef.current.delete(deleted.id);
                try {
                    await database.write(async () => {
                        const collection = database.get('messages');
                        try {
                            const existing = await collection.find(deleted.id);
                            await existing.destroyPermanently();
                        } catch (e) {}
                    });
                } catch (e) {
                    console.error('[useChatMessagesQuery] Failed to delete local message:', e);
                }
                queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            })
            // ── RECOVERY PATH: postgres_changes INSERT as fallback ──
            // Catches messages the Broadcast missed (e.g. app was backgrounded, reconnected)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`,
            }, async (payload) => {
                const newMsg = payload.new as any;
                if (!newMsg?.id) return;
                // Skip if already handled by Broadcast (dedup)
                if (seenMessageIdsRef.current.has(newMsg.id)) return;
                seenMessageIdsRef.current.add(newMsg.id);
                await writeRemoteMessageToLocal(newMsg);
                queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            channelRef.current = null;
            supabase.removeChannel(channel);
        };
    }, [chatId, queryClient, chatType]);

    // Filter out messages deleted for the current user
    const visibleMessages = useMemo(() => {
        if (!userId) return messages;
        return messages.filter((m) => !m.deletedFor?.includes(userId));
    }, [messages, userId]);

    return {
        messages: visibleMessages,
        loading,
        error,
        sendMessage,
        markAsRead,
        loadMoreMessages,
        hasMore,
    };
}

export default useChatMessagesQuery;

