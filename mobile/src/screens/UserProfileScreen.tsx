import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NeumorphicBackButton, NeumorphicIconButton } from '../components/NeumorphicIconButtons';

import Icon from '../components/Icon';

import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import ProfilePictureViewer from '../components/ProfilePictureViewer';
import DefaultAvatar from '../components/DefaultAvatar';
import useUserProfileQuery from '../hooks/useUserProfileQuery';
import { useChatsQuery } from '../hooks/useChatsQuery';



const UserProfileScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const queryClient = useQueryClient();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const userId = (params.id as string) || (params.userId as string) || currentUser?.id;

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setCurrentUser(session?.user || null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setCurrentUser(session?.user || null);
        });
        return () => subscription.unsubscribe();
    }, []);

    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const isOwnProfile = userId === currentUser?.id;
    const { user, loading } = useUserProfileQuery(userId, isOwnProfile);
    const { getOrCreateDirectChat } = useChatsQuery();
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [profileImageObjectKey, setProfileImageObjectKey] = useState<string | null>(null);
    const [showFullImage, setShowFullImage] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileImage(user.photoURL);
            setProfileImageObjectKey(user.photoObjectKey);
        }
    }, [user]);

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



    // Delegates to the hook's getOrCreateDirectChat which handles
    // in-memory check → DB check → create atomically, eliminating the
    // race condition that caused duplicate chats.
    const handleMessage = async () => {
        if (!currentUser) {
            Alert.alert('Sign In Required', 'Please sign in to send messages.');
            return;
        }
        if (!userId || !user) return;

        try {
            const chatId = await getOrCreateDirectChat(userId, {
                displayName: (user as any).displayName || 'User',
                photoURL: (user as any).photoURL || '',
            });

            router.push({
                pathname: '/chat/[id]',
                params: {
                    id: chatId,
                    otherUserId: userId,
                    otherUserName: (user as any).displayName || 'User',
                    otherUserPhoto: (user as any).photoURL || '',
                }
            });
        } catch (error) {
            Alert.alert('Error', 'Could not start chat.');
        }
    };

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
                <View style={{ paddingHorizontal: SPACING.lg, paddingTop: 20, paddingBottom: 20 }}>
                    <NeumorphicBackButton onPress={() => router.back()} />
                </View>
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
                    <NeumorphicBackButton onPress={() => router.back()} />
                    {isOwnProfile ? (
                        <NeumorphicIconButton iconName="Plus" onPress={() => router.push('/(tabs)/')} />
                    ) : (
                        <View style={{ width: 45 }} />
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
                        </View>
                    </View>

                    {currentUser && !isOwnProfile && (
                        <View style={styles.actionButtonsContainer}>
                            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleMessage}>
                                <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Message</Text>
                            </TouchableOpacity>
                        </View>
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

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    notFoundText: { fontSize: 18, fontWeight: 'bold', marginTop: 16 },
    stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    profileContent: { paddingHorizontal: 20, paddingTop: 10 },
    headerProfileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    avatar: { width: 80, height: 80, borderRadius: 40 },
    userInfoColumn: { flex: 1, marginLeft: 16, justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    displayName: { fontSize: 20, fontWeight: '700' },
    displayUsername: { fontSize: 14, marginTop: 2 },
    actionButtonsContainer: { flexDirection: 'row', gap: 12, marginTop: 24 },
    primaryBtn: { flex: 1, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    primaryBtnText: { fontSize: 15, fontWeight: '600' },

});

export default UserProfileScreen;
