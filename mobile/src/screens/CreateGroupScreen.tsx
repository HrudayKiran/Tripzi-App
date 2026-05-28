import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Image,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    BackHandler,
} from 'react-native';
import { FlashList } from "@shopify/flash-list";

const TypedFlashList = FlashList as any;
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from '../components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';
import { supabase } from '../lib/supabase';
import { searchUsersByPrefix } from '../utils/searchUsers';
import { pickAndUploadImage } from '../utils/imageUpload';

interface User {
    id: string;
    displayName: string;
    username?: string;
    photoURL?: string;
}

const CreateGroupScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();

    // Use state for currentUser to properly handle auth state
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setCurrentUser(session?.user || null);
        });
        return () => subscription.unsubscribe();
    }, []);

    const [step, setStep] = useState<'select' | 'details'>('select');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [searching, setSearching] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupIcon, setGroupIcon] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        const backAction = () => {
            if (searchQuery !== '') {
                setSearchQuery('');
                setSearchResults([]);
                return true;
            }
            if (step === 'details') {
                setStep('select');
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [searchQuery, step]);




    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const users = await searchUsersByPrefix(query, 10);
            const results: User[] = users
                .filter((u) => u.id !== currentUser?.id)
                .map((u) => ({
                    id: u.id,
                    displayName: u.displayName || 'User',
                    username: u.username,
                    photoURL: u.photoURL,
                }));

            setSearchResults(results);
        } catch (error) {

        } finally {
            setSearching(false);
        }
    };

    const toggleUserSelection = (user: User) => {
        if (selectedUsers.some((u) => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const pickGroupIcon = async () => {
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
                setGroupIcon(result.assets[0].uri);
            }
        } catch (error) {

        }
    };

    const createGroup = async () => {
        if (!currentUser || selectedUsers.length < 1) {
            Alert.alert('Error', 'Please select at least one member.');
            return;
        }
        if (!groupName.trim()) {
            Alert.alert('Error', 'Please enter a group name.');
            return;
        }

        setCreating(true);
        try {
            // Upload group icon if selected
            let groupIconUrl = '';
            if (groupIcon) {
                const result = await pickAndUploadImage({
                    folder: 'chats',
                    userId: currentUser.id,
                    existingUri: groupIcon,
                });
                if (result.success && result.url) groupIconUrl = result.url;
            }

            // Get current user profile
            const { data: profile } = await supabase.from('profiles').select('name, display_name, photo_url').eq('id', currentUser.id).maybeSingle();
            const userData: any = profile || {};

            // Prepare participants
            const participants = [currentUser.id, ...selectedUsers.map((u) => u.id)];
            const participantDetails: { [key: string]: any } = {
                [currentUser.id]: {
                    displayName: userData.name || userData.display_name || currentUser.user_metadata?.full_name || 'User',
                    photoURL: userData.photo_url || currentUser.user_metadata?.avatar_url || '',
                    role: 'admin',
                },
            };

            selectedUsers.forEach((user) => {
                participantDetails[user.id] = {
                    displayName: user.displayName || 'User',
                    photoURL: user.photoURL || '',
                    role: 'member',
                };
            });

            // Create group chat
            const { data: chatRow, error: chatErr } = await supabase.from('group_chats').insert({
                group_name: groupName.trim(),
                group_icon: groupIconUrl,
                participants,
                participant_details: participantDetails,
                created_by: currentUser.id,
                admins: [currentUser.id],
                unread_count: participants.reduce((acc, uid) => { acc[uid] = 0; return acc; }, {} as { [key: string]: number }),
                muted_by: [],
                pinned_by: [],
                last_message: `${userData.name || userData.display_name || 'Someone'} created the group "${groupName.trim()}"`,
            }).select('id').single();
            if (chatErr || !chatRow) throw chatErr || new Error('Failed');

            // Add system message
            await supabase.from('messages').insert({
                group_chat_id: chatRow.id,
                chat_id: null,
                sender_id: 'system',
                sender_name: 'System',
                type: 'system',
                text: `${userData.name || userData.display_name || 'Someone'} created the group "${groupName.trim()}"`,
                status: 'sent',
                read_by: {},
                delivered_to: [],
                deleted_for: [],
            });

            router.replace({
                pathname: '/chat/[id]',
                params: {
                    id: chatRow.id,
                    chatId: chatRow.id,
                    collectionName: 'group_chats',
                    isGroupChat: 'true',
                    otherUserName: groupName.trim(),
                    otherUserPhoto: groupIconUrl || undefined,
                }
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to create group. Please try again.');
        } finally {
            setCreating(false);
        }
    };

    const renderUserItem = ({ item }: { item: User }) => {
        const isSelected = selectedUsers.some((u) => u.id === item.id);

        return (
            <TouchableOpacity
                style={[styles.userItem, { backgroundColor: colors.card }]}
                onPress={() => toggleUserSelection(item)}
                activeOpacity={0.7}
            >
                {item.photoURL ? (
                    <Image source={{ uri: item.photoURL }} style={styles.userAvatar} />
                ) : (
                    <View style={[styles.userAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                        <Text style={styles.userAvatarText}>{item.displayName?.charAt(0)?.toUpperCase() || 'U'}</Text>
                    </View>
                )}
                <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                        <Text style={[styles.userName, { color: colors.text }]}>{item.displayName}</Text>
                    </View>
                    {item.username && (
                        <Text style={[styles.userUsername, { color: colors.primary }]}>@{item.username}</Text>
                    )}
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected, { borderColor: colors.primary }]}>
                    {isSelected && <Icon name="Check" size={16} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    const renderSelectedUser = ({ item }: { item: User }) => (
        <TouchableOpacity style={styles.selectedUserItem} onPress={() => toggleUserSelection(item)}>
            {item.photoURL ? (
                <Image source={{ uri: item.photoURL }} style={styles.selectedUserAvatar} />
            ) : (
                <View style={[styles.selectedUserAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={styles.selectedUserAvatarText}>{item.displayName?.charAt(0)?.toUpperCase()}</Text>
                </View>
            )}
            <View style={styles.removeSelectedBadge}>
                <Icon name="X" size={12} color="#fff" />
            </View>
            <Text style={[styles.selectedUserName, { color: colors.text }]} numberOfLines={1}>
                {item.displayName?.split(' ')[0]}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
            >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Icon name="CaretLeft" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        {step === 'select' ? 'New Group' : 'Group Details'}
                    </Text>
                    {step === 'select' && selectedUsers.length > 0 && (
                        <TouchableOpacity
                            style={[styles.nextButton, { backgroundColor: colors.primary }]}
                            onPress={() => setStep('details')}
                        >
                            <Text style={styles.nextButtonText}>Next</Text>
                        </TouchableOpacity>
                    )}
                    {step === 'details' && (
                        <TouchableOpacity
                            style={[styles.nextButton, { backgroundColor: creating ? colors.border : colors.primary }]}
                            onPress={createGroup}
                            disabled={creating}
                        >
                            {creating ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.nextButtonText}>Create</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {step === 'select' ? (
                    <>
                        {/* Search */}
                        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
                            <Icon name="MagnifyingGlass" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search users..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={handleSearch}
                            />
                        </View>

                        {/* Selected users */}
                        {selectedUsers.length > 0 && (
                            <View style={styles.selectedContainer}>
                                <TypedFlashList
                                    data={selectedUsers}
                                    renderItem={renderSelectedUser}
                                    keyExtractor={(item) => item.id}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.selectedList}
                                    keyboardShouldPersistTaps="handled"
                                    estimatedItemSize={60}
                                />
                            </View>
                        )}

                        {/* User list */}
                        {searching ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color={colors.primary} />
                            </View>
                        ) : (
                            <TypedFlashList
                                data={searchResults}
                                renderItem={renderUserItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.userList}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                                ListHeaderComponent={
                                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                                        {searchQuery.length > 0 ? 'Search Results' : 'Search users to add'}
                                    </Text>
                                }
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Icon name="Users" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                            {searchQuery.length > 0 ? 'No users found' : 'Start typing to find people'}
                                        </Text>
                                        {searchQuery.length === 0 && (
                                            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                                                Use the search bar above to find users
                                            </Text>
                                        )}
                                    </View>
                                }
                                estimatedItemSize={80}
                            />
                        )}
                    </>
                ) : (
                    /* Group Details Step */
                    <View style={styles.detailsContainer}>
                        <TouchableOpacity style={styles.iconPicker} onPress={pickGroupIcon}>
                            {groupIcon ? (
                                <Image source={{ uri: groupIcon }} style={styles.groupIconPreview} />
                            ) : (
                                <View style={[styles.iconPlaceholder, { backgroundColor: colors.card }]}>
                                    <Icon name="Camera" size={32} color={colors.textSecondary} />
                                </View>
                            )}
                            <View style={[styles.editIconBadge, { backgroundColor: colors.primary }]}>
                                <Icon name="Pencil" size={12} color="#fff" />
                            </View>
                        </TouchableOpacity>

                        <TextInput
                            style={[styles.groupNameInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                            placeholder="Group Name"
                            placeholderTextColor={colors.textSecondary}
                            value={groupName}
                            onChangeText={setGroupName}
                            maxLength={50}
                        />

                        <Text style={[styles.membersLabel, { color: colors.textSecondary }]}>
                            {selectedUsers.length + 1} members (including you)
                        </Text>

                        <TypedFlashList
                            data={selectedUsers}
                            renderItem={({ item }) => (
                                <View style={[styles.memberItem, { backgroundColor: colors.card }]}>
                                    {item.photoURL ? (
                                        <Image source={{ uri: item.photoURL }} style={styles.memberAvatar} />
                                    ) : (
                                        <View style={[styles.memberAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                                            <Text style={styles.memberAvatarText}>{item.displayName?.charAt(0)?.toUpperCase()}</Text>
                                        </View>
                                    )}
                                    <Text style={[styles.memberName, { color: colors.text }]}>{item.displayName}</Text>
                                </View>
                            )}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.membersList}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                            estimatedItemSize={72}
                        />
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    keyboardContainer: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1 },
    backButton: { padding: SPACING.sm },
    headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginLeft: SPACING.sm },
    nextButton: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
    nextButtonText: { color: '#fff', fontWeight: FONT_WEIGHT.semibold },
    searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.lg, marginVertical: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
    searchInput: { flex: 1, marginLeft: SPACING.sm, fontSize: FONT_SIZE.md },
    selectedContainer: { paddingVertical: SPACING.sm, borderBottomWidth: 1 },
    selectedList: { paddingHorizontal: SPACING.lg },
    selectedUserItem: { alignItems: 'center', marginRight: SPACING.md, width: 60 },
    selectedUserAvatar: { width: 50, height: 50, borderRadius: 25 },
    selectedUserAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    selectedUserAvatarText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    removeSelectedBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#EF4444', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
    selectedUserName: { fontSize: FONT_SIZE.xs, marginTop: 4, textAlign: 'center' },
    sectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm, marginHorizontal: SPACING.lg },
    userList: { paddingVertical: SPACING.md },
    userItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg },
    userAvatar: { width: 48, height: 48, borderRadius: 24 },
    userAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    userAvatarText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    userInfo: { flex: 1, marginLeft: SPACING.md },
    userNameRow: { flexDirection: 'row', alignItems: 'center' },
    userName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    userUsername: { fontSize: FONT_SIZE.sm, marginTop: 2 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    checkboxSelected: { backgroundColor: '#9d74f7', borderColor: '#9d74f7' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { padding: SPACING.xl, alignItems: 'center' },
    emptyText: { fontSize: FONT_SIZE.md, textAlign: 'center' },
    emptyHint: { fontSize: FONT_SIZE.sm, marginTop: SPACING.sm, textAlign: 'center' },
    // Details step
    detailsContainer: { flex: 1, padding: SPACING.xl },
    iconPicker: { alignSelf: 'center', marginBottom: SPACING.xl },
    groupIconPreview: { width: 100, height: 100, borderRadius: 50 },
    iconPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    editIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    groupNameInput: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, fontSize: FONT_SIZE.lg, textAlign: 'center', borderWidth: 1 },
    membersLabel: { fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: SPACING.xl, marginBottom: SPACING.md },
    membersList: { paddingTop: SPACING.sm },
    memberItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
    memberAvatar: { width: 40, height: 40, borderRadius: 20 },
    memberAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    memberAvatarText: { color: '#fff', fontWeight: FONT_WEIGHT.bold },
    memberName: { flex: 1, marginLeft: SPACING.md, fontSize: FONT_SIZE.md },
});

export default CreateGroupScreen;
