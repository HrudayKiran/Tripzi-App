import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    FlatList,
    ActivityIndicator,
    Modal,
    Dimensions,
    Animated,
    TouchableWithoutFeedback,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { formatDistanceToNow } from 'date-fns';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Story {
    id: string;
    userId: string;
    userDisplayName: string;
    userPhotoURL?: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    viewedBy: string[];
    viewCount: number;
    createdAt: any;
    expiresAt: any;
}

interface StoryGroup {
    userId: string;
    userDisplayName: string;
    userPhotoURL?: string;
    stories: Story[];
    hasUnviewed: boolean;
}

const StoriesScreen = ({ navigation, route }) => {
    const { colors } = useTheme();

    // Use state for currentUser to properly handle auth state
    const [currentUser, setCurrentUser] = useState(auth().currentUser);

    // Listen for auth state changes
    React.useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged((user) => {
            console.log('📸 [STORY AUTH] Auth state changed:', user?.uid || 'null');
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
    const [myStories, setMyStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Story viewer state
    const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Edit story state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editCaption, setEditCaption] = useState('');
    const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        loadStories();
    }, [currentUser]); // Reload when user changes

    const loadStories = async () => {
        if (!currentUser) return;
        setLoading(true);

        try {
            const now = new Date();

            // Get stories from followed users
            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const following = userDoc.data()?.following || [];
            const usersToFetch = [currentUser.uid, ...following];

            // Simplified query - only filter by userId, then filter locally
            // This avoids compound index issues with 'in' + range queries
            let storiesSnapshot;
            if (usersToFetch.length === 0) {
                storiesSnapshot = { docs: [] };
            } else {
                storiesSnapshot = await firestore()
                    .collection('stories')
                    .where('userId', 'in', usersToFetch.slice(0, 10)) // Firestore limit
                    .get();
            }

            const storiesMap = new Map<string, StoryGroup>();

            storiesSnapshot.docs.forEach((doc) => {
                const story = { id: doc.id, ...doc.data() } as Story;

                // Filter expired stories locally
                const expiresAt = story.expiresAt?.toDate ? story.expiresAt.toDate() : new Date(story.expiresAt);
                if (expiresAt <= now) return; // Skip expired stories

                const existing = storiesMap.get(story.userId);

                if (existing) {
                    existing.stories.push(story);
                    if (!story.viewedBy?.includes(currentUser.uid)) {
                        existing.hasUnviewed = true;
                    }
                } else {
                    storiesMap.set(story.userId, {
                        userId: story.userId,
                        userDisplayName: story.userDisplayName,
                        userPhotoURL: story.userPhotoURL,
                        stories: [story],
                        hasUnviewed: !story.viewedBy?.includes(currentUser.uid),
                    });
                }
            });

            // Sort stories within each group by createdAt
            storiesMap.forEach((group) => {
                group.stories.sort((a, b) => {
                    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                    return bTime - aTime;
                });
            });

            // Separate my stories
            const myGroup = storiesMap.get(currentUser.uid);
            if (myGroup) {
                setMyStories(myGroup.stories);
                storiesMap.delete(currentUser.uid);

                // Check if we should auto-open my story
                if (route?.params?.viewMyStory) {
                    setViewingGroup(myGroup);
                    // Reset params so it doesn't open again on reload
                    navigation.setParams({ viewMyStory: undefined });
                }
            } else {
                setMyStories([]);
            }

            // Sort: unviewed first
            const groups = Array.from(storiesMap.values()).sort((a, b) => {
                if (a.hasUnviewed && !b.hasUnviewed) return -1;
                if (!a.hasUnviewed && b.hasUnviewed) return 1;
                return 0;
            });

            setStoryGroups(groups);
        } catch (error) {
            console.error('Failed to load stories:', error);
        } finally {
            setLoading(false);
        }
    };

    const uploadStory = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
                await createStory(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Story picker error:', error);
        }
    };

    const takePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
                await createStory(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Camera error:', error);
        }
    };

    const createStory = async (imageUri: string) => {
        if (!currentUser) return;
        setUploading(true);

        try {
            // Upload image
            const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const storageRef = storage().ref(`stories/${currentUser.uid}/${filename}`);
            await storageRef.putFile(imageUri);
            const downloadUrl = await storageRef.getDownloadURL();

            // Get user data
            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();

            // Create story with 24h expiry
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            await firestore().collection('stories').add({
                userId: currentUser.uid,
                userDisplayName: userData?.displayName || currentUser.displayName || 'User',
                userPhotoURL: userData?.photoURL || currentUser.photoURL || '',
                mediaUrl: downloadUrl,
                mediaType: 'image',
                viewedBy: [],
                viewCount: 0,
                createdAt: firestore.FieldValue.serverTimestamp(),
                expiresAt: firestore.Timestamp.fromDate(expiresAt),
            });

            loadStories();
        } catch (error) {
            console.error('Failed to create story:', error);
        } finally {
            setUploading(false);
        }
    };

    const openStoryViewer = (group: StoryGroup) => {
        setViewingGroup(group);
        setCurrentStoryIndex(0);
        setPaused(false);
        progressAnim.setValue(0);
        startProgress(group.stories[0]);
    };

    const startProgress = (story: Story) => {
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 5000, // 5 seconds per story
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished && viewingGroup) {
                goToNextStory();
            }
        });

        // Mark as viewed
        if (currentUser && !story.viewedBy.includes(currentUser.uid)) {
            firestore()
                .collection('stories')
                .doc(story.id)
                .update({
                    viewedBy: firestore.FieldValue.arrayUnion(currentUser.uid),
                    viewCount: firestore.FieldValue.increment(1),
                })
                .catch(() => { });
        }
    };

    const goToNextStory = () => {
        if (!viewingGroup) return;

        if (currentStoryIndex < viewingGroup.stories.length - 1) {
            const nextIndex = currentStoryIndex + 1;
            setCurrentStoryIndex(nextIndex);
            progressAnim.setValue(0);
            startProgress(viewingGroup.stories[nextIndex]);
        } else {
            // Move to next group or close
            const currentGroupIndex = storyGroups.findIndex((g) => g.userId === viewingGroup.userId);
            if (currentGroupIndex < storyGroups.length - 1) {
                const nextGroup = storyGroups[currentGroupIndex + 1];
                setViewingGroup(nextGroup);
                setCurrentStoryIndex(0);
                progressAnim.setValue(0);
                startProgress(nextGroup.stories[0]);
            } else {
                closeStoryViewer();
            }
        }
    };

    const goToPrevStory = () => {
        if (!viewingGroup) return;

        if (currentStoryIndex > 0) {
            const prevIndex = currentStoryIndex - 1;
            setCurrentStoryIndex(prevIndex);
            progressAnim.setValue(0);
            startProgress(viewingGroup.stories[prevIndex]);
        } else {
            // Move to prev group
            const currentGroupIndex = storyGroups.findIndex((g) => g.userId === viewingGroup.userId);
            if (currentGroupIndex > 0) {
                const prevGroup = storyGroups[currentGroupIndex - 1];
                setViewingGroup(prevGroup);
                const lastIndex = prevGroup.stories.length - 1;
                setCurrentStoryIndex(lastIndex);
                progressAnim.setValue(0);
                startProgress(prevGroup.stories[lastIndex]);
            }
        }
    };

    const closeStoryViewer = () => {
        progressAnim.stopAnimation();
        setViewingGroup(null);
        setCurrentStoryIndex(0);
    };

    // Edit Story
    const openEditModal = (story: Story) => {
        progressAnim.stopAnimation();
        setPaused(true);
        setEditingStoryId(story.id);
        setEditCaption(story.caption || '');
        setShowEditModal(true);
    };

    const saveStoryEdit = async () => {
        if (!editingStoryId) return;
        setSavingEdit(true);
        try {
            await firestore().collection('stories').doc(editingStoryId).update({
                caption: editCaption.trim(),
            });
            setShowEditModal(false);
            loadStories();
            Alert.alert('Success', 'Story updated!');
        } catch (error) {
            Alert.alert('Error', 'Failed to update story.');
        } finally {
            setSavingEdit(false);
        }
    };

    const replaceStoryImage = async () => {
        if (!editingStoryId) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
                setSavingEdit(true);
                // Upload new image
                const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
                const storageRef = storage().ref(`stories/${currentUser?.uid}/${filename}`);
                await storageRef.putFile(result.assets[0].uri);
                const downloadUrl = await storageRef.getDownloadURL();

                // Update story
                await firestore().collection('stories').doc(editingStoryId).update({
                    mediaUrl: downloadUrl,
                });

                setShowEditModal(false);
                loadStories();
                Alert.alert('Success', 'Story image updated!');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update image.');
        } finally {
            setSavingEdit(false);
        }
    };

    // Delete Story
    const deleteStory = async (storyId: string) => {
        Alert.alert(
            'Delete Story',
            'Are you sure you want to delete this story?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await firestore().collection('stories').doc(storyId).delete();
                            closeStoryViewer();
                            loadStories();
                            Alert.alert('Deleted', 'Story has been removed.');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete story.');
                        }
                    },
                },
            ]
        );
    };

    const renderStoryItem = ({ item }: { item: StoryGroup }) => (
        <TouchableOpacity style={styles.storyItem} onPress={() => openStoryViewer(item)}>
            <View style={[styles.storyRing, item.hasUnviewed ? styles.unviewedRing : styles.viewedRing]}>
                {item.userPhotoURL ? (
                    <Image source={{ uri: item.userPhotoURL }} style={styles.storyAvatar} />
                ) : (
                    <View style={[styles.storyAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                        <Text style={styles.storyAvatarText}>{item.userDisplayName?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                )}
            </View>
            <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
                {item.userDisplayName.split(' ')[0]}
            </Text>
        </TouchableOpacity>
    );

    const renderMyStory = () => (
        <TouchableOpacity
            style={styles.storyItem}
            onPress={() => {
                if (myStories.length > 0) {
                    openStoryViewer({
                        userId: currentUser?.uid || '',
                        userDisplayName: 'Your Story',
                        userPhotoURL: currentUser?.photoURL || undefined,
                        stories: myStories,
                        hasUnviewed: false,
                    });
                } else {
                    uploadStory();
                }
            }}
        >
            <View style={styles.myStoryContainer}>
                {currentUser?.photoURL ? (
                    <Image source={{ uri: currentUser.photoURL }} style={styles.storyAvatar} />
                ) : (
                    <View style={[styles.storyAvatarPlaceholder, { backgroundColor: colors.card }]}>
                        <Ionicons name="person" size={24} color={colors.textSecondary} />
                    </View>
                )}
                <View style={[styles.addStoryBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={14} color="#fff" />
                </View>
            </View>
            <Text style={[styles.storyName, { color: colors.text }]}>
                {myStories.length > 0 ? 'Your Story' : 'Add Story'}
            </Text>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Stories</Text>
                <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Uploading indicator */}
            {uploading && (
                <View style={[styles.uploadingBar, { backgroundColor: colors.primary }]}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.uploadingText}>Uploading story...</Text>
                </View>
            )}

            {/* Stories list */}
            <FlatList
                data={storyGroups}
                renderItem={renderStoryItem}
                keyExtractor={(item) => item.userId}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesList}
                ListHeaderComponent={renderMyStory}
                ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No stories from people you follow
                    </Text>
                }
            />

            {/* Story Viewer Modal */}
            <Modal visible={!!viewingGroup} animationType="fade" transparent>
                {viewingGroup && (
                    <View style={styles.viewerContainer}>
                        {/* Progress bars */}
                        <SafeAreaView style={styles.progressContainer}>
                            <View style={styles.progressBars}>
                                {viewingGroup.stories.map((_, index) => (
                                    <View key={index} style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                        {index < currentStoryIndex && (
                                            <View style={[styles.progressFill, { width: '100%' }]} />
                                        )}
                                        {index === currentStoryIndex && (
                                            <Animated.View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        width: progressAnim.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: ['0%', '100%'],
                                                        }),
                                                    },
                                                ]}
                                            />
                                        )}
                                    </View>
                                ))}
                            </View>

                            {/* Header */}
                            <View style={styles.viewerHeader}>
                                {viewingGroup.userPhotoURL ? (
                                    <Image source={{ uri: viewingGroup.userPhotoURL }} style={styles.viewerAvatar} />
                                ) : (
                                    <View style={styles.viewerAvatarPlaceholder}>
                                        <Text style={styles.viewerAvatarText}>
                                            {viewingGroup.userDisplayName?.charAt(0)?.toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.viewerInfo}>
                                    <Text style={styles.viewerName}>{viewingGroup.userDisplayName}</Text>
                                    <Text style={styles.viewerTime}>
                                        {viewingGroup.stories[currentStoryIndex]?.createdAt &&
                                            formatDistanceToNow(
                                                viewingGroup.stories[currentStoryIndex].createdAt.toDate
                                                    ? viewingGroup.stories[currentStoryIndex].createdAt.toDate()
                                                    : new Date(viewingGroup.stories[currentStoryIndex].createdAt),
                                                { addSuffix: true }
                                            )}
                                    </Text>
                                </View>
                                <TouchableOpacity style={styles.closeButton} onPress={closeStoryViewer}>
                                    <Ionicons name="close" size={28} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>

                        {/* Story image */}
                        <Image
                            source={{ uri: viewingGroup.stories[currentStoryIndex]?.mediaUrl }}
                            style={styles.storyImage}
                            resizeMode="contain"
                        />

                        {/* Touch areas for navigation */}
                        <View style={styles.touchAreas}>
                            <TouchableWithoutFeedback onPress={goToPrevStory}>
                                <View style={styles.touchAreaLeft} />
                            </TouchableWithoutFeedback>
                            <TouchableWithoutFeedback onPress={goToNextStory}>
                                <View style={styles.touchAreaRight} />
                            </TouchableWithoutFeedback>
                        </View>

                        {/* View count and Edit/Delete for own stories */}
                        {viewingGroup.userId === currentUser?.uid && (
                            <View style={styles.ownStoryActions}>
                                <View style={styles.viewCountContainer}>
                                    <Ionicons name="eye" size={20} color="#fff" />
                                    <Text style={styles.viewCountText}>
                                        {viewingGroup.stories[currentStoryIndex]?.viewCount || 0} views
                                    </Text>
                                </View>
                                <View style={styles.storyActionButtons}>
                                    <TouchableOpacity
                                        style={styles.storyActionButton}
                                        onPress={() => openEditModal(viewingGroup.stories[currentStoryIndex])}
                                    >
                                        <Ionicons name="pencil" size={22} color="#fff" />
                                        <Text style={styles.storyActionText}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.storyActionButton, { backgroundColor: 'rgba(239,68,68,0.8)' }]}
                                        onPress={() => deleteStory(viewingGroup.stories[currentStoryIndex].id)}
                                    >
                                        <Ionicons name="trash" size={22} color="#fff" />
                                        <Text style={styles.storyActionText}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </Modal>

            {/* Edit Story Modal */}
            <Modal visible={showEditModal} animationType="slide" transparent>
                <View style={styles.editModalContainer}>
                    <View style={[styles.editModalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.editModalHeader}>
                            <Text style={[styles.editModalTitle, { color: colors.text }]}>Edit Story</Text>
                            <TouchableOpacity onPress={() => { setShowEditModal(false); setPaused(false); }}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Caption</Text>
                        <TextInput
                            style={[styles.editCaptionInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                            value={editCaption}
                            onChangeText={setEditCaption}
                            placeholder="Add a caption..."
                            placeholderTextColor={colors.textSecondary}
                            multiline
                        />

                        <TouchableOpacity
                            style={[styles.replaceImageButton, { backgroundColor: colors.card }]}
                            onPress={replaceStoryImage}
                            disabled={savingEdit}
                        >
                            <Ionicons name="image" size={20} color={colors.primary} />
                            <Text style={[styles.replaceImageText, { color: colors.primary }]}>Replace Image</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.saveEditButton, { backgroundColor: colors.primary }]}
                            onPress={saveStoryEdit}
                            disabled={savingEdit}
                        >
                            {savingEdit ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveEditText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1 },
    headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    cameraButton: { padding: SPACING.sm },
    uploadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm, gap: SPACING.sm },
    uploadingText: { color: '#fff', fontSize: FONT_SIZE.sm },
    storiesList: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg },
    storyItem: { alignItems: 'center', marginRight: SPACING.lg, width: 70 },
    storyRing: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
    unviewedRing: { borderColor: '#8B5CF6' },
    viewedRing: { borderColor: '#6B7280' },
    storyAvatar: { width: 58, height: 58, borderRadius: 29 },
    storyAvatarPlaceholder: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
    storyAvatarText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    storyName: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, textAlign: 'center' },
    myStoryContainer: { position: 'relative' },
    addStoryBadge: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    emptyText: { paddingHorizontal: SPACING.lg },
    // Viewer
    viewerContainer: { flex: 1, backgroundColor: '#000' },
    progressContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    progressBars: { flexDirection: 'row', paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm, gap: 4 },
    progressBar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#fff' },
    viewerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
    viewerAvatar: { width: 36, height: 36, borderRadius: 18 },
    viewerAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#444', justifyContent: 'center', alignItems: 'center' },
    viewerAvatarText: { color: '#fff', fontWeight: FONT_WEIGHT.bold },
    viewerInfo: { flex: 1, marginLeft: SPACING.sm },
    viewerName: { color: '#fff', fontWeight: FONT_WEIGHT.semibold },
    viewerTime: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZE.xs },
    closeButton: { padding: SPACING.sm },
    storyImage: { flex: 1, width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
    touchAreas: { position: 'absolute', top: 100, bottom: 100, left: 0, right: 0, flexDirection: 'row' },
    touchAreaLeft: { flex: 1 },
    touchAreaRight: { flex: 1 },
    viewCountContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    viewCountText: { color: '#fff', fontSize: FONT_SIZE.sm },
    ownStoryActions: { position: 'absolute', bottom: 40, left: 0, right: 0, paddingHorizontal: SPACING.lg },
    storyActionButtons: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.md, marginTop: SPACING.md },
    storyActionButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
    storyActionText: { color: '#fff', fontWeight: FONT_WEIGHT.semibold },
    // Edit Modal
    editModalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    editModalContent: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl },
    editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    editModalTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    editLabel: { fontSize: FONT_SIZE.sm, marginBottom: SPACING.xs },
    editCaptionInput: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, minHeight: 80, textAlignVertical: 'top', marginBottom: SPACING.lg },
    replaceImageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.lg },
    replaceImageText: { fontWeight: FONT_WEIGHT.semibold },
    saveEditButton: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
    saveEditText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },
});

export default StoriesScreen;
