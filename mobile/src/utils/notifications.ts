import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notifications to show when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const showUploadNotification = async (progress: number, title: string = 'Uploading Post...') => {
  // progress is 0 to 1
  const percentage = Math.round(progress * 100);
  
  const notificationId = 'trip-upload-progress';

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: `${percentage}% completed`,
      data: { progress },
      // @ts-ignore
      sticky: true,
      categoryIdentifier: 'upload-progress',
    },
    trigger: null,
    identifier: notificationId,
  });

  return notificationId;
};

export const completeUploadNotification = async (title: string = 'Trip Posted! ✨', body: string = 'Your trip is now live.') => {
  await Notifications.dismissNotificationAsync('trip-upload-progress');
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger: null,
  });
};

export const failUploadNotification = async (error: string = 'Upload failed. Please try again.') => {
  await Notifications.dismissNotificationAsync('trip-upload-progress');
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Post Upload Failed ❌',
      body: error,
    },
    trigger: null,
  });
};

// Initialize notification channel for Android
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('upload-progress', {
    name: 'Upload Progress',
    importance: Notifications.AndroidImportance.LOW,
    showBadge: false,
  });
}
