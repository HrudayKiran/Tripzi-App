import { useEffect, useState } from 'react';
import appCheck from '@react-native-firebase/app-check';

const ENABLE_IN_DEV = process.env.EXPO_PUBLIC_ENABLE_APPCHECK === 'true';
const SHOULD_ENABLE = !__DEV__ || ENABLE_IN_DEV;
const DEBUG_TOKEN = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN?.trim() || undefined;
const WEB_SITE_KEY = process.env.EXPO_PUBLIC_APPCHECK_WEB_SITE_KEY?.trim() || undefined;

export const initializeAppCheck = async () => {
    if (!SHOULD_ENABLE) {
        if (__DEV__) {
            console.log('[AppCheck] Disabled in dev. Set EXPO_PUBLIC_ENABLE_APPCHECK=true to enable.');
        }
        return;
    }

    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    provider.configure({
        android: {
            provider: __DEV__ ? 'debug' : 'playIntegrity',
            debugToken: DEBUG_TOKEN,
        },
        apple: {
            provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
            debugToken: DEBUG_TOKEN,
        },
        web: {
            provider: __DEV__ ? 'debug' : 'reCaptchaV3',
            debugToken: DEBUG_TOKEN,
            siteKey: WEB_SITE_KEY,
        },
    });

    await appCheck().initializeAppCheck({
        provider,
        isTokenAutoRefreshEnabled: true,
    });

    // Warm up one token so App Check metrics start appearing quickly.
    await appCheck().getToken(false);
};

export const useAppCheck = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await initializeAppCheck();
            } catch (err) {
                setError(err as Error);
            } finally {
                setIsInitialized(true);
            }
        };

        init();
    }, []);

    return {
        isInitialized,
        error,
        isEnabled: SHOULD_ENABLE,
    };
};

export const getAppCheckToken = async (): Promise<string | null> => {
    if (!SHOULD_ENABLE) return null;
    try {
        const { token } = await appCheck().getToken(true);
        return token;
    } catch (_) {
        return null;
    }
};

export default useAppCheck;
