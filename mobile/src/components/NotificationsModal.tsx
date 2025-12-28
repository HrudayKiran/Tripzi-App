import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Animated, PanResponder, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const { width } = Dimensions.get('window');

type NotificationsModalProps = {
    visible: boolean;
    onClose: () => void;
    onNotificationsChange?: (count: number) => void;
};

type Notification = {
    id: number;
    type: string;
    title: string;
    message: string;
    time: string;
    icon: string;
    color: string;
};

// Sample notifications data
const SAMPLE_NOTIFICATIONS: Notification[] = [
    { id: 1, type: 'trip', title: 'New trip to Ladakh!', message: 'Kiran posted a new adventure trip', time: '2 mins ago', icon: 'airplane', color: '#8B5CF6' },
    { id: 2, type: 'like', title: 'Someone liked your trip', message: 'Your Goa trip got 5 new likes', time: '15 mins ago', icon: 'heart', color: '#EC4899' },
    { id: 3, type: 'message', title: 'New message', message: 'Hey, interested in joining your trip!', time: '1 hour ago', icon: 'chatbubble', color: '#3B82F6' },
    { id: 4, type: 'join', title: 'Trip request', message: 'Someone wants to join your Kerala trip', time: '3 hours ago', icon: 'person-add', color: '#10B981' },
    { id: 5, type: 'reminder', title: 'Trip reminder', message: 'Your Manali trip starts in 3 days', time: '1 day ago', icon: 'calendar', color: '#F59E0B' },
];

// Swipeable Notification Item Component
const SwipeableNotification = ({ notification, onDelete, colors }: { notification: Notification; onDelete: (id: number) => void; colors: any }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const itemHeight = useRef(new Animated.Value(80)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => {
                return Math.abs(gesture.dx) > 10 && gesture.dx > 0;
            },
            onPanResponderMove: (_, gesture) => {
                if (gesture.dx > 0) {
                    translateX.setValue(gesture.dx);
                }
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dx > width * 0.4) {
                    // Swipe past threshold - delete
                    Animated.parallel([
                        Animated.timing(translateX, { toValue: width, duration: 200, useNativeDriver: false }),
                        Animated.timing(itemHeight, { toValue: 0, duration: 200, useNativeDriver: false }),
                        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }),
                    ]).start(() => onDelete(notification.id));
                } else {
                    // Snap back
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
                }
            },
        })
    ).current;

    return (
        <Animated.View style={{ height: itemHeight, opacity }}>
            {/* Delete background */}
            <View style={[styles.deleteBackground, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="trash" size={24} color="#fff" />
                <Text style={styles.deleteText}>Delete</Text>
            </View>

            {/* Notification content */}
            <Animated.View
                style={[{ transform: [{ translateX }] }]}
                {...panResponder.panHandlers}
            >
                <TouchableOpacity
                    style={[styles.notificationItem, { backgroundColor: colors.card }]}
                    activeOpacity={0.9}
                >
                    <View style={[styles.notificationIcon, { backgroundColor: `${notification.color}20` }]}>
                        <Ionicons name={notification.icon as any} size={20} color={notification.color} />
                    </View>
                    <View style={styles.notificationContent}>
                        <Text style={[styles.notificationTitle, { color: colors.text }]}>
                            {notification.title}
                        </Text>
                        <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                            {notification.message}
                        </Text>
                        <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>
                            {notification.time}
                        </Text>
                    </View>
                    <View style={[styles.unreadDot, { backgroundColor: notification.color }]} />
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
};

const NotificationsModal = ({ visible, onClose, onNotificationsChange }: NotificationsModalProps) => {
    const { colors } = useTheme();
    const slideAnim = useRef(new Animated.Value(width)).current;
    const [notifications, setNotifications] = useState<Notification[]>(SAMPLE_NOTIFICATIONS);

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
        onNotificationsChange?.(notifications.length);
    }, [notifications.length]);

    const clearAll = () => {
        setNotifications([]);
    };

    const deleteNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
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
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {notifications.length > 0 ? (
                            <>
                                {/* Swipe hint */}
                                <View style={styles.swipeHint}>
                                    <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
                                    <Text style={[styles.swipeHintText, { color: colors.textSecondary }]}>
                                        Swipe right to delete
                                    </Text>
                                </View>

                                {/* Clear All Button */}
                                <TouchableOpacity
                                    style={styles.clearAllButton}
                                    onPress={clearAll}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                                    <Text style={[styles.clearAllText, { color: colors.error }]}>Clear All</Text>
                                </TouchableOpacity>

                                {/* Notifications List */}
                                <FlatList
                                    data={notifications}
                                    keyExtractor={(item) => item.id.toString()}
                                    contentContainerStyle={styles.content}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item, index }) => (
                                        <Animatable.View animation="fadeInRight" delay={index * 50}>
                                            <SwipeableNotification
                                                notification={item}
                                                onDelete={deleteNotification}
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
    swipeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm, gap: SPACING.xs },
    swipeHintText: { fontSize: FONT_SIZE.xs },
    clearAllButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, gap: SPACING.xs },
    clearAllText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
    deleteBackground: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm, flexDirection: 'row', alignItems: 'center', paddingLeft: SPACING.xl, gap: SPACING.sm },
    deleteText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
    notificationItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
    notificationIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
    notificationContent: { flex: 1 },
    notificationTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.xs },
    notificationMessage: { fontSize: FONT_SIZE.sm, marginBottom: SPACING.xs },
    notificationTime: { fontSize: FONT_SIZE.xs },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xxxl },
    emptyIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
    emptyText: { fontSize: FONT_SIZE.sm, textAlign: 'center' },
});

export default NotificationsModal;
