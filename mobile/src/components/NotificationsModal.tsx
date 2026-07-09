import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Animated, ScrollView } from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { NeumorphicCloseButton } from './NeumorphicIconButtons';
import { MotiView } from 'moti';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useNotificationStore, Notification } from '../store/notificationStore';

const { width } = Dimensions.get('window');

// Bypasses the FlashList TypeScript configuration constraints in this workspace environment
const TypedFlashList = FlashList as any;

export type NotificationType =
    | 'message'
    | 'join_trip'
    | 'join_success'
    | 'trip_join'
    | 'leave_trip'
    | 'rating'
    | 'trip_update'
    | 'trip_cancelled'
    | 'trip_full'
    | 'report_submitted'
    | 'trip_report'
    | 'system'
    | 'action_required';

type NotificationsModalProps = {
    visible: boolean;
    onClose: () => void;
};

// Map notification types to icons and colors
const getNotificationStyle = (type: NotificationType | string): { icon: string; color: string } => {
    switch (type) {
        case 'message':
            return { icon: 'Envelope', color: '#9d74f7' };
        case 'join_trip':
        case 'join_success':
        case 'trip_join':
            return { icon: 'UserPlus', color: '#10B981' };
        case 'leave_trip':
            return { icon: 'UserMinus', color: '#EF4444' };
        case 'rating':
            return { icon: 'Star', color: '#F59E0B' };
        case 'trip_update':
            return { icon: 'NotePencil', color: '#3B82F6' };
        case 'trip_cancelled':
            return { icon: 'XCircle', color: '#EF4444' };
        case 'trip_full':
            return { icon: 'Users', color: '#9d74f7' };
        case 'report_submitted':
        case 'trip_report':
            return { icon: 'Flag', color: '#F97316' };
        case 'system':
            return { icon: 'Megaphone', color: '#0EA5E9' };
        case 'action_required':
            return { icon: 'Bell', color: '#F59E0B' };
        default:
            return { icon: 'Bell', color: '#6B7280' };
    }
};

// Format relative time
const getTimeAgo = (dateString: string): string => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

// Premium Skeleton Loader Item Component
const NotificationSkeletonItem = ({ colors, isDarkMode }: { colors: any; isDarkMode: boolean }) => {
    const skeletonBg = isDarkMode ? '#1E293B' : '#E5E7EB';
    
    return (
        <MotiView
            from={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{
                type: 'timing',
                duration: 900,
                loop: true,
            }}
            style={[styles.notificationItem, { backgroundColor: colors.card }]}
        >
            {/* Left side circular avatar/icon skeleton */}
            <View style={[styles.notificationIcon, { backgroundColor: skeletonBg }]} />
            
            {/* Right side text skeleton stacks */}
            <View style={styles.notificationContent}>
                {/* Title */}
                <View style={[styles.skeletonLine, { backgroundColor: skeletonBg, width: '45%', height: 14, marginBottom: 10 }]} />
                {/* Body line 1 */}
                <View style={[styles.skeletonLine, { backgroundColor: skeletonBg, width: '90%', height: 11, marginBottom: 6 }]} />
                {/* Body line 2 */}
                <View style={[styles.skeletonLine, { backgroundColor: skeletonBg, width: '60%', height: 11, marginBottom: 10 }]} />
                {/* Time */}
                <View style={[styles.skeletonLine, { backgroundColor: skeletonBg, width: '20%', height: 9 }]} />
            </View>
        </MotiView>
    );
};

// Notification Item Component with Swipe-to-Delete
const NotificationItem = ({
    notification,
    onPress,
    onDelete,
    colors
}: {
    notification: Notification;
    onPress: () => void;
    onDelete: () => void;
    colors: any;
}) => {
    const { icon, color } = getNotificationStyle(notification.type || 'system');
    const swipeableRef = useRef<Swipeable>(null);

    const renderRightActions = () => (
        <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => {
                swipeableRef.current?.close();
                onDelete();
            }}
        >
            <Icon name="Trash" size={24} color="#fff" />
            <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
    );

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            rightThreshold={40}
            overshootRight={false}
        >
            <TouchableOpacity
                style={[
                    styles.notificationItem,
                    { backgroundColor: colors.card },
                    !notification.is_read && { borderLeftWidth: 3, borderLeftColor: color }
                ]}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <View style={[styles.notificationIcon, { backgroundColor: `${color}20` }]}>
                    <Icon name={icon as any} size={20} color={color} />
                </View>
                <View style={styles.notificationContent}>
                    <Text style={[styles.notificationTitle, { color: colors.text }]}>
                        {notification.title}
                    </Text>
                    <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                        {notification.message}
                    </Text>
                    <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>
                        {getTimeAgo(notification.created_at)}
                    </Text>
                </View>
                {!notification.is_read && (
                    <View style={[styles.unreadDot, { backgroundColor: color }]} />
                )}
            </TouchableOpacity>
        </Swipeable>
    );
};

const NotificationsModal = ({ visible, onClose }: NotificationsModalProps) => {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(width)).current;

    // Cache the current user ID after first resolution — avoids repeated network calls
    const userIdRef = useRef<string | null>(null);

    const {
        notifications,
        unreadCount,
        setNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        setLoading,
        isLoading,
    } = useNotificationStore();

    /**
     * Resolves the current user ID using getSession() (cached — no network round trip).
     * Falls back to getUser() only if session is missing.
     */
    const resolveUserId = useCallback(async (): Promise<string | null> => {
        if (userIdRef.current) return userIdRef.current;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            userIdRef.current = session.user.id;
            return session.user.id;
        }
        // Fallback: verify with server in case session is stale
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
            userIdRef.current = user.id;
            return user.id;
        }
        return null;
    }, []);

    // Fetch notifications from Supabase when modal opens
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const userId = await resolveUserId();
            if (!userId) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('[Notifications] Fetch error:', error.message);
                return;
            }

            if (data) {
                setNotifications(data.map(n => ({
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    is_read: n.is_read,
                    created_at: n.created_at,
                    type: n.type,
                    deep_link_route: n.deep_link_route,
                    deep_link_params: n.deep_link_params,
                    actor_name: n.actor_name,
                })));
            }
        } catch (e) {
            console.error('[Notifications] Unexpected fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [setNotifications, setLoading, resolveUserId]);

    // Fetch + realtime subscription — fixed race condition with isMounted guard
    useEffect(() => {
        if (!visible) return;

        let isMounted = true;
        let channel: ReturnType<typeof supabase.channel> | null = null;

        const setupAndSubscribe = async () => {
            await fetchNotifications();
            if (!isMounted) return;

            const userId = await resolveUserId();
            if (!userId || !isMounted) return;

            channel = supabase
                .channel(`notifications-${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `recipient_id=eq.${userId}`,
                    },
                    (payload: any) => {
                        if (!isMounted) return;
                        if (payload.new) {
                            const n = payload.new;
                            useNotificationStore.getState().addNotification({
                                id: n.id,
                                title: n.title,
                                message: n.message,
                                is_read: n.is_read,
                                created_at: n.created_at,
                                type: n.type,
                                deep_link_route: n.deep_link_route,
                                deep_link_params: n.deep_link_params,
                                actor_name: n.actor_name,
                            });
                        }
                    }
                )
                .subscribe();
        };

        setupAndSubscribe();

        return () => {
            isMounted = false;
            if (channel) supabase.removeChannel(channel);
        };
    }, [visible, fetchNotifications, resolveUserId]);

    // Slide animation
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

    const handleNotificationPress = async (notification: Notification) => {
        if (!notification.is_read) {
            const userId = await resolveUserId();
            if (!userId) return;

            // Optimistic local update
            markAsRead(notification.id);

            // Sync to Supabase — explicit ownership guard as defence-in-depth (RLS also enforces this)
            supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notification.id)
                .eq('recipient_id', userId)
                .then();
        }

        if (notification.deep_link_route) {
            onClose();
            setTimeout(() => {
                router.push({
                    pathname: notification.deep_link_route as any,
                    params: notification.deep_link_params as any,
                });
            }, 300);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        const userId = await resolveUserId();
        if (!userId) return;

        // Optimistic local removal
        deleteNotification(notificationId);

        // Sync to Supabase — explicit ownership guard as defence-in-depth (RLS also enforces this)
        supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId)
            .eq('recipient_id', userId)
            .then();
    };

    const handleMarkAllAsRead = async () => {
        const userId = await resolveUserId();
        if (!userId) return;

        // Optimistic local update
        markAllAsRead();

        // Sync to Supabase
        supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('recipient_id', userId)
            .eq('is_read', false)
            .then();
    };

    return (
        <Modal visible={visible} transparent={true} onRequestClose={onClose} animationType="none">
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                    <Animated.View
                        style={[
                            styles.modalContainer,
                            { backgroundColor: colors.background },
                            { transform: [{ translateX: slideAnim }] }
                        ]}
                    >
                        <View style={{ flex: 1, paddingTop: insets.top }}>
                            {/* Header */}
                            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                                <View style={styles.headerLeft}>
                                    <View style={[styles.headerIcon, { backgroundColor: isDarkMode ? '#222222' : '#F3F4F6' }]}>
                                        <Icon name="Bell" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                                    </View>
                                    <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
                                    {unreadCount > 0 && (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>{unreadCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <NeumorphicCloseButton
                                    onPress={onClose}
                                    size={42}
                                    iconSize={22}
                                />
                            </View>

                            {/* Loading / Content Render Decision */}
                            {isLoading ? (
                                <ScrollView 
                                    style={styles.loadingScroll}
                                    contentContainerStyle={styles.content}
                                    showsVerticalScrollIndicator={false}
                                >
                                    <View style={styles.skeletonActionRow}>
                                        <View style={[styles.skeletonLine, { backgroundColor: isDarkMode ? '#1E293B' : '#E5E7EB', width: '30%', height: 10 }]} />
                                    </View>
                                    <NotificationSkeletonItem colors={colors} isDarkMode={isDarkMode} />
                                    <NotificationSkeletonItem colors={colors} isDarkMode={isDarkMode} />
                                    <NotificationSkeletonItem colors={colors} isDarkMode={isDarkMode} />
                                    <NotificationSkeletonItem colors={colors} isDarkMode={isDarkMode} />
                                    <NotificationSkeletonItem colors={colors} isDarkMode={isDarkMode} />
                                </ScrollView>
                            ) : notifications.length > 0 ? (
                                <>
                                    {/* Action buttons */}
                                    <View style={styles.actionRow}>
                                        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                                            Swipe left to delete
                                        </Text>
                                        {unreadCount > 0 && (
                                            <TouchableOpacity
                                                style={styles.markAllButton}
                                                onPress={handleMarkAllAsRead}
                                                activeOpacity={0.7}
                                            >
                                                <Icon name="Checks" size={16} color={colors.primary} />
                                                <Text style={[styles.markAllText, { color: colors.primary }]}>
                                                    Mark all read
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Notifications List */}
                                    <TypedFlashList
                                        data={notifications}
                                        keyExtractor={(item: any) => item.id}
                                        contentContainerStyle={styles.content}
                                        showsVerticalScrollIndicator={false}
                                        renderItem={({ item, index }: any) => (
                                            <MotiView
                                                from={{ opacity: 0, translateX: 20 }}
                                                animate={{ opacity: 1, translateX: 0 }}
                                                transition={{ type: 'timing', duration: 300, delay: index * 30 }}
                                            >
                                                <NotificationItem
                                                    notification={item}
                                                    onPress={() => handleNotificationPress(item)}
                                                    onDelete={() => handleDeleteNotification(item.id)}
                                                    colors={colors}
                                                />
                                            </MotiView>
                                        )}
                                        estimatedItemSize={80}
                                    />
                                </>
                            ) : (
                                /* Empty State */
                                <View style={styles.emptyState}>
                                    <View style={[
                                        styles.emptyIcon,
                                        {
                                            backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
                                            shadowColor: isDarkMode ? '#000000' : '#b8c4d9',
                                            shadowOffset: { width: 3, height: 3 },
                                            shadowOpacity: 0.8,
                                            shadowRadius: 5,
                                            elevation: 4,
                                        }
                                    ]}>
                                        <Icon name="BellSlash" size={48} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                                    </View>
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>All caught up!</Text>
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        You have no new notifications
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Animated.View>
                </View>
            </GestureHandlerRootView>
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
    badge: { backgroundColor: '#EF4444', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center' },
    badgeText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    loadingScroll: { flex: 1 },
    skeletonActionRow: { paddingVertical: SPACING.md, marginBottom: SPACING.xs },
    skeletonLine: { borderRadius: BORDER_RADIUS.sm },
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
    deleteAction: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 80, marginBottom: SPACING.sm, borderRadius: BORDER_RADIUS.md },
    deleteText: { color: '#fff', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
});

export default NotificationsModal;
