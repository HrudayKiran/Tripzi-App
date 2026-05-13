import { View, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import Icon from './Icon';

interface DefaultAvatarProps {
    uri?: string | null;
    name?: string;
    size?: number;
    style?: ViewStyle | ImageStyle;
    isGroup?: boolean;
}

const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ uri, size = 40, style, isGroup = false }) => {
    const isValidUrl = uri && (typeof uri === 'string') && (uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('file://'));

    return (
        <View style={[
            {
                width: size,
                height: size,
                borderRadius: size / 2,
                overflow: 'hidden',
                backgroundColor: '#f3f4f6', // Neutral light background for fallback
                justifyContent: 'center',
                alignItems: 'center'
            },
            style as ViewStyle
        ]}>
            {!isValidUrl ? (
                <Icon
                    name={isGroup ? "Users" : "User"}
                    size={size * 0.6}
                    color="#9ca3af"
                />
            ) : (
                <Image
                    source={{ uri: uri! }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                />
            )}
        </View>
    );
};

export default DefaultAvatar;

