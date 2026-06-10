import { Alert } from 'react-native';
import notifee from '@notifee/react-native';

export const showUploadNotification = async (progress: number | string, message: string): Promise<number> => {
    let percent = 0;
    const num = Number(progress);
    if (!isNaN(num)) {
        if (num <= 1) {
            percent = Math.round(num * 100);
        } else {
            percent = Math.round(num);
        }
    }
    percent = Math.max(0, Math.min(100, percent));

    try {
        await notifee.displayNotification({
            id: 'media-upload-notification',
            title: 'Uploading Media',
            body: `${message} (${percent}%)`,
            android: {
                channelId: 'system',
                smallIcon: 'ic_notification',
                onlyAlertOnce: true,
                progress: {
                    max: 100,
                    current: percent,
                    indeterminate: false,
                },
            },
        });
    } catch (error) {
        console.error('[Notifications] Failed to show progress notification:', error);
    }
    
    return 12345;
};

export const completeUploadNotification = async (id: number | string, title?: string, message?: string): Promise<void> => {
    let finalTitle = title || 'Upload Complete';
    let finalMessage = message || '';
    if (typeof id === 'string' && !title && !message) {
        finalMessage = id;
    } else if (typeof id === 'string' && title && !message) {
        finalTitle = id;
        finalMessage = title;
    }

    try {
        await notifee.cancelNotification('media-upload-notification');
        
        await notifee.displayNotification({
            title: finalTitle,
            body: finalMessage,
            android: {
                channelId: 'system',
                smallIcon: 'ic_notification',
            },
        });
    } catch (error) {
        console.error('[Notifications] Failed to show complete notification:', error);
    }
};

export const failUploadNotification = async (id: number | string, title?: string, message?: string): Promise<void> => {
    let finalTitle = title || 'Upload Failed';
    let finalMessage = message || 'An error occurred during upload.';
    if (typeof id === 'string' && !title && !message) {
        finalMessage = id;
    } else if (typeof id === 'string' && title && !message) {
        finalTitle = id;
        finalMessage = title;
    }

    try {
        await notifee.cancelNotification('media-upload-notification');
        
        await notifee.displayNotification({
            title: finalTitle,
            body: finalMessage,
            android: {
                channelId: 'system',
                smallIcon: 'ic_notification',
            },
        });
    } catch (error) {
        console.error('[Notifications] Failed to show fail notification:', error);
    }

    Alert.alert(finalTitle, finalMessage);
};
