import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, TOUCH_TARGET, HEADER, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

type HeaderProps = {
    title: string;
    onBack?: () => void;
    showBack?: boolean;
    rightAction?: React.ReactNode;
    transparent?: boolean;
};

const Header = ({ title, onBack, showBack = true, rightAction, transparent = false }: HeaderProps) => {
    const { colors } = useTheme();

    return (
        <SafeAreaView
            edges={['top']}
            style={[
                styles.safeArea,
                { backgroundColor: transparent ? 'transparent' : colors.background }
            ]}
        >
            <View style={styles.container}>
                {/* Left - Back Button */}
                <View style={styles.leftContainer}>
                    {showBack && onBack && (
                        <TouchableOpacity
                            onPress={onBack}
                            style={styles.backButton}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={28} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Center - Title */}
                <View style={styles.centerContainer}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {title}
                    </Text>
                </View>

                {/* Right - Action */}
                <View style={styles.rightContainer}>
                    {rightAction}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        // SafeAreaView handles top inset
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: HEADER.height,
        paddingHorizontal: SPACING.lg,
    },
    leftContainer: {
        width: TOUCH_TARGET.min,
        alignItems: 'flex-start',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
    },
    rightContainer: {
        width: TOUCH_TARGET.min,
        alignItems: 'flex-end',
    },
    backButton: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: TOUCH_TARGET.min / 2,
    },
    title: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
    },
});

export default Header;
