import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiService, Conversation, AIMessage } from '../services/AIService';

export function useAIPlannerQuery(conversationId: string | null) {
    const queryClient = useQueryClient();

    // Query for listing conversations
    const { data: conversations = [], isLoading: loadingConversations, refetch: refetchConversations } = useQuery({
        queryKey: ['aiConversations'],
        queryFn: async () => {
            console.log('[useAIPlannerQuery] Fetching conversations...');
            return await aiService.listConversations(20);
        },
    });

    // Query for messages in a conversation
    const { data: messages = [], isLoading: loadingMessages, refetch: refetchMessages } = useQuery({
        queryKey: ['aiMessages', conversationId],
        queryFn: async () => {
            if (!conversationId) return [];

            console.log(`[useAIPlannerQuery] Fetching messages for ${conversationId}...`);
            const serverMsgs = await aiService.getConversationMessages(conversationId);
            
            // Map to AIMessage format expected by the UI
            const loadedMsgs: AIMessage[] = serverMsgs.map((m) => ({
                _id: m.id,
                text: m.content,
                createdAt: new Date(m.created_at),
                user: m.role === 'assistant'
                    ? { _id: 'nxtvibes-ai', name: 'NxtVibes AI' }
                    : { _id: 'user', name: 'User' },
                suggestions: m.suggestions,
            }));
            
            return loadedMsgs.reverse();
        },
        enabled: !!conversationId,
    });

    return {
        conversations,
        messages,
        loading: loadingConversations || loadingMessages,
        refetchConversations,
        refetchMessages,
    };
}

export default useAIPlannerQuery;
