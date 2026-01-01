import React from 'react';
import { View, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface DefaultAvatarProps {
    uri?: string | null;
    size?: number;
    style?: ViewStyle | ImageStyle;
}

/**
 * A smart avatar component that shows the user's photo or a default icon.
 * Falls back to app icon or person icon when no valid URL is provided.
 */
const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ uri, size = 40, style }) => {
    const { colors } = useTheme();

    const isValidUrl = uri && (uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('file://'));

    if (isValidUrl) {
        return (
            <Image
                source={{ uri }}
                style={[{ width: size, height: size, borderRadius: size / 2 }, style as ImageStyle]}
            />
        );
    }

    // Fallback: show a person icon in a circular background
    return (
        <View style={[
            styles.fallback,
            {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors.inputBackground
            },
            style
        ]}>
            <Ionicons name="person" size={size * 0.5} color={colors.textSecondary} />
        </View>
    );
};

const styles = StyleSheet.create({
    fallback: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default DefaultAvatar;
