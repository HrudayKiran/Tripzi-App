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
import { joinChannel, pushToChannel, connectPhoenixSocket } from '../lib/phoenixSocket';

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

function mapLocalMessage(m: Message, parentMap?: Map<string, any>): ChatMessage {
    const parseDateSafe = (val: any) => parsePostgresDate(val);

    let replyTo: ReplyTo | undefined = undefined;
    if (m.replyToRaw) {
        try {
            const parsed = JSON.parse(m.replyToRaw);
            if (parsed && typeof parsed === 'object' && parsed.messageId) {
                replyTo = parsed;
            }
        } catch {
            // It is a plain UUID string! Resolve from parentMap
            if (parentMap && parentMap.has(m.replyToRaw)) {
                const parent = parentMap.get(m.replyToRaw);
                replyTo = {
                    messageId: parent.id,
                    text: parent.text || '',
                    senderId: parent.senderId,
                };
            }
        }
    }

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
        replyTo,
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

async function resolveRepliesAndMapMessages(localMessages: any[]): Promise<ChatMessage[]> {
    const replyToIds = localMessages
        .map((m: any) => m.replyToRaw)
        .filter((id): id is string => {
            if (!id) return false;
            if (id.trim().startsWith('{') || id.trim().startsWith('[')) return false;
            return true;
        });

    let parentMap = new Map<string, any>();
    if (replyToIds.length > 0) {
        try {
            const parents = await database.get('messages')
                .query(Q.where('id', Q.oneOf(replyToIds)))
                .fetch();
            parentMap = new Map(parents.map((p: any) => [p.id, p]));
        } catch (e) {
            console.error('[resolveRepliesAndMapMessages] Failed to batch load parent messages:', e);
        }
    }

    return localMessages.map((m: any) => mapLocalMessage(m, parentMap));
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

            return resolveRepliesAndMapMessages(messagesList);
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
            const mapped = await resolveRepliesAndMapMessages([...olderLocalMessages].reverse());

            queryClient.setQueryData<ChatMessage[]>(['messages', chatId], (old) => [
                ...mapped,
                ...(old || []),
            ]);
        }
    }, [chatId, hasMore, queryClient, clearedAt, userId]);

    // Send message via Phoenix channel → local WatermelonDB
    const sendMessage = useCallback(async (text: string, replyTo?: ReplyTo, mentions?: string[]) => {
        if (!chatId || !userId || !text.trim() || !chatType) {
            throw new Error('Invalid send arguments');
        }

        const senderName = senderProfileRef.current?.name || 'User';
        const topic = chatType === 'group' ? `group:${chatId}` : `dm:${chatId}`;

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

        // Dedup: mark as seen before the channel echo comes back
        seenMessageIdsRef.current.add(localId);

        // Invalidate queries so UI updates immediately
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] });

        // Update local parent chat last_message + unread count
        const parentTable = chatType === 'group' ? 'group_chats' : 'direct_chats';
        try {
            const chatRecord = await database.get(parentTable).find(chatId);
            await database.write(async () => {
                await (chatRecord as any).update((rec: any) => {
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
                            const uc = JSON.parse(rec.unreadCountRaw) || {};
                            uc[userId] = 0;
                            rec.unreadCountRaw = JSON.stringify(uc);
                        } catch {}
                    }
                });
            });
        } catch {}

        queryClient.invalidateQueries({ queryKey: [chatType === 'group' ? 'groupChats' : 'chats', userId] });

        try {
            // ── Phoenix channel send (replaces Supabase insert + broadcast) ──
            // Server saves to DB, broadcasts new_message to all members, fires Oban push jobs
            const serverMsg = await pushToChannel(topic, 'send_message', {
                id: localId,
                text: text.trim(),
                type: 'text',
                reply_to: replyTo?.messageId ?? null,
                mentions: mentions || [],
                sender_name: senderName,
            });

            // Mark local message as sent + synced
            await database.write(async () => {
                try {
                    const existing = await database.get('messages').find(localId);
                    await (existing as any).update((rec: any) => {
                        rec.status = 'sent';
                        rec._raw._status = 'synced';
                    });
                } catch {}
            });

            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            return { success: true, status: 'sent' };

        } catch (error: any) {
            console.warn('[sendMessage] Phoenix push failed (offline), keeping pending:', error);
            // Message stays in local DB as pending — sync will pick it up
            return { success: true, status: 'pending' };
        }
    }, [chatId, userId, chatType, queryClient]);

    // Mark messages as read via Phoenix channel
    const markAsRead = useCallback(async () => {
        if (!chatId || !userId || !chatType) return;

        try {
            const topic = chatType === 'group' ? `group:${chatId}` : `dm:${chatId}`;

            // Get unread message IDs from local DB
            const unread = await database.get('messages')
                .query(
                    Q.where('chat_id', chatId),
                    Q.where('sender_id', Q.notEq(userId))
                )
                .fetch();

            const toUpdate = (unread as any[]).filter((m) => {
                try {
                    const readBy = JSON.parse(m.readByRaw || '{}');
                    return !readBy[userId];
                } catch { return true; }
            });

            if (toUpdate.length > 0) {
                // Fire-and-forget push to server for DB update + broadcast
                pushToChannel(topic, 'mark_read', {
                    message_ids: toUpdate.map((m) => m.id),
                }).catch(() => {
                    // Fallback: call Supabase RPC directly if Phoenix not connected
                    const runFallback = async () => {
                        try {
                            await supabase.rpc('batch_mark_as_read', {
                                p_message_ids: toUpdate.map((m: any) => m.id),
                                p_user_id: userId,
                            });
                        } catch {}
                    };
                    runFallback();
                });
            }

            // Reset unread count locally
            const parentTable = chatType === 'group' ? 'group_chats' : 'direct_chats';
            try {
                const chatRec = await database.get(parentTable).find(chatId);
                await database.write(async () => {
                    await (chatRec as any).update((rec: any) => {
                        try {
                            const uc = JSON.parse(rec.unreadCountRaw || '{}');
                            uc[userId] = 0;
                            rec.unreadCountRaw = JSON.stringify(uc);
                        } catch {}
                    });
                });
            } catch {}

            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });

        } catch (error) {
            if (__DEV__) console.error('[markAsRead] Error:', error);
        }
    }, [chatId, userId, chatType, queryClient]);

    // ── Phoenix Channel real-time subscription ──────────────────────────────
    // Replaces ALL Supabase Realtime channels (broadcast + postgres_changes).
    // Server broadcasts new_message, message_edited, message_deleted, messages_read,
    // user_typing via Phoenix PubSub — no Supabase involvement.
    useEffect(() => {
        if (!chatId || !chatType) return;

        // Ensure socket is connected
        connectPhoenixSocket();

        const topic = chatType === 'group' ? `group:${chatId}` : `dm:${chatId}`;

        // Clear dedup set when switching chats
        seenMessageIdsRef.current.clear();

        const cleanup = joinChannel(topic, async (event, payload) => {
            switch (event) {
                case 'new_message': {
                    if (!payload?.id) break;
                    if (seenMessageIdsRef.current.has(payload.id)) break;
                    seenMessageIdsRef.current.add(payload.id);
                    await writeRemoteMessageToLocal(payload);
                    queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
                    // Also update parent chat last_message in local DB
                    queryClient.invalidateQueries({ queryKey: ['chats', userId] });
                    queryClient.invalidateQueries({ queryKey: ['groupChats', userId] });
                    break;
                }

                case 'message_edited': {
                    const { message_id, text, edited_at } = payload || {};
                    if (!message_id) break;
                    await database.write(async () => {
                        try {
                            const msg = await database.get('messages').find(message_id);
                            await (msg as any).update((rec: any) => {
                                rec.text = text;
                                rec.editedAt = edited_at || Date.now();
                                rec._raw.updated_at = Date.now();
                            });
                        } catch {}
                    });
                    queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
                    break;
                }

                case 'message_deleted': {
                    const { message_id, everyone } = payload || {};
                    if (!message_id) break;
                    if (everyone) {
                        await database.write(async () => {
                            try {
                                const msg = await database.get('messages').find(message_id);
                                await (msg as any).update((rec: any) => {
                                    rec.text = '';
                                    rec.mediaUrl = null;
                                    rec.deletedForEveryoneAt = Date.now();
                                    rec._raw.updated_at = Date.now();
                                });
                            } catch {}
                        });
                    } else {
                        await database.write(async () => {
                            try {
                                const msg = await database.get('messages').find(message_id);
                                await (msg as any).destroyPermanently();
                            } catch {}
                        });
                    }
                    seenMessageIdsRef.current.delete(message_id);
                    queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
                    break;
                }

                case 'messages_read': {
                    const { user_id, message_ids } = payload || {};
                    if (!user_id || !message_ids?.length) break;
                    await database.write(async () => {
                        for (const msgId of message_ids) {
                            try {
                                const msg = await database.get('messages').find(msgId);
                                await (msg as any).update((rec: any) => {
                                    try {
                                        const readBy = JSON.parse(rec.readByRaw || '{}');
                                        readBy[user_id] = new Date().toISOString();
                                        rec.readByRaw = JSON.stringify(readBy);
                                        rec.status = 'read';
                                        rec._raw.updated_at = Date.now();
                                    } catch {}
                                });
                            } catch {}
                        }
                    });
                    queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
                    break;
                }

                case 'presence_state':
                case 'presence_diff':
                case 'user_typing':
                    // Typing and presence handled by usePresence hook
                    break;

                default:
                    break;
            }
        });

        return () => {
            cleanup();
        };
    }, [chatId, chatType, queryClient, userId]);

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