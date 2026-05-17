import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Animated, Alert, Modal, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../components/Icon';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';
import TripCard from '../components/TripCard';
import ProfilePictureViewer from '../components/ProfilePictureViewer';
import DefaultAvatar from '../components/DefaultAvatar';
import ActionReasonModal from '../components/ActionReasonModal';
import { deleteProfileImageFromR2, pickAndUploadImage } from '../utils/imageUpload';
import { cancelTrip } from '../utils/tripActions';
import ReportTripModal from '../components/ReportTripModal';
import useUserProfileQuery from '../hooks/useUserProfileQuery';

const { width } = Dimensions.get('window');

const CANCEL_REASONS = [
    'Host is unavailable',
    'Safety or logistics issue',
    'Weather or route issue',
    'Trip plan changed',
    'Other',
];

const UserProfileScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const queryClient = useQueryClient();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const userId = (params.id as string) || (params.userId as string) || currentUser?.id;

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setCurrentUser(session?.user || null);
        });
        return () => subscription.unsubscribe();
    }, []);

    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const isOwnProfile = userId === currentUser?.id;
    const { user, trips, hostRating, loading } = useUserProfileQuery(userId, isOwnProfile);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [profileImageObjectKey, setProfileImageObjectKey] = useState<string | null>(null);
    const [showFullImage, setShowFullImage] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileImage(user.photoURL);
            setProfileImageObjectKey(user.photoObjectKey);
        }
    }, [user]);

    // Modal States
    const [activeModal, setActiveModal] = useState<'none' | 'report'>('none');
    const [selectedTrip, setSelectedTrip] = useState<any>(null);
    const [tripCancelTargetId, setTripCancelTargetId] = useState<string | null>(null);
    const [cancellingTrip, setCancellingTrip] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Header Animation Refs
    const headerTranslateY = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const HEADER_HEIGHT = 60 + insets.top;

    const handleScroll = (event: any) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const direction = currentScrollY > lastScrollY.current ? 'down' : 'up';

        if (currentScrollY > HEADER_HEIGHT) {
            if (direction === 'down') {
                Animated.timing(headerTranslateY, {
                    toValue: -HEADER_HEIGHT,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            } else {
                Animated.timing(headerTranslateY, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            }
        } else if (currentScrollY < 0) {
            Animated.timing(headerTranslateY, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
            }).start();
        }
        lastScrollY.current = currentScrollY;
    };



    const handleCreateButtonPress = () => setShowCreateModal(true);


    const handleMessage = async () => {
        if (!currentUser) {
            Alert.alert('Sign In Required', 'Please sign in to send messages.');
            return;
        }
        if (!userId || !user) return;

        try {
            const { data: existingChats } = await supabase
                .from('chats')
                .select('*')
                .eq('type', 'direct')
                .contains('participants', [currentUser.id]);

            let chatId = null;
            for (const chat of (existingChats || [])) {
                if (chat.participants && chat.participants.includes(userId)) {
                    chatId = chat.id;
                    break;
                }
            }

            if (!chatId) {
                const { data: profile } = await supabase.from('profiles').select('name, display_name, photo_url').eq('id', currentUser.id).maybeSingle();
                const myName = profile?.name || profile?.display_name || currentUser.user_metadata?.full_name || 'User';
                const myPhoto = profile?.photo_url || currentUser.user_metadata?.avatar_url || '';

                const { data: newChat } = await supabase.from('chats').insert({
                    type: 'direct',
                    created_by: currentUser.id,
                    participants: [currentUser.id, userId],
                    participant_details: {
                        [currentUser.id]: { displayName: myName, photoURL: myPhoto },
                        [userId]: { displayName: user.displayName || user.name || 'User', photoURL: user.photoURL || '' },
                    },
                    unread_count: { [currentUser.id]: 0, [userId]: 0 },
                    muted_by: [],
                    pinned_by: [],
                }).select('id').single();
                chatId = newChat?.id;
            }

            router.push({
                pathname: '/chat/[id]',
                params: {
                    id: chatId,
                    otherUserId: userId,
                    otherUserName: user.displayName || user.name || 'User',
                    otherUserPhoto: user.photoURL || '',
                }
            });
        } catch (error) {
            Alert.alert('Error', 'Could not start chat.');
        }
    };

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
                    onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
                    onReportPress={() => {
                        setSelectedTrip(trip);
                        setActiveModal('report');
                    }}
                    showOptions={false}
                    mode="join"
                    hideProfileInfo={true}
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
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Icon name="CaretLeft" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.loadingContainer}>
                    <Icon name="User" size={64} color={colors.textSecondary} />
                    <Text style={[styles.notFoundText, { color: colors.text }]}>User not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                    <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.card }]} onPress={() => router.back()}>
                        <Icon name="CaretLeft" size={24} color={colors.text} />
                    </TouchableOpacity>
                    {isOwnProfile && (
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.card }]} onPress={handleCreateButtonPress}>
                            <Icon name="Plus" size={24} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: HEADER_HEIGHT }}
            >
                <View style={styles.profileContent}>
                    <View style={styles.headerProfileRow}>
                        <TouchableOpacity onPress={() => (profileImage || user.photoURL) ? setShowFullImage(true) : null}>
                            <DefaultAvatar
                                uri={profileImage || user.photoURL}
                                name={user.displayName}
                                size={80}
                                style={styles.avatar}
                            />
                        </TouchableOpacity>

                        <View style={styles.userInfoColumn}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>{user.displayName}</Text>
                            </View>
                            {user.username && <Text style={[styles.displayUsername, { color: colors.textSecondary }]}>@{user.username}</Text>}
                            {hostRating && (
                                <View style={styles.ratingContainer}>
                                    <Icon name="Star" size={12} color="#F59E0B" weight="fill" />
                                    <Text style={styles.ratingScore}>{hostRating.average}</Text>
                                    <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>({hostRating.count})</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.statsColumn}>
                            <Text style={[styles.statValue, { color: colors.text }]}>{trips.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
                        </View>
                    </View>

                    {user.bio ? <Text style={[styles.bioText, { color: colors.text }]}>{user.bio}</Text> : null}

                    {currentUser && !isOwnProfile && (
                        <View style={styles.actionButtonsContainer}>
                            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleMessage}>
                                <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Message</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </View>

                <View style={styles.contentSection}>
                    <View style={styles.tabsHeader}>
                        <View style={[styles.activeTab, { borderBottomColor: colors.text }]}>
                            <Icon name="SquaresFour" size={20} color={colors.text} />
                        </View>
                    </View>

                    {trips.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Icon name="Camera" size={40} color={colors.textSecondary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Posts Yet</Text>
                        </View>
                    ) : (
                        renderTripGrid()
                    )}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            <ProfilePictureViewer
                visible={showFullImage}
                imageUrl={profileImage || user?.photoURL}
                imageObjectKey={profileImageObjectKey || user?.photoObjectKey || null}
                userName={user?.displayName}
                isOwnProfile={isOwnProfile}
                onClose={() => setShowFullImage(false)}
                onDeleted={() => {
                    setProfileImage(null);
                    setProfileImageObjectKey(null);
                    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
                }}
            />

            <ReportTripModal
                visible={activeModal === 'report'}
                onClose={() => { setActiveModal('none'); setSelectedTrip(null); }}
                trip={selectedTrip}
            />

            <ActionReasonModal
                visible={!!tripCancelTargetId}
                title="Cancel Trip"
                subtitle="Joined travelers will be notified with your reason."
                actionLabel="Cancel Trip"
                actionTone="danger"
                reasons={CANCEL_REASONS}
                loading={cancellingTrip}
                onClose={() => setTripCancelTargetId(null)}
                onSubmit={async (reason) => {
                    if (!tripCancelTargetId) return;
                    setCancellingTrip(true);
                    try {
                        await cancelTrip(tripCancelTargetId, reason);
                        queryClient.invalidateQueries({ queryKey: ['userTrips', userId] });
                        setTripCancelTargetId(null);
                    } catch (error: any) {
                        Alert.alert('Error', error?.message || 'Failed to cancel trip.');
                    } finally {
                        setCancellingTrip(false);
                    }
                }}
            />

            <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCreateModal(false)}>
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 300 }}
                        style={[styles.createModalContent, { backgroundColor: colors.background }]}
                    >
                        <Text style={[styles.createModalTitle, { color: colors.text }]}>Create New Trip ✈️</Text>
                        <TouchableOpacity style={[styles.createOption, { backgroundColor: colors.card }]} onPress={() => { setShowCreateModal(false); router.push('/trip/create'); }}>
                            <View style={[styles.createOptionIcon, { backgroundColor: '#E0E7FF' }]}><Icon name="PencilSimple" size={24} color="#6366F1" /></View>
                            <View style={styles.createOptionText}>
                                <Text style={[styles.createOptionTitle, { color: colors.text }]}>Manual Trip Planning</Text>
                                <Text style={[styles.createOptionDesc, { color: colors.textSecondary }]}>Fill in details and add photos</Text>
                            </View>
                            <Icon name="CaretRight" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.createOption, { backgroundColor: colors.card }]} onPress={() => { setShowCreateModal(false); router.push('/trip/ai-planner'); }}>
                            <View style={[styles.createOptionIcon, { backgroundColor: '#EDE9FE' }]}><Icon name="Sparkle" size={24} color="#8B5CF6" /></View>
                            <View style={styles.createOptionText}>
                                <Text style={[styles.createOptionTitle, { color: colors.text }]}>AI Trip Planning</Text>
                                <Text style={[styles.createOptionDesc, { color: colors.textSecondary }]}>Let AI plan and generate images</Text>
                            </View>
                            <Icon name="CaretRight" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </MotiView>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    notFoundText: { fontSize: FONT_SIZE.xl, fontWeight: 'bold', marginTop: SPACING.lg },
    backBtn: { padding: SPACING.lg },
    stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    profileContent: { paddingHorizontal: 20 },
    headerProfileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    avatar: { width: 80, height: 80, borderRadius: 40 },
    userInfoColumn: { flex: 1, marginLeft: 16, justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    displayName: { fontSize: 20, fontWeight: '700' },
    displayUsername: { fontSize: 14, marginTop: 2 },
    ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    ratingScore: { fontSize: 13, fontWeight: '700', color: '#B45309' },
    ratingCount: { fontSize: 12 },
    statsColumn: { alignItems: 'center', paddingLeft: 10 },
    statValue: { fontSize: 18, fontWeight: '700' },
    statLabel: { fontSize: 12 },
    bioText: { marginTop: 16, fontSize: 15, lineHeight: 22 },
    actionButtonsContainer: { flexDirection: 'row', gap: 12, marginTop: 24 },
    primaryBtn: { flex: 1, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    primaryBtnText: { fontSize: 15, fontWeight: '600' },
    secondaryBtn: { flex: 1, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    secondaryBtnText: { fontSize: 15, fontWeight: '600' },
    contentSection: { marginTop: 24 },
    tabsHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 2 },
    activeTab: { paddingBottom: 12, borderBottomWidth: 2, width: 60, alignItems: 'center' },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
    postsContainer: { marginTop: 0 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    createModalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    createModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    createOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12 },
    createOptionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    createOptionText: { flex: 1 },
    createOptionTitle: { fontSize: 16, fontWeight: 'bold' },
    createOptionDesc: { fontSize: 14 },
});

export default UserProfileScreen;
