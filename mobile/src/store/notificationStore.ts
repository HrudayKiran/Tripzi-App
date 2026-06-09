import { create } from 'zustand';

export interface Notification {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type?: string;
    deep_link_route?: string;
    deep_link_params?: any;
    actor_name?: string;
}

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    currentToast: { title: string; message: string; route?: string; params?: Record<string, any> } | null;
    isLoading: boolean;
    setNotifications: (notifications: Notification[]) => void;
    addNotification: (notification: Notification) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    deleteNotification: (id: string) => void;
    clearAll: () => void;
    setUnreadCount: (count: number) => void;
    incrementUnreadCount: () => void;
    showToast: (title: string, message: string, route?: string, params?: Record<string, any>) => void;
    hideToast: () => void;
    setLoading: (loading: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    unreadCount: 0,
    currentToast: null,
    isLoading: false,
    setNotifications: (notifications) => set({
        notifications,
        unreadCount: notifications.filter(n => !n.is_read).length,
    }),
    addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
    })),
    markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
    })),
    markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
    })),
    deleteNotification: (id) => set((state) => {
        const notification = state.notifications.find(n => n.id === id);
        const wasUnread = notification && !notification.is_read;
        return {
            notifications: state.notifications.filter(n => n.id !== id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
    }),
    clearAll: () => set({ notifications: [], unreadCount: 0 }),
    setUnreadCount: (count) => set({ unreadCount: count }),
    incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
    showToast: (title, message, route?, params?) => set({ currentToast: { title, message, route, params } }),
    hideToast: () => set({ currentToast: null }),
    setLoading: (loading) => set({ isLoading: loading }),
}));
