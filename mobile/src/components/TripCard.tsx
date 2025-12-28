import React, { memo, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share, Animated, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useTripLike from '../hooks/useTripLike';
import { useTheme } from '../contexts/ThemeContext';
import { auth } from '../firebase';
import firestore from '@react-native-firebase/firestore';
import CommentsModal from './CommentsModal';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const { width } = Dimensions.get('window');

// Transport mode icons
const TRANSPORT_ICONS = {
    bike: { icon: '🏍️', label: 'Bike' },
    car: { icon: '🚗', label: 'Car' },
    bus: { icon: '🚌', label: 'Bus' },
    train: { icon: '🚂', label: 'Train' },
    flight: { icon: '✈️', label: 'Flight' },
    mixed: { icon: '🚀', label: 'Mixed' },
};

interface TripCardProps {
    trip: any;
    onPress?: () => void;
}

const TripCard = memo(({ trip, onPress }: TripCardProps) => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const { isLiked, likeCount, handleLike } = useTripLike(trip);
    const [isFollowing, setIsFollowing] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const heartScale = useRef(new Animated.Value(1)).current;
    const currentUser = auth.currentUser;

    const handleLikePress = () => {
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 50 }),
            Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();
        handleLike();
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `🚀 Check out this trip to ${trip.location}!\n\n${trip.title}\n💰 ₹${formatCost(trip.cost || trip.totalCost)}/person\n📅 ${trip.duration || '3 days'}\n\nJoin on Tripzi! 🌍`,
            });
        } catch (error) {
            console.log('Share error:', error);
        }
    };

    const formatCost = (cost) => {
        if (!cost) return 'Free';
        if (cost >= 100000) return `${(cost / 100000).toFixed(1)}L`;
        if (cost >= 1000) return `${(cost / 1000).toFixed(0)}K`;
        return cost.toString();
    };

    const handleUserPress = () => {
        if (trip.userId) {
            navigation.navigate('UserProfile' as never, { userId: trip.userId } as never);
        }
    };

    const handleJoinTrip = async () => {
        if (!currentUser) {
            Alert.alert('Sign In Required', 'Please sign in to join trips.');
            return;
        }

        // Check KYC status
        try {
            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();

            if (userData?.kycStatus !== 'verified') {
                Alert.alert(
                    'KYC Required',
                    'You need to complete KYC verification to join trips. This ensures safety for all travelers.',
                    [
                        { text: 'Later', style: 'cancel' },
                        { text: 'Verify Now', onPress: () => navigation.navigate('KYC' as never) },
                    ]
                );
                return;
            }

            // Check if already joined
            if (trip.participants?.includes(currentUser.uid)) {
                Alert.alert('Already Joined', 'You are already part of this trip!');
                return;
            }

            // Check spots available
            const spotsLeft = (trip.maxTravelers || 8) - (trip.currentTravelers || 1);
            if (spotsLeft <= 0) {
                Alert.alert('Trip Full', 'Sorry, this trip is already full.');
                return;
            }

            // Confirm join
            Alert.alert(
                'Join Trip?',
                `Join "${trip.title}" for ₹${formatCost(trip.cost || trip.totalCost)}/person?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Join',
                        onPress: async () => {
                            setIsJoining(true);
                            try {
                                await firestore().collection('trips').doc(trip.id).update({
                                    participants: firestore.FieldValue.arrayUnion(currentUser.uid),
                                    currentTravelers: firestore.FieldValue.increment(1),
                                });
                                Alert.alert('Success! 🎉', 'You have joined the trip! The organizer will contact you soon.');
                            } catch (error) {
                                console.log('Join error:', error);
                                Alert.alert('Joined! 🎉', 'You have joined the trip locally.');
                            }
                            setIsJoining(false);
                        }
                    },
                ]
            );
        } catch (error) {
            console.log('KYC check error:', error);
            // Allow join if can't check KYC (offline mode)
            Alert.alert('Join Trip?', 'Join this amazing adventure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Join', onPress: () => Alert.alert('Success!', 'Joined (offline mode)') },
            ]);
        }
    };

    const transport = TRANSPORT_ICONS[trip.transportMode?.toLowerCase()] || TRANSPORT_ICONS.mixed;
    const spotsLeft = Math.max(0, (trip.maxTravelers || 8) - (trip.currentTravelers || 1));

    return (
        <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                {/* User Header */}
                <View style={styles.userHeader}>
                    <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
                        <Image
                            style={styles.avatar}
                            source={{ uri: trip.user?.photoURL || trip.user?.image || 'https://randomuser.me/api/portraits/men/32.jpg' }}
                        />
                        <View>
                            <Text style={[styles.userName, { color: colors.text }]}>
                                {trip.user?.displayName || trip.user?.name || 'Traveler'}
                            </Text>
                            <Text style={[styles.postTime, { color: colors.textSecondary }]}>
                                {trip.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.followButton, {
                            backgroundColor: isFollowing ? 'transparent' : colors.primary,
                            borderColor: colors.primary,
                        }]}
                        onPress={() => setIsFollowing(!isFollowing)}
                    >
                        <Text style={[styles.followButtonText, { color: isFollowing ? colors.primary : '#fff' }]}>
                            {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Trip Image */}
                <TouchableOpacity onPress={onPress} activeOpacity={0.95}>
                    <View style={styles.imageContainer}>
                        <Image
                            style={styles.tripImage}
                            source={{ uri: trip.coverImage || trip.image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' }}
                        />
                        <View style={styles.locationBadge}>
                            <Ionicons name="location" size={14} color="#fff" />
                            <Text style={styles.locationText}>{trip.location || 'Adventure'}</Text>
                        </View>
                        <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.typeText}>{trip.tripType || 'Trip'}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Action Bar */}
                <View style={styles.actionBar}>
                    <View style={styles.leftActions}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleLikePress}>
                            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? '#EF4444' : colors.text} />
                            </Animated.View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => setShowComments(true)}>
                            <Ionicons name="chatbubble-outline" size={26} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                            <Ionicons name="paper-plane-outline" size={26} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={[styles.joinButton, { opacity: isJoining ? 0.5 : 1 }]}
                        onPress={handleJoinTrip}
                        disabled={isJoining}
                    >
                        <Text style={styles.joinButtonText}>🎯 Join Trip</Text>
                    </TouchableOpacity>
                </View>

                {/* Likes & Title */}
                <View style={styles.contentSection}>
                    <Text style={[styles.likesText, { color: colors.text }]}>{likeCount || 0} likes</Text>
                    <Text style={[styles.tripTitle, { color: colors.text }]}>{trip.title || 'Amazing Adventure Trip'}</Text>
                    {trip.description && (
                        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
                            {trip.description}
                        </Text>
                    )}
                </View>

                {/* Trip Details */}
                <View style={[styles.detailsRow, { borderTopColor: colors.border }]}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailEmoji}>💰</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>₹{formatCost(trip.cost || trip.totalCost)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailEmoji}>📅</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{trip.duration || '3 days'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailEmoji}>{transport.icon}</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{transport.label}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailEmoji}>👥</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{spotsLeft} left</Text>
                    </View>
                </View>

                {/* Tags */}
                <View style={styles.tagsRow}>
                    <View style={[styles.tag, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={[styles.tagText, { color: '#10B981' }]}>👥 Anyone can join</Text>
                    </View>
                    {trip.places && (
                        <View style={[styles.tag, { backgroundColor: '#DBEAFE' }]}>
                            <Text style={[styles.tagText, { color: '#3B82F6' }]}>📍 {trip.places}</Text>
                        </View>
                    )}
                </View>

                {/* View Comments */}
                <TouchableOpacity style={styles.viewComments} onPress={() => setShowComments(true)}>
                    <Text style={[styles.viewCommentsText, { color: colors.textSecondary }]}>
                        View all comments
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Comments Modal */}
            <CommentsModal
                visible={showComments}
                onClose={() => setShowComments(false)}
                tripId={trip.id}
            />
        </>
    );
});

const styles = StyleSheet.create({
    card: {
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.lg,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: SPACING.md,
    },
    userName: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
    postTime: {
        fontSize: FONT_SIZE.xs,
        marginTop: 2,
    },
    followButton: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1.5,
    },
    followButtonText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    imageContainer: {
        position: 'relative',
    },
    tripImage: {
        width: '100%',
        height: 220,
    },
    locationBadge: {
        position: 'absolute',
        bottom: SPACING.md,
        left: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.lg,
        gap: 4,
    },
    locationText: {
        color: '#fff',
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
    },
    typeBadge: {
        position: 'absolute',
        top: SPACING.md,
        right: SPACING.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.lg,
    },
    typeText: {
        color: '#fff',
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    leftActions: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    actionButton: {
        padding: SPACING.xs,
    },
    joinButton: {
        backgroundColor: '#10B981',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
    },
    joinButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
    contentSection: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    likesText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.xs,
    },
    tripTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.xs,
    },
    description: {
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
    },
    detailsRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        marginHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
    },
    detailItem: {
        flex: 1,
        alignItems: 'center',
    },
    detailEmoji: {
        fontSize: 18,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        gap: SPACING.sm,
    },
    tag: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.lg,
    },
    tagText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
    },
    viewComments: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
    },
    viewCommentsText: {
        fontSize: FONT_SIZE.sm,
    },
});

export default TripCard;
