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
    inputBackground: string;
    headerBackground: string;
};

const lightColors: ColorScheme = {
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1a1a1a',
    textSecondary: '#666666',
    border: '#F3F4F6',
    primary: '#8A2BE2',
    inputBackground: '#F9FAFB',
    headerBackground: '#FFFFFF',
};

const darkColors: ColorScheme = {
    background: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    border: '#2C2C2C',
    primary: '#A855F7',
    inputBackground: '#2C2C2C',
    headerBackground: '#1E1E1E',
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
        } catch (error) {
            console.log('Error loading theme:', error);
        }
    };

    const toggleTheme = async () => {
        const newTheme = !isDarkMode;
        setIsDarkMode(newTheme);
        try {
            await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
        } catch (error) {
            console.log('Error saving theme:', error);
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
