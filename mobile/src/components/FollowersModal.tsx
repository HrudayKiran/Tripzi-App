import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, TextInput, Animated, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const { width } = Dimensions.get('window');

interface FollowersModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    users: any[];
    onUserPress: (userId: string) => void;
}

const FollowersModal = ({ visible, onClose, title, users, onUserPress }: FollowersModalProps) => {
    const { colors, isDarkMode } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const slideAnim = useRef(new Animated.Value(width)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: width,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const filteredUsers = users.filter(user =>
        user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderUser = ({ item, index }) => (
        <Animatable.View animation="fadeInRight" delay={index * 30}>
            <TouchableOpacity
                style={[styles.userItem, { backgroundColor: colors.card }]}
                onPress={() => onUserPress(item.id)}
                activeOpacity={0.7}
            >
                <Image source={{ uri: item.photoURL || undefined }} style={styles.avatar} />
                <View style={styles.userInfo}>
                    <Text style={[styles.displayName, { color: colors.text }]}>{item.displayName || 'User'}</Text>
                    {item.username && <Text style={[styles.username, { color: colors.primary }]}>@{item.username}</Text>}
                    {item.bio && <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={1}>{item.bio}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
        </Animatable.View>
    );

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
            <Animated.View style={[styles.container, { backgroundColor: colors.background, transform: [{ translateX: slideAnim }] }]}>
                <SafeAreaView style={styles.safeArea} edges={['top']}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Search Bar */}
                    <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
                        <Ionicons name="search" size={20} color={colors.textSecondary} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder={`Search ${title.toLowerCase()}...`}
                            placeholderTextColor={colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* User List */}
                    <FlatList
                        data={filteredUsers}
                        renderItem={renderUser}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    {searchQuery ? 'No users found' : `No ${title.toLowerCase()} yet`}
                                </Text>
                            </View>
                        }
                    />
                </SafeAreaView>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    container: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 20,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: FONT_SIZE.md,
        paddingVertical: SPACING.xs,
    },
    listContent: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xxxl,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.sm,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: SPACING.md,
    },
    userInfo: {
        flex: 1,
    },
    displayName: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
    username: {
        fontSize: FONT_SIZE.sm,
        marginTop: 2,
    },
    bio: {
        fontSize: FONT_SIZE.sm,
        marginTop: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: SPACING.xxxl * 2,
    },
    emptyText: {
        fontSize: FONT_SIZE.md,
        marginTop: SPACING.lg,
    },
});

export default FollowersModal;
