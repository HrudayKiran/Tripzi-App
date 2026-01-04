import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions, Image, StatusBar, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import DefaultAvatar from '../components/DefaultAvatar';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const { width, height } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = 80;

type Moment = {
    id: string;
    tripId: string;
    tripTitle: string;
    mediaUrl: string;
    mediaType: 'video' | 'image';
    userId: string;
    userName: string;
    userPhoto?: string;
    location?: string;
    description?: string;
    likes: string[];
    commentsCount: number;
    isLiked: boolean;
};

const MomentsScreen = () => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const [moments, setMoments] = useState<Moment[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const videoRefs = useRef<{ [key: string]: Video | null }>({});
    const currentUser = auth().currentUser;

    // Mute state
    const [isMuted, setIsMuted] = useState(false);

    // Animation for Double Tap Heart
    const [showHeart, setShowHeart] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        // Real-time listener
        const unsubscribe = firestore()
            .collection('trips')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .onSnapshot(async (querySnapshot) => {
                const momentsData = await Promise.all(
                    querySnapshot.docs.map(async (doc) => {
                        const tripData = doc.data();

                        // User Data
                        let userName = 'User';
                        let userPhoto = null;
                        if (tripData.userId) {
                            try {
                                const userDoc = await firestore().collection('users').doc(tripData.userId).get();
                                if (userDoc.exists) {
                                    const userData = userDoc.data();
                                    userName = userData?.displayName || 'User';
                                    userPhoto = userData?.photoURL;
                                }
                            } catch { }
                        }

                        // Media type
                        const mediaType = tripData.video ? 'video' : 'image';
                        const mediaUrl = tripData.video || tripData.coverImage || tripData.images?.[0] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';

                        // Real-time likes and comments
                        const likes = tripData.likes || [];
                        const isLiked = currentUser ? likes.includes(currentUser.uid) : false;

                        return {
                            id: doc.id,
                            tripId: doc.id,
                            tripTitle: tripData.title || 'Trip',
                            mediaUrl,
                            mediaType,
                            userId: tripData.userId,
                            userName,
                            userPhoto,
                            location: tripData.location || tripData.toLocation,
                            description: tripData.description,
                            likes,
                            commentsCount: tripData.commentsCount || 0,
                            isLiked,
                        };
                    })
                );
                setMoments(momentsData);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching moments:", error);
                setLoading(false);
            });

        return () => unsubscribe();
    }, [currentUser?.uid]);

    const handleLike = async (item: Moment) => {
        if (!currentUser) return;

        // Optimistic Update
        setShowHeart(prev => ({ ...prev, [item.id]: true }));
        setTimeout(() => setShowHeart(prev => ({ ...prev, [item.id]: false })), 1000);

        try {
            const tripRef = firestore().collection('trips').doc(item.tripId);
            if (item.isLiked) {
                await tripRef.update({
                    likes: firestore.FieldValue.arrayRemove(currentUser.uid),
                });
            } else {
                await tripRef.update({
                    likes: firestore.FieldValue.arrayUnion(currentUser.uid),
                });
            }
        } catch (error) {
            console.error("Like error:", error);
        }
    };

    const handleShare = async (item: Moment) => {
        try {
            await Share.share({
                message: `Check out this amazing trip: ${item.tripTitle} by @${item.userName} on Tripzi! 🌍`,
            });
        } catch (error) { }
    };

    const handleComments = (item: Moment) => {
        navigation.navigate('Comments', { tripId: item.tripId });
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    const formatCount = (count: number | undefined | null) => {
        if (!count && count !== 0) return '0';
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    const renderMoment = ({ item, index }: { item: Moment; index: number }) => {
        const isActive = isFocused && index === currentIndex;

        return (
            <View style={[styles.momentContainer, { backgroundColor: '#000' }]}>
                <Pressable
                    onPress={toggleMute}
                    style={StyleSheet.absoluteFill}
                >
                    {item.mediaType === 'video' ? (
                        <Video
                            ref={(ref: Video | null) => { videoRefs.current[item.id] = ref; }}
                            source={{ uri: item.mediaUrl }}
                            style={styles.media}
                            resizeMode={ResizeMode.COVER}
                            isLooping
                            shouldPlay={isActive}
                            isMuted={isMuted}
                        />
                    ) : (
                        <Image
                            source={{ uri: item.mediaUrl }}
                            style={styles.media}
                            resizeMode="cover"
                        />
                    )}
                </Pressable>

                {/* Double Tap Heart Overlay */}
                {showHeart[item.id] && (
                    <View style={styles.heartOverlay} pointerEvents="none">
                        <Animatable.View animation="bounceIn" duration={800}>
                            <Ionicons name="heart" size={100} color="rgba(255,255,255,0.8)" />
                        </Animatable.View>
                    </View>
                )}

                {/* Mute Indicator */}
                {item.mediaType === 'video' && isMuted && (
                    <View style={styles.muteIndicator} pointerEvents="none">
                        <Ionicons name="volume-mute" size={18} color="#fff" />
                    </View>
                )}

                {/* Gradient Overlay */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']}
                    style={styles.gradientOverlay}
                    pointerEvents="none"
                />

                {/* Content Layer */}
                <View style={styles.contentOverlay}>

                    {/* Right Side Actions */}
                    <View style={styles.rightActions}>
                        {/* User Profile - More Prominent */}
                        <TouchableOpacity
                            style={styles.profileContainer}
                            onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
                        >
                            <DefaultAvatar uri={item.userPhoto} size={52} style={styles.avatarBorder} />
                            <View style={styles.followBadge}>
                                <Ionicons name="add" size={14} color="#fff" />
                            </View>
                        </TouchableOpacity>

                        {/* Like */}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)}>
                            <Ionicons name={item.isLiked ? "heart" : "heart-outline"} size={32} color={item.isLiked ? "#EF4444" : "#fff"} />
                            <Text style={styles.actionText}>{formatCount(item.likes?.length || 0)}</Text>
                        </TouchableOpacity>

                        {/* Comment */}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleComments(item)}>
                            <Ionicons name="chatbubble-ellipses-outline" size={30} color="#fff" />
                            <Text style={styles.actionText}>{formatCount(item.commentsCount)}</Text>
                        </TouchableOpacity>

                        {/* Share */}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
                            <Ionicons name="paper-plane-outline" size={30} color="#fff" />
                        </TouchableOpacity>

                        {/* View Trip */}
                        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('TripDetails', { tripId: item.tripId })}>
                            <View style={styles.glassButton}>
                                <Ionicons name="compass-outline" size={24} color="#fff" />
                            </View>
                            <Text style={styles.actionText}>View</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Info */}
                    <View style={styles.bottomInfo} pointerEvents="box-none">
                        <TouchableOpacity
                            style={styles.userRow}
                            onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
                        >
                            <DefaultAvatar uri={item.userPhoto} size={32} style={styles.bottomAvatar} />
                            <Text style={styles.userName}>@{item.userName.replace(/\s/g, '').toLowerCase()}</Text>
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.tripTitle}>{item.tripTitle}</Text>

                        {item.location && (
                            <View style={styles.locationTag}>
                                <Ionicons name="location-sharp" size={12} color="#fff" />
                                <Text style={styles.locationText}>{item.location}</Text>
                            </View>
                        )}

                        {item.description && (
                            <Text style={styles.description} numberOfLines={2}>
                                {item.description}
                            </Text>
                        )}
                    </View>

                </View>
            </View>
        );
    };

    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }, []);

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (moments.length === 0) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: '#000' }]}>
                <Ionicons name="film-outline" size={80} color="rgba(255,255,255,0.3)" />
                <Text style={{ color: '#fff', marginTop: 20, fontSize: 18, fontWeight: 'bold' }}>No Moments Yet</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Join trips and share your memories!</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Header Overlay */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <Text style={styles.headerTitle}>Moments</Text>
                <TouchableOpacity>
                    <Ionicons name="camera-outline" size={28} color="#fff" />
                </TouchableOpacity>
            </SafeAreaView>

            <FlatList
                data={moments}
                renderItem={renderMoment}
                keyExtractor={(item) => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={height}
                snapToAlignment="start"
                decelerationRate="fast"
                viewabilityConfig={{
                    itemVisiblePercentThreshold: 50
                }}
                onViewableItemsChanged={onViewableItemsChanged}
                contentContainerStyle={{ paddingBottom: 0 }}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingTop: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 4,
    },
    momentContainer: {
        width: width,
        height: height,
        position: 'relative',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 400,
    },
    contentOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 90,
        padding: SPACING.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    heartOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    muteIndicator: {
        position: 'absolute',
        top: 100,
        right: 20,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomInfo: {
        flex: 1,
        marginRight: 70,
        justifyContent: 'flex-end',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    bottomAvatar: {
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#fff',
    },
    userName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: FONT_SIZE.md,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowRadius: 3,
    },
    verifiedBadge: {
        marginLeft: 4,
    },
    locationTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    locationText: {
        color: '#fff',
        fontSize: 11,
        marginLeft: 4,
        fontWeight: '600',
    },
    tripTitle: {
        color: '#fff',
        fontSize: FONT_SIZE.lg,
        fontWeight: 'bold',
        marginBottom: 8,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowRadius: 3,
    },
    description: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 2,
    },
    rightActions: {
        position: 'absolute',
        right: 8,
        bottom: 0,
        alignItems: 'center',
        gap: 18,
        width: 60,
    },
    profileContainer: {
        marginBottom: 12,
        alignItems: 'center',
    },
    avatarBorder: {
        borderWidth: 2.5,
        borderColor: '#fff',
    },
    followBadge: {
        position: 'absolute',
        bottom: -8,
        alignSelf: 'center',
        backgroundColor: '#EF4444',
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    actionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 50,
    },
    glassButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    actionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },

});

export default MomentsScreen;
