import { create } from 'zustand';

/**
 * Tracks which chat screen the user is currently viewing.
 * Used to suppress duplicate notification banners when the user
 * is already in the same chat that a push notification is for.
 */
interface ActiveChatState {
    /** The ID of the chat currently being viewed, or null if not in a chat */
    activeChatId: string | null;
    /** Set when user enters a chat screen */
    setActiveChatId: (chatId: string | null) => void;
    /** Clear when user leaves a chat screen */
    clearActiveChatId: () => void;
}

export const useActiveChatStore = create<ActiveChatState>((set) => ({
    activeChatId: null,
    setActiveChatId: (chatId) => set({ activeChatId: chatId }),
    clearActiveChatId: () => set({ activeChatId: null }),
}));
