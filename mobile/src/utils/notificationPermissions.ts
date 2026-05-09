import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'not_determined';

export const getNotificationPermissionStatus = async (): Promise<NotificationPermissionStatus> => {
    try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'undetermined') return 'not_determined';
        return status;
    } catch {
        return 'denied';
    }
};

export const requestNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
    try {
        const { status } = await Notifications.requestPermissionsAsync({
            ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
            },
        });
        if (status === 'undetermined') return 'not_determined';
        return status;
    } catch {
        return 'denied';
    }
};

export const syncNotificationPreference = async (
    uid: string,
    permissionStatus: NotificationPermissionStatus,
    enabled: boolean
): Promise<void> => {
    try {
        await supabase
            .from('profiles')
            .update({
                notification_permission_status: permissionStatus,
                push_notifications_enabled: enabled && permissionStatus === 'granted',
            })
            .eq('id', uid);
    } catch {
        // Sync failures should not block user flow.
    }
};
