import { useEffect, useState } from 'react';
import { Platform, Alert, Linking } from 'react-native';
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


        // Request notification permission first (most important)
        const notifResult = await requestNotificationPermission();

        // Request location permission
        const locResult = await requestLocationPermission();

        // Request camera and media permissions
        const camResult = await requestCameraPermission();
        const mediaResult = await requestMediaLibraryPermission();



    };

    const requestNotificationPermission = async (): Promise<boolean> => {
        try {


            // For Firebase Cloud Messaging
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
