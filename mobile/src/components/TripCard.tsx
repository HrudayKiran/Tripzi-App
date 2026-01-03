import React, { memo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share, Animated, Dimensions, Alert, Linking, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useTripLike from '../hooks/useTripLike';
import { useTheme } from '../contexts/ThemeContext';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import CommentsModal from './CommentsModal';
import ShareModal from './ShareModal';
import CustomToggle from './CustomToggle';
import DefaultAvatar from './DefaultAvatar';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import { DEFAULT_TRIP_IMAGE, isValidImageUrl } from '../constants/defaults';
import { Video, ResizeMode } from 'expo-av';

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
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [userRating, setUserRating] = useState<{ avg: number; count: number } | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [showShare, setShowShare] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef<Video>(null);
    const heartScale = useRef(new Animated.Value(1)).current;
    const currentUser = auth().currentUser;

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

    // Load user rating
    useEffect(() => {
        if (!trip.userId) return;

        firestore()
            .collection('users')
            .doc(trip.userId)
            .get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data?.totalRating && data?.ratingCount) {
                        setUserRating({
                            avg: parseFloat((data.totalRating / data.ratingCount).toFixed(1)),
                            count: data.ratingCount
                        });
                    }
                }
            })
            .catch(() => { });
    }, [trip.userId]);

    // Real-time comment count listener
    useEffect(() => {
        if (!trip.id || trip.id === 'fallback') return;

        const unsubscribe = firestore()
            .collection('trips')
            .doc(trip.id)
            .collection('comments')
            .onSnapshot(snapshot => {
                setCommentCount(snapshot.size);
            }, () => setCommentCount(0));

        return () => unsubscribe();
    }, [trip.id]);

    const handleLikePress = () => {
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 50 }),
            Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();
        handleLike();
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

    const handleFollow = async () => {
        if (!currentUser || !trip.userId || trip.userId === currentUser.uid) return;

        // Optimistic update
        setIsFollowing(!isFollowing);

        try {
            const userRef = firestore().collection('users').doc(trip.userId);
            const currentUserRef = firestore().collection('users').doc(currentUser.uid);

            if (isFollowing) {
                // Unfollow
                await userRef.update({ followers: firestore.FieldValue.arrayRemove(currentUser.uid) });
                await currentUserRef.update({ following: firestore.FieldValue.arrayRemove(trip.userId) });
            } else {
                // Follow
                await userRef.update({ followers: firestore.FieldValue.arrayUnion(currentUser.uid) });
                await currentUserRef.update({ following: firestore.FieldValue.arrayUnion(trip.userId) });
            }
        } catch {
            // Revert on error
            setIsFollowing(isFollowing);
        }
    };

    const handleJoinTrip = async () => {
        if (!currentUser) {
            Alert.alert('Sign In Required', 'Please sign in to join trips.');
            return;
        }

        try {
            if (hasJoined) {
                // Leave trip - instant toggle
                await firestore().collection('trips').doc(trip.id).update({
                    participants: firestore.FieldValue.arrayRemove(currentUser.uid),
                    currentTravelers: firestore.FieldValue.increment(-1),
                });
                setHasJoined(false);
            } else {
                // Check spots first
                const spotsLeft = (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1);
                if (spotsLeft <= 0) {
                    Alert.alert('Trip Full', 'Sorry, this trip is already full.');
                    return;
                }
                // Join trip - instant toggle
                await firestore().collection('trips').doc(trip.id).update({
                    participants: firestore.FieldValue.arrayUnion(currentUser.uid),
                    currentTravelers: firestore.FieldValue.increment(1),
                });
                setHasJoined(true);
            }
        } catch {
            // Keep previous state on error
        }
    };

    const handleShare = () => {
        setShowShare(true);
    };

    // Check if trip is completed (marked by owner)
    const isCompleted = trip.isCompleted === true;

    const transport = TRANSPORT_ICONS[trip.transportMode?.toLowerCase()] || TRANSPORT_ICONS.mixed;
    const spotsLeft = Math.max(0, (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1));

    return (
        <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                {/* User Header */}
                <View style={styles.userHeader}>
                    <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
                        <DefaultAvatar
                            uri={trip.user?.photoURL || trip.user?.image}
                            size={40}
                            style={styles.avatar}
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
                    <View style={styles.headerRight}>
                        {userRating && (
                            <View style={styles.ratingBadge}>
                                <Ionicons name="star" size={12} color="#F59E0B" />
                                <Text style={styles.ratingText}>{userRating.avg}</Text>
                            </View>
                        )}
                        {trip.userId !== currentUser?.uid && (
                            <TouchableOpacity
                                style={[styles.followButton, {
                                    backgroundColor: isFollowing ? 'transparent' : colors.primary,
                                    borderColor: colors.primary,
                                }]}
                                onPress={handleFollow}
                            >
                                <Text style={[styles.followButtonText, { color: isFollowing ? colors.primary : '#fff' }]}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Trip Images Carousel */}
                <View style={styles.imageContainer}>
                    {(() => {
                        let hasVideo = !!trip.video;
                        // Construct media array: Video first, then images
                        const images = hasVideo
                            ? [trip.video, ...(trip.images || [])]
                            : (trip.images?.length > 0 ? trip.images : [trip.coverImage || trip.image || DEFAULT_TRIP_IMAGE]);

                        return (
                            <>
                                <ScrollView
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    scrollEventThrottle={16}
                                    decelerationRate="fast"
                                    nestedScrollEnabled={true}
                                    snapToInterval={width}
                                    snapToAlignment="start"
                                    disableIntervalMomentum={true}
                                    onMomentumScrollEnd={(e) => {
                                        const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                        setActiveImageIndex(index);
                                        // Auto-pause video if scrolled away
                                        if (hasVideo && index !== 0) {
                                            setIsPlaying(false);
                                        }
                                    }}
                                >
                                    {images.map((item, index) => {
                                        const isVideoItem = hasVideo && index === 0;

                                        if (isVideoItem) {
                                            return (
                                                <Pressable
                                                    key={`vid_${index}`}
                                                    style={styles.tripImage}
                                                    onPress={() => setIsPlaying(!isPlaying)}
                                                >
                                                    <Video
                                                        ref={videoRef}
                                                        style={styles.tripImage}
                                                        source={{ uri: item }}
                                                        useNativeControls={false}
                                                        resizeMode={ResizeMode.COVER}
                                                        isLooping
                                                        shouldPlay={isPlaying && activeImageIndex === index}
                                                        isMuted={isMuted}
                                                    />
                                                    {!isPlaying && (
                                                        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }]}>
                                                            <Ionicons name="play-circle" size={60} color="rgba(255, 255, 255, 0.8)" />
                                                        </View>
                                                    )}
                                                    <TouchableOpacity
                                                        style={styles.muteButton}
                                                        onPress={() => setIsMuted(!isMuted)}
                                                    >
                                                        <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={20} color="#fff" />
                                                    </TouchableOpacity>
                                                </Pressable>
                                            );
                                        }

                                        return (
                                            <Image
                                                key={`img_${index}`}
                                                style={styles.tripImage}
                                                source={{ uri: item }}
                                                resizeMode="cover"
                                            />
                                        );
                                    })}
                                </ScrollView>
                                {images.length > 1 && (
                                    <View style={styles.imageDotsContainer}>
                                        {images.map((_, index) => (
                                            <View
                                                key={index}
                                                style={[
                                                    styles.imageDot,
                                                    { backgroundColor: index === activeImageIndex ? '#fff' : 'rgba(255,255,255,0.5)' }
                                                ]}
                                            />
                                        ))}
                                    </View>
                                )}
                                {images.length > 1 && (
                                    <View style={styles.imageCountBadge}>
                                        <Text style={styles.imageCountText}>{activeImageIndex + 1}/{images.length}</Text>
                                    </View>
                                )}
                            </>
                        );
                    })()}
                    <TouchableOpacity style={styles.locationBadge} onPress={handleLocationPress}>
                        <Ionicons name="location" size={14} color="#fff" />
                        <Text style={styles.locationText}>{trip.location}</Text>
                    </TouchableOpacity>
                </View>

                {/* Action Bar - Instagram Style */}
                <View style={styles.actionBar}>
                    <View style={styles.leftActions}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleLikePress}>
                            <Animated.View style={[styles.actionItem, { transform: [{ scale: heartScale }] }]}>
                                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={26} color={isLiked ? '#EF4444' : colors.text} />
                                <Text style={[styles.actionCount, { color: colors.text }]}>{likeCount || 0}</Text>
                            </Animated.View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => setShowComments(true)}>
                            <View style={styles.actionItem}>
                                <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
                                <Text style={[styles.actionCount, { color: colors.text }]}>{commentCount || 0}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                            <View style={styles.actionItem}>
                                <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
                            </View>
                        </TouchableOpacity>
                        {/* Toggle moved here next to share */}
                        {isCompleted ? (
                            <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={styles.completedText}>Done</Text>
                            </View>
                        ) : (
                            <CustomToggle
                                value={hasJoined}
                                onValueChange={handleJoinTrip}
                                onLabel="Joined"
                                offLabel="Join"
                                size="small"
                            />
                        )}
                    </View>
                    {/* Three dots menu at end */}
                    <TouchableOpacity style={styles.moreButton} onPress={() => setShowMenu(true)}>
                        <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Likes & Title */}
                <View style={styles.contentSection}>
                    <Text style={[styles.tripTitle, { color: colors.text }]}>{trip.title}</Text>
                    {trip.description && (
                        <View>
                            <Text
                                style={[styles.description, { color: colors.textSecondary }]}
                                numberOfLines={showFullDescription ? undefined : 2}
                            >
                                {trip.description}
                            </Text>
                            {trip.description.length > 100 && (
                                <TouchableOpacity onPress={() => setShowFullDescription(!showFullDescription)}>
                                    <Text style={[styles.showMoreText, { color: colors.primary }]}>
                                        {showFullDescription ? 'Show less' : '... Show more'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
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
            </View >

            {/* Comments Modal */}
            < CommentsModal
                visible={showComments}
                onClose={() => setShowComments(false)}
                tripId={trip.id}
            />

            {/* Share Modal */}
            < ShareModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                tripId={trip.id}
                tripTitle={trip.title || 'Trip'}
                tripImage={trip.coverImage || trip.images?.[0]}
            />

            {/* Three Dots Menu - Small Popup Style */}
            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View style={[styles.menuPopup, { backgroundColor: colors.card }]}>
                        <TouchableOpacity
                            style={styles.menuOption}
                            onPress={() => {
                                setShowMenu(false);
                                onPress && onPress();
                            }}
                        >
                            <Ionicons name="eye-outline" size={20} color={colors.text} />
                            <Text style={[styles.menuOptionText, { color: colors.text }]}>View Details</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuOption}
                            onPress={() => {
                                setShowMenu(false);
                                // TODO: Implement save/bookmark functionality
                                Alert.alert('Saved', 'Trip saved to your bookmarks!');
                            }}
                        >
                            <Ionicons name="bookmark-outline" size={20} color={colors.text} />
                            <Text style={[styles.menuOptionText, { color: colors.text }]}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuOption}
                            onPress={() => setShowMenu(false)}
                        >
                            <Ionicons name="flag-outline" size={20} color="#EF4444" />
                            <Text style={[styles.menuOptionText, { color: '#EF4444' }]}>Report</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
});

const styles = StyleSheet.create({
    card: { marginBottom: 1, overflow: 'hidden' },
    userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
    userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.md },
    userName: { fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
    postTime: { fontSize: FONT_SIZE.xs },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg, gap: 2 },
    ratingText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: '#D97706' },
    followButton: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    followButtonText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    imageContainer: { position: 'relative', aspectRatio: 4 / 5 },
    tripImage: { width, aspectRatio: 4 / 5 },
    imageDotsContainer: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: SPACING.xs },
    imageDot: { width: 8, height: 8, borderRadius: 4 },
    imageCountBadge: { position: 'absolute', top: SPACING.md, left: SPACING.md, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.sm },
    imageCountText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
    muteButton: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20 },
    locationBadge: { position: 'absolute', bottom: SPACING.md, left: SPACING.md, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg },
    locationText: { color: '#fff', fontSize: FONT_SIZE.xs, marginLeft: SPACING.xs },
    typeBadge: { position: 'absolute', top: SPACING.md, right: SPACING.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.sm },
    typeText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    actionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
    actionButton: { padding: SPACING.xs },
    actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionCount: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
    moreButton: { padding: SPACING.xs },
    joinButton: { backgroundColor: '#8B5CF6', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
    joinButtonText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
    contentSection: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
    likesText: { fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm, marginBottom: SPACING.xs },
    tripTitle: { fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md, marginBottom: SPACING.xs },
    description: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
    showMoreText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginTop: 2 },
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
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: 80, paddingRight: SPACING.md },
    menuPopup: { minWidth: 160, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.xs, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 10 },
    menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, gap: SPACING.sm },
    menuOptionText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
});

export default TripCard;
