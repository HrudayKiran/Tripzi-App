import { create } from 'zustand';
import { Appearance } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();
const THEME_KEY = '@nxtvibes_theme';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ColorScheme = {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    inputBackground: string;
    headerBackground: string;
    gradientStart: string;
    gradientEnd: string;
};

export const lightColors: ColorScheme = {
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1a1a1a',
    textSecondary: '#666666',
    border: '#F3F4F6',
    primary: '#9d74f7',
    primaryLight: '#EEE6FF',
    secondary: '#06B6D4',     // Cyan
    accent: '#F59E0B',        // Amber
    success: '#10B981',       // Emerald
    warning: '#F97316',       // Orange
    error: '#EF4444',         // Red
    inputBackground: '#F9FAFB',
    headerBackground: '#FFFFFF',
    gradientStart: '#9d74f7',
    gradientEnd: '#EC4899',   // Pink
};

export const darkColors: ColorScheme = {
    background: '#0F0F0F',
    card: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    border: '#2A2A2A',
    primary: '#9d74f7',
    primaryLight: '#2D2145',
    secondary: '#22D3EE',     // Light cyan
    accent: '#FBBF24',        // Light amber
    success: '#34D399',       // Light emerald
    warning: '#FB923C',       // Light orange
    error: '#F87171',         // Light red
    inputBackground: '#1F1F1F',
    headerBackground: '#1A1A1A',
    gradientStart: '#9d74f7',
    gradientEnd: '#F472B6',   // Light pink
};

interface ThemeState {
    themeMode: ThemeMode;
    isDarkMode: boolean;
    colors: ColorScheme;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
}

const getIsDarkMode = (mode: ThemeMode): boolean => {
    if (mode === 'system') {
        return Appearance.getColorScheme() === 'dark';
    }
    return mode === 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => {
    // Initial load from MMKV synchronously
    const savedTheme = storage.getString(THEME_KEY) as ThemeMode | undefined;
    const initialMode: ThemeMode = savedTheme || 'system';
    const initialIsDark = getIsDarkMode(initialMode);

    return {
        themeMode: initialMode,
        isDarkMode: initialIsDark,
        colors: initialIsDark ? darkColors : lightColors,
        setThemeMode: (mode: ThemeMode) => {
            storage.set(THEME_KEY, mode);
            const isDark = getIsDarkMode(mode);
            set({
                themeMode: mode,
                isDarkMode: isDark,
                colors: isDark ? darkColors : lightColors
            });
        },
        toggleTheme: () => {
            const currentMode = get().themeMode;
            const systemDark = Appearance.getColorScheme() === 'dark';
            const currentEffectiveDark = currentMode === 'system' ? systemDark : currentMode === 'dark';
            const newMode: ThemeMode = currentEffectiveDark ? 'light' : 'dark';
            get().setThemeMode(newMode);
        }
    };
});

// Listener for system appearance change
Appearance.addChangeListener(({ colorScheme }) => {
    const state = useThemeStore.getState();
    if (state.themeMode === 'system') {
        const isDark = colorScheme === 'dark';
        useThemeStore.setState({
            isDarkMode: isDark,
            colors: isDark ? darkColors : lightColors
        });
    }
});
