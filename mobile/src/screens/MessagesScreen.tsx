import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

// Sample users for when Firestore is unavailable
const SAMPLE_USERS = [
    { id: 'user1', displayName: 'Travel Explorer', photoURL: 'https://randomuser.me/api/portraits/men/32.jpg', bio: 'Adventure seeker' },
    { id: 'user2', displayName: 'Wanderlust', photoURL: 'https://randomuser.me/api/portraits/women/44.jpg', bio: 'Beach lover' },
    { id: 'user3', displayName: 'Mountain Rider', photoURL: 'https://randomuser.me/api/portraits/men/22.jpg', bio: 'Bike trips' },
];

const MessagesScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const [chats, setChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const currentUser = auth.currentUser;

    useEffect(() => {
        loadChats();
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
                                        chat.otherUser = { displayName: 'User', photoURL: 'https://via.placeholder.com/50' };
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
                    console.log('Chats load error:', error);
                    setLoading(false);
                }
            );

            return () => unsubscribe();
        } catch (error) {
            console.log('Chat setup error:', error);
            setLoading(false);
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

            setSearchResults(users.length > 0 ? users : SAMPLE_USERS);
        } catch (error) {
            console.log('Search error:', error);
            // Show sample users as fallback
            setSearchResults(SAMPLE_USERS);
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

    const renderChatItem = ({ item, index }) => (
        <Animatable.View animation="fadeInUp" delay={index * 50}>
            <TouchableOpacity
                style={[styles.chatItem, { backgroundColor: colors.card }]}
                onPress={() => navigation.navigate('Message', { chatId: item.id })}
                activeOpacity={0.7}
            >
                <Image
                    source={{ uri: item.isGroupChat ? 'https://via.placeholder.com/50' : (item.otherUser?.photoURL || 'https://via.placeholder.com/50') }}
                    style={styles.avatar}
                />
                <View style={styles.chatInfo}>
                    <Text style={[styles.chatName, { color: colors.text }]}>
                        {item.isGroupChat ? item.groupName : (item.otherUser?.displayName || 'User')}
                    </Text>
                    <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.lastMessage || 'No messages yet'}
                    </Text>
                </View>
                <View style={styles.chatMeta}>
                    <Text style={[styles.chatTime, { color: colors.textSecondary }]}>
                        {item.lastMessageTimestamp?.toDate?.()?.toLocaleDateString() || ''}
                    </Text>
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
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
                <TouchableOpacity
                    style={[styles.newChatButton, { backgroundColor: colors.primary }]}
                    onPress={() => setIsSearching(true)}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

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
});

export default MessagesScreen;
