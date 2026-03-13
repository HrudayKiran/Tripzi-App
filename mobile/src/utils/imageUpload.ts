import * as ImagePicker from 'expo-image-picker';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';
import { Alert, Linking, Platform } from 'react-native';

export type ImageFolder = 'profiles' | 'trips' | 'chats';

export interface UploadOptions {
    folder: ImageFolder;
    userId: string;
    subfolder?: string;
    aspect?: [number, number];
    quality?: number;
    allowsEditing?: boolean;
    tripId?: string;
}

export interface UploadResult {
    success: boolean;
    url?: string;
    path?: string;
    objectKey?: string;
    error?: string;
}

interface UploadTicket {
    uploadUrl: string;
    publicUrl: string;
    objectKey: string;
}

const inferContentType = (uri: string) => {
    const normalized = uri.toLowerCase();
    if (normalized.endsWith('.png')) return 'image/png';
    if (normalized.endsWith('.webp')) return 'image/webp';
    if (normalized.endsWith('.heic')) return 'image/heic';
    if (normalized.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
};

const inferFileName = (uri: string) => {
    const cleanUri = uri.split('?')[0];
    const segments = cleanUri.split('/');
    return segments[segments.length - 1] || `upload-${Date.now()}.jpg`;
};

const readLocalFileAsBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response as Blob);
        xhr.onerror = () => reject(new TypeError('Could not read the selected image file.'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
};

const putBlobToSignedUrl = async (
    uploadUrl: string,
    blob: Blob,
    contentType: string
) => {
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType,
        },
        body: blob,
    });

    if (!response.ok) {
        throw new Error(`R2 upload failed with status ${response.status}`);
    }
};

const uploadImageToR2 = async (
    uri: string,
    callableName: 'startProfileImageUpload' | 'startTripImageUpload',
    payload: Record<string, unknown>
): Promise<UploadResult> => {
    try {
        const contentType = inferContentType(uri);
        const fileName = inferFileName(uri);
        const callable = functions().httpsCallable(callableName);
        const ticketResponse = await callable({
            ...payload,
            contentType,
            fileName,
        });
        const ticket = ticketResponse?.data as UploadTicket | undefined;

        if (!ticket?.uploadUrl || !ticket?.publicUrl || !ticket?.objectKey) {
            throw new Error('Upload ticket was incomplete.');
        }

        const blob = await readLocalFileAsBlob(uri);
        await putBlobToSignedUrl(ticket.uploadUrl, blob, contentType);

        return {
            success: true,
            url: ticket.publicUrl,
            path: ticket.objectKey,
            objectKey: ticket.objectKey,
        };
    } catch (error) {
        return {
            success: false,
            error: 'Upload failed. Please try again.',
        };
    }
};

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
 * Pick an image from the device library and upload it.
 */
export async function pickAndUploadImage(options: UploadOptions): Promise<UploadResult> {
    const { folder, userId, subfolder, aspect = [1, 1], quality = 0.8, allowsEditing = true, tripId } = options;

    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
        return { success: false, error: 'Permission denied' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality,
    });

    if (result.canceled || !result.assets[0]) {
        return { success: false, error: 'Selection cancelled' };
    }

    if (folder === 'profiles') {
        return uploadProfileImageToR2(result.assets[0].uri, userId);
    }
    if (folder === 'trips') {
        return uploadTripImageToR2(result.assets[0].uri, userId, tripId);
    }

    return uploadToStorage(result.assets[0].uri, folder, userId, subfolder);
}

/**
 * Take a photo with camera and upload it.
 */
export async function captureAndUploadImage(options: UploadOptions): Promise<UploadResult> {
    const { folder, userId, subfolder, aspect = [1, 1], quality = 0.8, allowsEditing = true, tripId } = options;

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
        return { success: false, error: 'Camera permission denied' };
    }

    const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality,
    });

    if (result.canceled || !result.assets[0]) {
        return { success: false, error: 'Photo cancelled' };
    }

    if (folder === 'profiles') {
        return uploadProfileImageToR2(result.assets[0].uri, userId);
    }
    if (folder === 'trips') {
        return uploadTripImageToR2(result.assets[0].uri, userId, tripId);
    }

    return uploadToStorage(result.assets[0].uri, folder, userId, subfolder);
}

export async function uploadProfileImageToR2(
    uri: string,
    userId: string
): Promise<UploadResult> {
    return uploadImageToR2(uri, 'startProfileImageUpload', { userId });
}

export async function uploadTripImageToR2(
    uri: string,
    userId: string,
    tripId?: string
): Promise<UploadResult> {
    return uploadImageToR2(uri, 'startTripImageUpload', { userId, tripId: tripId || null });
}

export async function deleteProfileImageFromR2(objectKey: string): Promise<boolean> {
    if (!objectKey) return false;

    try {
        const callable = functions().httpsCallable('deleteProfileImage');
        await callable({ objectKey });
        return true;
    } catch {
        return false;
    }
}

export async function deleteTripImagesFromR2(
    objectKeys: string[],
    tripId?: string
): Promise<boolean> {
    const filteredKeys = objectKeys.filter(Boolean);
    if (filteredKeys.length === 0) return true;

    try {
        const callable = functions().httpsCallable('deleteTripImages');
        await callable({
            objectKeys: filteredKeys,
            tripId: tripId || null,
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Upload a local file to Firebase Storage.
 * Retained for non-migrated media only.
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

        return { success: false, error: 'Upload failed. Please try again.' };
    }
}

/**
 * Delete a file from Firebase Storage by URL.
 * Retained for legacy/non-migrated media.
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

        return false;
    }
}

/**
 * Delete a file from Firebase Storage by path.
 * Retained for legacy/non-migrated media.
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

        return false;
    }
}

export default {
    pickAndUploadImage,
    captureAndUploadImage,
    uploadToStorage,
    uploadProfileImageToR2,
    uploadTripImageToR2,
    deleteProfileImageFromR2,
    deleteTripImagesFromR2,
    deleteFromStorage,
    deleteFromStorageByPath,
    requestMediaPermission,
    requestCameraPermission,
};
