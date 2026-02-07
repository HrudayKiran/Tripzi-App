import { useState, useEffect, useCallback } from 'react';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export type NotificationType =
    | 'like'
    | 'comment'
    | 'message'
    | 'age_verified'
    | 'trip_join'
    | 'trip_full'
    | 'action_required';

export interface AppNotification {
    id: string;
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityId: string | null;
    entityType: 'trip' | 'chat' | 'user' | 'kyc' | null;
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

/**
 * Hook for real-time notifications from Firestore.
 * Provides notifications list, unread count, and actions to mark as read/delete.
 */
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
        const userId = auth().currentUser?.uid;


        if (!userId) {

            setLoading(false);
            setNotifications([]);
            return;
        }

        setLoading(true);
        setError(null);


        const unsubscribe = firestore()
            .collection('notifications')
            .where('recipientId', '==', userId)
            .limit(50)
            .onSnapshot(
                (snapshot) => {

                    const notifs = snapshot.docs.map((doc) => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            recipientId: data.recipientId,
                            type: data.type as NotificationType,
                            title: data.title,
                            message: data.message,
                            entityId: data.entityId || null,
                            entityType: data.entityType || null,
                            actorId: data.actorId || null,
                            actorName: data.actorName || null,
                            actorPhotoUrl: data.actorPhotoUrl || null,
                            deepLinkRoute: data.deepLinkRoute || '',
                            deepLinkParams: data.deepLinkParams || {},
                            read: data.read || false,
                            readAt: data.readAt?.toDate() || null,
                            createdAt: data.createdAt?.toDate() || new Date(),
                        } as AppNotification;
                    });
                    // Sort client-side since we removed orderBy to avoid index requirement
                    notifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

                    setNotifications(notifs);
                    setUnreadCount(notifs.filter((n) => !n.read).length);
                    setLoading(false);

                },
                (err) => {
                    console.error('🔔 [NOTIF] ❌ Listener error:', err);
                    setError(err as Error);
                    setLoading(false);
                }
            );

        return () => unsubscribe();
    }, [refreshKey]);

    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            await firestore().collection('notifications').doc(notificationId).update({
                read: true,
                readAt: firestore.FieldValue.serverTimestamp(),
            });
        } catch (err) {
            console.error('Error marking notification as read:', err);
            throw err;
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        const userId = auth().currentUser?.uid;
        if (!userId) return;

        try {
            const unreadDocs = await firestore()
                .collection('notifications')
                .where('recipientId', '==', userId)
                .where('read', '==', false)
                .get();

            if (unreadDocs.empty) return;

            const batch = firestore().batch();
            unreadDocs.docs.forEach((doc) => {
                batch.update(doc.ref, {
                    read: true,
                    readAt: firestore.FieldValue.serverTimestamp(),
                });
            });
            await batch.commit();
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
            throw err;
        }
    }, []);

    const deleteNotification = useCallback(async (notificationId: string) => {
        try {
            await firestore().collection('notifications').doc(notificationId).delete();
        } catch (err) {
            console.error('Error deleting notification:', err);
            throw err;
        }
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
