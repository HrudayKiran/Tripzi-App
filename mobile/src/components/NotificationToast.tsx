import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useNotificationStore } from '../store/notificationStore';
import Icon from '../components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import { STATUS, BORDER_RADIUS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../styles';

export const NotificationToast = () => {
    const { currentToast, hideToast } = useNotificationStore();
    const { colors } = useTheme();

    useEffect(() => {
        if (currentToast) {
            const timer = setTimeout(() => {
                hideToast();
            }, 4000); // Hide after 4 seconds
            return () => clearTimeout(timer);
        }
    }, [currentToast]);

    return (
        <AnimatePresence>
            {currentToast && (
                <MotiView
                    from={{ opacity: 0, translateY: -100 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: -100 }}
                    transition={{ type: 'spring', damping: 15 }}
                    style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                    <View style={styles.iconContainer}>
                        <Icon name="Bell" size={24} color={STATUS.success} />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{currentToast.title}</Text>
                        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>{currentToast.message}</Text>
                    </View>
                    <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
                        <Icon name="X" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </MotiView>
            )}
        </AnimatePresence>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 9999,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: STATUS.success + '20', // 20% opacity
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: 2,
    },
    message: {
        fontSize: FONT_SIZE.sm,
    },
    closeButton: {
        padding: SPACING.xs,
    },
});
