import { workersApi } from '../lib/workersApi';

// ─── Types ───────────────────────────────────────────────────────────

export interface AIMessage {
    _id: string | number;
    text: string;
    createdAt: Date | number;
    user: {
        _id: string | number;
        name: string;
        avatar?: string;
    };
    tripData?: any;
    quickReplies?: {
        type: 'radio' | 'checkbox';
        values: { title: string; value: string }[];
        keepIt?: boolean;
    };
    suggestions?: string[];
}

export type AIModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant';

export interface PlaceImage {
    place: string;
    imageUrl: string;
    photographerName: string;
    photographerUrl: string;
}

export interface Conversation {
    id: string;
    title: string;
    model: string;
    created_at: string;
    updated_at: string;
    messageCount: number;
    lastMessage: {
        content: string;
        role: string;
        createdAt: string;
    } | null;
}

export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    metadata: Record<string, any>;
    suggestions?: string[];
    created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const AI_USER = {
    _id: 'tripzi-ai' as const,
    name: 'Tripzi AI',
};

// ─── AI Service ──────────────────────────────────────────────────────

class AIService {
    // ═══════════════════════════════════════════
    // STATELESS CHAT (backward compatible)
    // ═══════════════════════════════════════════

    async sendMessage(
        text: string,
        previousMessages: AIMessage[] = [],
        model: AIModel = 'llama-3.3-70b-versatile'
    ): Promise<AIMessage[]> {
        try {
            const result = await workersApi<{ text: string; suggestions?: string[]; model: string }>('/ai/plan', {
                body: { text, previousMessages, model },
            });
            const aiText = result?.text;

            if (typeof aiText === 'string' && aiText.trim().length > 0) {
                return [{
                    _id: Date.now() + Math.random(),
                    text: aiText,
                    suggestions: result?.suggestions || [],
                    createdAt: new Date(),
                    user: AI_USER,
                }];
            }

            return [{
                _id: Date.now() + Math.random(),
                text: "I'm having a bit of trouble right now. Please try again.",
                createdAt: new Date(),
                user: AI_USER,
            }];
        } catch (error: any) {
            const errorMsg = error?.message?.includes('Not authenticated')
                ? 'Please log in to use Tripzi AI.'
                : 'Sorry, I couldn\'t connect to the AI. Please check your internet and try again.';

            return [{
                _id: Date.now() + Math.random(),
                text: errorMsg,
                createdAt: new Date(),
                user: AI_USER,
            }];
        }
    }

    // ═══════════════════════════════════════════
    // CONVERSATION MANAGEMENT (D1-backed)
    // ═══════════════════════════════════════════

    /**
     * List user's AI conversations, ordered by most recent.
     */
    async listConversations(limit: number = 20, offset: number = 0): Promise<Conversation[]> {
        try {
            const result = await workersApi<{ conversations: Conversation[] }>(
                `/ai/conversations?limit=${limit}&offset=${offset}`,
                { method: 'GET' }
            );
            return result?.conversations || [];
        } catch {
            return [];
        }
    }

    /**
     * Create a new conversation.
     */
    async createConversation(title?: string, model?: AIModel): Promise<Conversation | null> {
        try {
            const result = await workersApi<Conversation>('/ai/conversations', {
                body: { title, model },
            });
            return result || null;
        } catch {
            return null;
        }
    }

    /**
     * Get messages for a conversation.
     */
    async getConversationMessages(
        conversationId: string,
        limit: number = 50,
        before?: string
    ): Promise<ConversationMessage[]> {
        try {
            let url = `/ai/conversations/${conversationId}/messages?limit=${limit}`;
            if (before) url += `&before=${encodeURIComponent(before)}`;

            const result = await workersApi<{ messages: ConversationMessage[] }>(url, {
                method: 'GET',
            });
            return result?.messages || [];
        } catch {
            return [];
        }
    }

    /**
     * Send a message in a conversation. Returns both user and AI messages.
     */
    async sendConversationMessage(
        conversationId: string,
        text: string,
        model?: AIModel,
        location?: { latitude: number; longitude: number; city: string; country: string } | null
    ): Promise<{
        userMessage: ConversationMessage;
        aiMessage: ConversationMessage;
        model: string;
    } | null> {
        try {
            const result = await workersApi<{
                userMessage: ConversationMessage;
                aiMessage: ConversationMessage;
                model: string;
            }>(`/ai/conversations/${conversationId}/messages`, {
                body: { text, model, location },
            });
            return result || null;
        } catch {
            return null;
        }
    }

    /**
     * Delete a conversation.
     */
    async deleteConversation(conversationId: string): Promise<boolean> {
        try {
            await workersApi(`/ai/conversations/${conversationId}`, {
                method: 'DELETE',
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Rename a conversation.
     */
    async renameConversation(conversationId: string, title: string): Promise<boolean> {
        try {
            await workersApi(`/ai/conversations/${conversationId}`, {
                method: 'PUT',
                body: { title },
            });
            return true;
        } catch {
            return false;
        }
    }

    // ═══════════════════════════════════════════
    // IMAGES
    // ═══════════════════════════════════════════

    async fetchPlaceImages(places: string[]): Promise<PlaceImage[]> {
        try {
            const result = await workersApi<{ images: PlaceImage[] }>('/ai/images', {
                body: { places },
            });
            return result?.images || [];
        } catch {
            return [];
        }
    }
}

export const aiService = new AIService();
