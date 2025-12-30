import * as ImagePicker from 'expo-image-picker';
import storage from '@react-native-firebase/storage';
import { Alert, Linking, Platform } from 'react-native';

export type ImageFolder = 'profiles' | 'trips' | 'stories' | 'kyc' | 'chats';

export interface UploadOptions {
    folder: ImageFolder;
    userId: string;
    subfolder?: string;
    aspect?: [number, number];
    quality?: number;
    allowsEditing?: boolean;
}

export interface UploadResult {
    success: boolean;
    url?: string;
    path?: string;
    error?: string;
}

/**
 * Request permission to access media library.
 * Shows alert with "Open Settings" option if denied.
 */
export async function requestMediaPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
        Alert.alert(
            'Permission Required',
            'Please allow access to your photos to upload images.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open Settings',
                    onPress: () => {
                        if (Platform.OS === 'ios') {
                            Linking.openURL('app-settings:');
                        } else {
                            Linking.openSettings();
                        }
                    }
                },
            ]
        );
        return false;
    }
    return true;
}

/**
 * Request camera permission.
 * Shows alert with "Open Settings" option if denied.
 */
export async function requestCameraPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
        Alert.alert(
            'Camera Permission Required',
            'Please allow access to your camera to take photos.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open Settings',
                    onPress: () => {
                        if (Platform.OS === 'ios') {
                            Linking.openURL('app-settings:');
                        } else {
                            Linking.openSettings();
                        }
                    }
                },
            ]
        );
        return false;
    }
    return true;
}

/**
 * Pick an image from the device library and upload to Firebase Storage.
 * Returns the download URL on success.
 */
export async function pickAndUploadImage(options: UploadOptions): Promise<UploadResult> {
    const { folder, userId, subfolder, aspect = [1, 1], quality = 0.8, allowsEditing = true } = options;

    // Request permission
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
        return { success: false, error: 'Permission denied' };
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality,
    });

    if (result.canceled || !result.assets[0]) {
        return { success: false, error: 'Selection cancelled' };
    }

    // Upload to Firebase Storage
    return uploadToStorage(result.assets[0].uri, folder, userId, subfolder);
}

/**
 * Take a photo with camera and upload to Firebase Storage.
 * Returns the download URL on success.
 */
export async function captureAndUploadImage(options: UploadOptions): Promise<UploadResult> {
    const { folder, userId, subfolder, aspect = [1, 1], quality = 0.8, allowsEditing = true } = options;

    // Request permission
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
        return { success: false, error: 'Camera permission denied' };
    }

    // Take photo
    const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality,
    });

    if (result.canceled || !result.assets[0]) {
        return { success: false, error: 'Photo cancelled' };
    }

    // Upload to Firebase Storage
    return uploadToStorage(result.assets[0].uri, folder, userId, subfolder);
}

/**
 * Upload a local file to Firebase Storage.
 * @param uri Local file URI
 * @param folder Storage folder (profiles, trips, stories, kyc, chats)
 * @param userId User ID for path organization
 * @param subfolder Optional subfolder within user's folder
 */
export async function uploadToStorage(
    uri: string,
    folder: ImageFolder,
    userId: string,
    subfolder?: string
): Promise<UploadResult> {
    try {
        const timestamp = Date.now();
        const filename = `${timestamp}.jpg`;
        const path = subfolder
            ? `${folder}/${userId}/${subfolder}/${filename}`
            : `${folder}/${userId}/${filename}`;

        const reference = storage().ref(path);
        await reference.putFile(uri);
        const downloadUrl = await reference.getDownloadURL();

        return { success: true, url: downloadUrl, path };
    } catch (error) {
        console.error('Upload error:', error);
        return { success: false, error: 'Upload failed. Please try again.' };
    }
}

/**
 * Delete a file from Firebase Storage by URL.
 * @param url The download URL of the file to delete
 */
export async function deleteFromStorage(url: string): Promise<boolean> {
    if (!url || !url.startsWith('https://')) {
        return false;
    }

    try {
        const reference = storage().refFromURL(url);
        await reference.delete();
        return true;
    } catch (error) {
        console.error('Delete from storage error:', error);
        return false;
    }
}

/**
 * Delete a file from Firebase Storage by path.
 * @param path The storage path of the file to delete
 */
export async function deleteFromStorageByPath(path: string): Promise<boolean> {
    if (!path) {
        return false;
    }

    try {
        const reference = storage().ref(path);
        await reference.delete();
        return true;
    } catch (error) {
        console.error('Delete from storage error:', error);
        return false;
    }
}

export default {
    pickAndUploadImage,
    captureAndUploadImage,
    uploadToStorage,
    deleteFromStorage,
    deleteFromStorageByPath,
    requestMediaPermission,
    requestCameraPermission,
};
