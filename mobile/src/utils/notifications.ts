import messaging from '@react-native-firebase/messaging';

/**
 * Register the background message handler for FCM.
 * This must be called outside of any React component — typically in index.js.
 */
export const registerBackgroundHandler = () => {
  messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
    // FCM notification messages are automatically displayed by the system.
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
