/**
 * TripActionBar - Reusable action bar for trips/posts
 * Contains: Like, Comment, Share, Join buttons
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import NotificationService from '../utils/notificationService';

interface TripActionBarProps {
    tripId: string;
    tripTitle: string;
    tripOwnerId: string;
    tripLocation?: string;
    isLiked: boolean;
    likeCount: number;
    commentCount: number;
    hasJoined: boolean;
    spotsLeft: number;
    onLike: () => void;
    onCommentPress: () => void;
    onJoinToggle: () => void;
    showJoinButton?: boolean;
    compact?: boolean;
}

const TripActionBar: React.FC<TripActionBarProps> = memo(({
    tripId,
    tripTitle,
    tripOwnerId,
    tripLocation,
    isLiked,
    likeCount,
    commentCount,
    hasJoined,
    spotsLeft,
    onLike,
    onCommentPress,
    onJoinToggle,
    showJoinButton = true,
    compact = false,
}) => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const currentUser = auth().currentUser;
    const heartScale = React.useRef(new Animated.Value(1)).current;

    const handleLikePress = () => {
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 50 }),
            Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();
        onLike();
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `🚀 Check out this trip: ${tripTitle}!\n\n📍 ${tripLocation || 'Adventure awaits'}\n\nJoin on Tripzi! 🌍`,
            });
        } catch { }
    };

    const formatCount = (count: number): string => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    const isOwnTrip = currentUser?.uid === tripOwnerId;

    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            {/* Left Actions: Like, Comment, Share */}
            <View style={styles.leftActions}>
                {/* Like Button */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleLikePress}
                    activeOpacity={0.7}
                >
                    <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                        <Ionicons
                            name={isLiked ? 'heart' : 'heart-outline'}
                            size={compact ? 22 : 26}
                            color={isLiked ? '#EF4444' : colors.text}
                        />
                    </Animated.View>
                    {likeCount > 0 && (
                        <Text style={[styles.countText, { color: colors.textSecondary }]}>
                            {formatCount(likeCount)}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Comment Button */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onCommentPress}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="chatbubble-outline"
                        size={compact ? 20 : 24}
                        color={colors.text}
                    />
                    {commentCount > 0 && (
                        <Text style={[styles.countText, { color: colors.textSecondary }]}>
                            {formatCount(commentCount)}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Share Button */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleShare}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="paper-plane-outline"
                        size={compact ? 20 : 24}
                        color={colors.text}
                    />
                </TouchableOpacity>
            </View>

            {/* Right Actions: Join Button */}
            {showJoinButton && !isOwnTrip && (
                <TouchableOpacity
                    style={[
                        styles.joinButton,
                        {
                            backgroundColor: hasJoined ? 'transparent' : colors.primary,
                            borderColor: colors.primary,
                        },
                        spotsLeft <= 0 && !hasJoined && styles.joinButtonDisabled,
                    ]}
                    onPress={onJoinToggle}
                    disabled={spotsLeft <= 0 && !hasJoined}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={hasJoined ? 'checkmark-circle' : 'add-circle-outline'}
                        size={16}
                        color={hasJoined ? colors.primary : '#fff'}
                    />
                    <Text
                        style={[
                            styles.joinButtonText,
                            { color: hasJoined ? colors.primary : '#fff' },
                        ]}
                    >
                        {hasJoined ? 'Joined' : spotsLeft <= 0 ? 'Full' : 'Join'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
    },
    containerCompact: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
    },
    leftActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.lg,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    countText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 2,
        gap: SPACING.xs,
    },
    joinButtonDisabled: {
        opacity: 0.5,
    },
    joinButtonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default TripActionBar;
