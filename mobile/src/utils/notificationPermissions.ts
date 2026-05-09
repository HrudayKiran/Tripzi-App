import { PermissionsAndroid, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'not_determined';

export const getNotificationPermissionStatus = async (): Promise<NotificationPermissionStatus> => {
    if (Platform.OS !== 'android') {
        return 'granted';
    }

    if (Platform.Version < 33) {
        return 'granted';
    }

    try {
        const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted ? 'granted' : 'denied';
    } catch {
        return 'denied';
    }
};

export const requestNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
    if (Platform.OS !== 'android') {
        return 'granted';
    }

    if (Platform.Version < 33) {
        return 'granted';
    }

    try {
        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
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
