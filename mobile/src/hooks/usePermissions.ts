import { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getMessaging, requestPermission, AuthorizationStatus } from '@react-native-firebase/messaging';

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

    // Request only notifications on mount for a smoother first-launch UX.
    useEffect(() => {
        const checkAndRequestNotifications = async () => {
            await new Promise(resolve => setTimeout(resolve, 1200));
            await requestNotificationPermission();
        };

        checkAndRequestNotifications();
    }, []);

    const requestAllPermissions = async () => {
        await requestNotificationPermission();
    };

    const requestNotificationPermission = async (): Promise<boolean> => {
        try {
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    setPermissions(prev => ({ ...prev, notifications: true }));
                    return true;
                } else {
                    setPermissions(prev => ({ ...prev, notifications: false }));
                    return false;
                }
            } else {
                // For Firebase Cloud Messaging (Android < 13 or iOS)
                const messaging = getMessaging();
                const authStatus = await requestPermission(messaging);
                const enabled =
                    authStatus === AuthorizationStatus.AUTHORIZED ||
                    authStatus === AuthorizationStatus.PROVISIONAL;

                if (enabled) {
                    setPermissions(prev => ({ ...prev, notifications: true }));
                    return true;
                } else {
                    setPermissions(prev => ({ ...prev, notifications: false }));
                    return false;
                }
            }
        } catch (error) {
            
            return false;
        }
    };

    const requestLocationPermission = async (): Promise<boolean> => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            const granted = status === 'granted';
            setPermissions(prev => ({ ...prev, location: granted }));
            return granted;
        } catch (error) {
            
            return false;
        }
    };

    const requestCameraPermission = async (): Promise<boolean> => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            const granted = status === 'granted';
            setPermissions(prev => ({ ...prev, camera: granted }));
            return granted;
        } catch (error) {
            
            return false;
        }
    };

    const requestMediaLibraryPermission = async (): Promise<boolean> => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            const granted = status === 'granted';
            setPermissions(prev => ({ ...prev, mediaLibrary: granted }));
            return granted;
        } catch (error) {
            
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
