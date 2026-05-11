import { useEffect } from 'react';
import appCheck from '@react-native-firebase/app-check';

export const useAppCheck = () => {
    useEffect(() => {
        const initializeAppCheck = async () => {
            try {
                // Initialize Firebase App Check with Play Integrity on Android and DeviceCheck/AppAttest on iOS
                const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
                provider.configure({
                    android: {
                        provider: __DEV__ ? 'debug' : 'playIntegrity',
                        debugToken: process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN || '',
                    },
                    apple: {
                        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
                        debugToken: process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN || '',
                    },
                    web: {
                        provider: 'reCaptchaV3',
                        siteKey: process.env.EXPO_PUBLIC_APPCHECK_WEB_SITE_KEY || '',
                    },
                });

                await appCheck().initializeAppCheck({
                    provider,
                    isTokenAutoRefreshEnabled: true,
                });
                
                console.log('Firebase App Check initialized successfully.');
            } catch (error) {
                console.error('Failed to initialize Firebase App Check:', error);
            }
        };

        if (process.env.EXPO_PUBLIC_ENABLE_APPCHECK === 'true') {
            initializeAppCheck();
        }
    }, []);
};
