import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, FlatList, Dimensions, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';
import FollowersModal from '../components/FollowersModal';
import TripCard from '../components/TripCard';
import ProfilePictureViewer from '../components/ProfilePictureViewer';
import { pickAndUploadImage } from '../utils/imageUpload';
import NotificationService from '../utils/notificationService';

const { width, height } = Dimensions.get('window');

// Fallback user
const FALLBACK_USER = {
    id: 'testuser001',
    displayName: 'Travel Explorer',
    username: 'traveler',
    photoURL: 'https://randomuser.me/api/portraits/men/32.jpg',
    bio: 'Passionate traveler | 50+ trips 🏔️',
    kycStatus: 'verified',
    followers: [],
    following: [],
};

const UserProfileScreen = ({ route, navigation }) => {
    const currentUser = auth().currentUser;
    // Default to current user if no param passed (e.g. from Tab bar)
    const userId = route.params?.userId || currentUser?.uid;

    const { colors } = useTheme();
    const [user, setUser] = useState(null);
    const [trips, setTrips] = useState([]);
    const [stories, setStories] = useState<any[]>([
        { id: 'add', type: 'add' },
    ]);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showFollowersModal, setShowFollowersModal] = useState(false);
    const [showFollowingModal, setShowFollowingModal] = useState(false);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [showEditTripModal, setShowEditTripModal] = useState(false);
    const [currentStory, setCurrentStory] = useState(null);
    const [currentTrip, setCurrentTrip] = useState(null);
    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [editTripTitle, setEditTripTitle] = useState('');
    const [editTripLocation, setEditTripLocation] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [hostRating, setHostRating] = useState<{ average: number; count: number } | null>(null);
    const [showFullImage, setShowFullImage] = useState(false);
    const storyProgress = useRef(new Animated.Value(0)).current;

    const isOwnProfile = userId === currentUser?.uid;

    // Reload data when screen comes into focus (e.g., after creating a trip)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadUserData();
        });
        return unsubscribe;
    }, [navigation, userId]);

    // Real-time trips listener
    useEffect(() => {
        if (!userId) return;

        const unsubscribe = firestore()
            .collection('trips')
            .where('userId', '==', userId)
            .onSnapshot((snapshot) => {
                if (snapshot) {
                    const tripsData = snapshot.docs.map(doc => ({ // Sort manually if needed, or rely on query order
                        id: doc.id,
                        ...doc.data()
                    }));
                    // Client-side sort by createdAt desc
                    tripsData.sort((a, b) => {
                        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                        return bTime - aTime;
                    });
                    setTrips(tripsData);
                }
            }, (error) => {
                console.warn("Trip listener error:", error);
            });

        return () => unsubscribe();
    }, [userId]);

    const loadUserData = async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            const userDoc = await firestore().collection('users').doc(userId).get();

            if (userDoc.exists) {
                const userData = { id: userDoc.id, ...userDoc.data() };
                setUser(userData);
                setEditName(userData.displayName || '');
                setEditBio(userData.bio || '');
                setProfileImage(userData.photoURL);

                if (userData.followers?.includes(currentUser?.uid)) {
                    setIsFollowing(true);
                }

                // Trips are now handled by useEffect subscription

                // Load followers/following
                if (userData.followers?.length > 0) {
                    const followersData = await Promise.all(
                        userData.followers.slice(0, 20).map(async (uid) => {
                            try {
                                const doc = await firestore().collection('users').doc(uid).get();
                                return doc.exists ? { id: uid, ...doc.data() } : null;
                            } catch { return null; }
                        })
                    );
                    setFollowers(followersData.filter(Boolean));
                }

                if (userData.following?.length > 0) {
                    const followingData = await Promise.all(
                        userData.following.slice(0, 20).map(async (uid) => {
                            try {
                                const doc = await firestore().collection('users').doc(uid).get();
                                return doc.exists ? { id: uid, ...doc.data() } : null;
                            } catch { return null; }
                        })
                    );
                    setFollowing(followingData.filter(Boolean));
                }

                // Fetch host ratings for this user
                if (userId) {
                    try {
                        const ratingsSnapshot = await firestore()
                            .collection('ratings')
                            .where('hostId', '==', userId)
                            .get();

                        if (ratingsSnapshot.docs.length > 0) {
                            const totalRating = ratingsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().rating || 0), 0);
                            const avgRating = totalRating / ratingsSnapshot.docs.length;
                            setHostRating({
                                average: Math.round(avgRating * 10) / 10,
                                count: ratingsSnapshot.docs.length,
                            });
                        }
                    } catch (e) {

                    }
                }
            } else if (isOwnProfile && currentUser) {
                setUser({
                    id: currentUser.uid,
                    displayName: currentUser.displayName || 'User',
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || null,
                    bio: '',
                    kycStatus: 'pending',
                    followers: [],
                    following: [],
                });
                setEditName(currentUser.displayName || '');
                setProfileImage(currentUser.photoURL);
            } else {
                setUser(FALLBACK_USER);
                setEditName(FALLBACK_USER.displayName);
                setEditBio(FALLBACK_USER.bio);
                setProfileImage(FALLBACK_USER.photoURL);
            }
        } catch (error) {

            if (isOwnProfile && currentUser) {
                setUser({
                    id: currentUser.uid,
                    displayName: currentUser.displayName || 'User',
                    photoURL: currentUser.photoURL,
                    bio: '',
                    kycStatus: 'pending',
                    followers: [],
                    following: [],
                });
                setEditName(currentUser.displayName || '');
                setProfileImage(currentUser.photoURL);
            } else {
                setUser(FALLBACK_USER);
            }
        } finally {
            setLoading(false);
        }
    };

    // Pick and upload profile image to Firebase Storage
    const pickProfileImage = async () => {
        if (!currentUser) {
            Alert.alert('Error', 'Please log in to change your profile picture.');
            return;
        }

        try {
            const result = await pickAndUploadImage({
                folder: 'profiles',
                userId: currentUser.uid,
                aspect: [1, 1],
                quality: 0.7,
                allowsEditing: false,
            });

            if (result.success && result.url) {
                // Update local state
                setProfileImage(result.url);

                // Update Firestore with the cloud URL
                await firestore().collection('users').doc(currentUser.uid).update({
                    photoURL: result.url,
                });

                // Update user state
                setUser(prev => ({ ...prev, photoURL: result.url }));

                Alert.alert('Success! ✨', 'Your profile photo has been updated.');
            } else if (result.error && result.error !== 'Selection cancelled') {
                Alert.alert('Upload Failed', result.error);
            }
        } catch (error) {
            // Error upload blocked

            Alert.alert('Error', 'Failed to upload profile image. Please try again.');
        }
    };

    // Add story
    const addStory = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera roll permissions.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            aspect: [9, 16],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const newStory = {
                id: Date.now().toString(),
                image: result.assets[0].uri,
                title: 'New Story',
                viewed: false,
                createdAt: new Date(),
            };
            setStories(prev => [prev[0], newStory, ...prev.slice(1)]);
            Alert.alert('Story Added! 🎉', 'Your story is now visible for 24 hours.');
        }
    };

    // View story
    const viewStory = (story) => {
        setCurrentStory(story);
        setShowStoryModal(true);
        storyProgress.setValue(0);

        Animated.timing(storyProgress, {
            toValue: 1,
            duration: 5000,
            useNativeDriver: false,
        }).start(() => {
            setShowStoryModal(false);
            // Mark as viewed
            setStories(prev => prev.map(s => s.id === story.id ? { ...s, viewed: true } : s));
        });
    };

    const handleSaveProfile = async () => {
        if (!currentUser) return;
        try {
            await firestore().collection('users').doc(currentUser.uid).update({
                displayName: editName,
                bio: editBio,
                photoURL: profileImage,
            });

            setUser(prev => ({ ...prev, displayName: editName, bio: editBio, photoURL: profileImage }));
            setShowEditModal(false);
            Alert.alert('Success! ✨', 'Profile updated!');
        } catch (error) {
            setUser(prev => ({ ...prev, displayName: editName, bio: editBio, photoURL: profileImage }));
            setShowEditModal(false);
            Alert.alert('Saved!', 'Profile updated locally.');
        }
    };

    // Edit trip
    const openEditTrip = (trip) => {
        setCurrentTrip(trip);
        setEditTripTitle(trip.title || '');
        setEditTripLocation(trip.location || '');
        setShowEditTripModal(true);
    };

    const saveEditTrip = async () => {
        if (!currentTrip) return;
        try {
            await firestore().collection('trips').doc(currentTrip.id).update({
                title: editTripTitle,
                location: editTripLocation,
            });
            setTrips(prev => prev.map(t => t.id === currentTrip.id ? { ...t, title: editTripTitle, location: editTripLocation } : t));
            setShowEditTripModal(false);
            Alert.alert('Updated! ✨', 'Trip updated successfully.');
        } catch (error) {
            setTrips(prev => prev.map(t => t.id === currentTrip.id ? { ...t, title: editTripTitle, location: editTripLocation } : t));
            setShowEditTripModal(false);
            Alert.alert('Saved!', 'Trip updated locally.');
        }
    };

    const handleDeleteTrip = (tripId) => {
        Alert.alert('Delete Trip', 'Are you sure? All participants will be notified.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        // Fetch trip data to get participants
                        const tripDoc = await firestore().collection('trips').doc(tripId).get();
                        const tripData = tripDoc.data();

                        if (tripData) {
                            const participants = tripData.participants || [];
                            const hostName = currentUser?.displayName || 'The host';
                            const tripTitle = tripData.title || 'A trip';

                            // Notify all participants (except the owner)
                            for (const participantId of participants) {
                                if (participantId !== currentUser?.uid) {
                                    await NotificationService.onTripCancelled(participantId, tripId, tripTitle, hostName);
                                }
                            }
                        }

                        await firestore().collection('trips').doc(tripId).delete();
                    } catch (e) { }
                    setTrips(prev => prev.filter(t => t.id !== tripId));
                }
            }
        ]);
    };

    const handleFollow = async () => {
        if (!currentUser) return;
        setIsFollowing(!isFollowing);
        try {
            const userRef = firestore().collection('users').doc(userId);
            const currentUserRef = firestore().collection('users').doc(currentUser.uid);

            if (isFollowing) {
                await userRef.update({ followers: firestore.FieldValue.arrayRemove(currentUser.uid) });
                await currentUserRef.update({ following: firestore.FieldValue.arrayRemove(userId) });
            } else {
                await userRef.update({ followers: firestore.FieldValue.arrayUnion(currentUser.uid) });
                await currentUserRef.update({ following: firestore.FieldValue.arrayUnion(userId) });
            }
        } catch (error) { }
    };

    const handleMessage = async () => {
        if (!currentUser || !user) return;
        try {
            // Create or get existing chat using Firestore directly
            const chatQuery = await firestore()
                .collection('chats')
                .where('type', '==', 'direct')
                .where('participants', 'array-contains', currentUser.uid)
                .get();

            let chatId = null;
            for (const doc of chatQuery.docs) {
                const data = doc.data();
                if (data.participants.includes(userId)) {
                    chatId = doc.id;
                    break;
                }
            }

            if (!chatId) {
                // Create new chat
                const currentUserDoc = await firestore().collection('users').doc(currentUser.uid).get();
                const currentUserData = currentUserDoc.data();

                const newChatRef = await firestore().collection('chats').add({
                    type: 'direct',
                    participants: [currentUser.uid, userId],
                    participantDetails: {
                        [currentUser.uid]: {
                            displayName: currentUserData?.displayName || currentUser.displayName || 'User',
                            photoURL: currentUserData?.photoURL || currentUser.photoURL || '',
                        },
                        [userId]: {
                            displayName: user.displayName || 'User',
                            photoURL: user.photoURL || '',
                        },
                    },
                    unreadCount: {
                        [currentUser.uid]: 0,
                        [userId]: 0,
                    },
                    mutedBy: [],
                    pinnedBy: [],
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
                chatId = newChatRef.id;
            }

            navigation.navigate('Chat', {
                chatId,
                otherUserId: userId,
                otherUserName: user.displayName,
                otherUserPhoto: user.photoURL,
            });
        } catch (error) {
            // Error starting chat

            Alert.alert('Error', 'Could not start chat. Please try again.');
        }
    };

    const navigateToProfile = (uid) => {
        setShowFollowersModal(false);
        setShowFollowingModal(false);
        navigation.push('UserProfile', { userId: uid });
    };

    const renderStory = ({ item, index }) => {
        if (item.type === 'add') {
            return (
                <Animatable.View animation="fadeInRight" delay={index * 50}>
                    <TouchableOpacity style={styles.storyItem} onPress={addStory}>
                        <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.addStoryGradient}>
                            <Ionicons name="add" size={28} color="#fff" />
                        </LinearGradient>
                        <Text style={[styles.storyTitle, { color: colors.textSecondary }]}>Add</Text>
                    </TouchableOpacity>
                </Animatable.View>
            );
        }
        return (
            <Animatable.View animation="fadeInRight" delay={index * 50}>
                <TouchableOpacity style={styles.storyItem} onPress={() => viewStory(item)}>
                    <LinearGradient
                        colors={item.viewed ? ['#9CA3AF', '#9CA3AF'] : ['#F59E0B', '#EF4444', '#EC4899']}
                        style={styles.storyGradient}
                    >
                        <Image source={{ uri: item.image }} style={styles.storyImage} />
                    </LinearGradient>
                    <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                </TouchableOpacity>
            </Animatable.View>
        );
    };

    const renderUserItem = ({ item }) => (
        <TouchableOpacity style={[styles.userItem, { backgroundColor: colors.card }]} onPress={() => navigateToProfile(item.id)}>
            <Image source={{ uri: item.photoURL || undefined }} style={styles.userAvatar} />
            <View style={styles.userInfo}>
                <Text style={[styles.userItemName, { color: colors.text }]}>{item.displayName || 'User'}</Text>
                {item.username && <Text style={[styles.userItemUsername, { color: colors.primary }]}>@{item.username}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
    );

    // Content Rendering
    const renderTripGrid = () => (
        <View style={styles.postsContainer}>
            {trips.map((trip) => (
                <TripCard
                    key={trip.id}
                    trip={{ ...trip, user: user || trip.user }}
                    onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}
                />
            ))}
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
            </SafeAreaView>
        );
    }

    if (!user) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.loadingContainer}>
                    <Ionicons name="person-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.notFoundText, { color: colors.text }]}>User not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {/* Header - No Gradient */}
                <View style={[styles.gradientHeader, { backgroundColor: colors.background }]}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.card }]} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        {isOwnProfile && (
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('CreateTrip')}>
                                    <Ionicons name="add" size={24} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.card }]} onPress={() => setShowEditModal(true)}>
                                    <Ionicons name="create-outline" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                <View style={[styles.profileContent, { backgroundColor: colors.background, marginTop: 0 }]}>
                    {/* Top Section: Avatar & Stats */}
                    <View style={styles.topSection}>
                        <TouchableOpacity onPress={() => setShowFullImage(true)} style={styles.avatarContainer}>
                            <View style={[styles.avatarBorder, { backgroundColor: colors.background }]}>
                                <Image source={{ uri: profileImage || user.photoURL || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                            </View>
                        </TouchableOpacity>

                        {/* Stats - Now to the right of avatar, cleaner look */}
                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: colors.text }]}>{trips.length}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.statItem} onPress={() => setShowFollowersModal(true)}>
                                <Text style={[styles.statValue, { color: colors.text }]}>{user.followers?.length || 0}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
                            </TouchableOpacity>
                            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.statItem} onPress={() => setShowFollowingModal(true)}>
                                <Text style={[styles.statValue, { color: colors.text }]}>{user.following?.length || 0}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Check if verified or has rating */}
                    <View style={styles.nameSection}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.displayName, { color: colors.text }]}>{user.displayName}</Text>
                            {user.kycStatus === 'verified' && (
                                <Ionicons name="checkmark-circle" size={20} color="#3B82F6" style={{ marginLeft: 4 }} />
                            )}
                        </View>
                        {user.username && <Text style={[styles.displayUsername, { color: colors.textSecondary }]}>@{user.username}</Text>}

                        {/* Rating Badge - Now prominent below name/username */}
                        {hostRating && (
                            <View style={styles.ratingContainer}>
                                <View style={styles.ratingBadge}>
                                    <Ionicons name="star" size={14} color="#F59E0B" />
                                    <Text style={styles.ratingScore}>{hostRating.average}</Text>
                                </View>
                                <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>({hostRating.count} reviews)</Text>
                            </View>
                        )}

                        {user.bio ? (
                            <Text style={[styles.bioText, { color: colors.text }]}>{user.bio}</Text>
                        ) : null}
                    </View>

                    {/* Action Buttons */}
                    {!isOwnProfile && (
                        <View style={styles.actionButtonsContainer}>
                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: isFollowing ? colors.card : colors.primary, borderColor: isFollowing ? colors.border : 'transparent', borderWidth: isFollowing ? 1 : 0 }]}
                                onPress={handleFollow}
                            >
                                <Text style={[styles.primaryBtnText, { color: isFollowing ? colors.text : '#fff' }]}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleMessage}>
                                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Message</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Posts Section */}
                <View style={styles.contentSection}>
                    <View style={styles.tabsHeader}>
                        <View style={[styles.activeTab, { borderBottomColor: colors.text }]}>
                            <Ionicons name="grid-outline" size={20} color={colors.text} />
                        </View>
                    </View>

                    {trips.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIconCircle, { backgroundColor: colors.card }]}>
                                <Ionicons name="camera-outline" size={40} color={colors.textSecondary} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Posts Yet</Text>
                        </View>
                    ) : (
                        renderTripGrid()
                    )}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Story Viewer Modal */}
            <Modal visible={showStoryModal} transparent animationType="fade">
                <View style={styles.storyModalContainer}>
                    <TouchableOpacity style={styles.storyCloseArea} onPress={() => setShowStoryModal(false)} activeOpacity={1}>
                        {currentStory && (
                            <>
                                <View style={styles.storyProgressBar}>
                                    <Animated.View style={[styles.storyProgress, { width: storyProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
                                </View>
                                <View style={styles.storyHeader}>
                                    <Image source={{ uri: user?.photoURL }} style={styles.storyUserAvatar} />
                                    <Text style={styles.storyUserName}>{user?.displayName}</Text>
                                    <TouchableOpacity onPress={() => setShowStoryModal(false)}>
                                        <Ionicons name="close" size={28} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                <Image source={{ uri: currentStory.image }} style={styles.storyFullImage} resizeMode="contain" />
                                <Text style={styles.storyCaption}>{currentStory.title}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Edit Profile Modal */}
            <Modal visible={showEditModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <Animatable.View animation="slideInUp" style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.editAvatarSection} onPress={pickProfileImage}>
                            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.editAvatarGradient}>
                                <Image source={{ uri: profileImage || user?.photoURL }} style={styles.editAvatar} />
                            </LinearGradient>
                            <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
                        </TouchableOpacity>

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Display Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Your name"
                            placeholderTextColor={colors.textSecondary}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bio</Text>
                        <TextInput
                            style={[styles.input, styles.bioInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editBio}
                            onChangeText={setEditBio}
                            placeholder="Tell people about yourself..."
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            maxLength={150}
                        />
                        <Text style={[styles.charCount, { color: colors.textSecondary }]}>{editBio.length}/150</Text>

                        <TouchableOpacity onPress={handleSaveProfile}>
                            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.saveButton}>
                                <Text style={styles.saveButtonText}>Save Changes</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animatable.View>
                </View>
            </Modal>

            {/* Edit Trip Modal */}
            <Modal visible={showEditTripModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <Animatable.View animation="slideInUp" style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Post</Text>
                            <TouchableOpacity onPress={() => setShowEditTripModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Title</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editTripTitle}
                            onChangeText={setEditTripTitle}
                            placeholder="Trip title"
                            placeholderTextColor={colors.textSecondary}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Location</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editTripLocation}
                            onChangeText={setEditTripLocation}
                            placeholder="Location"
                            placeholderTextColor={colors.textSecondary}
                        />

                        <TouchableOpacity onPress={saveEditTrip}>
                            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.saveButton}>
                                <Text style={styles.saveButtonText}>Save Changes</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animatable.View>
                </View>
            </Modal>

            {/* Followers Modal - Full screen slide from right */}
            <FollowersModal
                visible={showFollowersModal}
                onClose={() => setShowFollowersModal(false)}
                title="Followers"
                users={followers}
                onUserPress={navigateToProfile}
            />

            {/* Following Modal - Full screen slide from right */}
            <FollowersModal
                visible={showFollowingModal}
                onClose={() => setShowFollowingModal(false)}
                title="Following"
                users={following}
                onUserPress={navigateToProfile}
            />

            {/* Profile Picture Viewer */}
            <ProfilePictureViewer
                visible={showFullImage}
                imageUrl={profileImage || user?.photoURL}
                userName={user?.displayName}
                isOwnProfile={isOwnProfile}
                onClose={() => setShowFullImage(false)}
                onDeleted={() => {
                    setProfileImage(null);
                    setUser(prev => ({ ...prev, photoURL: null }));
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
    notFoundText: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.lg },
    backBtn: { padding: SPACING.lg },
    // Standard Header - no fixed height, no large padding
    gradientHeader: { paddingTop: SPACING.lg, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xs },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
    headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

    // Profile Content - stacked immediately below
    profileContent: { flex: 1, marginTop: 0, paddingTop: SPACING.sm, paddingHorizontal: 20 },
    topSection: { flexDirection: 'row', alignItems: 'center' },
    avatarContainer: { position: 'relative' },
    avatarBorder: { padding: 4, borderRadius: 52, elevation: 0, shadowOpacity: 0 }, // Removed shadow for cleaner look
    avatar: { width: 80, height: 80, borderRadius: 40 }, // Slightly smaller or standard size
    editIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },

    statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginLeft: 20 },
    statItem: { alignItems: 'center', padding: 8 },
    statDivider: { width: 1, height: 30 },
    statValue: { fontSize: 20, fontWeight: '700' },
    statLabel: { fontSize: 13, marginTop: 2 },

    nameSection: { marginTop: 16 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    displayName: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
    displayUsername: { fontSize: 14, marginTop: 2 },

    ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(245, 158, 11, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingScore: { fontSize: 14, fontWeight: '700', color: '#B45309' },
    ratingCount: { fontSize: 13, marginLeft: 6 },

    bioText: { marginTop: 12, fontSize: 15, lineHeight: 22 },

    actionButtonsContainer: { flexDirection: 'row', gap: 12, marginTop: 24 },
    primaryBtn: { flex: 1, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    primaryBtnText: { fontSize: 15, fontWeight: '600' },
    secondaryBtn: { flex: 1, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    secondaryBtnText: { fontSize: 15, fontWeight: '600' },

    contentSection: { marginTop: 24, paddingBottom: 40 },
    tabsHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 16 },
    activeTab: { paddingBottom: 12, borderBottomWidth: 2, width: 60, alignItems: 'center' },

    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 16, fontWeight: '600' },

    // Keep existing modal styles
    fullImageModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '90%', height: '70%' },
    closeFullImage: { position: 'absolute', top: 50, right: 20, padding: SPACING.sm },

    editProfileButton: { marginHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md, marginBottom: SPACING.sm },
    editProfileButtonText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

    postsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md, marginHorizontal: 20 },
    postsContainer: { marginTop: 0 },
    addPostButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

    // Story Modal and others
    storyModalContainer: { flex: 1, backgroundColor: '#000' },
    storyCloseArea: { flex: 1 },
    storyProgressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: SPACING.md, marginTop: SPACING.xl, borderRadius: 2 },
    storyProgress: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
    storyHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
    storyUserAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: SPACING.sm },
    storyUserName: { flex: 1, color: '#fff', fontWeight: FONT_WEIGHT.bold },
    storyFullImage: { flex: 1, width: '100%' },
    storyCaption: { color: '#fff', fontSize: FONT_SIZE.md, textAlign: 'center', padding: SPACING.lg },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl },
    listModalContent: { height: '70%', borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
    modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    editAvatarSection: { alignItems: 'center', marginBottom: SPACING.xl },
    editAvatarGradient: { width: 100, height: 100, borderRadius: 50, padding: 3, justifyContent: 'center', alignItems: 'center' },
    editAvatar: { width: 94, height: 94, borderRadius: 47, backgroundColor: '#fff' },
    changePhotoText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginTop: SPACING.sm },
    inputLabel: { fontSize: FONT_SIZE.xs, marginBottom: SPACING.xs, marginTop: SPACING.md },
    input: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, fontSize: FONT_SIZE.md },
    bioInput: { height: 100, textAlignVertical: 'top' },
    charCount: { fontSize: FONT_SIZE.xs, textAlign: 'right', marginTop: SPACING.xs },
    saveButton: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', marginTop: SPACING.xl },
    saveButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    userItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
    userAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: SPACING.md },
    userInfo: { flex: 1 },
    userItemName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    userItemUsername: { fontSize: FONT_SIZE.sm },
    emptyList: { alignItems: 'center', paddingVertical: SPACING.xxxl },
    emptyListText: { fontSize: FONT_SIZE.sm, marginTop: SPACING.md },
    postsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -1 },
    gridItem: { width: '33.333%', aspectRatio: 1, padding: 1 },
    gridImage: { width: '100%', height: '100%', borderRadius: 2 },
    videoIconOverlay: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 },
    gridEditButton: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },

    // Restored Story Styles
    storyItem: { alignItems: 'center', marginRight: SPACING.md },
    addStoryGradient: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
    storyTitle: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, maxWidth: 70 },
    storyGradient: { width: 72, height: 72, borderRadius: 36, padding: 3, justifyContent: 'center', alignItems: 'center' },
    storyImage: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#fff' },
});

export default UserProfileScreen;
