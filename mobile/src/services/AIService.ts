import { workersApi } from '../lib/workersApi';

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
}

export type AIModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant';

export interface PlaceImage {
    place: string;
    imageUrl: string;
    photographerName: string;
    photographerUrl: string;
}

const AI_USER = {
    _id: 'tripzi-ai' as const,
    name: 'Tripzi AI',
};

class AIService {
    async sendMessage(
        text: string,
        previousMessages: AIMessage[] = [],
        model: AIModel = 'llama-3.3-70b-versatile'
    ): Promise<AIMessage[]> {
        try {
            const result = await workersApi<{ text: string; model: string }>('/ai/plan', {
                body: { text, previousMessages, model },
            });
            const aiText = result?.text;

            if (typeof aiText === 'string' && aiText.trim().length > 0) {
                return [{
                    _id: Date.now() + Math.random(),
                    text: aiText,
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
