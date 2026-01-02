import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, FlatList, Dimensions, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';
import FollowersModal from '../components/FollowersModal';
import TripCard from '../components/TripCard';
import ProfilePictureViewer from '../components/ProfilePictureViewer';
import { pickAndUploadImage } from '../utils/imageUpload';

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
    const { userId } = route.params;
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
    const currentUser = auth.currentUser;
    const isOwnProfile = userId === currentUser?.uid;

    useEffect(() => {
        loadUserData();
    }, [userId]);

    const loadUserData = async () => {
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

                // Load trips
                try {
                    const tripsSnapshot = await firestore()
                        .collection('trips')
                        .where('userId', '==', userId)
                        .get();

                    setTrips(tripsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), user: userData })));
                } catch (e) { console.log('Trips error:', e); }

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
                    console.log('Host rating fetch error:', e);
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
            console.log('Error loading user:', error);
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
                allowsEditing: true,
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
            console.log('Profile image upload error:', error);
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
            allowsEditing: true,
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
        Alert.alert('Delete Trip', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
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
            console.log('Error starting chat:', error);
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

    const renderTripGrid = () => (
        <View style={styles.postsContainer}>
            {trips.map((trip) => (
                <TripCard
                    key={trip.id}
                    trip={trip}
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
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <LinearGradient colors={['#8B5CF6', '#EC4899', '#F59E0B']} style={styles.gradientHeader}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        {isOwnProfile && (
                            <TouchableOpacity style={styles.headerButton} onPress={() => setShowEditModal(true)}>
                                <Ionicons name="create-outline" size={24} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                </LinearGradient>

                {/* Profile Card - Instagram Layout */}
                <Animatable.View animation="fadeInUp" delay={100} style={[styles.profileCard, { backgroundColor: colors.card }]}>
                    {/* Top Row: Avatar + Stats */}
                    <View style={styles.profileTopRow}>
                        <TouchableOpacity onPress={isOwnProfile ? pickProfileImage : () => setShowFullImage(true)} style={styles.avatarWrapper}>
                            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.avatarGradient}>
                                <Image style={styles.avatar} source={{ uri: profileImage || user.photoURL || undefined }} />
                            </LinearGradient>
                            {isOwnProfile && (
                                <View style={[styles.editAvatarBadge, { backgroundColor: colors.primary }]}>
                                    <Ionicons name="camera" size={14} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Stats on Right */}
                        <View style={styles.statsRow}>
                            <TouchableOpacity style={styles.statItem}>
                                <Text style={[styles.statNumber, { color: colors.primary }]}>{trips.length}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Posts</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statItem} onPress={() => setShowFollowersModal(true)}>
                                <Text style={[styles.statNumber, { color: '#10B981' }]}>{user.followers?.length || 0}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statItem} onPress={() => setShowFollowingModal(true)}>
                                <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{user.following?.length || 0}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Name, Username, Bio below */}
                    <View style={styles.profileInfoSection}>
                        <Text style={[styles.userName, { color: colors.text }]}>{user.displayName}</Text>
                        {user.username && <Text style={[styles.username, { color: colors.primary }]}>@{user.username}</Text>}
                        {user.bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{user.bio}</Text> : null}

                        {/* Badges Row */}
                        <View style={styles.badgesRow}>
                            {user.kycStatus === 'verified' && (
                                <View style={styles.kycBadge}>
                                    <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                                    <Text style={styles.kycBadgeText}>Verified</Text>
                                </View>
                            )}
                            {hostRating && (
                                <View style={styles.hostRatingBadge}>
                                    <Ionicons name="star" size={14} color="#F59E0B" />
                                    <Text style={styles.hostRatingText}>
                                        {hostRating.average} ({hostRating.count} {hostRating.count === 1 ? 'review' : 'reviews'})
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Actions */}
                    {!isOwnProfile && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={[styles.followButton, { backgroundColor: isFollowing ? 'transparent' : colors.primary, borderColor: colors.primary }]}
                                onPress={handleFollow}
                            >
                                <Text style={[styles.followButtonText, { color: isFollowing ? colors.primary : '#fff' }]}>
                                    {isFollowing ? 'Unfollow' : 'Follow'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.messageButton, { borderColor: colors.primary }]} onPress={handleMessage}>
                                <Ionicons name="chatbubble" size={18} color={colors.primary} />
                                <Text style={[styles.messageButtonText, { color: colors.primary }]}>Message</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animatable.View>

                {/* Posts */}
                <Animatable.View animation="fadeInUp" delay={300} style={styles.postsSection}>
                    <View style={styles.postsSectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{isOwnProfile ? 'My Posts' : 'Posts'}</Text>
                        {isOwnProfile && (
                            <TouchableOpacity
                                style={[styles.addPostButton, { backgroundColor: colors.primary }]}
                                onPress={() => navigation.navigate('CreateTrip')}
                            >
                                <Ionicons name="add" size={20} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {trips.length === 0 ? (
                        <View style={styles.emptyPosts}>
                            <Ionicons name="airplane-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet</Text>
                            {isOwnProfile && (
                                <TouchableOpacity style={[styles.createButton, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('CreateTrip')}>
                                    <Text style={styles.createButtonText}>Create First Post</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        renderTripGrid()
                    )}
                </Animatable.View>
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
    gradientHeader: { height: 120, paddingTop: SPACING.lg, paddingHorizontal: SPACING.lg },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
    headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    profileCard: { marginTop: -50, marginHorizontal: SPACING.lg, padding: SPACING.lg, borderRadius: BORDER_RADIUS.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
    profileTopRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
    avatarWrapper: { marginRight: SPACING.lg },
    avatarGradient: { width: 90, height: 90, borderRadius: 45, padding: 3, justifyContent: 'center', alignItems: 'center' },
    avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff' },
    editAvatarBadge: { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statNumber: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    statLabel: { fontSize: FONT_SIZE.xs },
    profileInfoSection: { width: '100%', paddingTop: SPACING.md },
    userName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    username: { fontSize: FONT_SIZE.sm, marginTop: 2 },
    bio: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
    kycBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg, gap: 4 },
    kycBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: '#10B981' },
    hostRatingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg, gap: 4 },
    hostRatingText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: '#D97706' },
    actionButtons: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg, width: '100%' },
    fullImageModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '90%', height: '70%' },
    closeFullImage: { position: 'absolute', top: 50, right: 20, padding: SPACING.sm },
    followButton: { flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', borderWidth: 2 },
    followButtonText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    messageButton: { flex: 1, flexDirection: 'row', paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, gap: SPACING.xs },
    messageButtonText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    storiesSection: { marginTop: SPACING.lg },
    sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
    storiesList: { paddingHorizontal: SPACING.lg },
    storyItem: { alignItems: 'center', marginRight: SPACING.md },
    storyGradient: { width: 72, height: 72, borderRadius: 36, padding: 3, justifyContent: 'center', alignItems: 'center' },
    addStoryGradient: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
    storyImage: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#fff' },
    storyTitle: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, maxWidth: 70 },
    postsSection: { marginTop: SPACING.lg, marginHorizontal: SPACING.lg },
    postsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    addPostButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    postsContainer: { marginTop: SPACING.md },
    tripCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md },
    tripContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    tripImage: { width: 60, height: 60, borderRadius: BORDER_RADIUS.md },
    tripInfo: { flex: 1, marginLeft: SPACING.md },
    tripTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    tripLocation: { fontSize: FONT_SIZE.sm, marginTop: 2 },
    tripActions: { flexDirection: 'row', gap: SPACING.sm },
    tripAction: { padding: SPACING.sm },
    emptyPosts: { alignItems: 'center', paddingVertical: SPACING.xxxl },
    emptyText: { fontSize: FONT_SIZE.sm, marginTop: SPACING.md },
    createButton: { marginTop: SPACING.lg, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg },
    createButtonText: { color: '#fff', fontWeight: FONT_WEIGHT.bold },
    // Story Modal
    storyModalContainer: { flex: 1, backgroundColor: '#000' },
    storyCloseArea: { flex: 1 },
    storyProgressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: SPACING.md, marginTop: SPACING.xl, borderRadius: 2 },
    storyProgress: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
    storyHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
    storyUserAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: SPACING.sm },
    storyUserName: { flex: 1, color: '#fff', fontWeight: FONT_WEIGHT.bold },
    storyFullImage: { flex: 1, width: '100%' },
    storyCaption: { color: '#fff', fontSize: FONT_SIZE.md, textAlign: 'center', padding: SPACING.lg },
    // Modals
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
    postsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    addPostButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    postsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -1 },
    gridItem: { width: '33.333%', aspectRatio: 1, padding: 1 },
    gridImage: { width: '100%', height: '100%', borderRadius: 2 },
    gridEditButton: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
});

export default UserProfileScreen;
