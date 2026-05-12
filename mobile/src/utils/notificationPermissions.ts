import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Check current push notification permission status using Firebase Messaging.
 */
export const getNotificationPermissionStatus = async (): Promise<'granted' | 'denied' | 'undetermined'> => {
    try {
        // Handle Android 13+ (API 33+) notification permission
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const hasPermission = await PermissionsAndroid.check('android.permission.POST_NOTIFICATIONS');
            return hasPermission ? 'granted' : 'denied';
        }

        const authStatus = await messaging().hasPermission();

        if (
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL
        ) {
            return 'granted';
        }

        if (authStatus === messaging.AuthorizationStatus.DENIED) {
            return 'denied';
        }

        return 'undetermined';
    } catch {
        return 'undetermined';
    }
};

/**
 * Request push notification permission using Firebase Messaging.
 */
export const requestNotificationPermission = async (): Promise<'granted' | 'denied' | 'undetermined'> => {
    try {
        // Handle Android 13+ (API 33+) notification permission
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const status = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
            return status === 'granted' ? 'granted' : 'denied';
        }

        const authStatus = await messaging().requestPermission();
        if (
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL
        ) {
            return 'granted';
        }
        if (authStatus === messaging.AuthorizationStatus.DENIED) {
            return 'denied';
        }
        return 'undetermined';
    } catch {
        return 'undetermined';
    }
};

/**
 * Sync the user's explicit preference for push notifications to the database.
 */
export const syncNotificationPreference = async (
    userId: string,
    permissionStatus: string,
    enabled: boolean
): Promise<void> => {
    const { supabase } = await import('../lib/supabase');
    const { error } = await supabase
        .from('profiles')
        .update({ push_notifications_enabled: enabled })
        .eq('id', userId);

    if (error) {
        console.error('Failed to sync notification preference:', error);
        throw error;
    }
};
