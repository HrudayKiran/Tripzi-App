/**
 * Centralized chat type definitions used across hooks, screens, and components.
 * M3: Eliminates duplicate type definitions from useChatMessages.ts and useChatMessagesQuery.ts.
 */

// ─── Message Types ───────────────────────────────────────────────

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
    isLive?: boolean;
    expires_at?: string;
    duration?: number;
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

// ─── Chat Types ──────────────────────────────────────────────────

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
