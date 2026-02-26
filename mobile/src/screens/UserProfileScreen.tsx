import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Dimensions, Alert, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import TripCard from '../components/TripCard';
import ProfilePictureViewer from '../components/ProfilePictureViewer';
import DefaultAvatar from '../components/DefaultAvatar';
import { pickAndUploadImage } from '../utils/imageUpload';

import NotificationService from '../utils/notificationService';
import { useAgeGate } from '../hooks/useAgeGate';
import AgeVerificationModal from '../components/AgeVerificationModal';

import ReportTripModal from '../components/ReportTripModal';

const { width, height } = Dimensions.get('window');

// Fallback user
const FALLBACK_USER = {
    id: 'testuser001',
    displayName: 'Travel Explorer',
    username: 'traveler',
    photoURL: 'https://randomuser.me/api/portraits/men/32.jpg',
    bio: 'Passionate traveler | 50+ trips 🏔️',
    ageVerified: true,
};

const UserProfileScreen = ({ route, navigation }) => {
    const currentUser = auth().currentUser;
    // Default to current user if no param passed (e.g. from Tab bar)
    const userId = route.params?.userId || currentUser?.uid;

    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [user, setUser] = useState(null);

    const [trips, setTrips] = useState([]);

    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    const [showEditTripModal, setShowEditTripModal] = useState(false);

    const [currentTrip, setCurrentTrip] = useState(null);
    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [editTripTitle, setEditTripTitle] = useState('');
    const [editTripLocation, setEditTripLocation] = useState('');
    const [profileImage, setProfileImage] = useState(null);

    const [hostRating, setHostRating] = useState<{ average: number; count: number } | null>(null);
    const [showFullImage, setShowFullImage] = useState(false);
    const [showAgeModal, setShowAgeModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Hoisted Modal State
    const [activeModal, setActiveModal] = useState<'none' | 'report'>('none');
    const [selectedTrip, setSelectedTrip] = useState<any>(null);



    // Header Animation Refs
    const scrollY = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const headerTranslateY = useRef(new Animated.Value(0)).current;
    const HEADER_HEIGHT = 60 + insets.top;

    const { isAgeVerified } = useAgeGate();

    const isOwnProfile = userId === currentUser?.uid;

    const handleScroll = (event: any) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const direction = currentScrollY > lastScrollY.current ? 'down' : 'up';

        // Only hide if we've scrolled past the header height
        if (currentScrollY > HEADER_HEIGHT) {
            if (direction === 'down') {
                // Hide header
                Animated.timing(headerTranslateY, {
                    toValue: -HEADER_HEIGHT,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            } else {
                // Show header
                Animated.timing(headerTranslateY, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            }
        } else if (currentScrollY < 0) {
            // Ensure header is shown when pulling down (bounce)
            Animated.timing(headerTranslateY, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
            }).start();
        }

        lastScrollY.current = currentScrollY;
    };



    // Handle create trip button with age verification check
    const handleCreateButtonPress = () => {
        if (!isAgeVerified) {
            setShowAgeModal(true);
            return;
        }
        setShowCreateModal(true);
    };

    const handleCreateTripManual = () => {
        setShowCreateModal(false);
        navigation.navigate('CreateTrip');
    };

    const handleCreateTripAI = () => {
        setShowCreateModal(false);
        navigation.navigate('AIChat');
    };



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

            });

        return () => unsubscribe();
    }, [userId]);

    const loadUserData = async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            const profileCollection = isOwnProfile ? 'users' : 'public_users';
            const userDoc = await firestore().collection(profileCollection).doc(userId).get();

            if (userDoc.exists) {
                const userData = { id: userDoc.id, ...userDoc.data() };
                setUser(userData);
                setEditName(userData.displayName || '');
                setEditBio(userData.bio || '');
                setEditUsername(userData.username || '');
                setProfileImage(userData.photoURL);

                // Trips are now handled by useEffect subscription

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
                    ageVerified: false,
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
                    ageVerified: false,
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
            // Error upload blocked

            Alert.alert('Error', 'Failed to upload profile image. Please try again.');
        }
    };



    const handleSaveProfile = async () => {
        if (!currentUser) return;

        // Check if username changed and validate uniqueness
        if (editUsername && editUsername !== user?.username) {
            setCheckingUsername(true);
            setUsernameError('');

            try {
                // Check if username is already taken
                const usernameQuery = await firestore()
                    .collection('public_users')
                    .where('username', '==', editUsername.toLowerCase())
                    .get();

                const isTaken = usernameQuery.docs.some(doc => doc.id !== currentUser.uid);

                if (isTaken) {
                    setUsernameError('Username already taken. Try a different one.');
                    setCheckingUsername(false);
                    return;
                }
            } catch (error) {

            }
            setCheckingUsername(false);
        }

        try {
            const updateData: any = {
                displayName: editName,
                bio: editBio,
                photoURL: profileImage,
            };

            if (editUsername) {
                updateData.username = editUsername.toLowerCase();
            }

            await firestore().collection('users').doc(currentUser.uid).update(updateData);

            setUser(prev => ({ ...prev, displayName: editName, bio: editBio, photoURL: profileImage, username: editUsername.toLowerCase() }));
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







    // Content Rendering
    const renderTripGrid = () => (
        <View style={styles.postsContainer}>
            {trips.map((trip) => (
                <TripCard
                    key={trip.id}
                    trip={{
                        ...trip,
                        user: {
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            uid: user.id
                        }
                    }}
                    onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}
                    onReportPress={() => {
                        setSelectedTrip(trip);
                        setActiveModal('report');
                    }}
                    showOptions={false}
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
        <View style={[styles.container, { backgroundColor: colors.background }]}>

            {/* Sticky Collapsible Header */}
            <Animated.View
                style={[
                    styles.stickyHeader,
                    {
                        backgroundColor: colors.background,
                        transform: [{ translateY: headerTranslateY }],
                        zIndex: 100,
                        elevation: 5,
                        paddingTop: insets.top,
                        height: HEADER_HEIGHT,
                    }
                ]}
            >

                <View style={styles.headerRow}>
                    <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.card }]} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    {isOwnProfile && (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.card }]} onPress={handleCreateButtonPress}>
                                <Ionicons name="add" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.card }]} onPress={() => setShowEditModal(true)}>
                                <Ionicons name="create-outline" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: HEADER_HEIGHT }} // Offset for sticky header
            >


                <View style={[styles.profileContent, { backgroundColor: colors.background, marginTop: 0 }]}>

                    {/* Main Profile Header Row: Avatar | Info | Stats */}
                    <View style={styles.headerProfileRow}>

                        {/* 1. Avatar */}
                        <TouchableOpacity onPress={isOwnProfile ? pickProfileImage : () => (profileImage || user.photoURL) ? setShowFullImage(true) : null}>
                            <View style={styles.avatarContainer}>
                                <View style={[styles.avatarBorder, { backgroundColor: colors.background }]}>
                                    <DefaultAvatar
                                        uri={profileImage || user.photoURL}
                                        name={user.displayName}
                                        size={80}
                                        style={styles.avatar}
                                    />
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* 2. Info Column (Name, Username, Rating) */}
                        <View style={styles.userInfoColumn}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>{user.displayName}</Text>
                                {user.ageVerified === true && (
                                    <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginLeft: 4 }} />
                                )}
                            </View>

                            {user.username && <Text style={[styles.displayUsername, { color: colors.textSecondary }]}>@{user.username}</Text>}

                            {hostRating && (
                                <View style={styles.ratingContainer}>
                                    <Ionicons name="star" size={12} color="#F59E0B" />
                                    <Text style={styles.ratingScore}>{hostRating.average}</Text>
                                    <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>({hostRating.count})</Text>
                                </View>
                            )}
                        </View>

                        {/* 3. Stats Column (Trips) */}
                        <TouchableOpacity style={styles.statsColumn} onPress={() => isOwnProfile && navigation.navigate('MyTrips', { initialTab: 'completed' })}>
                            <Text style={[styles.statValue, { color: colors.text }]}>{trips.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Trips</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Bio - Below the header row */}
                    {user.bio ? (
                        <Text style={[styles.bioText, { color: colors.text }]}>{user.bio}</Text>
                    ) : null}

                    {/* Action Buttons */}
                    {!isOwnProfile && (
                        <View style={styles.actionButtonsContainer}>
                            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleMessage}>
                                <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Message</Text>
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



            {/* Edit Profile Modal - Fullscreen */}
            <Modal visible={showEditModal} animationType="slide">
                <SafeAreaView style={[styles.fullscreenModal, { backgroundColor: colors.background }]} edges={['top']}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
                        <TouchableOpacity onPress={() => setShowEditModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.editScrollView}
                        contentContainerStyle={styles.editScrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <TouchableOpacity style={styles.editAvatarSection} onPress={pickProfileImage}>
                            <View style={styles.avatarContainer}>
                                <DefaultAvatar
                                    uri={profileImage || user?.photoURL}
                                    name={user?.displayName}
                                    size={100}
                                    style={styles.editAvatar}
                                />
                                <View style={[styles.editIconBadge, { backgroundColor: colors.primary, right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16 }]}>
                                    <Ionicons name="camera" size={18} color="#fff" />
                                </View>
                            </View>
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

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Username</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: usernameError ? '#EF4444' : colors.border }]}
                            value={editUsername}
                            onChangeText={(text) => {
                                setEditUsername(text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
                                setUsernameError('');
                            }}
                            placeholder="username"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="none"
                            maxLength={20}
                        />
                        {usernameError ? (
                            <Text style={styles.errorText}>{usernameError}</Text>
                        ) : (
                            <Text style={[styles.usernameHint, { color: colors.textSecondary }]}>Letters, numbers, underscores only</Text>
                        )}

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

                        <TouchableOpacity onPress={handleSaveProfile} style={{ marginBottom: 40 }}>
                            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.saveButton}>
                                <Text style={styles.saveButtonText}>Save Changes</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
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

            {/* Age Verification Modal */}
            <AgeVerificationModal
                visible={showAgeModal}
                onClose={() => setShowAgeModal(false)}
                action="create or join a trip"
            />


            <ReportTripModal
                visible={activeModal === 'report'}
                onClose={() => {
                    setActiveModal('none');
                    setSelectedTrip(null);
                }}
                trip={selectedTrip}
            />

            {/* Create Selection Modal */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCreateModal(false)}
                >
                    <Animatable.View animation="fadeInUp" duration={300} style={[styles.createModalContent, { backgroundColor: colors.background }]}>
                        <Text style={[styles.createModalTitle, { color: colors.text }]}>Create New Trip ✈️</Text>

                        <TouchableOpacity
                            style={[styles.createOption, { backgroundColor: colors.card }]}
                            onPress={handleCreateTripManual}
                        >
                            <View style={[styles.createOptionIcon, { backgroundColor: '#E0E7FF' }]}>
                                <Ionicons name="create-outline" size={24} color="#6366F1" />
                            </View>
                            <View style={styles.createOptionText}>
                                <Text style={[styles.createOptionTitle, { color: colors.text }]}>Create a Trip Manually</Text>
                                <Text style={[styles.createOptionDesc, { color: colors.textSecondary }]}>Fill in details and add your own photos</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.createOption, { backgroundColor: colors.card }]}
                            onPress={() => {
                                setShowCreateModal(false);
                                navigation.navigate('App', { screen: 'AITripPlanner' });
                            }}
                        >
                            <View style={[styles.createOptionIcon, { backgroundColor: '#EDE9FE' }]}>
                                <View style={styles.headerAvatarContainer}>
                                    <Image
                                        source={require('../../assets/Tripzi AI.png')}
                                        style={styles.headerAvatarImage}
                                    />
                                </View>
                            </View>
                            <View style={styles.createOptionText}>
                                <Text style={[styles.createOptionTitle, { color: colors.text }]}>Create with Tripzi AI</Text>
                                <Text style={[styles.createOptionDesc, { color: colors.textSecondary }]}>Let AI plan and generate images for you</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </Animatable.View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};


const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
    notFoundText: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.lg },
    backBtn: { padding: SPACING.lg },
    // Standard Header - no fixed height, no large padding
    gradientHeader: { paddingTop: SPACING.lg, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xs },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    headerButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },

    // Profile Content - stacked immediately below
    // Profile Content - stacked immediately below
    profileContent: { flex: 1, marginTop: 0, paddingHorizontal: 20 },

    headerProfileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },

    avatarContainer: { position: 'relative' },
    avatarBorder: { borderRadius: 40 },
    avatar: { width: 80, height: 80, borderRadius: 40 },
    editIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },

    userInfoColumn: { flex: 1, marginLeft: 16, justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    displayName: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
    displayUsername: { fontSize: 14, marginTop: 2 },

    ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    ratingScore: { fontSize: 13, fontWeight: '700', color: '#B45309' },
    ratingCount: { fontSize: 12 },

    statsColumn: { alignItems: 'center', paddingLeft: 10 },
    statValue: { fontSize: 18, fontWeight: '700' },
    statLabel: { fontSize: 12, marginTop: 2 },

    bioText: { marginTop: 16, fontSize: 15, lineHeight: 22 },

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
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl, paddingHorizontal: SPACING.xl },
    modalTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
    },
    headerTitle: {

        fontSize: 22,
        fontWeight: FONT_WEIGHT.bold,
    },
    stickyHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md, // Add explicit top padding since we removed SafeAreaView wrapper
        paddingBottom: SPACING.sm,
    },
    editAvatarSection: { alignItems: 'center', marginBottom: SPACING.xl },
    editAvatarGradient: { width: 100, height: 100, borderRadius: 50, padding: 3, justifyContent: 'center', alignItems: 'center' },
    editAvatar: { borderRadius: 50 },
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



    // Default Avatar styles
    defaultAvatar: { justifyContent: 'center', alignItems: 'center' },
    defaultAvatarText: { color: '#fff', fontWeight: FONT_WEIGHT.bold },

    // Username validation styles
    errorText: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
    usernameHint: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },

    // Fullscreen edit modal styles
    fullscreenModal: { flex: 1 },
    editScrollView: { flex: 1 },
    editScrollContent: { padding: SPACING.xl },

    // Create Modal Styles
    createModalContent: { width: '100%', borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxl + SPACING.xl },
    createModalTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.lg, textAlign: 'center' },
    createOption: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md },
    createOptionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
    createOptionText: { flex: 1 },
    createOptionTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: 2 },
    createOptionDesc: { fontSize: FONT_SIZE.sm },


    //
    headerAvatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerAvatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
});

export default UserProfileScreen;
