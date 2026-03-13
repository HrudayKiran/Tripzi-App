import AsyncStorage from '@react-native-async-storage/async-storage';

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
        const value = await AsyncStorage.getItem(key);
        if (value === null) return defaultValue;
        return value === 'true';
    } catch {
        return defaultValue;
    }
};

export const setBooleanPreference = async (
    key: string,
    value: boolean
): Promise<void> => {
    try {
        await AsyncStorage.setItem(key, value ? 'true' : 'false');
    } catch {
        // Preference writes are non-blocking UX enhancements.
    }
};

export const getStringPreference = async (
    key: string,
    defaultValue: string | null = null
): Promise<string | null> => {
    try {
        const value = await AsyncStorage.getItem(key);
        return value === null ? defaultValue : value;
    } catch {
        return defaultValue;
    }
};

export const setStringPreference = async (
    key: string,
    value: string
): Promise<void> => {
    try {
        await AsyncStorage.setItem(key, value);
    } catch {
        // Preference writes are non-blocking UX enhancements.
    }
};
