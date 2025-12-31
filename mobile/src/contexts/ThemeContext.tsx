import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeContextType = {
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
    primary: '#8B5CF6',       // Vibrant purple
    primaryLight: '#EDE9FE',
    secondary: '#06B6D4',     // Cyan
    accent: '#F59E0B',        // Amber
    success: '#10B981',       // Emerald
    warning: '#F97316',       // Orange
    error: '#EF4444',         // Red
    inputBackground: '#F9FAFB',
    headerBackground: '#FFFFFF',
    gradientStart: '#8B5CF6',
    gradientEnd: '#EC4899',   // Pink
};

const darkColors: ColorScheme = {
    background: '#0F0F0F',
    card: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    border: '#2A2A2A',
    primary: '#A78BFA',       // Light purple
    primaryLight: '#2D2A3E',
    secondary: '#22D3EE',     // Light cyan
    accent: '#FBBF24',        // Light amber
    success: '#34D399',       // Light emerald
    warning: '#FB923C',       // Light orange
    error: '#F87171',         // Light red
    inputBackground: '#1F1F1F',
    headerBackground: '#1A1A1A',
    gradientStart: '#A78BFA',
    gradientEnd: '#F472B6',   // Light pink
};

const ThemeContext = createContext<ThemeContextType>({
    isDarkMode: false,
    toggleTheme: () => { },
    colors: lightColors,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('theme');
            if (savedTheme !== null) {
                setIsDarkMode(savedTheme === 'dark');
            }
        } catch {
            // Theme loading failed silently
        }
    };

    const toggleTheme = async () => {
        const newTheme = !isDarkMode;
        setIsDarkMode(newTheme);
        try {
            await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
        } catch {
            // Theme saving failed silently
        }
    };

    const colors = isDarkMode ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
