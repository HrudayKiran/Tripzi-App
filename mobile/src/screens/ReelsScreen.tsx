import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import DefaultAvatar from '../components/DefaultAvatar';

const { width, height } = Dimensions.get('window');

type Reel = {
    id: string;
    tripId: string;
    tripTitle: string;
    tripImage: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    location?: string;
    description?: string;
    createdAt: any;
};

const ReelsScreen = () => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const [reels, setReels] = useState<Reel[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const fetchReels = async () => {
            try {
                // Fetch recent trips as reels
                const tripsSnapshot = await firestore()
                    .collection('trips')
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get();

                const reelsData = await Promise.all(
                    tripsSnapshot.docs.map(async (doc) => {
                        const tripData = doc.data();
                        // Fetch user data
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
                        return {
                            id: doc.id,
                            tripId: doc.id,
                            tripTitle: tripData.title || 'Trip',
                            tripImage: tripData.coverImage || tripData.images?.[0] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
                            userId: tripData.userId,
                            userName,
                            userPhoto,
                            location: tripData.location,
                            description: tripData.description,
                            createdAt: tripData.createdAt,
                        };
                    })
                );
                setReels(reelsData);
            } catch (error) {
                // Error

            } finally {
                setLoading(false);
            }
        };

        fetchReels();
    }, []);

    const renderReel = ({ item, index }: { item: Reel; index: number }) => (
        <TouchableOpacity
            style={[styles.reelContainer, { backgroundColor: colors.background }]}
            activeOpacity={0.95}
            onPress={() => navigation.navigate('TripDetails', { tripId: item.tripId })}
        >
            <Image
                source={{ uri: item.tripImage }}
                style={styles.reelImage}
                resizeMode="cover"
            />
            {/* Gradient Overlay */}
            <View style={styles.gradientOverlay} />

            {/* User Info */}
            <View style={styles.userInfo}>
                <DefaultAvatar uri={item.userPhoto} size={40} style={styles.avatar} />
                <View style={styles.userText}>
                    <Text style={styles.userName}>{item.userName}</Text>
                    <Text style={styles.tripTitle}>{item.tripTitle}</Text>
                </View>
            </View>

            {/* Location */}
            {item.location && (
                <View style={styles.locationBadge}>
                    <Ionicons name="location" size={14} color="#fff" />
                    <Text style={styles.locationText}>{item.location}</Text>
                </View>
            )}

            {/* Side Actions */}
            <View style={styles.sideActions}>
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="heart-outline" size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="paper-plane-outline" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="bookmark-outline" size={26} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Description */}
            {item.description && (
                <View style={styles.descriptionContainer}>
                    <Text style={styles.description} numberOfLines={2}>
                        {item.description}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (reels.length === 0) {
        return (
            <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <Ionicons name="videocam-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Reels Yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Trip highlights will appear here
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]}>
            <FlatList
                data={reels}
                renderItem={renderReel}
                keyExtractor={(item) => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={height}
                snapToAlignment="start"
                decelerationRate="fast"
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.y / height);
                    setCurrentIndex(index);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center' },
    reelContainer: { width, height, position: 'relative' },
    reelImage: { width: '100%', height: '100%', position: 'absolute' },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    userInfo: {
        position: 'absolute',
        bottom: 120,
        left: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: { marginRight: SPACING.md },
    userText: {},
    userName: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },
    tripTitle: { color: 'rgba(255,255,255,0.8)', fontSize: FONT_SIZE.sm },
    locationBadge: {
        position: 'absolute',
        bottom: 80,
        left: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.lg,
    },
    locationText: { color: '#fff', fontSize: FONT_SIZE.xs, marginLeft: 4 },
    sideActions: {
        position: 'absolute',
        right: SPACING.lg,
        bottom: 150,
        alignItems: 'center',
        gap: SPACING.lg,
    },
    actionButton: { padding: SPACING.sm },
    descriptionContainer: {
        position: 'absolute',
        bottom: 40,
        left: SPACING.lg,
        right: 80,
    },
    description: { color: '#fff', fontSize: FONT_SIZE.sm },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.lg },
    emptySubtitle: { fontSize: FONT_SIZE.sm, marginTop: SPACING.sm },
});

export default ReelsScreen;
