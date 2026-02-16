import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { FONT_WEIGHT } from '../styles/constants';

interface DefaultAvatarProps {
    uri?: string | null;
    name?: string;
    size?: number;
    style?: ViewStyle | ImageStyle;
}

/**
 * A smart avatar component that shows the user's photo or a gradient with initials.
 */
const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ uri, name = 'User', size = 40, style }) => {
    const { colors } = useTheme();

    const isValidUrl = uri && (uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('file://'));

    if (isValidUrl) {
        return (
            <Image
                source={{ uri: uri! }}
                style={[{ width: size, height: size, borderRadius: size / 2 }, style as ImageStyle]}
            />
        );
    }

    // Fallback: Gradient with Initials
    const initial = (name || 'U').charAt(0).toUpperCase();
    const fontSize = size * 0.4;

    return (
        <LinearGradient
            colors={['#8B5CF6', '#EC4899', '#F59E0B']}
            style={[
                styles.gradient,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                style
            ]}
        >
            <Text style={[styles.text, { fontSize }]}>{initial}</Text>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    gradient: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
        fontWeight: FONT_WEIGHT.bold,
    }
});

export default DefaultAvatar;

