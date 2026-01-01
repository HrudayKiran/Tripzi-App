/**
 * Firebase App Check Hook
 * 
 * App Check helps protect your Firebase backend resources from abuse.
 * It works by verifying that your app is running on a legitimate device
 * and hasn't been tampered with.
 * 
 * SETUP REQUIRED:
 * 1. Enable App Check in Firebase Console (https://console.firebase.google.com)
 * 2. Register your app with Play Integrity (Android)
 * 3. Add SHA-256 fingerprint to Firebase Console
 */

import { useEffect, useState } from 'react';
import appCheck from '@react-native-firebase/app-check';

// Set to true in production, false in development for easier testing
const ENABLE_APP_CHECK = !__DEV__;

// Use debug token in development (set in Firebase Console > App Check > Apps > Debug Tokens)
const DEBUG_TOKEN = 'YOUR-DEBUG-TOKEN'; // Replace with your debug token

/**
 * Initialize App Check with Play Integrity (Android)
 */
export const initializeAppCheck = async () => {
    if (!ENABLE_APP_CHECK) {
        console.log('App Check disabled in development');
        return;
    }

    try {
        // Configure App Check with Play Integrity provider
        await appCheck().initializeAppCheck({
            provider: appCheck.newPlayIntegrityProvider({
                // Optional: Define which Firebase products App Check protects
                // By default, it protects all products
            }),
            // Enable token auto-refresh
            isTokenAutoRefreshEnabled: true,
        });

        console.log('✅ App Check initialized successfully');

        // Get initial token to verify it's working
        const { token } = await appCheck().getToken(true);
        console.log('App Check token obtained:', token.substring(0, 20) + '...');

    } catch (error) {
        console.error('Failed to initialize App Check:', error);
    }
};

/**
 * React hook for App Check status
 */
export const useAppCheck = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await initializeAppCheck();
                setIsInitialized(true);
            } catch (err) {
                setError(err as Error);
            }
        };

        init();
    }, []);

    return {
        isInitialized,
        error,
        isEnabled: ENABLE_APP_CHECK,
    };
};

/**
 * Get App Check token manually (for custom backend calls)
 */
export const getAppCheckToken = async (): Promise<string | null> => {
    try {
        const { token } = await appCheck().getToken(true);
        return token;
    } catch (error) {
        console.error('Failed to get App Check token:', error);
        return null;
    }
};

export default useAppCheck;
