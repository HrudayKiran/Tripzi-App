import React, { createContext, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore, ThemeMode, ColorScheme } from '../store/themeStore';

export type { ThemeMode, ColorScheme };

type ThemeContextType = {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    colors: ColorScheme;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const { themeMode, setThemeMode, isDarkMode, toggleTheme, colors } = useThemeStore();

    return (
        <ThemeContext.Provider value={{ themeMode, setThemeMode, isDarkMode, toggleTheme, colors }}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        // Fallback directly to the Zustand store if used outside the provider
        const store = useThemeStore();
        return {
            themeMode: store.themeMode,
            setThemeMode: store.setThemeMode,
            isDarkMode: store.isDarkMode,
            toggleTheme: store.toggleTheme,
            colors: store.colors,
        };
    }
    return context;
};
