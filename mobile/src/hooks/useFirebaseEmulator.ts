/**
 * Firebase Emulator Connection Hook
 * 
 * Use this during development to test against local Firebase emulators
 * instead of production Firebase services.
 * 
 * Start emulators with: firebase emulators:start
 */

import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';

// Set to true to enable emulator connection in development
const USE_EMULATORS = false;

// For Android emulator, use 10.0.2.2 (maps to host's localhost)
// For physical device, use your computer's local IP (e.g., 192.168.1.x)
const EMULATOR_HOST = '10.0.2.2';

interface EmulatorConfig {
    firestore: { host: string; port: number };
    functions: { host: string; port: number };
    storage: { host: string; port: number };
    auth: { host: string; port: number };
}

const defaultConfig: EmulatorConfig = {
    firestore: { host: EMULATOR_HOST, port: 8080 },
    functions: { host: EMULATOR_HOST, port: 5001 },
    storage: { host: EMULATOR_HOST, port: 9199 },
    auth: { host: EMULATOR_HOST, port: 9099 },
};

let emulatorsConnected = false;

/**
 * Connect to Firebase Local Emulators
 * Call this once at app startup if you want to use emulators
 */
export const connectToEmulators = (config: Partial<EmulatorConfig> = {}) => {
    if (!__DEV__ || !USE_EMULATORS || emulatorsConnected) {
        return;
    }

    const finalConfig = { ...defaultConfig, ...config };

    try {
        // Firestore emulator
        firestore().useEmulator(finalConfig.firestore.host, finalConfig.firestore.port);


        // Functions emulator
        functions().useEmulator(finalConfig.functions.host, finalConfig.functions.port);


        // Storage emulator
        storage().useEmulator(finalConfig.storage.host, finalConfig.storage.port);


        // Auth emulator (optional - uncomment if needed)
        // auth().useEmulator(`http://${finalConfig.auth.host}:${finalConfig.auth.port}`);
        //

        emulatorsConnected = true;

    } catch (error) {
        console.warn('Failed to connect to Firebase emulators:', error);
    }
};

/**
 * React hook for Firebase emulator status
 */
export const useFirebaseEmulator = () => {
    const [isConnected, setIsConnected] = useState(emulatorsConnected);

    useEffect(() => {
        if (__DEV__ && USE_EMULATORS && !emulatorsConnected) {
            connectToEmulators();
            setIsConnected(true);
        }
    }, []);

    return {
        isConnected,
        isEnabled: USE_EMULATORS,
        isDev: __DEV__,
    };
};

export default useFirebaseEmulator;
