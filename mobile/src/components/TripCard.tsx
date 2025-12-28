import React, { memo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share, Animated, Dimensions, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useTripLike from '../hooks/useTripLike';
import { useTheme } from '../contexts/ThemeContext';
import { auth } from '../firebase';
import firestore from '@react-native-firebase/firestore';
import CommentsModal from './CommentsModal';
import CustomToggle from './CustomToggle';
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
    const [hasJoined, setHasJoined] = useState(false);
    const [commentCount, setCommentCount] = useState(0);
    const heartScale = useRef(new Animated.Value(1)).current;
    const currentUser = auth.currentUser;

    // Initialize join state from props (no real-time listener to avoid re-render conflicts)
    useEffect(() => {
        if (currentUser && trip.participants) {
            setHasJoined(trip.participants.includes(currentUser.uid));
        } else {
            setHasJoined(false);
        }
    }, [trip.id, trip.participants, currentUser?.uid]);

    // Check if current user follows the trip creator
    useEffect(() => {
        if (!currentUser || !trip.userId || trip.userId === currentUser.uid) {
            setIsFollowing(false);
            return;
        }

        const unsubscribe = firestore()
            .collection('users')
            .doc(trip.userId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    const followers = userData?.followers || [];
                    setIsFollowing(followers.includes(currentUser.uid));
                }
            });

        return () => unsubscribe();
    }, [trip.userId, currentUser?.uid]);

    // Load comment count
    useEffect(() => {
        if (trip.id && trip.id !== 'fallback') {
            firestore()
                .collection('trips')
                .doc(trip.id)
                .collection('comments')
                .get()
                .then(snapshot => setCommentCount(snapshot.size))
                .catch(() => setCommentCount(0));
        }
    }, [trip.id]);

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

    // Format time ago
    const getTimeAgo = (timestamp: any) => {
        if (!timestamp) return 'Just now';

        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        } catch {
            return 'Recently';
        }
    };

    const handleLocationPress = () => {
        const location = trip.location || trip.toLocation;
        if (location) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
            Linking.openURL(url);
        }
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

        if (isJoining) return; // Prevent double-tap
        setIsJoining(true);

        // Safety timeout - reset isJoining after 5 seconds max
        const timeoutId = setTimeout(() => {
            console.log('⚠️ Toggle timeout - resetting');
            setIsJoining(false);
        }, 5000);

        try {
            if (hasJoined) {
                // Leave trip
                await firestore().collection('trips').doc(trip.id).update({
                    participants: firestore.FieldValue.arrayRemove(currentUser.uid),
                    currentTravelers: firestore.FieldValue.increment(-1),
                });
                setHasJoined(false);
                console.log('✅ Left trip');
            } else {
                // Check KYC first
                const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
                const userData = userDoc.data();
                console.log('📋 KYC Status:', userData?.kycStatus);

                // Only block if explicitly set to non-verified (allow if field doesn't exist)
                if (userData?.kycStatus && userData.kycStatus !== 'verified' && userData.kycStatus !== 'pending') {
                    Alert.alert(
                        'KYC Required',
                        'Complete KYC verification to join trips.',
                        [
                            { text: 'Later', style: 'cancel' },
                            { text: 'Verify Now', onPress: () => navigation.navigate('KYC' as never) },
                        ]
                    );
                    clearTimeout(timeoutId);
                    setIsJoining(false);
                    return;
                }

                const spotsLeft = (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1);
                if (spotsLeft <= 0) {
                    Alert.alert('Trip Full', 'Sorry, this trip is already full.');
                    clearTimeout(timeoutId);
                    setIsJoining(false);
                    return;
                }

                // Join trip
                await firestore().collection('trips').doc(trip.id).update({
                    participants: firestore.FieldValue.arrayUnion(currentUser.uid),
                    currentTravelers: firestore.FieldValue.increment(1),
                });

                // Add to group chat
                const chatId = `trip_${trip.id}`;
                const chatRef = firestore().collection('chats').doc(chatId);
                const chatDoc = await chatRef.get();

                if (chatDoc.exists) {
                    await chatRef.update({
                        participants: firestore.FieldValue.arrayUnion(currentUser.uid),
                    });
                }

                setHasJoined(true);
                console.log('✅ Joined trip');
            }
        } catch (error) {
            console.log('Toggle error:', error);
            // Don't change state on error - keep previous state
        } finally {
            clearTimeout(timeoutId);
            setIsJoining(false);
        }
    };

    // Check if trip is completed (past end date)
    const isCompleted = (() => {
        if (!trip.toDate) return false;
        const endDate = new Date(trip.toDate);
        return endDate < new Date();
    })();

    const transport = TRANSPORT_ICONS[trip.transportMode?.toLowerCase()] || TRANSPORT_ICONS.mixed;
    const spotsLeft = Math.max(0, (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1));

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
                                {getTimeAgo(trip.createdAt)}
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
                        <TouchableOpacity style={styles.locationBadge} onPress={handleLocationPress}>
                            <Ionicons name="location" size={14} color="#fff" />
                            <Text style={styles.locationText}>{trip.location || 'Adventure'}</Text>
                        </TouchableOpacity>
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
                            <View>
                                <Ionicons name="chatbubble-outline" size={26} color={colors.text} />
                                {commentCount > 0 && (
                                    <View style={styles.commentBadge}>
                                        <Text style={styles.commentBadgeText}>{commentCount > 99 ? '99+' : commentCount}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                            <Ionicons name="paper-plane-outline" size={26} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    {isCompleted ? (
                        <View style={styles.completedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            <Text style={styles.completedText}>Completed</Text>
                        </View>
                    ) : (
                        <CustomToggle
                            value={hasJoined}
                            onValueChange={handleJoinTrip}
                            disabled={isJoining}
                            onLabel="Joined"
                            offLabel="Join"
                            size="small"
                        />
                    )}
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
                    <View style={[styles.tag, {
                        backgroundColor: trip.genderPreference === 'male' ? '#DBEAFE' :
                            trip.genderPreference === 'female' ? '#FCE7F3' : '#D1FAE5'
                    }]}>
                        <Text style={[styles.tagText, {
                            color: trip.genderPreference === 'male' ? '#3B82F6' :
                                trip.genderPreference === 'female' ? '#EC4899' : '#10B981'
                        }]}>
                            {trip.genderPreference === 'male' ? '👨 Male only' :
                                trip.genderPreference === 'female' ? '👩 Female only' : '👥 Anyone'}
                        </Text>
                    </View>
                    {trip.tripTypes?.slice(0, 1).map((type: string, index: number) => (
                        <View key={index} style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                            <Text style={[styles.tagText, { color: '#F59E0B' }]}>🎯 {type.replace('_', ' ')}</Text>
                        </View>
                    ))}
                </View>
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
    card: { marginBottom: 1, overflow: 'hidden' },
    userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
    userInfo: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.md },
    userName: { fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
    postTime: { fontSize: FONT_SIZE.xs },
    followButton: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    followButtonText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    imageContainer: { position: 'relative', aspectRatio: 1 },
    tripImage: { width: '100%', height: '100%' },
    locationBadge: { position: 'absolute', bottom: SPACING.md, left: SPACING.md, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg },
    locationText: { color: '#fff', fontSize: FONT_SIZE.xs, marginLeft: SPACING.xs },
    typeBadge: { position: 'absolute', top: SPACING.md, right: SPACING.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.sm },
    typeText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    actionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    actionButton: { padding: SPACING.xs },
    commentBadge: { position: 'absolute', top: -5, right: -8, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    commentBadgeText: { color: '#fff', fontSize: 10, fontWeight: FONT_WEIGHT.bold },
    joinButton: { backgroundColor: '#8B5CF6', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
    joinButtonText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
    contentSection: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
    likesText: { fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm, marginBottom: SPACING.xs },
    tripTitle: { fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md, marginBottom: SPACING.xs },
    description: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-around', padding: SPACING.md, borderTopWidth: 1 },
    detailItem: { alignItems: 'center' },
    detailEmoji: { fontSize: 18, marginBottom: 2 },
    detailValue: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.xs },
    tag: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg },
    tagText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
    viewComments: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
    viewCommentsText: { fontSize: FONT_SIZE.sm },
    toggleContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    toggleLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
    completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg, gap: 4 },
    completedText: { color: '#10B981', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
});

export default TripCard;
