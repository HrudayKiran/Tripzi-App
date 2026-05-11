import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { getStringPreference, PREFERENCE_KEYS, setStringPreference } from '../utils/preferences';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextType = {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    colors: ColorScheme;
};

type ColorScheme = {
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

const lightColors: ColorScheme = {
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

const darkColors: ColorScheme = {
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

const ThemeContext = createContext<ThemeContextType>({
    themeMode: 'system',
    setThemeMode: () => { },
    isDarkMode: false,
    toggleTheme: () => { },
    colors: lightColors,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const systemColorScheme = useColorScheme();

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await getStringPreference(PREFERENCE_KEYS.theme) as ThemeMode | null;
            if (savedTheme !== null) {
                setThemeModeState(savedTheme);
            }
        } catch {
            // Theme loading failed silently
        }
    };

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        try {
            await setStringPreference(PREFERENCE_KEYS.theme, mode);
        } catch {
            // Theme saving failed silently
        }
    };

    const toggleTheme = async () => {
        const currentEffectiveDark = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';
        const newMode: ThemeMode = currentEffectiveDark ? 'light' : 'dark';
        setThemeMode(newMode);
    };

    const isDarkMode = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';
    const colors = isDarkMode ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ themeMode, setThemeMode, isDarkMode, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
