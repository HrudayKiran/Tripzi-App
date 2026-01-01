import { useEffect, useState } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
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
 * Custom hook to manage all app permissions.
 * Requests permissions on first app launch and provides methods to request individual permissions.
 */
export function usePermissions(): UsePermissionsReturn {
    const [permissions, setPermissions] = useState<PermissionStatus>({
        notifications: false,
        location: false,
        camera: false,
        mediaLibrary: false,
    });

    // Request all permissions on mount
    useEffect(() => {
        const checkAndRequestPermissions = async () => {
            // Small delay to let the app initialize
            await new Promise(resolve => setTimeout(resolve, 1500));
            await requestAllPermissions();
        };

        checkAndRequestPermissions();
    }, []);

    const requestAllPermissions = async () => {
        console.log('Requesting all app permissions...');

        // Request notification permission first (most important)
        const notifResult = await requestNotificationPermission();

        // Request location permission
        const locResult = await requestLocationPermission();

        // Request camera and media permissions
        const camResult = await requestCameraPermission();
        const mediaResult = await requestMediaLibraryPermission();

        console.log('Permission results:', {
            notifications: notifResult,
            location: locResult,
            camera: camResult,
            mediaLibrary: mediaResult,
        });
    };

    const requestNotificationPermission = async (): Promise<boolean> => {
        try {
            console.log('Requesting notification permission...');

            // For Firebase Cloud Messaging
            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (enabled) {
                console.log('FCM notification permission granted');
                setPermissions(prev => ({ ...prev, notifications: true }));
                return true;
            } else {
                console.log('FCM notification permission denied');
                setPermissions(prev => ({ ...prev, notifications: false }));
                return false;
            }
        } catch (error) {
            console.log('Notification permission error:', error);
            return false;
        }
    };

    const requestLocationPermission = async (): Promise<boolean> => {
        try {
            console.log('Requesting location permission...');
            const { status } = await Location.requestForegroundPermissionsAsync();
            const granted = status === 'granted';

            console.log('Location permission:', granted ? 'granted' : 'denied');
            setPermissions(prev => ({ ...prev, location: granted }));
            return granted;
        } catch (error) {
            console.log('Location permission error:', error);
            return false;
        }
    };

    const requestCameraPermission = async (): Promise<boolean> => {
        try {
            console.log('Requesting camera permission...');
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            const granted = status === 'granted';

            console.log('Camera permission:', granted ? 'granted' : 'denied');
            setPermissions(prev => ({ ...prev, camera: granted }));
            return granted;
        } catch (error) {
            console.log('Camera permission error:', error);
            return false;
        }
    };

    const requestMediaLibraryPermission = async (): Promise<boolean> => {
        try {
            console.log('Requesting media library permission...');
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            const granted = status === 'granted';

            console.log('Media library permission:', granted ? 'granted' : 'denied');
            setPermissions(prev => ({ ...prev, mediaLibrary: granted }));
            return granted;
        } catch (error) {
            console.log('Media library permission error:', error);
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
