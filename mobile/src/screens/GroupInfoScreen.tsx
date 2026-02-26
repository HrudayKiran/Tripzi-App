import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Alert,
    TextInput,
    Modal,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';
import { searchUsersByPrefix } from '../utils/searchUsers';
import { getPublicProfilesByIds } from '../utils/publicProfiles';

interface Member {
    id: string;
    displayName: string;
    photoURL?: string;
    role: 'admin' | 'member';
}

interface GroupData {
    id: string;
    groupName: string;
    groupIcon?: string;
    participants: string[];
    admins: string[];
    createdBy: string;
    participantDetails?: { [uid: string]: { displayName?: string; photoURL?: string } };
}

const GroupInfoScreen = ({ navigation, route }) => {
    const { chatId } = route.params;
    const { colors } = useTheme();
    const currentUser = auth().currentUser;

    const [group, setGroup] = useState<GroupData | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [showAddMember, setShowAddMember] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const isAdmin = group?.admins.includes(currentUser?.uid || '');
    const isCreator = group?.createdBy === currentUser?.uid;

    useEffect(() => {
        loadGroup();
    }, [chatId]);

    const loadGroup = async () => {
        try {
            const doc = await firestore().collection('chats').doc(chatId).get();
            if (!doc.exists) {
                Alert.alert('Error', 'Group not found.');
                navigation.goBack();
                return;
            }

            const data = { id: doc.id, ...doc.data() } as GroupData;
            setGroup(data);
            setEditName(data.groupName);

            // Load member details from public profile mirror.
            const publicProfiles = await getPublicProfilesByIds(data.participants || []);
            const memberList: Member[] = (data.participants || []).map((uid) => {
                const profile = publicProfiles.get(uid);
                const fallback = data.participantDetails?.[uid] || {};
                return {
                    id: uid,
                    displayName: profile?.displayName || fallback.displayName || 'User',
                    photoURL: profile?.photoURL || fallback.photoURL || undefined,
                    role: data.admins.includes(uid) ? 'admin' : 'member',
                };
            });

            // Sort: admins first, then alphabetically
            memberList.sort((a, b) => {
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (a.role !== 'admin' && b.role === 'admin') return 1;
                return a.displayName.localeCompare(b.displayName);
            });

            setMembers(memberList);
        } catch (error) {
            
        } finally {
            setLoading(false);
        }
    };

    const updateGroupName = async () => {
        if (!editName.trim() || !isAdmin) return;
        try {
            await firestore().collection('chats').doc(chatId).update({
                groupName: editName.trim(),
            });
            setGroup((prev) => prev ? { ...prev, groupName: editName.trim() } : null);
            setEditing(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to update group name.');
        }
    };

    const updateGroupIcon = async () => {
        if (!isAdmin || !currentUser) return;
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant photo access.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled && result.assets[0]) {
                const filename = `${Date.now()}_group.jpg`;
                const storageRef = storage().ref(`groups/${currentUser.uid}/${filename}`);
                await storageRef.putFile(result.assets[0].uri);
                const downloadUrl = await storageRef.getDownloadURL();

                await firestore().collection('chats').doc(chatId).update({
                    groupIcon: downloadUrl,
                });
                setGroup((prev) => prev ? { ...prev, groupIcon: downloadUrl } : null);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update group icon.');
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const users = await searchUsersByPrefix(query, 10);
            const results = users.filter((user) =>
                !group?.participants.includes(user.id) && user.id !== currentUser?.uid
            );

            setSearchResults(results);
        } catch (error) {
            
        } finally {
            setSearching(false);
        }
    };

    const addMember = async (user: any) => {
        if (!isAdmin || !group) return;
        try {
            await functions().httpsCallable('addGroupMember')({
                chatId,
                memberId: user.id,
            });

            setShowAddMember(false);
            setSearchQuery('');
            setSearchResults([]);
            loadGroup();
        } catch (error) {
            Alert.alert('Error', 'Failed to add member.');
        }
    };

    const removeMember = (member: Member) => {
        if (!isAdmin || member.id === currentUser?.uid) return;

        Alert.alert(
            'Remove Member',
            `Remove ${member.displayName} from the group?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await functions().httpsCallable('removeGroupMember')({
                                chatId,
                                memberId: member.id,
                            });

                            loadGroup();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove member.');
                        }
                    },
                },
            ]
        );
    };

    const toggleAdmin = (member: Member) => {
        if (!isCreator || member.id === currentUser?.uid) return;

        const action = member.role === 'admin' ? 'remove as admin' : 'make admin';
        const newRole = member.role === 'admin' ? 'member' : 'admin';

        Alert.alert(
            newRole === 'admin' ? 'Make Admin' : 'Remove Admin',
            `${member.displayName} will be ${action === 'make admin' ? 'made an admin' : 'removed as admin'}.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        try {
                            if (newRole === 'admin') {
                                await functions().httpsCallable('promoteGroupAdmin')({
                                    chatId,
                                    memberId: member.id,
                                });
                            } else {
                                await functions().httpsCallable('demoteGroupAdmin')({
                                    chatId,
                                    memberId: member.id,
                                });
                            }
                            loadGroup();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to update admin status.');
                        }
                    },
                },
            ]
        );
    };

    const leaveGroup = () => {
        Alert.alert(
            'Leave Group',
            'Are you sure you want to leave this group?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await functions().httpsCallable('leaveGroup')({
                                chatId,
                            });

                            navigation.navigate('ChatsList');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to leave group.');
                        }
                    },
                },
            ]
        );
    };

    const renderMember = ({ item }: { item: Member }) => {
        const isMe = item.id === currentUser?.uid;

        return (
            <TouchableOpacity
                style={[styles.memberItem, { backgroundColor: colors.card }]}
                onPress={() => {
                    if (!isMe) navigation.navigate('UserProfile', { userId: item.id });
                }}
                onLongPress={() => {
                    if (isAdmin && !isMe) {
                        Alert.alert(
                            item.displayName,
                            'Choose an action',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                isCreator && { text: item.role === 'admin' ? 'Remove Admin' : 'Make Admin', onPress: () => toggleAdmin(item) },
                                { text: 'Remove from Group', style: 'destructive', onPress: () => removeMember(item) },
                            ].filter(Boolean) as any
                        );
                    }
                }}
                activeOpacity={0.7}
            >
                {item.photoURL ? (
                    <Image source={{ uri: item.photoURL }} style={styles.memberAvatar} />
                ) : (
                    <View style={[styles.memberAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                        <Text style={styles.memberAvatarText}>{item.displayName?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                )}
                <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                        {item.displayName} {isMe && '(You)'}
                    </Text>
                    <Text style={[styles.memberRole, { color: item.role === 'admin' ? '#10B981' : colors.textSecondary }]}>
                        {item.role === 'admin' ? 'Admin' : 'Member'}
                    </Text>
                </View>
                {!isMe && <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
            </TouchableOpacity>
        );
    };

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
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Group Info</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Group Icon & Name */}
                <View style={styles.groupHeader}>
                    <TouchableOpacity onPress={isAdmin ? updateGroupIcon : undefined}>
                        {group?.groupIcon ? (
                            <Image source={{ uri: group.groupIcon }} style={styles.groupIcon} />
                        ) : (
                            <View style={[styles.groupIconPlaceholder, { backgroundColor: colors.primary }]}>
                                <Ionicons name="people" size={40} color="#fff" />
                            </View>
                        )}
                        {isAdmin && (
                            <View style={[styles.editIconBadge, { backgroundColor: colors.primary }]}>
                                <Ionicons name="camera" size={14} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>

                    {editing ? (
                        <View style={styles.editNameContainer}>
                            <TextInput
                                style={[styles.editNameInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                                value={editName}
                                onChangeText={setEditName}
                                autoFocus
                            />
                            <TouchableOpacity onPress={updateGroupName}>
                                <Ionicons name="checkmark" size={24} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setEditing(false)}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.nameRow} onPress={isAdmin ? () => setEditing(true) : undefined}>
                            <Text style={[styles.groupName, { color: colors.text }]}>{group?.groupName}</Text>
                            {isAdmin && <Ionicons name="pencil" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
                        </TouchableOpacity>
                    )}

                    <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
                        {members.length} members
                    </Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsSection}>
                    {isAdmin && (
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.card }]}
                            onPress={() => setShowAddMember(true)}
                        >
                            <Ionicons name="person-add" size={20} color={colors.primary} />
                            <Text style={[styles.actionText, { color: colors.text }]}>Add Members</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.card }]}
                        onPress={leaveGroup}
                    >
                        <Ionicons name="exit-outline" size={20} color="#EF4444" />
                        <Text style={[styles.actionText, { color: '#EF4444' }]}>Leave Group</Text>
                    </TouchableOpacity>
                </View>

                {/* Members */}
                <View style={styles.membersSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MEMBERS</Text>
                    <FlatList
                        data={members}
                        renderItem={renderMember}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                    />
                </View>
            </ScrollView>

            {/* Add Member Modal */}
            <Modal visible={showAddMember} animationType="slide" transparent>
                <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Members</Text>
                            <TouchableOpacity onPress={() => { setShowAddMember(false); setSearchQuery(''); setSearchResults([]); }}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
                            <Ionicons name="search" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search users..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={handleSearch}
                                autoFocus
                            />
                        </View>

                        {searching ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.searchResultItem, { backgroundColor: colors.card }]}
                                        onPress={() => addMember(item)}
                                    >
                                        {item.photoURL ? (
                                            <Image source={{ uri: item.photoURL }} style={styles.searchAvatar} />
                                        ) : (
                                            <View style={[styles.searchAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                                                <Text style={styles.searchAvatarText}>{item.displayName?.charAt(0)?.toUpperCase()}</Text>
                                            </View>
                                        )}
                                        <Text style={[styles.searchName, { color: colors.text }]}>{item.displayName}</Text>
                                        <Ionicons name="add-circle" size={24} color={colors.primary} />
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    searchQuery.length > 0 ? (
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found</Text>
                                    ) : null
                                }
                                contentContainerStyle={{ paddingTop: SPACING.md }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1 },
    backButton: { padding: SPACING.sm },
    headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginLeft: SPACING.sm },
    groupHeader: { alignItems: 'center', paddingVertical: SPACING.xl },
    groupIcon: { width: 100, height: 100, borderRadius: 50 },
    groupIconPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    editIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
    groupName: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    memberCount: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
    editNameContainer: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, gap: SPACING.sm },
    editNameInput: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, minWidth: 200, fontSize: FONT_SIZE.md },
    actionsSection: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
    actionButton: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm, gap: SPACING.md },
    actionText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium },
    membersSection: { paddingHorizontal: SPACING.lg },
    sectionTitle: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm },
    memberItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
    memberAvatar: { width: 44, height: 44, borderRadius: 22 },
    memberAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    memberAvatarText: { color: '#fff', fontWeight: FONT_WEIGHT.bold },
    memberInfo: { flex: 1, marginLeft: SPACING.md },
    memberName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium },
    memberRole: { fontSize: FONT_SIZE.xs, marginTop: 2 },
    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, maxHeight: '80%', padding: SPACING.xl },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
    searchInput: { flex: 1, marginLeft: SPACING.sm, fontSize: FONT_SIZE.md },
    searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
    searchAvatar: { width: 40, height: 40, borderRadius: 20 },
    searchAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    searchAvatarText: { color: '#fff', fontWeight: FONT_WEIGHT.bold },
    searchName: { flex: 1, marginLeft: SPACING.md, fontSize: FONT_SIZE.md },
    emptyText: { textAlign: 'center', marginTop: SPACING.xl },
});

export default GroupInfoScreen;
