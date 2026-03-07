import React, { memo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Alert, Linking, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import DefaultAvatar from './DefaultAvatar';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, STATUS, NEUTRAL } from '../styles';
import { DEFAULT_TRIP_IMAGE, isValidImageUrl } from '../constants/defaults';
import NotificationService from '../utils/notificationService';

const { width } = Dimensions.get('window');

// Transport mode icons
const TRANSPORT_ICONS = {
    bike: { icon: '🏍️', label: 'Bike' },
    car: { icon: '🚗', label: 'Car' },
    bus: { icon: '🚌', label: 'Bus' },
    train: { icon: '🚂', label: 'Train' },
    flight: { icon: '✈️', label: 'Flight' },
    mixed: { icon: '🚀', label: 'Mixed Travel' },
};

interface TripCardProps {
    trip: any;
    onPress?: () => void;
    isVisible?: boolean;
    onReportPress: (trip: any) => void;
    showOptions?: boolean;
    mode?: 'chat' | 'join';
    hideProfileInfo?: boolean;
}

const TripCard = memo(({ trip, onPress, isVisible = false, onReportPress, showOptions = true, mode = 'chat', hideProfileInfo = false }: TripCardProps) => {

    const { colors } = useTheme();
    const navigation = useNavigation();
    const [isJoining, setIsJoining] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [userRating, setUserRating] = useState<{ avg: number; count: number } | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null);
    const moreButtonRef = useRef<View>(null);
    const [mediaAspectRatio, setMediaAspectRatio] = useState(4 / 5);
    const currentUser = auth().currentUser;

    // Detect aspect ratio of first media item
    useEffect(() => {
        const firstMedia = trip.images?.[0] || trip.coverImage || trip.image;
        if (!firstMedia) return;

        if (isValidImageUrl(firstMedia)) {
            Image.getSize(firstMedia, (w, h) => {
                if (w && h) {
                    setMediaAspectRatio(w / h);
                }
            }, (err) => {
                // Fallback or ignore
            });
        }
    }, [trip.video, trip.videoUrl, trip.images, trip.coverImage, trip.image]);

    // Initialize join state from props
    useEffect(() => {
        if (currentUser && trip.participants) {
            setHasJoined(trip.participants.includes(currentUser.uid));
        } else {
            setHasJoined(false);
        }
    }, [trip.id, trip.participants, currentUser?.uid]);

    // Load user rating
    useEffect(() => {
        if (!trip.userId) return;

        firestore()
            .collection('public_users')
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

        try {
            const userName = currentUser.displayName || 'A traveler';
            const tripTitle = trip.title || 'a trip';

            if (hasJoined) {
                // Leave trip
                await firestore().collection('trips').doc(trip.id).update({
                    participants: firestore.FieldValue.arrayRemove(currentUser.uid),
                    currentTravelers: firestore.FieldValue.increment(-1),
                });
                setHasJoined(false);

                // Also remove user from associated group chat
                try {
                    const groupChats = await firestore()
                        .collection('group_chats')
                        .where('tripId', '==', trip.id)
                        .where('participants', 'array-contains', currentUser.uid)
                        .get();
                    for (const chatDoc of groupChats.docs) {
                        await chatDoc.ref.update({
                            participants: firestore.FieldValue.arrayRemove(currentUser.uid),
                            [`participantDetails.${currentUser.uid}`]: firestore.FieldValue.delete(),
                        });
                    }
                } catch { /* silently handle */ }

                if (trip.userId && trip.userId !== currentUser.uid) {
                    await NotificationService.onLeaveTrip(currentUser.uid, userName, trip.id, trip.userId, tripTitle);
                }
            } else {
                // Check spots first
                const spotsLeft = (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1);
                if (spotsLeft <= 0) {
                    Alert.alert('Trip Full', 'Sorry, this trip is already full.');
                    return;
                }

                // Gender check — read from 'users' where gender is stored
                const tripGender = (trip.genderPreference || '').trim().toLowerCase();
                if (tripGender && tripGender !== 'anyone') {
                    try {
                        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
                        const userData = userDoc.data();
                        const userGender = (userData?.gender || '').trim().toLowerCase();

                        if (!userGender) {
                            Alert.alert(
                                'Gender Not Set',
                                'Your gender is required to join gender-restricted trips. Please update your profile.'
                            );
                            return;
                        }

                        if (userGender !== tripGender) {
                            const genderLabel = tripGender === 'male' ? 'Male' : 'Female';
                            Alert.alert(
                                'Gender Restriction',
                                `This trip is for ${genderLabel} travelers only. Try joining other trips that match your gender or are open to Anyone! 🌍`
                            );
                            return;
                        }
                    } catch (e) {
                        Alert.alert('Error', 'Could not verify your gender. Please try again.');
                        return;
                    }
                }

                // Join trip
                await firestore().collection('trips').doc(trip.id).update({
                    participants: firestore.FieldValue.arrayUnion(currentUser.uid),
                    currentTravelers: firestore.FieldValue.increment(1),
                });
                setHasJoined(true);

                if (trip.userId && trip.userId !== currentUser.uid) {
                    await NotificationService.onJoinTrip(currentUser.uid, userName, trip.id, trip.userId, tripTitle);
                }
            }
        } catch (error: any) {
            console.warn('Join trip error:', error?.message || error);
            Alert.alert('Error', 'Could not join/leave this trip. Please try again.');
        }
    };

    const handleChatWithUser = async () => {
        if (!currentUser) {
            Alert.alert('Sign In Required', 'Please sign in to chat.');
            return;
        }
        if (!trip.userId) {
            Alert.alert('Error', 'Cannot chat with this user.');
            return;
        }
        try {
            const chatQuery = await firestore()
                .collection('chats')
                .where('type', '==', 'direct')
                .where('participants', 'array-contains', currentUser.uid)
                .get();

            let chatId = null;
            for (const doc of chatQuery.docs) {
                const data = doc.data();
                if (data.participants && data.participants.includes(trip.userId)) {
                    chatId = doc.id;
                    break;
                }
            }

            if (!chatId) {
                const newChatRef = await firestore().collection('chats').add({
                    type: 'direct',
                    createdBy: currentUser.uid,
                    participants: [currentUser.uid, trip.userId],
                    participantDetails: {
                        [currentUser.uid]: {
                            displayName: currentUser.displayName || 'User',
                            photoURL: currentUser.photoURL || '',
                        },
                        [trip.userId]: {
                            displayName: trip.user?.displayName || trip.user?.name || 'User',
                            photoURL: trip.user?.photoURL || '',
                        },
                    },
                    unreadCount: {
                        [currentUser.uid]: 0,
                        [trip.userId]: 0,
                    },
                    mutedBy: [],
                    pinnedBy: [],
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
                chatId = newChatRef.id;
            }

            navigation.navigate('Chat' as never, {
                chatId,
                otherUserId: trip.userId,
                otherUserName: trip.user?.displayName || trip.user?.name || 'User',
                otherUserPhoto: trip.user?.photoURL || '',
            } as never);
        } catch (error: any) {
            console.warn('TripCard chat error:', error?.message || error);
            Alert.alert('Error', 'Could not start chat. Please try again.');
        }
    };

    // Check if trip is completed (marked by owner)
    const isCompleted = trip.isCompleted === true;
    const isOwnTrip = trip.userId === currentUser?.uid || trip.user?.uid === currentUser?.uid;

    const transport = TRANSPORT_ICONS[trip.transportMode?.toLowerCase()] || TRANSPORT_ICONS.mixed;
    const spotsLeft = Math.max(0, (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1));

    return (
        <>
            <View style={[styles.card, { backgroundColor: colors.card }, hideProfileInfo && styles.profileCardElevated]}>
                {/* User Header — avatar, name, join, view details, 3-dots */}
                {!hideProfileInfo && (
                    <View style={styles.userHeader}>
                        <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
                            <DefaultAvatar
                                uri={trip.user?.photoURL || trip.user?.image}
                                name={trip.user?.displayName || trip.user?.name || 'Traveler'}
                                size={38}
                                style={styles.avatar}
                            />
                            <View style={styles.userInfoText}>
                                <View style={styles.nameRow}>
                                    <Text style={[styles.userName, { color: colors.text }]}>
                                        {trip.user?.displayName || trip.user?.name || 'Traveler'}
                                    </Text>
                                    {userRating && (
                                        <View style={styles.ratingBadge}>
                                            <Ionicons name="star" size={10} color="#F59E0B" />
                                            <Text style={styles.ratingText}>{userRating.avg}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.postTime, { color: colors.textSecondary }]}>
                                    {getTimeAgo(trip.createdAt)}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Actions in header */}
                        <View style={styles.headerActions}>
                            {/* Chat Button (home feed mode) */}
                            {mode === 'chat' && !isOwnTrip && !isCompleted && (
                                <TouchableOpacity
                                    style={[
                                        styles.joinButton,
                                        {
                                            backgroundColor: colors.primary,
                                            borderColor: colors.primary,
                                        },
                                    ]}
                                    onPress={handleChatWithUser}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.joinButtonText, { color: '#fff' }]}>
                                        Chat
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Join Button (profile mode) */}
                            {mode === 'join' && !isOwnTrip && !isCompleted && (
                                <TouchableOpacity
                                    style={[
                                        styles.joinButton,
                                        {
                                            backgroundColor: hasJoined ? 'transparent' : colors.primary,
                                            borderColor: colors.primary,
                                        },
                                    ]}
                                    onPress={handleJoinTrip}
                                    disabled={spotsLeft <= 0 && !hasJoined}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.joinButtonText, { color: hasJoined ? colors.primary : '#fff' }]}>
                                        {hasJoined ? 'Joined' : spotsLeft <= 0 ? 'Full' : 'Join'}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {isCompleted && (
                                <View style={styles.completedBadge}>
                                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                    <Text style={styles.completedText}>Done</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Trip Images Carousel */}
                <View>
                    <View style={[styles.imageContainer, { aspectRatio: mediaAspectRatio }]}>
                        {(() => {
                            const images = trip.images?.length > 0 ? trip.images : [trip.coverImage || trip.image || DEFAULT_TRIP_IMAGE];

                            return (
                                <>
                                    <ScrollView
                                        horizontal
                                        pagingEnabled
                                        showsHorizontalScrollIndicator={false}
                                        scrollEventThrottle={16}
                                        decelerationRate="fast"
                                        nestedScrollEnabled={true}
                                        style={StyleSheet.absoluteFill}
                                        contentContainerStyle={{ width: width * images.length }}
                                        onMomentumScrollEnd={(e) => {
                                            const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                            setActiveImageIndex(index);
                                        }}
                                    >
                                        {images.map((item, index) => (
                                            <View key={`img_container_${index}`} style={{ position: 'relative' }}>
                                                <Image
                                                    key={`img_${index}`}
                                                    style={[styles.tripImage, { aspectRatio: mediaAspectRatio }]}
                                                    source={{ uri: item }}
                                                    resizeMode="contain"
                                                />
                                                {(trip.imageLocations?.[index] || trip?.toLocation || trip?.location) ? (
                                                    <View style={styles.imageOverlay}>
                                                        <View style={styles.overlayLocationRow}>
                                                            <Ionicons name="location" size={12} color="#fff" />
                                                            <Text style={styles.overlayLocation} numberOfLines={1}>
                                                                {trip.imageLocations?.[index] || trip?.toLocation || trip?.location}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                ) : null}
                                            </View>
                                        ))}
                                    </ScrollView>

                                    {images.length > 1 && (
                                        <View style={styles.imageCountBadge}>
                                            <Text style={styles.imageCountText}>{activeImageIndex + 1}/{images.length}</Text>
                                        </View>
                                    )}
                                </>
                            );
                        })()}
                    </View>

                    {/* Media Footer: Dots Only */}
                    <View style={styles.mediaFooter}>
                        {(() => {
                            const images = trip.images?.length > 0 ? trip.images : [trip.coverImage || trip.image || DEFAULT_TRIP_IMAGE];

                            if (images.length <= 1) return <View style={{ height: 6 }} />;

                            return (
                                <View style={styles.imageDotsContainer}>
                                    {images.map((_, index) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.imageDot,
                                                { backgroundColor: index === activeImageIndex ? colors.primary : colors.border }
                                            ]}
                                        />
                                    ))}
                                </View>
                            );
                        })()}
                    </View>
                </View>

                {/* Bottom Time Ago For Profile Cards */}
                {hideProfileInfo && (
                    <View style={{ paddingHorizontal: SPACING.md, paddingTop: 0 }}>
                        <Text style={[styles.postTime, { color: colors.textSecondary }]}>
                            {getTimeAgo(trip.createdAt)}
                        </Text>
                    </View>
                )}

                {/* Title + Location + Description */}
                <View style={[styles.contentSection, hideProfileInfo && { paddingTop: SPACING.xs }]}>
                    <Text style={[styles.tripTitle, { color: colors.text }]}>{trip.title}</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <TouchableOpacity
                            style={[styles.locationRow, { marginBottom: 0, flex: 1, marginRight: 8 }]}
                            onPress={() => {
                                const query = trip.location || trip.toLocation;
                                if (query) {
                                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="location" size={16} color={colors.primary} />
                            <Text style={[styles.locationText, { color: colors.primary }]} numberOfLines={1}>
                                {trip.location || trip.toLocation || 'TBD'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.viewDetailsButton, {
                                borderColor: colors.primary,
                                backgroundColor: colors.primary + '10', // 10% opacity 
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                marginLeft: 0
                            }]}
                            onPress={onPress}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.viewDetailsText, { color: colors.primary, fontSize: 12 }]}>View Details</Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {trip.description && (
                        <View style={styles.descriptionContainer}>
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

                {/* Trip Details Row */}
                <View style={[styles.detailsRow, { borderTopColor: colors.border }, hideProfileInfo && { borderTopWidth: 0 }]}>
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
                    <View style={styles.detailItem}>
                        <Text style={styles.detailEmoji}>
                            {trip.genderPreference === 'male' ? '👨' : trip.genderPreference === 'female' ? '👩' : '👥'}
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                            {trip.genderPreference === 'male' ? 'Male' : trip.genderPreference === 'female' ? 'Female' : 'Any'}
                        </Text>
                    </View>
                    {trip.tripTypes?.slice(0, 1).map((type: string, index: number) => (
                        <View key={index} style={styles.detailItem}>
                            <Text style={styles.detailEmoji}>🎯</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>{type.replace('_', ' ')}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </>
    );
});

const styles = StyleSheet.create({
    card: {
        marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        overflow: 'hidden',
    },
    profileCardElevated: {
        marginBottom: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    // Header
    userHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 2,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: SPACING.sm,
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        marginRight: SPACING.sm,
    },
    userInfoText: {
        justifyContent: 'center',
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    userName: {
        fontWeight: FONT_WEIGHT.bold,
        fontSize: FONT_SIZE.sm,
    },
    postTime: {
        fontSize: 11,
        marginTop: 1,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 2,
    },
    ratingText: {
        fontSize: 10,
        fontWeight: FONT_WEIGHT.bold,
        color: '#D97706',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    joinButton: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 22,
        borderWidth: 1.5,
    },
    joinButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 3,
    },
    completedText: {
        color: '#10B981',
        fontSize: 11,
        fontWeight: '700',
    },
    moreButton: {
        padding: 4,
    },
    // Image
    imageContainer: {
        position: 'relative',
        aspectRatio: 4 / 5,
    },
    tripImage: {
        width,
        aspectRatio: 4 / 5,
    },
    imageOverlay: {
        position: 'absolute',
        bottom: SPACING.md,
        left: SPACING.md,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: SPACING.xs,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.md,
    },
    overlayLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    overlayLocation: {
        color: '#fff',
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
    },
    mediaFooter: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        minHeight: 24,
    },
    imageDotsContainer: {
        flexDirection: 'row',
        gap: SPACING.xs,
        alignItems: 'center',
    },
    imageDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    imageCountBadge: {
        position: 'absolute',
        top: SPACING.md,
        left: SPACING.md,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
    },
    imageCountText: {
        color: '#fff',
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
    },
    // Content
    contentSection: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    tripTitle: {
        fontWeight: FONT_WEIGHT.bold,
        fontSize: FONT_SIZE.md,
        marginBottom: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 4,
    },
    locationText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
        flex: 1,
    },
    descriptionContainer: {
        marginTop: 2,
    },
    description: {
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
    },
    showMoreText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        marginTop: 2,
    },
    // Details row
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: SPACING.sm + 2,
        paddingHorizontal: SPACING.md,
        borderTopWidth: 0,
    },
    detailItem: {
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
    // Bottom: Tags + View Details
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        paddingTop: SPACING.xs,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        flex: 1,
    },
    tag: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
    },
    tagText: {
        fontSize: 11,
        fontWeight: FONT_WEIGHT.semibold,
    },
    viewDetailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        gap: 2,
        marginLeft: SPACING.sm,
    },
    viewDetailsText: {
        fontSize: 12,
        fontWeight: '600',
    },
    // Menu
    menuOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    menuPopup: {
        position: 'absolute',
        minWidth: 150,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.xs,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 10,
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
    },
    menuOptionText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
});

export default TripCard;
