import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import TripCard from '../components/TripCard';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

// Fallback user for when Firestore is unavailable
const FALLBACK_USER = {
    id: 'testuser001',
    displayName: 'Travel Explorer',
    email: 'explorer@tripzi.com',
    photoURL: 'https://randomuser.me/api/portraits/men/32.jpg',
    bio: 'Passionate traveler | 50+ trips | Love mountains & beaches 🏔️🏖️',
    kycStatus: 'verified',
    followers: [],
    following: [],
};

const UserProfileScreen = ({ route, navigation }) => {
    const { userId } = route.params;
    const { colors } = useTheme();
    const [user, setUser] = useState(null);
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const currentUser = auth.currentUser;

    useEffect(() => {
        loadUserData();
    }, [userId]);

    const loadUserData = async () => {
        try {
            const isOwnProfile = userId === currentUser?.uid;

            // Try to fetch from Firestore
            const userDoc = await firestore().collection('users').doc(userId).get();

            if (userDoc.exists) {
                const userData = { id: userDoc.id, ...userDoc.data() };
                setUser(userData);

                if (userData.followers?.includes(currentUser?.uid)) {
                    setIsFollowing(true);
                }

                // Fetch user's trips
                try {
                    const tripsSnapshot = await firestore()
                        .collection('trips')
                        .where('userId', '==', userId)
                        .get();

                    const userTrips = tripsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        user: userData,
                    }));
                    setTrips(userTrips);
                } catch (e) {
                    console.log('Trips fetch error:', e);
                }
            } else if (isOwnProfile && currentUser) {
                // Own profile but no Firestore doc - use auth data
                setUser({
                    id: currentUser.uid,
                    displayName: currentUser.displayName || 'User',
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || 'https://via.placeholder.com/120',
                    bio: 'Tripzi traveler',
                    kycStatus: 'pending',
                    followers: [],
                    following: [],
                });
            } else if (userId === 'testuser001') {
                // Use fallback for test user
                setUser(FALLBACK_USER);
            } else {
                // User not found
                setUser(null);
            }
        } catch (error) {
            console.log('Error loading user:', error);
            // Use fallback if it's the test user or own profile
            const isOwnProfile = userId === currentUser?.uid;
            if (isOwnProfile && currentUser) {
                setUser({
                    id: currentUser.uid,
                    displayName: currentUser.displayName || 'User',
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || 'https://via.placeholder.com/120',
                    bio: 'Tripzi traveler',
                    kycStatus: 'pending',
                    followers: [],
                    following: [],
                });
            } else if (userId === 'testuser001') {
                setUser(FALLBACK_USER);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!currentUser) return;

        setIsFollowing(!isFollowing);

        try {
            const userRef = firestore().collection('users').doc(userId);
            const currentUserRef = firestore().collection('users').doc(currentUser.uid);

            if (isFollowing) {
                await userRef.update({
                    followers: firestore.FieldValue.arrayRemove(currentUser.uid),
                });
                await currentUserRef.update({
                    following: firestore.FieldValue.arrayRemove(userId),
                });
            } else {
                await userRef.update({
                    followers: firestore.FieldValue.arrayUnion(currentUser.uid),
                });
                await currentUserRef.update({
                    following: firestore.FieldValue.arrayUnion(userId),
                });
            }
        } catch (error) {
            console.log('Follow error (local only):', error);
            // Keep local state change
        }
    };

    const handleMessage = () => {
        navigation.navigate('Message', {
            recipientId: userId,
            recipientName: user?.displayName,
            recipientImage: user?.photoURL,
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!user) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: colors.card }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
                    <View style={{ width: 44 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <Ionicons name="person-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.notFoundText, { color: colors.text }]}>User not found</Text>
                    <Text style={[styles.notFoundSubtext, { color: colors.textSecondary }]}>
                        This user may not exist or Firestore is still connecting
                    </Text>
                    <TouchableOpacity
                        style={[styles.retryButton, { backgroundColor: colors.primary }]}
                        onPress={loadUserData}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: colors.card }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Profile Card */}
                <Animatable.View animation="fadeInUp" style={[styles.profileCard, { backgroundColor: colors.card }]}>
                    <Image
                        style={styles.avatar}
                        source={{ uri: user.photoURL || 'https://via.placeholder.com/120' }}
                    />
                    <Text style={[styles.userName, { color: colors.text }]}>{user.displayName}</Text>
                    {user.bio && (
                        <Text style={[styles.bio, { color: colors.textSecondary }]}>{user.bio}</Text>
                    )}

                    {/* KYC Badge */}
                    {user.kycStatus === 'verified' && (
                        <View style={[styles.kycBadge, { backgroundColor: '#D1FAE5' }]}>
                            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                            <Text style={styles.kycBadgeText}>KYC Verified</Text>
                        </View>
                    )}

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: colors.text }]}>{trips.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: colors.text }]}>{user.followers?.length || 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: colors.text }]}>{user.following?.length || 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    {currentUser?.uid !== userId && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.followButton,
                                    { backgroundColor: isFollowing ? colors.card : colors.primary, borderColor: colors.primary }
                                ]}
                                onPress={handleFollow}
                            >
                                <Text style={[styles.followButtonText, { color: isFollowing ? colors.primary : '#fff' }]}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.messageButton, { borderColor: colors.primary }]}
                                onPress={handleMessage}
                            >
                                <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                                <Text style={[styles.messageButtonText, { color: colors.primary }]}>Message</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animatable.View>

                {/* User's Trips */}
                <View style={styles.tripsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        {user.displayName}'s Trips
                    </Text>
                    {trips.length === 0 ? (
                        <View style={styles.emptyTrips}>
                            <Ionicons name="airplane-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No trips yet</Text>
                        </View>
                    ) : (
                        trips.map((trip, index) => (
                            <Animatable.View key={trip.id} animation="fadeInUp" delay={index * 100}>
                                <TripCard
                                    trip={trip}
                                    onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}
                                />
                            </Animatable.View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
    notFoundText: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.lg },
    notFoundSubtext: { fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xl },
    retryButton: { paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg },
    retryButtonText: { color: '#fff', fontWeight: FONT_WEIGHT.bold },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    backButton: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        borderRadius: TOUCH_TARGET.min / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    profileCard: {
        marginHorizontal: SPACING.lg,
        padding: SPACING.xl,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
    },
    avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: SPACING.md },
    userName: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
    bio: { fontSize: FONT_SIZE.sm, textAlign: 'center', marginBottom: SPACING.md },
    kycBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.xs,
        marginBottom: SPACING.lg,
    },
    kycBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: '#10B981' },
    statsRow: { flexDirection: 'row', gap: SPACING.xxl, marginBottom: SPACING.lg },
    statItem: { alignItems: 'center' },
    statNumber: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    statLabel: { fontSize: FONT_SIZE.xs },
    actionButtons: { flexDirection: 'row', gap: SPACING.md, width: '100%' },
    followButton: {
        flex: 1,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        borderWidth: 1.5,
    },
    followButtonText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    messageButton: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        gap: SPACING.xs,
    },
    messageButtonText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    tripsSection: { padding: SPACING.lg },
    sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.lg },
    emptyTrips: { alignItems: 'center', paddingVertical: SPACING.xxxl },
    emptyText: { fontSize: FONT_SIZE.sm, marginTop: SPACING.md },
});

export default UserProfileScreen;
