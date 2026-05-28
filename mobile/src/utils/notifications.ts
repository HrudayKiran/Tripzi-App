import { Alert } from 'react-native';

export const showUploadNotification = async (progress: number | string, message: string): Promise<number> => {
    console.log(`[Upload Notification] Progress: ${progress}, Message: ${message}`);
    return 12345;
};

export const completeUploadNotification = async (id: number | string, title?: string, message?: string): Promise<void> => {
    console.log(`[Upload Complete] ID: ${id}, ${title || ''}: ${message || ''}`);
};

export const failUploadNotification = async (id: number | string, title?: string, message?: string): Promise<void> => {
    console.log(`[Upload Failed] ID: ${id}, ${title || ''}: ${message || ''}`);
    if (title || message) {
        Alert.alert(title || 'Upload Failed', message || 'An error occurred during upload.');
    }
};
