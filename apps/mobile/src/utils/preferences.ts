import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();

export const PREFERENCE_KEYS = {
    theme: '@nxtvibes_theme',
    saveToGallery: '@nxtvibes_save_to_gallery',
    notificationPrompted: '@nxtvibes_notification_prompted',
    hapticsEnabled: '@nxtvibes_haptics_enabled',
    hapticsIntensity: '@nxtvibes_haptics_intensity',
    hapticsJoinTrip: '@nxtvibes_haptics_join_trip',
    hapticsNav: '@nxtvibes_haptics_nav',
    hapticsNotif: '@nxtvibes_haptics_notif',
} as const;

export const getBooleanPreferenceSync = (
    key: string,
    defaultValue: boolean
): boolean => {
    try {
        const value = storage.getBoolean(key);
        return value !== undefined ? value : defaultValue;
    } catch {
        return defaultValue;
    }
};

export const getBooleanPreference = async (
    key: string,
    defaultValue: boolean
): Promise<boolean> => {
    return getBooleanPreferenceSync(key, defaultValue);
};

export const setBooleanPreference = async (
    key: string,
    value: boolean
): Promise<void> => {
    try {
        storage.set(key, value);
    } catch {
        // Preference writes are non-blocking UX enhancements.
    }
};

export const getStringPreferenceSync = (
    key: string,
    defaultValue: string | null = null
): string | null => {
    try {
        const value = storage.getString(key);
        return value !== undefined ? value : defaultValue;
    } catch {
        return defaultValue;
    }
};

export const getStringPreference = async (
    key: string,
    defaultValue: string | null = null
): Promise<string | null> => {
    return getStringPreferenceSync(key, defaultValue);
};

export const setStringPreference = async (
    key: string,
    value: string
): Promise<void> => {
    try {
        storage.set(key, value);
    } catch {
        // Preference writes are non-blocking UX enhancements.
    }
};
