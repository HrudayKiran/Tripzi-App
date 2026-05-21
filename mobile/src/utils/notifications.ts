import messaging from '@react-native-firebase/messaging';
import { syncDatabase } from '../database/sync';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Create Android notification channel for upload progress
if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('upload-progress', {
        name: 'Upload Progress',
        importance: Notifications.AndroidImportance.LOW,
        sound: undefined,
        vibrationPattern: [0],
        enableVibrate: false,
    });
}

const PROGRESS_NOTIFICATION_ID = 'trip-upload-progress';

/**
 * Register the background message handler for FCM.
 * This must be called outside of any React component — typically in index.js.
 */
export const registerBackgroundHandler = () => {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('Background message received:', remoteMessage);
        
        // Handle silent notification (data only)
        if (remoteMessage.data && !remoteMessage.notification) {
            console.log('Handling silent notification, triggering sync...');
            try {
                await syncDatabase();
            } catch (e) {
                console.error('Failed to sync in background:', e);
            }
        }
    });
};

/**
 * Show or update a local notification with upload progress.
 * Uses a fixed identifier so each call replaces the previous notification.
 */
export const showUploadNotification = async (progress: number, title?: string): Promise<string> => {
    try {
        const progressPercent = Math.round(progress * 100);
        await Notifications.scheduleNotificationAsync({
            identifier: PROGRESS_NOTIFICATION_ID,
            content: {
                title: title || 'Processing...',
                body: `Progress: ${progressPercent}%`,
                data: { type: 'upload-progress' },
                ...(Platform.OS === 'android' && { channelId: 'upload-progress' }),
            },
            trigger: null, // Show immediately
        });
        return PROGRESS_NOTIFICATION_ID;
    } catch (e) {
        console.error('Failed to show upload notification:', e);
        return 'error';
    }
};

/**
 * Dismiss the progress notification and show a completion notification.
 */
export const completeUploadNotification = async (title?: string, body?: string): Promise<void> => {
    try {
        // Dismiss the progress notification
        await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
        
        // Show a completion notification
        await Notifications.scheduleNotificationAsync({
            content: {
                title: title || 'Upload Complete!',
                body: body || 'Your content has been uploaded successfully.',
                data: { type: 'upload-complete' },
                ...(Platform.OS === 'android' && { channelId: 'upload-progress' }),
            },
            trigger: null,
        });
    } catch (e) {
        console.error('Failed to show completion notification:', e);
    }
};

/**
 * Dismiss the progress notification and show an error notification.
 */
export const failUploadNotification = async (error?: string): Promise<void> => {
    try {
        // Dismiss the progress notification
        await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
        
        // Show a failure notification
        await Notifications.scheduleNotificationAsync({
            content: {
                title: 'Upload Failed',
                body: error || 'Something went wrong. Please try again.',
                data: { type: 'upload-failed' },
                ...(Platform.OS === 'android' && { channelId: 'upload-progress' }),
            },
            trigger: null,
        });
    } catch (e) {
        console.error('Failed to show failure notification:', e);
    }
};
