import messaging from '@react-native-firebase/messaging';
import { syncDatabase } from '../database/sync';

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
 * No-op stubs — previously used expo-notifications for local upload progress.
 * The create screens already show their own in-app loading indicators.
 */
export const showUploadNotification = async (_progress: number, _title?: string): Promise<string> => {
  return 'no-op';
};

export const completeUploadNotification = async (_title?: string, _body?: string): Promise<void> => {};

export const failUploadNotification = async (_error?: string): Promise<void> => {};
