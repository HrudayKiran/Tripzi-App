import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useCallback, useEffect } from 'react';
import { useNotificationStore } from '../store/notificationStore';

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
    deepLinkRoute: string;
    deepLinkParams: Record<string, any>;
    read: boolean;
    readAt: Date | null;
    createdAt: Date;
}

export function useNotificationsQuery() {
    const queryClient = useQueryClient();

    // Fetch notifications
    const { data: notifications = [], isLoading, error, refetch } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error: fetchError } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (fetchError) throw fetchError;

            const mapped = (data || []).map((row: any) => ({
                id: row.id,
                recipientId: user.id,
                type: row.type as NotificationType,
                title: row.title,
                message: row.message || '',
                entityId: row.entity_id || null,
                entityType: row.entity_type || null,
                actorId: row.actor_id || null,
                actorName: row.actor_name || null,
                deepLinkRoute: row.deep_link_route || '',
                deepLinkParams: row.deep_link_params || {},
                read: row.is_read || false,
                readAt: row.read_at ? new Date(row.read_at) : null,
                createdAt: row.created_at ? new Date(row.created_at) : new Date(),
            }));

            return mapped;
        },
    });

    // Sync unread count to Zustand
    useEffect(() => {
        if (notifications) {
            const unread = notifications.filter((n) => !n.read).length;
            useNotificationStore.getState().setUnreadCount(unread);
        }
    }, [notifications]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Mutations
    const markAsReadMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId)
                .eq('recipient_id', user.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('recipient_id', user.id)
                .eq('is_read', false);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const deleteNotificationMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('recipient_id', user.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel('notifications-feed-query')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
                
                // Show toast on new insert
                if (payload.eventType === 'INSERT') {
                    const newNotif = payload.new;
                    const { showToast } = useNotificationStore.getState();
                    showToast(newNotif.title, newNotif.message || '');
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return {
        notifications,
        unreadCount,
        loading: isLoading,
        error,
        markAsRead: markAsReadMutation.mutateAsync,
        markAllAsRead: markAllAsReadMutation.mutateAsync,
        deleteNotification: deleteNotificationMutation.mutateAsync,
        refresh: refetch,
    };
}

export default useNotificationsQuery;
