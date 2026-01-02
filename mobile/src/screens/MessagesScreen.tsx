import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Modal, Animated, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const { width, height } = Dimensions.get('window');

const MessagesScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const [chats, setChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [stories, setStories] = useState<any[]>([]);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [currentStory, setCurrentStory] = useState<any>(null);
    const storyProgress = useRef(new Animated.Value(0)).current;
    // Group chat creation
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [groupSearchResults, setGroupSearchResults] = useState<any[]>([]);
    const [showMenuDropdown, setShowMenuDropdown] = useState(false);
    const currentUser = auth().currentUser;

    useEffect(() => {
        loadChats();
        loadStories();
    }, []);

    const loadChats = async () => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        try {
            const chatsRef = firestore()
                .collection('chats')
                .where('participants', 'array-contains', currentUser.uid)
                .orderBy('lastMessageTimestamp', 'desc');

            const unsubscribe = chatsRef.onSnapshot(
                async (snapshot) => {
                    if (snapshot.empty) {
                        setChats([]);
                        setLoading(false);
                        return;
                    }

                    const chatsData = await Promise.all(
                        snapshot.docs.map(async (doc) => {
                            const chat = { id: doc.id, ...doc.data() };

                            // Get other user's info
                            if (!chat.isGroupChat) {
                                const otherUserId = chat.participants?.find(p => p !== currentUser.uid);
                                if (otherUserId) {
                                    try {
                                        const userDoc = await firestore().collection('users').doc(otherUserId).get();
                                        if (userDoc.exists) {
                                            chat.otherUser = userDoc.data();
                                        }
                                    } catch (e) {
                                        chat.otherUser = { displayName: 'User', photoURL: null };
                                    }
                                }
                            }
                            return chat;
                        })
                    );
                    setChats(chatsData);
                    setLoading(false);
                },
                (error) => {
                    // Error handled silently
                    setLoading(false);
                }
            );

            return () => unsubscribe();
        } catch (error) {
            // Error handled silently
            setLoading(false);
        }
    };

    // Load stories (posts from last 24 hours)
    const loadStories = async () => {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const storiesSnapshot = await firestore()
                .collection('trips')
                .where('createdAt', '>=', firestore.Timestamp.fromDate(twentyFourHoursAgo))
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            const storiesData = await Promise.all(
                storiesSnapshot.docs.map(async (doc) => {
                    const trip = { id: doc.id, ...doc.data() };
                    // Get user info
                    try {
                        const userDoc = await firestore().collection('users').doc(trip.userId).get();
                        if (userDoc.exists) {
                            trip.user = userDoc.data();
                        }
                    } catch (e) {
                        trip.user = { displayName: 'User', photoURL: null };
                    }
                    return trip;
                })
            );

            // Group by user
            const groupedStories = storiesData.reduce((acc, story) => {
                const userId = story.userId;
                if (!acc[userId]) {
                    acc[userId] = {
                        userId,
                        user: story.user,
                        stories: []
                    };
                }
                acc[userId].stories.push(story);
                return acc;
            }, {});

            setStories(Object.values(groupedStories));
        } catch {
            // Stories load failed silently
        }
    };

    const openStory = (storyGroup: any) => {
        setCurrentStory({ ...storyGroup, currentIndex: 0 });
        setShowStoryModal(true);
        storyProgress.setValue(0);
        Animated.timing(storyProgress, {
            toValue: 1,
            duration: 5000,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) closeStory();
        });
    };

    const closeStory = () => {
        storyProgress.stopAnimation();
        setShowStoryModal(false);
        setCurrentStory(null);
    };

    // Group chat functions
    const searchUsersForGroup = async (query: string) => {
        setGroupSearchQuery(query);
        if (query.length < 2) {
            setGroupSearchResults([]);
            return;
        }
        try {
            const usersRef = firestore().collection('users');
            const snapshot = await usersRef
                .orderBy('displayName')
                .startAt(query)
                .endAt(query + '\uf8ff')
                .limit(10)
                .get();
            const users = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => u.id !== currentUser?.uid);
            setGroupSearchResults(users);
        } catch {
            // Group search failed silently
        }
    };

    const toggleUserSelection = (user: any) => {
        setSelectedUsers(prev => {
            const exists = prev.find(u => u.id === user.id);
            if (exists) return prev.filter(u => u.id !== user.id);
            return [...prev, user];
        });
    };

    const createGroupChat = async () => {
        if (!groupName.trim() || selectedUsers.length < 1) {
            return;
        }
        try {
            const participants = [currentUser?.uid, ...selectedUsers.map(u => u.id)];
            const newGroup = await firestore().collection('chats').add({
                isGroupChat: true,
                groupName: groupName.trim(),
                participants,
                createdBy: currentUser?.uid,
                createdAt: firestore.FieldValue.serverTimestamp(),
                lastMessage: 'Group created',
                lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
            });

            // Reset modal state
            setShowGroupModal(false);
            setGroupName('');
            setSelectedUsers([]);
            setGroupSearchQuery('');
            setGroupSearchResults([]);

            // Navigate to the new group chat
            navigation.navigate('Message', { chatId: newGroup.id });
        } catch {
            // Group creation failed silently
        }
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        try {
            const usersRef = firestore().collection('users');
            const snapshot = await usersRef
                .orderBy('displayName')
                .startAt(query)
                .endAt(query + '\uf8ff')
                .limit(10)
                .get();

            const users = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => u.id !== currentUser?.uid);

            setSearchResults(users);
        } catch (error) {
            console.log('User search error:', error);
            setSearchResults([]); // No dummy data
        }
    };

    const startChat = (user) => {
        navigation.navigate('Message', {
            recipientId: user.id,
            recipientName: user.displayName,
            recipientImage: user.photoURL,
        });
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
    };

    const handleDeleteChat = (chat: any) => {
        const chatName = chat.isGroupChat ? chat.groupName : (chat.otherUser?.displayName || 'this user');

        Alert.alert(
            'Delete Chat',
            `Are you sure you want to delete your conversation with ${chatName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await firestore().collection('chats').doc(chat.id).delete();
                            // Messages subcollection will be cleaned up by Cloud Function
                        } catch {
                            Alert.alert('Error', 'Failed to delete chat. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    // Format time for chat list
    const formatChatTime = (timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            } else if (diffDays === 1) {
                return 'Yesterday';
            } else if (diffDays < 7) {
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            } else {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        } catch {
            return '';
        }
    };

    const renderChatItem = ({ item, index }) => (
        <Animatable.View animation="fadeInUp" delay={index * 50}>
            <TouchableOpacity
                style={[styles.chatItem, { backgroundColor: colors.card }]}
                onPress={() => navigation.navigate('Message', { chatId: item.id })}
                onLongPress={() => handleDeleteChat(item)}
                activeOpacity={0.7}
                delayLongPress={500}
            >
                {/* Avatar with online indicator */}
                <View style={styles.avatarContainer}>
                    <Image
                        source={item.isGroupChat
                            ? require('../../assets/icon.png')
                            : { uri: item.otherUser?.photoURL || undefined }
                        }
                        style={styles.avatar}
                    />
                    {item.otherUser?.isOnline && <View style={styles.onlineIndicator} />}
                </View>

                <View style={styles.chatInfo}>
                    <View style={styles.chatNameRow}>
                        <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                            {item.isGroupChat ? item.groupName : (item.otherUser?.displayName || 'User')}
                        </Text>
                        <Text style={[styles.chatTime, { color: item.unreadCount ? colors.primary : colors.textSecondary }]}>
                            {formatChatTime(item.lastMessageTimestamp)}
                        </Text>
                    </View>
                    <View style={styles.lastMessageRow}>
                        <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.lastMessage || 'No messages yet'}
                        </Text>
                        {item.unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Animatable.View>
    );

    const renderUserItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.userItem, { backgroundColor: colors.card }]}
            onPress={() => startChat(item)}
            activeOpacity={0.7}
        >
            <Image source={{ uri: item.photoURL }} style={styles.avatar} />
            <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.text }]}>{item.displayName}</Text>
                <Text style={[styles.userBio, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.bio || 'Tripzi user'}
                </Text>
            </View>
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Gradient Header */}
            <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientHeader}
            >
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitleGradient}>Messages</Text>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.headerBtnGradient}
                            onPress={() => setShowMenuDropdown(!showMenuDropdown)}
                        >
                            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Three-dots Dropdown Menu */}
                {showMenuDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.card, shadowColor: colors.text }]}>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setShowMenuDropdown(false);
                                setIsSearching(true);
                            }}
                        >
                            <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
                            <Text style={[styles.dropdownText, { color: colors.text }]}>New Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setShowMenuDropdown(false);
                                setShowGroupModal(true);
                            }}
                        >
                            <Ionicons name="people-outline" size={20} color={colors.text} />
                            <Text style={[styles.dropdownText, { color: colors.text }]}>New Group</Text>
                        </TouchableOpacity>
                        <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setShowMenuDropdown(false);
                                navigation.navigate('Settings');
                            }}
                        >
                            <Ionicons name="settings-outline" size={20} color={colors.text} />
                            <Text style={[styles.dropdownText, { color: colors.text }]}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </LinearGradient>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={[styles.searchBox, { backgroundColor: colors.inputBackground }]}>
                    <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search users to chat..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        onFocus={() => setIsSearching(true)}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setIsSearching(false); }}>
                            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Stories Section */}
            {stories.length > 0 && !isSearching && (
                <View style={styles.storiesSection}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
                        {stories.map((storyGroup, index) => (
                            <TouchableOpacity
                                key={storyGroup.userId || index}
                                style={styles.storyItem}
                                onPress={() => openStory(storyGroup)}
                            >
                                <LinearGradient
                                    colors={['#8B5CF6', '#EC4899', '#F59E0B']}
                                    style={styles.storyRing}
                                >
                                    <Image
                                        source={{ uri: storyGroup.user?.photoURL || undefined }}
                                        style={styles.storyAvatar}
                                    />
                                </LinearGradient>
                                <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
                                    {storyGroup.user?.displayName?.split(' ')[0] || 'User'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Search Results or Chats */}
            {isSearching && searchResults.length > 0 ? (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>USERS</Text>
                    <FlatList
                        data={searchResults}
                        renderItem={renderUserItem}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            ) : loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : chats.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No conversations yet</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        Search for users above to start chatting
                    </Text>
                    <TouchableOpacity
                        style={[styles.startChatButton, { backgroundColor: colors.primary }]}
                        onPress={() => setIsSearching(true)}
                    >
                        <Text style={styles.startChatButtonText}>Start a Chat</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={chats}
                    renderItem={renderChatItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.chatsList}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Story Viewer Modal */}
            <Modal visible={showStoryModal} transparent animationType="fade">
                <View style={styles.storyModalContainer}>
                    {currentStory && (
                        <>
                            {/* Progress bar */}
                            <View style={styles.storyProgressContainer}>
                                <Animated.View
                                    style={[
                                        styles.storyProgressBar,
                                        {
                                            width: storyProgress.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0%', '100%'],
                                            })
                                        }
                                    ]}
                                />
                            </View>

                            {/* Header */}
                            <View style={styles.storyHeader}>
                                <Image
                                    source={{ uri: currentStory.user?.photoURL || undefined }}
                                    style={styles.storyHeaderAvatar}
                                />
                                <Text style={styles.storyHeaderName}>
                                    {currentStory.user?.displayName || 'User'}
                                </Text>
                                <TouchableOpacity onPress={closeStory} style={styles.storyCloseBtn}>
                                    <Ionicons name="close" size={28} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Story Content */}
                            <Image
                                source={{ uri: currentStory.stories?.[0]?.imageUrl || undefined }}
                                style={styles.storyImage}
                                resizeMode="contain"
                            />

                            {/* Story Info */}
                            <View style={styles.storyInfo}>
                                <Text style={styles.storyTitle}>{currentStory.stories?.[0]?.destination || 'Trip Story'}</Text>
                                <Text style={styles.storyDescription} numberOfLines={2}>
                                    {currentStory.stories?.[0]?.description || ''}
                                </Text>
                            </View>
                        </>
                    )}
                </View>
            </Modal>

            {/* Group Chat Creation Modal */}
            <Modal visible={showGroupModal} animationType="slide">
                <SafeAreaView style={[styles.groupModalContainer, { backgroundColor: colors.background }]}>
                    <View style={styles.groupModalHeader}>
                        <TouchableOpacity onPress={() => setShowGroupModal(false)}>
                            <Ionicons name="close" size={28} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.groupModalTitle, { color: colors.text }]}>New Group</Text>
                        <TouchableOpacity
                            onPress={createGroupChat}
                            disabled={!groupName.trim() || selectedUsers.length < 1}
                        >
                            <Text style={[styles.createBtn, { color: (groupName.trim() && selectedUsers.length > 0) ? colors.primary : colors.textSecondary }]}>
                                Create
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Group Name */}
                    <View style={[styles.groupNameContainer, { backgroundColor: colors.card }]}>
                        <TextInput
                            style={[styles.groupNameInput, { color: colors.text }]}
                            placeholder="Group name..."
                            placeholderTextColor={colors.textSecondary}
                            value={groupName}
                            onChangeText={setGroupName}
                        />
                    </View>

                    {/* Selected Users */}
                    {selectedUsers.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedUsersScroll}>
                            {selectedUsers.map(user => (
                                <TouchableOpacity
                                    key={user.id}
                                    style={styles.selectedUserChip}
                                    onPress={() => toggleUserSelection(user)}
                                >
                                    <Image source={{ uri: user.photoURL }} style={styles.selectedUserAvatar} />
                                    <Text style={styles.selectedUserName}>{user.displayName?.split(' ')[0]}</Text>
                                    <Ionicons name="close-circle" size={18} color="#fff" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Search Users */}
                    <View style={[styles.groupSearchBox, { backgroundColor: colors.card }]}>
                        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Search users to add..."
                            placeholderTextColor={colors.textSecondary}
                            value={groupSearchQuery}
                            onChangeText={searchUsersForGroup}
                        />
                    </View>

                    {/* User Results */}
                    <FlatList
                        data={groupSearchResults}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.groupUserItem, { backgroundColor: colors.card }]}
                                onPress={() => toggleUserSelection(item)}
                            >
                                <Image source={{ uri: item.photoURL }} style={styles.avatar} />
                                <View style={styles.userInfo}>
                                    <Text style={[styles.userName, { color: colors.text }]}>{item.displayName}</Text>
                                    <Text style={[styles.userBio, { color: colors.textSecondary }]}>{item.bio || 'Tripzi user'}</Text>
                                </View>
                                <View style={[styles.checkbox, selectedUsers.find(u => u.id === item.id) && styles.checkboxSelected]}>
                                    {selectedUsers.find(u => u.id === item.id) && (
                                        <Ionicons name="checkmark" size={16} color="#fff" />
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
    },
    headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
    newChatButton: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        borderRadius: TOUCH_TARGET.min / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    searchInput: { flex: 1, fontSize: FONT_SIZE.sm },
    section: { flex: 1, paddingHorizontal: SPACING.xl },
    sectionTitle: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, marginBottom: SPACING.md },
    chatsList: { paddingHorizontal: SPACING.xl },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
    },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: SPACING.md },
    chatInfo: { flex: 1 },
    chatName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, marginBottom: 2 },
    lastMessage: { fontSize: FONT_SIZE.sm },
    chatMeta: { alignItems: 'flex-end' },
    chatTime: { fontSize: FONT_SIZE.xs },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
    },
    userInfo: { flex: 1, marginLeft: SPACING.md },
    userName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    userBio: { fontSize: FONT_SIZE.sm },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xxxl },
    emptyIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
    emptySubtitle: { fontSize: FONT_SIZE.sm, textAlign: 'center', marginBottom: SPACING.xl },
    startChatButton: { paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg },
    startChatButtonText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    // Stories styles
    storiesSection: { marginBottom: SPACING.md },
    storiesScroll: { paddingHorizontal: SPACING.xl, gap: SPACING.md },
    storyItem: { alignItems: 'center', width: 70 },
    storyRing: { width: 66, height: 66, borderRadius: 33, padding: 3, justifyContent: 'center', alignItems: 'center' },
    storyAvatar: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: '#fff' },
    storyName: { fontSize: FONT_SIZE.xs, marginTop: 4, textAlign: 'center' },
    // Story modal styles
    storyModalContainer: { flex: 1, backgroundColor: '#000' },
    storyProgressContainer: { height: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 50, marginHorizontal: SPACING.md, borderRadius: 2 },
    storyProgressBar: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
    storyHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
    storyHeaderAvatar: { width: 36, height: 36, borderRadius: 18 },
    storyHeaderName: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, flex: 1, marginLeft: SPACING.sm },
    storyCloseBtn: { padding: SPACING.sm },
    storyImage: { flex: 1, width: width },
    storyInfo: { padding: SPACING.lg, backgroundColor: 'rgba(0,0,0,0.5)' },
    storyTitle: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
    storyDescription: { color: 'rgba(255,255,255,0.8)', fontSize: FONT_SIZE.sm },
    // Header actions
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    headerBtn: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, borderRadius: TOUCH_TARGET.min / 2, justifyContent: 'center', alignItems: 'center' },
    // Group chat modal styles
    groupModalContainer: { flex: 1 },
    groupModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
    groupModalTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    createBtn: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    groupNameContainer: { margin: SPACING.lg, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    groupNameInput: { fontSize: FONT_SIZE.md },
    selectedUsersScroll: { maxHeight: 80, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
    selectedUserChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8B5CF6', borderRadius: 20, paddingRight: SPACING.sm, marginRight: SPACING.sm, gap: SPACING.xs },
    selectedUserAvatar: { width: 36, height: 36, borderRadius: 18 },
    selectedUserName: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
    groupSearchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.lg, marginBottom: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, gap: SPACING.sm },
    groupUserItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, borderRadius: BORDER_RADIUS.md },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
    checkboxSelected: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
    // Dropdown menu styles
    dropdownMenu: {
        position: 'absolute',
        top: 50,
        right: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.sm,
        minWidth: 160,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        gap: SPACING.md,
    },
    dropdownText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
    },
    dropdownDivider: {
        height: 1,
        marginVertical: SPACING.xs,
        marginHorizontal: SPACING.md,
    },
    // Gradient header styles
    gradientHeader: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        paddingTop: SPACING.lg,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitleGradient: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
    },
    headerBtnGradient: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        borderRadius: TOUCH_TARGET.min / 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    // Chat item improvements
    avatarContainer: {
        position: 'relative',
        marginRight: SPACING.md,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#fff',
    },
    chatNameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    lastMessageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    unreadBadge: {
        backgroundColor: '#8B5CF6',
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
});

export default MessagesScreen;
