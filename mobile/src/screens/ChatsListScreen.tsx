import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import { useChats, Chat } from '../hooks/useChats';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

interface SearchUser {
    id: string;
    displayName: string;
    username?: string;
    photoURL?: string;
    kycStatus?: string;
}

const ChatsListScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const { chats, loading, refreshChats } = useChats();

    // Use state for currentUser to properly handle auth state
    const [currentUser, setCurrentUser] = useState(auth().currentUser);

    // Listen for auth state changes
    React.useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged((user) => {
            console.log('📱 [AUTH] Auth state changed:', user?.uid || 'null');
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    // Search state
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [startingChat, setStartingChat] = useState(false);
    const [storyUsers, setStoryUsers] = useState<any[]>([]);
    const [myStories, setMyStories] = useState<any[]>([]);

    // Messages Settings modal
    const [showMessagesSettings, setShowMessagesSettings] = useState(false);
    const [readReceipts, setReadReceipts] = useState(true);

    // Fetch following users for stories
    React.useEffect(() => {
        if (!currentUser) {
            console.log('📱 [STORIES] No current user');
            return;
        }
        console.log('📱 [STORIES] Setting up listener for:', currentUser.uid);
        const unsubscribe = firestore()
            .collection('users')
            .doc(currentUser.uid)
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    const following = userData?.following || [];
                    console.log('📱 [STORIES] Following count:', following.length);
                    if (following.length > 0) {
                        const users = await Promise.all(
                            following.slice(0, 10).map(async (uid: string) => {
                                try {
                                    const userDoc = await firestore().collection('users').doc(uid).get();
                                    return userDoc.exists ? { id: uid, ...userDoc.data() } : null;
                                } catch { return null; }
                            })
                        );
                        const validUsers = users.filter(Boolean);
                        console.log('📱 [STORIES] Story users loaded:', validUsers.length);
                        setStoryUsers(validUsers);
                    } else {
                        console.log('📱 [STORIES] No following users');
                        setStoryUsers([]);
                    }
                } else {
                    console.log('📱 [STORIES] User doc does not exist');
                }
            });
        return () => unsubscribe();
    }, [currentUser]);

    // Fetch user's own stories to determine "Your Story" visibility
    React.useEffect(() => {
        if (!currentUser) return;

        const now = new Date();
        const unsubscribe = firestore()
            .collection('stories')
            .where('userId', '==', currentUser.uid)
            .onSnapshot((snapshot) => {
                const activeStories = snapshot.docs
                    .map((doc) => ({ id: doc.id, ...doc.data() }))
                    .filter((story: any) => {
                        if (!story.expiresAt) return true;
                        const expiresAt = story.expiresAt.toDate ? story.expiresAt.toDate() : new Date(story.expiresAt);
                        return expiresAt > now;
                    });
                console.log('📱 [MY STORIES] Active stories:', activeStories.length);
                setMyStories(activeStories);
            });
        return () => unsubscribe();
    }, [currentUser]);

    const getOtherParticipant = useCallback(
        (chat: Chat) => {
            if (!currentUser) return null;
            const otherUid = chat.participants.find((uid) => uid !== currentUser.uid);
            if (!otherUid) return null;
            return {
                uid: otherUid,
                ...chat.participantDetails?.[otherUid],
            };
        },
        [currentUser]
    );

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return formatDistanceToNow(date, { addSuffix: false });
        } catch {
            return '';
        }
    };

    // Search users
    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const queryLower = query.toLowerCase();

            // Search by displayName
            const nameQuery = await firestore()
                .collection('users')
                .orderBy('displayName')
                .startAt(query)
                .endAt(query + '\uf8ff')
                .limit(10)
                .get();

            // Search by username
            const usernameQuery = await firestore()
                .collection('users')
                .orderBy('username')
                .startAt(queryLower)
                .endAt(queryLower + '\uf8ff')
                .limit(10)
                .get();

            const results = new Map<string, SearchUser>();

            [...nameQuery.docs, ...usernameQuery.docs].forEach((doc) => {
                if (doc.id !== currentUser?.uid && !results.has(doc.id)) {
                    results.set(doc.id, {
                        id: doc.id,
                        displayName: doc.data().displayName || 'User',
                        username: doc.data().username,
                        photoURL: doc.data().photoURL,
                        kycStatus: doc.data().kycStatus,
                    });
                }
            });

            setSearchResults(Array.from(results.values()));
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearching(false);
        }
    };

    // Start chat with user
    const startChatWithUser = async (user: SearchUser) => {
        if (!currentUser) return;
        setStartingChat(true);

        try {
            // Check if chat already exists
            const chatQuery = await firestore()
                .collection('chats')
                .where('type', '==', 'direct')
                .where('participants', 'array-contains', currentUser.uid)
                .get();

            let chatId = null;
            for (const doc of chatQuery.docs) {
                const data = doc.data();
                if (data.participants.includes(user.id)) {
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
                    participants: [currentUser.uid, user.id],
                    participantDetails: {
                        [currentUser.uid]: {
                            displayName: currentUserData?.displayName || currentUser.displayName || 'User',
                            photoURL: currentUserData?.photoURL || currentUser.photoURL || '',
                        },
                        [user.id]: {
                            displayName: user.displayName || 'User',
                            photoURL: user.photoURL || '',
                        },
                    },
                    unreadCount: {
                        [currentUser.uid]: 0,
                        [user.id]: 0,
                    },
                    mutedBy: [],
                    pinnedBy: [],
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
                chatId = newChatRef.id;
            }

            setShowSearch(false);
            setSearchQuery('');
            setSearchResults([]);

            navigation.navigate('Chat', {
                chatId,
                otherUserId: user.id,
                otherUserName: user.displayName,
                otherUserPhoto: user.photoURL,
            });
        } catch (error) {
            console.error('Error starting chat:', error);
            Alert.alert('Error', 'Could not start chat. Please try again.');
        } finally {
            setStartingChat(false);
        }
    };

    const renderChatItem = ({ item, index }: { item: Chat; index: number }) => {
        const otherUser = item.type === 'direct' ? getOtherParticipant(item) : null;
        const displayName = item.type === 'group' ? item.groupName : otherUser?.displayName || 'User';
        const displayPhoto = item.type === 'group' ? item.groupIcon : otherUser?.photoURL;
        const unreadCount = currentUser ? item.unreadCount?.[currentUser.uid] || 0 : 0;

        return (
            <Animatable.View animation="fadeInUp" delay={index * 50} duration={300}>
                <TouchableOpacity
                    style={[styles.chatItem, { backgroundColor: colors.card }]}
                    onPress={() => navigation.navigate('Chat', { chatId: item.id })}
                    activeOpacity={0.7}
                >
                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        {displayPhoto ? (
                            <Image source={{ uri: displayPhoto }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                                <Text style={styles.avatarText}>
                                    {displayName?.charAt(0)?.toUpperCase() || 'U'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Chat Info */}
                    <View style={styles.chatInfo}>
                        <View style={styles.chatHeader}>
                            <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                                {displayName}
                            </Text>
                            <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                                {formatTime(item.lastMessage?.timestamp)}
                            </Text>
                        </View>

                        <View style={styles.chatPreview}>
                            <Text
                                style={[
                                    styles.lastMessage,
                                    { color: unreadCount > 0 ? colors.text : colors.textSecondary },
                                    unreadCount > 0 && styles.unreadText,
                                ]}
                                numberOfLines={1}
                            >
                                {item.lastMessage?.text || 'Start a conversation'}
                            </Text>

                            {unreadCount > 0 && (
                                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.unreadCount}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Animatable.View>
        );
    };

    const renderSearchResult = ({ item }: { item: SearchUser }) => (
        <TouchableOpacity
            style={[styles.searchResultItem, { backgroundColor: colors.card }]}
            onPress={() => startChatWithUser(item)}
            activeOpacity={0.7}
            disabled={startingChat}
        >
            {item.photoURL ? (
                <Image source={{ uri: item.photoURL }} style={styles.searchAvatar} />
            ) : (
                <View style={[styles.searchAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>
                        {item.displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                </View>
            )}
            <View style={styles.searchUserInfo}>
                <View style={styles.searchNameRow}>
                    <Text style={[styles.searchUserName, { color: colors.text }]}>
                        {item.displayName}
                    </Text>
                    {item.kycStatus === 'verified' && (
                        <Ionicons name="shield-checkmark" size={14} color="#10B981" style={{ marginLeft: 4 }} />
                    )}
                </View>
                {item.username && (
                    <Text style={[styles.searchUsername, { color: colors.primary }]}>@{item.username}</Text>
                )}
            </View>
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={80} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Chats Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Tap the search icon to find people and start chatting!
            </Text>
        </View>
    );

    // Stories header component
    const renderStoriesHeader = () => (
        <View style={styles.storiesContainer}>
            {/* Your story - Only show if user has stories */}
            {myStories.length > 0 && (
                <TouchableOpacity
                    style={styles.storyItem}
                    onPress={() => navigation.navigate('Stories', { viewMyStory: true })}
                >
                    <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.storyGradient}>
                        {currentUser?.photoURL ? (
                            <Image source={{ uri: currentUser.photoURL }} style={styles.storyAvatar} />
                        ) : (
                            <View style={[styles.storyAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                                <Text style={styles.storyInitial}>
                                    {(currentUser?.displayName || 'U').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </LinearGradient>
                    <Text style={[styles.storyName, { color: colors.textSecondary }]} numberOfLines={1}>Your Story</Text>
                </TouchableOpacity>
            )}
            {/* Following users stories */}
            {storyUsers.map((user) => (
                <TouchableOpacity
                    key={user.id}
                    style={styles.storyItem}
                    onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                >
                    <LinearGradient colors={['#F59E0B', '#EF4444']} style={styles.storyGradient}>
                        {user.photoURL ? (
                            <Image source={{ uri: user.photoURL }} style={styles.storyAvatar} />
                        ) : (
                            <View style={[styles.storyAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                                <Text style={styles.storyInitial}>{(user.displayName || 'U').charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                    </LinearGradient>
                    <Text style={[styles.storyName, { color: colors.textSecondary }]} numberOfLines={1}>
                        {user.displayName?.split(' ')[0] || 'User'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
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
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: colors.card }]}
                        onPress={() => setShowSearch(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="search-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: colors.card }]}
                        onPress={() => setShowMessagesSettings(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stories Section - Minimal gap */}
            {renderStoriesHeader()}

            {/* Chat List */}
            <FlatList
                data={chats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                    styles.listContent,
                    chats.length === 0 && styles.emptyList,
                ]}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={refreshChats}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            />

            {/* Search Modal */}
            <Modal visible={showSearch} animationType="slide" transparent>
                <View style={[styles.searchModal, { backgroundColor: colors.background }]}>
                    <SafeAreaView style={styles.searchModalContent}>
                        {/* Search Header */}
                        <View style={[styles.searchHeader, { borderBottomColor: colors.border }]}>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => {
                                    setShowSearch(false);
                                    setSearchQuery('');
                                    setSearchResults([]);
                                }}
                            >
                                <Ionicons name="arrow-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.searchInput, { backgroundColor: colors.card, color: colors.text }]}
                                placeholder="Search by name or username..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={handleSearch}
                                autoFocus
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Search Results */}
                        {searching ? (
                            <View style={styles.searchLoading}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={[styles.searchingText, { color: colors.textSecondary }]}>Searching...</Text>
                            </View>
                        ) : searchQuery.length > 0 && searchResults.length === 0 ? (
                            <View style={styles.noResults}>
                                <Ionicons name="person-outline" size={48} color={colors.textSecondary} />
                                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>
                                    No users found for "{searchQuery}"
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={searchResults}
                                renderItem={renderSearchResult}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.searchResultsList}
                                showsVerticalScrollIndicator={false}
                                ListHeaderComponent={
                                    searchResults.length > 0 ? (
                                        <Text style={[styles.resultsHeader, { color: colors.textSecondary }]}>
                                            {searchResults.length} user{searchResults.length > 1 ? 's' : ''} found
                                        </Text>
                                    ) : null
                                }
                            />
                        )}

                        {startingChat && (
                            <View style={styles.startingChatOverlay}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={[styles.startingChatText, { color: colors.text }]}>Starting chat...</Text>
                            </View>
                        )}
                    </SafeAreaView>
                </View>
            </Modal>

            {/* WhatsApp-style Dropdown Menu */}
            <Modal visible={showMessagesSettings} animationType="fade" transparent>
                <TouchableOpacity
                    style={styles.dropdownOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMessagesSettings(false)}
                >
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.card }]}>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setShowMessagesSettings(false);
                                navigation.navigate('CreateGroupChat');
                            }}
                        >
                            <Ionicons name="people" size={20} color={colors.text} />
                            <Text style={[styles.dropdownText, { color: colors.text }]}>New group</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setShowMessagesSettings(false);
                                navigation.navigate('Stories');
                            }}
                        >
                            <Ionicons name="add-circle" size={20} color={colors.text} />
                            <Text style={[styles.dropdownText, { color: colors.text }]}>Add story</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setShowMessagesSettings(false);
                                navigation.navigate('MessageSettings');
                            }}
                        >
                            <Ionicons name="settings" size={20} color={colors.text} />
                            <Text style={[styles.dropdownText, { color: colors.text }]}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    persistentSearchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SPACING.xl,
        marginBottom: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    persistentSearchText: {
        fontSize: FONT_SIZE.sm,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: SPACING.lg,
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: SPACING.md,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    avatarPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
    },
    chatInfo: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatName: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        flex: 1,
        marginRight: SPACING.sm,
    },
    timestamp: {
        fontSize: FONT_SIZE.xs,
    },
    chatPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lastMessage: {
        fontSize: FONT_SIZE.sm,
        flex: 1,
        marginRight: SPACING.sm,
    },
    unreadText: {
        fontWeight: FONT_WEIGHT.semibold,
    },
    unreadBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadCount: {
        color: '#fff',
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: SPACING.xxxl,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        marginTop: SPACING.xl,
        marginBottom: SPACING.sm,
    },
    emptySubtitle: {
        fontSize: FONT_SIZE.md,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.lg,
    },
    startChatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    startChatButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
    // Search Modal
    searchModal: {
        flex: 1,
    },
    searchModalContent: {
        flex: 1,
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
    },
    closeButton: {
        padding: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        marginLeft: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        fontSize: FONT_SIZE.md,
    },
    searchLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    noResults: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    noResultsText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
        textAlign: 'center',
    },
    // Stories Styles
    storiesContainer: {
        flexDirection: 'row',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    storyItem: {
        alignItems: 'center',
        marginRight: SPACING.lg,
        width: 72,
    },
    storyGradient: {
        width: 68,
        height: 68,
        borderRadius: 34,
        padding: 3,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    storyInner: {
        width: 62,
        height: 62,
        borderRadius: 31,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    storyAvatar: {
        width: 62,
        height: 62,
        borderRadius: 31,
        borderWidth: 3,
        borderColor: '#fff',
    },
    storyAvatarPlaceholder: {
        width: 62,
        height: 62,
        borderRadius: 31,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    storyInitial: {
        color: '#fff',
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
    },
    storyName: {
        fontSize: FONT_SIZE.xs,
        textAlign: 'center',
    },
    searchResultsList: {
        padding: SPACING.lg,
    },
    resultsHeader: {
        fontSize: FONT_SIZE.sm,
        marginBottom: SPACING.md,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.sm,
    },
    searchAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: SPACING.md,
    },
    searchAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    searchUserInfo: {
        flex: 1,
    },
    searchNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchUserName: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
    searchUsername: {
        fontSize: FONT_SIZE.sm,
        marginTop: 2,
    },
    startingChatOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    startingChatText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    // Dropdown Menu
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    dropdownMenu: {
        position: 'absolute',
        top: 60,
        right: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        minWidth: 180,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        gap: SPACING.md,
    },
    dropdownText: {
        fontSize: FONT_SIZE.md,
    },
});

export default ChatsListScreen;
