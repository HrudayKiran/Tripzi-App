import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View, Animated, Easing, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icon, { IconName } from './Icon';
import { useRouter } from 'expo-router';

// ==========================================
// 1. Base Neumorphic Icon Button
// ==========================================
export interface NeumorphicIconButtonProps {
    onPress: () => void;
    iconName: IconName;
    size?: number;
    iconSize?: number;
    iconWeight?: 'bold' | 'fill' | 'regular' | 'light' | 'thin' | 'duotone';
    style?: StyleProp<ViewStyle>;
    bgOverride?: string;
    iconColorOverride?: string;
}

export function NeumorphicIconButton({
    onPress,
    iconName,
    size = 45,
    iconSize = 22,
    iconWeight = 'bold',
    style,
    bgOverride,
    iconColorOverride
}: NeumorphicIconButtonProps) {
    const { isDarkMode } = useTheme();
    const isDark = isDarkMode;

    const resolvedBg = bgOverride || (isDark ? '#000000' : '#FFFFFF');
    const resolvedIconColor = iconColorOverride || (isDark ? '#FFFFFF' : '#000000');

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.button,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: resolvedBg,
                    shadowColor: isDark ? '#000000' : '#b8c4d9',
                    shadowOffset: { width: 3, height: 3 },
                    shadowOpacity: 0.8,
                    shadowRadius: 5,
                    elevation: 4,
                },
                style
            ]}
            activeOpacity={0.85}
        >
            <Icon
                name={iconName}
                size={iconSize}
                color={resolvedIconColor}
                weight={iconWeight}
            />
        </TouchableOpacity>
    );
}

// ==========================================
// 2. Neumorphic Back Button
// ==========================================
export interface NeumorphicBackButtonProps {
    onPress?: () => void;
    iconName?: IconName;
    size?: number;
    iconSize?: number;
    style?: StyleProp<ViewStyle>;
}

export function NeumorphicBackButton({
    onPress,
    iconName = 'CaretLeft',
    size = 45,
    iconSize = 24,
    style
}: NeumorphicBackButtonProps) {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const isDark = isDarkMode;

    const handlePress = onPress || (() => router.back());

    return (
        <TouchableOpacity
            onPress={handlePress}
            style={[
                styles.button,
                {
                    backgroundColor: isDark ? '#000000' : '#FFFFFF',
                    shadowColor: isDark ? '#000000' : '#d1d9e6',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    justifyContent: 'center',
                    alignItems: 'center',
                    elevation: 5,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                },
                style
            ]}
            activeOpacity={0.7}
        >
            <Icon
                name={iconName}
                size={iconSize}
                color={isDark ? '#FFFFFF' : '#000000'}
            />
        </TouchableOpacity>
    );
}

// ==========================================
// 3. Neumorphic Floating Action Button
// ==========================================
export interface NeumorphicFloatingButtonProps {
    onPress: () => void;
    iconName?: IconName;
    bottom?: number;
    right?: number;
    size?: number;
    iconSize?: number;
}

export function NeumorphicFloatingButton({
    onPress,
    iconName = 'Plus',
    bottom = 84,
    right = 20,
    size = 56,
    iconSize = 26,
}: NeumorphicFloatingButtonProps) {
    const { colors, isDarkMode } = useTheme();
    const isDark = isDarkMode;

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.floatingButton,
                {
                    position: 'absolute',
                    bottom: bottom,
                    right: right,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: isDark ? '#000000' : '#FFFFFF',
                    shadowColor: isDark ? '#000000' : '#b8c4d9',
                    elevation: 8,
                    shadowOffset: { width: 4, height: 4 },
                    shadowOpacity: 0.8,
                    shadowRadius: 10,
                }
            ]}
            activeOpacity={0.7}
        >
            <Icon
                name={iconName}
                size={iconSize}
                color={colors.primary}
                weight="bold"
            />
        </TouchableOpacity>
    );
}

// ==========================================
// 4. Neumorphic Loading Icon
// ==========================================
export interface NeumorphicLoadingIconProps {
    size?: number;
    iconSize?: number;
    style?: StyleProp<ViewStyle>;
}

export function NeumorphicLoadingIcon({
    size = 60,
    iconSize = 28,
    style
}: NeumorphicLoadingIconProps) {
    const { isDarkMode } = useTheme();
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const isDark = isDarkMode;

    useEffect(() => {
        const startRotation = () => {
            rotateAnim.setValue(0);
            Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        };

        startRotation();
    }, [rotateAnim]);

    const rotateInterpolate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View
            style={[
                styles.loadingContainer,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: isDark ? '#000000' : '#FFFFFF',
                    shadowColor: isDark ? '#000000' : '#b8c4d9',
                    shadowOffset: { width: 3, height: 3 },
                    shadowOpacity: 0.8,
                    shadowRadius: 5,
                    elevation: 4,
                },
                style
            ]}
        >
            <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                <Icon
                    name="CircleNotch"
                    size={iconSize}
                    color={isDark ? '#FFFFFF' : '#000000'}
                    weight="bold"
                />
            </Animated.View>
        </View>
    );
}

// ==========================================
// 5. Presets & Shorthands
// ==========================================

// Close Button (X)
export function NeumorphicCloseButton({
    onPress,
    size = 40,
    iconSize = 20,
    style
}: Omit<NeumorphicIconButtonProps, 'iconName'>) {
    return (
        <NeumorphicIconButton
            onPress={onPress}
            iconName="X"
            size={size}
            iconSize={iconSize}
            style={style}
        />
    );
}

// Search Button (Magnifying Glass)
export function NeumorphicSearchButton({
    onPress,
    size = 40,
    iconSize = 20,
    style
}: Omit<NeumorphicIconButtonProps, 'iconName'>) {
    return (
        <NeumorphicIconButton
            onPress={onPress}
            iconName="MagnifyingGlass"
            size={size}
            iconSize={iconSize}
            style={style}
        />
    );
}

// Toggle Left (ToggleLeft icon as used in settings screen)
export function NeumorphicToggleLeftButton({
    onPress,
    size = 40,
    iconSize = 20,
    style
}: Omit<NeumorphicIconButtonProps, 'iconName'>) {
    return (
        <NeumorphicIconButton
            onPress={onPress}
            iconName="ToggleLeft"
            size={size}
            iconSize={iconSize}
            style={style}
        />
    );
}

// Toggle Right (ToggleRight icon as used in settings screen)
export function NeumorphicToggleRightButton({
    onPress,
    size = 40,
    iconSize = 20,
    style
}: Omit<NeumorphicIconButtonProps, 'iconName'>) {
    return (
        <NeumorphicIconButton
            onPress={onPress}
            iconName="ToggleRight"
            size={size}
            iconSize={iconSize}
            style={style}
        />
    );
}

const styles = StyleSheet.create({
    button: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingButton: {
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
