import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Animated, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';
import { useNotifications, AppNotification, NotificationType } from '../hooks/useNotifications';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

type NotificationsModalProps = {
    visible: boolean;
    onClose: () => void;
    onNotificationsChange?: (count: number) => void;
};

// Map notification types to icons and colors
const getNotificationStyle = (type: NotificationType): { icon: string; color: string } => {
    switch (type) {
        case 'like':
            return { icon: 'heart', color: '#EC4899' };
        case 'comment':
            return { icon: 'chatbubble', color: '#3B82F6' };
        case 'message':
            return { icon: 'mail', color: '#8B5CF6' };
        case 'kyc_approved':
            return { icon: 'shield-checkmark', color: '#10B981' };
        case 'kyc_rejected':
            return { icon: 'alert-circle', color: '#EF4444' };
        case 'trip_join':
            return { icon: 'person-add', color: '#10B981' };
        case 'trip_full':
            return { icon: 'people', color: '#8B5CF6' };
        case 'action_required':
            return { icon: 'notifications', color: '#F59E0B' };
        default:
            return { icon: 'notifications', color: '#6B7280' };
    }
};

// Format relative time
const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

// Notification Item Component
const NotificationItem = ({
    notification,
    onPress,
    onDelete,
    colors
}: {
    notification: AppNotification;
    onPress: () => void;
    onDelete: () => void;
    colors: any;
}) => {
    const { icon, color } = getNotificationStyle(notification.type);

    return (
        <TouchableOpacity
            style={[
                styles.notificationItem,
                { backgroundColor: colors.card },
                !notification.read && { borderLeftWidth: 3, borderLeftColor: color }
            ]}
            onPress={onPress}
            onLongPress={onDelete}
            activeOpacity={0.7}
            delayLongPress={500}
        >
            <View style={[styles.notificationIcon, { backgroundColor: `${color}20` }]}>
                <Ionicons name={icon as any} size={20} color={color} />
            </View>
            <View style={styles.notificationContent}>
                <Text style={[styles.notificationTitle, { color: colors.text }]}>
                    {notification.title}
                </Text>
                <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                    {notification.message}
                </Text>
                <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>
                    {getTimeAgo(notification.createdAt)}
                </Text>
            </View>
            {!notification.read && (
                <View style={[styles.unreadDot, { backgroundColor: color }]} />
            )}
        </TouchableOpacity>
    );
};

const NotificationsModal = ({ visible, onClose, onNotificationsChange }: NotificationsModalProps) => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const slideAnim = useRef(new Animated.Value(width)).current;

    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotifications();

    useEffect(() => {
        if (visible) {
            slideAnim.setValue(width);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                speed: 14,
                bounciness: 0,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: width,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    // Report notification count changes
    useEffect(() => {
        onNotificationsChange?.(unreadCount);
    }, [unreadCount]);

    const handleNotificationPress = async (notification: AppNotification) => {
        // Mark as read
        if (!notification.read) {
            await markAsRead(notification.id);
        }

        // Navigate to deep link route
        if (notification.deepLinkRoute) {
            onClose();
            setTimeout(() => {
                navigation.navigate(notification.deepLinkRoute as never, notification.deepLinkParams as never);
            }, 300);
        }
    };

    const handleDeleteNotification = (notificationId: string) => {
        deleteNotification(notificationId);
    };

    return (
        <Modal visible={visible} transparent={true} onRequestClose={onClose} animationType="none">
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <Animated.View
                    style={[
                        styles.modalContainer,
                        { backgroundColor: colors.background },
                        { transform: [{ translateX: slideAnim }] }
                    ]}
                >
                    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                        {/* Header */}
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <View style={styles.headerLeft}>
                                <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
                                    <Ionicons name="notifications" size={20} color={colors.primary} />
                                </View>
                                <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
                                {unreadCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{unreadCount}</Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                            </View>
                        ) : notifications.length > 0 ? (
                            <>
                                {/* Action buttons */}
                                <View style={styles.actionRow}>
                                    <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                                        Long press to delete
                                    </Text>
                                    {unreadCount > 0 && (
                                        <TouchableOpacity
                                            style={styles.markAllButton}
                                            onPress={markAllAsRead}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                                            <Text style={[styles.markAllText, { color: colors.primary }]}>
                                                Mark all read
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Notifications List */}
                                <FlatList
                                    data={notifications}
                                    keyExtractor={(item) => item.id}
                                    contentContainerStyle={styles.content}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item, index }) => (
                                        <Animatable.View animation="fadeInRight" delay={index * 30}>
                                            <NotificationItem
                                                notification={item}
                                                onPress={() => handleNotificationPress(item)}
                                                onDelete={() => handleDeleteNotification(item.id)}
                                                colors={colors}
                                            />
                                        </Animatable.View>
                                    )}
                                />
                            </>
                        ) : (
                            /* Empty State */
                            <View style={styles.emptyState}>
                                <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                                    <Ionicons name="notifications-off-outline" size={48} color={colors.primary} />
                                </View>
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>All caught up!</Text>
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    You have no new notifications
                                </Text>
                            </View>
                        )}
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    backdrop: { flex: 1 },
    modalContainer: { width: width, height: '100%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderBottomWidth: 1 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    headerIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    closeButton: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: 'center', alignItems: 'center' },
    badge: { backgroundColor: '#EF4444', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center' },
    badgeText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
    hintText: { fontSize: FONT_SIZE.xs },
    markAllButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    markAllText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
    notificationItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
    notificationIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
    notificationContent: { flex: 1 },
    notificationTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.xs },
    notificationMessage: { fontSize: FONT_SIZE.sm, marginBottom: SPACING.xs, lineHeight: 18 },
    notificationTime: { fontSize: FONT_SIZE.xs },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xxxl },
    emptyIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
    emptyText: { fontSize: FONT_SIZE.sm, textAlign: 'center' },
});

export default NotificationsModal;
