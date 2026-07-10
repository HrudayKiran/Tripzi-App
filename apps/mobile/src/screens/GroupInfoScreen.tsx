import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    TextInput,
    Modal,
    ScrollView,
    BackHandler,
} from 'react-native';
import { FlashList } from "@shopify/flash-list";

const TypedFlashList = FlashList as any;
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, STATUS, NEUTRAL } from '../styles';
import { supabase } from '../lib/supabase';
import { workersApi } from '../lib/workersApi';
import { uploadGroupChatImageToR2 } from '../utils/imageUpload';
import { searchUsersByPrefix } from '../utils/searchUsers';
import { getPublicProfilesByIds } from '../utils/publicProfiles';
import DefaultAvatar from '../components/DefaultAvatar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
    groupDescription?: string;
    participants: string[];
    createdBy: string;
    collectionName?: 'group_chats';
    memberCount?: number;
    participantDetails?: { [uid: string]: { displayName?: string; photoURL?: string } };
}

const GroupInfoScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const chatId = params.chatId as string || params.id as string;
    const requestedCollection = 'group_chats';
    const { colors } = useTheme();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
    }, []);

    const queryClient = useQueryClient();

    const { data: groupData, isLoading: loadingGroup } = useQuery({
        queryKey: ['groupChat', chatId],
        queryFn: async () => {
            const { data } = await supabase.from('group_chats').select('*').eq('id', chatId).maybeSingle();
            return data;
        },
        enabled: !!chatId,
    });

    const { data: publicProfiles } = useQuery({
        queryKey: ['publicProfiles', groupData?.participants],
        queryFn: async () => {
            if (!groupData?.participants) return new Map();
            return getPublicProfilesByIds(groupData.participants);
        },
        enabled: !!groupData?.participants,
    });

    const group = groupData ? {
        id: groupData.id,
        collectionName: 'group_chats' as const,
        groupName: groupData.group_name || 'Group',
        groupIcon: groupData.group_icon || groupData.trip_image,
        groupDescription: groupData.group_description,
        participants: groupData.participants || [],
        createdBy: groupData.created_by,
        participantDetails: groupData.participant_details
    } as GroupData : null;

    const members = useMemo(() => {
        if (!groupData || !publicProfiles) return [];
        const admins = Array.isArray(groupData.admins) ? groupData.admins : [groupData.created_by];
        const memberList = (groupData.participants || []).map((uid: string) => {
            const profile = publicProfiles.get(uid);
            const fallback = groupData.participant_details?.[uid] || {};
            const isUserAdmin = admins.includes(uid) || groupData.created_by === uid;
            return {
                id: uid,
                displayName: profile?.displayName || fallback.displayName || 'User',
                photoURL: profile?.photoURL || fallback.photoURL || undefined,
                role: isUserAdmin ? 'admin' : 'member',
            };
        });

        memberList.sort((a: any, b: any) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            return a.displayName.localeCompare(b.displayName);
        });

        return memberList;
    }, [groupData, publicProfiles]);

    const loading = loadingGroup || loadingAuth || !publicProfiles;

    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [showAddMember, setShowAddMember] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const isCreator = group?.createdBy === currentUser?.id;
    const isAdmin = useMemo(() => {
        if (!currentUser || !groupData) return false;
        const adminsList = Array.isArray(groupData.admins) ? groupData.admins : [groupData.created_by];
        return adminsList.includes(currentUser.id) || groupData.created_by === currentUser.id;
    }, [groupData, currentUser]);

    useEffect(() => {
        if (groupData?.group_name) {
            setEditName(groupData.group_name);
        }
    }, [groupData]);

    useEffect(() => {
        const backAction = () => {
            if (showAddMember) {
                setShowAddMember(false);
                setSearchQuery('');
                setSearchResults([]);
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [showAddMember]);

    const updateGroupName = async () => {
        if (!editName.trim() || !isAdmin || !currentUser) return;
        try {
            const table = 'group_chats';
            const userProfile = publicProfiles?.get(currentUser.id);
            const userDisplayName = userProfile?.displayName || currentUser.user_metadata?.full_name || 'Admin';
            const systemText = `${userDisplayName} changed the group name to "${editName.trim()}"`;

            await Promise.all([
                supabase.from(table).update({
                    group_name: editName.trim(),
                    last_message: {
                        text: systemText,
                        sender_id: null,
                        created_at: new Date().toISOString()
                    },
                    updated_at: new Date().toISOString()
                }).eq('id', chatId),
                supabase.from('messages').insert({
                    chat_id: chatId,
                    chat_type: 'group',
                    sender_id: 'system',
                    sender_name: 'System',
                    type: 'system',
                    text: systemText,
                    status: 'sent'
                })
            ]);

            queryClient.invalidateQueries({ queryKey: ['groupChat', chatId] });
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
                const uploadResult = await uploadGroupChatImageToR2(result.assets[0].uri, currentUser.id, chatId);
                if (uploadResult.success && uploadResult.url) {
                    const table = 'group_chats';
                    const userProfile = publicProfiles?.get(currentUser.id);
                    const userDisplayName = userProfile?.displayName || currentUser.user_metadata?.full_name || 'Admin';
                    const systemText = `${userDisplayName} changed this group's icon`;

                    await Promise.all([
                        supabase.from(table).update({
                            group_icon: uploadResult.url,
                            last_message: {
                                text: systemText,
                                sender_id: null,
                                created_at: new Date().toISOString()
                            },
                            updated_at: new Date().toISOString()
                        }).eq('id', chatId),
                        supabase.from('messages').insert({
                            chat_id: chatId,
                            chat_type: 'group',
                            sender_id: 'system',
                            sender_name: 'System',
                            type: 'system',
                            text: systemText,
                            status: 'sent'
                        })
                    ]);

                    queryClient.invalidateQueries({ queryKey: ['groupChat', chatId] });
                }
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
                !group?.participants.includes(user.id) && user.id !== currentUser?.id
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
            await workersApi('/group_chats/add-member', { body: {
                chatId,
                memberId: user.id,
                collectionName: 'group_chats',
            } });

            setShowAddMember(false);
            setSearchQuery('');
            setSearchResults([]);
            queryClient.invalidateQueries({ queryKey: ['groupChat', chatId] });
        } catch (error) {
            Alert.alert('Error', 'Failed to add member.');
        }
    };

    const removeMember = (member: Member) => {
        if (!isAdmin || member.id === currentUser?.id) return;

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
                            await workersApi('/group_chats/remove-member', { body: {
                                chatId,
                                memberId: member.id,
                                collectionName: 'group_chats',
                            } });

                            queryClient.invalidateQueries({ queryKey: ['groupChat', chatId] });
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove member.');
                        }
                    },
                },
            ]
        );
    };

    const toggleAdmin = (member: Member) => {
        if (!isCreator || member.id === currentUser?.id) return;

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
                            const endpoint = newRole === 'admin' ? '/group_chats/promote-admin' : '/group_chats/demote-admin';
                            await workersApi(endpoint, { body: {
                                chatId,
                                memberId: member.id,
                                collectionName: 'group_chats',
                            } });
                            queryClient.invalidateQueries({ queryKey: ['groupChat', chatId] });
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
                            await workersApi('/group_chats/leave', { body: {
                                chatId,
                                collectionName: 'group_chats',
                            } });

                            router.replace('/');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to leave group.');
                        }
                    },
                },
            ]
        );
    };

    const renderMember = ({ item }: { item: Member }) => {
        const isMe = item.id === currentUser?.id;

        return (
            <TouchableOpacity
                style={[styles.memberItem, { backgroundColor: colors.card }]}
                onPress={() => {
                    if (!isMe) router.push({ pathname: '/profile/[id]', params: { id: item.id } });
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
                <DefaultAvatar
                    uri={item.photoURL}
                    name={item.displayName}
                    size={44}
                />
                <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                        {item.displayName} {isMe && '(You)'}
                    </Text>
                    <Text style={[styles.memberRole, { color: item.role === 'admin' ? '#10B981' : colors.textSecondary }]}>
                        {item.role === 'admin' ? 'Admin' : 'Member'}
                    </Text>
                </View>
                {!isMe && <Icon name="CaretRight" size={20} color={colors.textSecondary} />}
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
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Icon name="CaretLeft" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Group Info</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Group Icon & Name */}
                <View style={styles.groupHeader}>
                    <TouchableOpacity onPress={isAdmin ? updateGroupIcon : undefined}>
                        <DefaultAvatar
                            uri={group?.groupIcon}
                            name={group?.groupName || 'Group'}
                            size={100}
                            isGroup={true}
                        />
                        {isAdmin && (
                            <View style={[styles.editIconBadge, { backgroundColor: colors.primary }]}>
                                <Icon name="Camera" size={14} color="#fff" />
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
                                <Icon name="Check" size={24} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setEditing(false)}>
                                <Icon name="X" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.nameRow} onPress={isAdmin ? () => setEditing(true) : undefined}>
                            <Text style={[styles.groupName, { color: colors.text }]}>{group?.groupName}</Text>
                            {isAdmin && <Icon name="PencilSimple" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
                        </TouchableOpacity>
                    )}

                    <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
                        {(group?.participants?.length || group?.memberCount || members.length)} members
                    </Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsSection}>
                    {isAdmin && (
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.card }]}
                            onPress={() => setShowAddMember(true)}
                        >
                            <Icon name="UserPlus" size={20} color={colors.primary} />
                            <Text style={[styles.actionText, { color: colors.text }]}>Add Members</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.card }]}
                        onPress={leaveGroup}
                    >
                        <Icon name="SignOut" size={20} color="#EF4444" />
                        <Text style={[styles.actionText, { color: '#EF4444' }]}>Leave Group</Text>
                    </TouchableOpacity>
                </View>

                {/* Members */}
                <View style={styles.membersSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MEMBERS</Text>
                    <TypedFlashList
                        data={members}
                        renderItem={renderMember}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                        estimatedItemSize={60}
                    />
                </View>
            </ScrollView>

            {/* Add Member Modal */}
            <Modal
                visible={showAddMember}
                animationType="slide"
                transparent={false}
                onRequestClose={() => {
                    setShowAddMember(false);
                    setSearchQuery('');
                    setSearchResults([]);
                }}
            >
                <SafeAreaView style={[styles.fullScreenModal, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Add Members</Text>
                        <TouchableOpacity onPress={() => { setShowAddMember(false); setSearchQuery(''); setSearchResults([]); }}>
                            <Icon name="X" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.searchContainer, { backgroundColor: colors.card, marginBottom: SPACING.md }]}>
                        <Icon name="MagnifyingGlass" size={20} color={colors.textSecondary} />
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
                        <TypedFlashList
                            data={searchResults}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.searchResultItem, { backgroundColor: colors.card }]}
                                    onPress={() => addMember(item)}
                                >
                                    <DefaultAvatar
                                        uri={item.photoURL}
                                        name={item.displayName}
                                        size={40}
                                    />
                                    <Text style={[styles.searchName, { color: colors.text }]}>{item.displayName}</Text>
                                    <Icon name="PlusCircle" size={24} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                searchQuery.length > 0 ? (
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found</Text>
                                ) : null
                            }
                            contentContainerStyle={{ paddingTop: SPACING.md }}
                            estimatedItemSize={60}
                        />
                    )}
                </SafeAreaView>
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
    fullScreenModal: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
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
