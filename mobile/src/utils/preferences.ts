import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();

export const PREFERENCE_KEYS = {
    theme: '@tripzi_theme',
    saveToGallery: '@tripzi_save_to_gallery',
    notificationPrompted: '@tripzi_notification_prompted',
} as const;

export const getBooleanPreference = async (
    key: string,
    defaultValue: boolean
): Promise<boolean> => {
    try {
        const value = storage.getBoolean(key);
        return value !== undefined ? value : defaultValue;
    } catch {
        return defaultValue;
    }
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

export const getStringPreference = async (
    key: string,
    defaultValue: string | null = null
): Promise<string | null> => {
    try {
        const value = storage.getString(key);
        return value !== undefined ? value : defaultValue;
    } catch {
        return defaultValue;
    }
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
