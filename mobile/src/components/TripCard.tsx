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
    mixed: { icon: '🚀', label: 'Mixed' },
};

interface TripCardProps {
    trip: any;
    onPress?: () => void;
    isVisible?: boolean;
    onReportPress: (trip: any) => void;
    showOptions?: boolean;
}

const TripCard = memo(({ trip, onPress, isVisible = false, onReportPress, showOptions = true }: TripCardProps) => {

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
        } catch {
            // Keep previous state on error
        }
    };

    // Check if trip is completed (marked by owner)
    const isCompleted = trip.isCompleted === true;
    const isOwnTrip = trip.userId === currentUser?.uid;

    const transport = TRANSPORT_ICONS[trip.transportMode?.toLowerCase()] || TRANSPORT_ICONS.mixed;
    const spotsLeft = Math.max(0, (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1));

    return (
        <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                {/* User Header — avatar, name, join, view details, 3-dots */}
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
                        {/* Join Button */}
                        {!isOwnTrip && !isCompleted && (
                            <TouchableOpacity
                                style={[
                                    styles.joinButton,
                                    {
                                        backgroundColor: hasJoined ? 'transparent' : colors.primary,
                                        borderColor: hasJoined ? colors.primary : colors.primary,
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

                        {/* Three dots menu */}
                        {showOptions && (
                            <View ref={moreButtonRef} collapsable={false}>
                                <TouchableOpacity
                                    style={styles.moreButton}
                                    onPress={() => {
                                        moreButtonRef.current?.measure((x, y, w, h, pageX, pageY) => {
                                            setMenuPosition({ top: pageY + h + 4, right: Dimensions.get('window').width - (pageX + w) });
                                            setShowMenu(true);
                                        });
                                    }}
                                >
                                    <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

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

                {/* Title + Location + Description */}
                <View style={styles.contentSection}>
                    <Text style={[styles.tripTitle, { color: colors.text }]}>{trip.title}</Text>

                    <TouchableOpacity
                        style={styles.locationRow}
                        onPress={() => {
                            const query = trip.location || trip.toLocation;
                            if (query) {
                                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="location" size={18} color={colors.primary} />
                        <Text style={[styles.locationText, { color: colors.primary }]} numberOfLines={1}>
                            {trip.location || trip.toLocation || 'TBD'}
                        </Text>
                    </TouchableOpacity>

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

                {/* Tags + View Details */}
                <View style={[styles.bottomRow, { paddingVertical: SPACING.md }]}>
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

                    <TouchableOpacity
                        style={[styles.viewDetailsButton, {
                            borderColor: colors.primary,
                            backgroundColor: colors.primary + '10', // 10% opacity 
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                        }]}
                        onPress={onPress}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.viewDetailsText, { color: colors.primary, fontSize: FONT_SIZE.md }]}>View Details</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>


            {/* Three Dots Menu — Report only */}
            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    {menuPosition && (
                        <View style={[
                            styles.menuPopup,
                            {
                                backgroundColor: colors.card,
                                top: menuPosition.top,
                                right: menuPosition.right,
                            }
                        ]}>
                            {/* Report */}
                            {!isOwnTrip && (
                                <TouchableOpacity
                                    style={styles.menuOption}
                                    onPress={() => {
                                        setShowMenu(false);
                                        onReportPress(trip);
                                    }}
                                >
                                    <Ionicons name="flag-outline" size={18} color="#EF4444" />
                                    <Text style={[styles.menuOptionText, { color: '#EF4444' }]}>Report</Text>
                                </TouchableOpacity>
                            )}

                            {/* View Details (fallback for own trips) */}
                            {isOwnTrip && (
                                <TouchableOpacity
                                    style={styles.menuOption}
                                    onPress={() => {
                                        setShowMenu(false);
                                        onPress && onPress();
                                    }}
                                >
                                    <Ionicons name="eye-outline" size={18} color={colors.text} />
                                    <Text style={[styles.menuOptionText, { color: colors.text }]}>View Details</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </TouchableOpacity>
            </Modal>
        </>
    );
});

const styles = StyleSheet.create({
    card: {
        marginBottom: 1,
        overflow: 'hidden',
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
        borderTopWidth: 1,
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
