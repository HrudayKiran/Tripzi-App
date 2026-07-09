import { useState } from 'react';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import messaging from '@react-native-firebase/messaging';

interface PermissionStatus {
    notifications: boolean;
    location: boolean;
    camera: boolean;
    mediaLibrary: boolean;
}

interface UsePermissionsReturn {
    permissions: PermissionStatus;
    requestAllPermissions: () => Promise<void>;
    requestNotificationPermission: () => Promise<boolean>;
    requestLocationPermission: () => Promise<boolean>;
    requestCameraPermission: () => Promise<boolean>;
    requestMediaLibraryPermission: () => Promise<boolean>;
}

/**
 * Custom hook to manage app permissions.
 * Requests only notifications on app launch. Camera/media/location are requested on-demand.
 */
export function usePermissions(): UsePermissionsReturn {
    const [permissions, setPermissions] = useState<PermissionStatus>({
        notifications: false,
        location: false,
        camera: false,
        mediaLibrary: false,
    });

    const requestAllPermissions = async () => {
        await requestNotificationPermission();
    };

    const requestNotificationPermission = async (): Promise<boolean> => {
        try {
            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;
            setPermissions(prev => ({ ...prev, notifications: enabled }));
            return enabled;
        } catch {
            return false;
        }
    };

    const requestLocationPermission = async (): Promise<boolean> => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            const granted = status === 'granted';
            setPermissions(prev => ({ ...prev, location: granted }));
            return granted;
        } catch {
            return false;
        }
    };

    const requestCameraPermission = async (): Promise<boolean> => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            const granted = status === 'granted';
            setPermissions(prev => ({ ...prev, camera: granted }));
            return granted;
        } catch {
            return false;
        }
    };

    const requestMediaLibraryPermission = async (): Promise<boolean> => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            const granted = status === 'granted';
            setPermissions(prev => ({ ...prev, mediaLibrary: granted }));
            return granted;
        } catch {
            return false;
        }
    };

    return {
        permissions,
        requestAllPermissions,
        requestNotificationPermission,
        requestLocationPermission,
        requestCameraPermission,
        requestMediaLibraryPermission,
    };
}

export default usePermissions;
