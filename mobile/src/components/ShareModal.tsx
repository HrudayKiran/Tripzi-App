import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import DefaultAvatar from './DefaultAvatar';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

type ShareModalProps = {
    visible: boolean;
    onClose: () => void;
    tripId: string;
    tripTitle: string;
    tripImage?: string;
};

type User = {
    id: string;
    displayName: string;
    photoURL?: string;
    username?: string;
};

const ShareModal = ({ visible, onClose, tripId, tripTitle, tripImage }: ShareModalProps) => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const [following, setFollowing] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const currentUser = auth.currentUser;

    // Fetch following list
    useEffect(() => {
        if (!visible || !currentUser) return;

        const fetchFollowing = async () => {
            setLoading(true);
            try {
                // Get user's following list
                const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
                const userData = userDoc.data();
                const followingIds = userData?.following || [];

                if (followingIds.length === 0) {
                    setFollowing([]);
                    setLoading(false);
                    return;
                }

                // Fetch following users' data
                const usersPromises = followingIds.slice(0, 50).map(async (uid: string) => {
                    const userDoc = await firestore().collection('users').doc(uid).get();
                    if (userDoc.exists) {
                        return { id: uid, ...userDoc.data() } as User;
                    }
                    return null;
                });

                const users = (await Promise.all(usersPromises)).filter(Boolean) as User[];
                setFollowing(users);
            } catch (error) {
                console.log('Error fetching following:', error);
                setFollowing([]);
            } finally {
                setLoading(false);
            }
        };

        fetchFollowing();
    }, [visible, currentUser]);

    const filteredUsers = following.filter(user =>
        user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSendShare = async () => {
        if (selectedUsers.length === 0 || !currentUser) {
            Alert.alert('Select Users', 'Please select at least one user to share with.');
            return;
        }

        setSending(true);
        try {
            const tripLink = `tripzi://trip/${tripId}`;
            const messageContent = `🗺️ Check out this trip: ${tripTitle}\n\n${tripLink}`;

            // Send to each selected user
            for (const userId of selectedUsers) {
                // Create or get existing chat
                const chatId = [currentUser.uid, userId].sort().join('_');

                // Check if chat exists
                const chatDoc = await firestore().collection('chats').doc(chatId).get();
                if (!chatDoc.exists) {
                    // Create new chat
                    await firestore().collection('chats').doc(chatId).set({
                        participants: [currentUser.uid, userId],
                        createdAt: firestore.FieldValue.serverTimestamp(),
                        lastMessage: messageContent,
                        lastMessageTime: firestore.FieldValue.serverTimestamp(),
                    });
                }

                // Send message
                await firestore()
                    .collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .add({
                        text: messageContent,
                        senderId: currentUser.uid,
                        senderName: currentUser.displayName || 'User',
                        senderPhoto: currentUser.photoURL || null,
                        createdAt: firestore.FieldValue.serverTimestamp(),
                        type: 'trip_share',
                        tripId: tripId,
                        tripTitle: tripTitle,
                        tripImage: tripImage || null,
                    });

                // Update chat's last message using set with merge to avoid not-found
                await firestore().collection('chats').doc(chatId).set({
                    lastMessage: `🗺️ Shared a trip: ${tripTitle}`,
                    lastMessageTime: firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            // Show toast instead of alert - will add toast render below
            setSelectedUsers([]);
            setShowToast(true);
            setTimeout(() => {
                setShowToast(false);
                onClose();
            }, 2000);
        } catch (error) {
            console.log('Share error:', error);
            setShowToast(false);
        } finally {
            setSending(false);
        }
    };

    const renderUser = ({ item }: { item: User }) => {
        const isSelected = selectedUsers.includes(item.id);

        return (
            <TouchableOpacity
                style={[styles.userItem, { backgroundColor: isSelected ? colors.primaryLight : colors.card }]}
                onPress={() => toggleUserSelection(item.id)}
                activeOpacity={0.7}
            >
                <DefaultAvatar uri={item.photoURL} size={44} style={styles.avatar} />
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{item.displayName || 'User'}</Text>
                    {item.username && (
                        <Text style={[styles.username, { color: colors.textSecondary }]}>@{item.username}</Text>
                    )}
                </View>
                <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary : colors.border }]}>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <SafeAreaView style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: colors.text }]}>Share to</Text>
                        <TouchableOpacity
                            onPress={handleSendShare}
                            disabled={selectedUsers.length === 0 || sending}
                            style={[
                                styles.sendButton,
                                { backgroundColor: selectedUsers.length > 0 ? colors.primary : colors.border }
                            ]}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.sendText}>Send</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <View style={[styles.searchBox, { backgroundColor: colors.inputBackground }]}>
                            <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search people..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    {/* Selected count */}
                    {selectedUsers.length > 0 && (
                        <View style={styles.selectedBadge}>
                            <Text style={[styles.selectedText, { color: colors.primary }]}>
                                {selectedUsers.length} selected
                            </Text>
                        </View>
                    )}

                    {/* Users List */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                Loading...
                            </Text>
                        </View>
                    ) : filteredUsers.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                {searchQuery ? 'No users found' : 'No following yet'}
                            </Text>
                            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                                {searchQuery ? 'Try a different search' : 'Follow people to share trips with them'}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredUsers}
                            renderItem={renderUser}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </SafeAreaView>

                {/* Instagram-style Toast */}
                {showToast && (
                    <View style={styles.toastContainer}>
                        <View style={styles.toast}>
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                            <Text style={styles.toastText}>Sent</Text>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
    },
    closeButton: { padding: SPACING.xs },
    title: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    sendButton: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
    },
    sendText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
    searchContainer: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        height: 44,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    searchInput: { flex: 1, fontSize: FONT_SIZE.sm },
    selectedBadge: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
    selectedText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
    listContent: { paddingHorizontal: SPACING.lg },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.sm,
    },
    avatar: { marginRight: SPACING.md },
    userInfo: { flex: 1 },
    userName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    username: { fontSize: FONT_SIZE.sm, marginTop: 2 },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZE.sm },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl },
    emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.lg },
    emptySubtitle: { fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: SPACING.sm },
    toastContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    toastText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
});

export default ShareModal;
