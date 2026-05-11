import messaging from '@react-native-firebase/messaging';

/**
 * Check current push notification permission status using Firebase Messaging.
 */
export const getNotificationPermissionStatus = async (): Promise<'granted' | 'denied' | 'undetermined'> => {
    try {
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
    try {
        const { supabase } = await import('../lib/supabase');
        await supabase
            .from('profiles')
            .update({ push_notifications_enabled: enabled })
            .eq('id', userId);
    } catch (e) {
        console.error('Failed to sync notification preference:', e);
    }
};
