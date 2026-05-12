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
}

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    currentToast: { title: string; message: string } | null;
    setNotifications: (notifications: Notification[]) => void;
    addNotification: (notification: Notification) => void;
    markAsRead: (id: string) => void;
    setUnreadCount: (count: number) => void;
    incrementUnreadCount: () => void;
    showToast: (title: string, message: string) => void;
    hideToast: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    unreadCount: 0,
    currentToast: null,
    setNotifications: (notifications) => set({ notifications }),
    addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1
    })),
    markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
    })),
    setUnreadCount: (count) => set({ unreadCount: count }),
    incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
    showToast: (title, message) => set({ currentToast: { title, message } }),
    hideToast: () => set({ currentToast: null }),
}));
