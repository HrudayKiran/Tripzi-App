import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type NotificationType =
    | 'message'
    | 'join_success'
    | 'join_trip'
    | 'leave_trip'
    | 'trip_update'
    | 'trip_cancelled'
    | 'trip_join'
    | 'age_verified'
    | 'rating'
    | 'report_submitted'
    | 'trip_report'
    | 'trip_full'
    | 'system'
    | 'action_required';

export interface AppNotification {
    id: string;
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityId: string | null;
    entityType: 'trip' | 'chat' | 'user' | 'report' | null;
    actorId: string | null;
    actorName: string | null;
    actorPhotoUrl: string | null;
    deepLinkRoute: string;
    deepLinkParams: Record<string, any>;
    read: boolean;
    readAt: Date | null;
    createdAt: Date;
}

interface UseNotificationsReturn {
    notifications: AppNotification[];
    unreadCount: number;
    loading: boolean;
    error: Error | null;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (notificationId: string) => Promise<void>;
    refresh: () => void;
}

export function useNotifications(): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    useEffect(() => {
        let isMounted = true;

        const setup = async () => {
            setLoading(true);
            setError(null);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (isMounted) { setLoading(false); setNotifications([]); }
                return;
            }

            try {
                const { data, error: fetchError } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (fetchError) throw fetchError;

                if (isMounted) {
                    const notifs = (data || []).map((row: any) => ({
                        id: row.id,
                        recipientId: user.id,
                        type: row.type as NotificationType,
                        title: row.title,
                        message: row.body || row.message || '',
                        entityId: row.entity_id || null,
                        entityType: row.entity_type || null,
                        actorId: row.actor_id || null,
                        actorName: row.actor_name || null,
                        actorPhotoUrl: row.actor_photo_url || null,
                        deepLinkRoute: row.deep_link_route || '',
                        deepLinkParams: row.deep_link_params || {},
                        read: row.read || false,
                        readAt: row.read_at ? new Date(row.read_at) : null,
                        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
                    }));

                    setNotifications(notifs);
                    setUnreadCount(notifs.filter((n) => !n.read).length);
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) { setError(err as Error); setLoading(false); }
            }
        };

        setup();

        // Realtime subscription for new notifications
        const channel = supabase
            .channel('notifications-feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                setup();
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [refreshKey]);

    const markAsRead = useCallback(async (notificationId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
            .from('notifications')
            .update({ read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', user.id);
    }, []);

    const markAllAsRead = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
            .from('notifications')
            .update({ read: true, read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('read', false);
    }, []);

    const deleteNotification = useCallback(async (notificationId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId)
            .eq('user_id', user.id);
    }, []);

    return {
        notifications,
        unreadCount,
        loading,
        error,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refresh,
    };
}

export default useNotifications;
