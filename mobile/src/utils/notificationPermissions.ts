import { PermissionsAndroid, Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';

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
        await firestore().collection('users').doc(uid).set({
            notificationPermissionStatus: permissionStatus,
            pushNotificationsEnabled: enabled && permissionStatus === 'granted',
            updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch {
        // Sync failures should not block user flow.
    }
};
