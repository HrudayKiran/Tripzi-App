import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Modal, Dimensions, Animated, NativeSyntheticEvent, NativeScrollEvent, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import TripCard from '../components/TripCard';
import DefaultAvatar from '../components/DefaultAvatar';
import useTrips from '../api/useTrips';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import NotificationsModal from '../components/NotificationsModal';
import FilterModal, { FilterOptions } from '../components/FilterModal';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

import firestore from '@react-native-firebase/firestore';
import AppLogo from '../components/AppLogo';
import ReportTripModal from '../components/ReportTripModal'; // Imported

const { width, height } = Dimensions.get('window');

const FeedScreen = ({ navigation }) => {
    const { trips, loading, refetch } = useTrips();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [searchVisible, setSearchVisible] = useState(false);
    const [filters, setFilters] = useState<FilterOptions | null>(null);
    const [hasNotifications, setHasNotifications] = useState(true);
    const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [focusedTripId, setFocusedTripId] = useState<string | null>(null);

    // Hoisted Modal State
    const [activeModal, setActiveModal] = useState<'none' | 'report'>('none');
    const [selectedTrip, setSelectedTrip] = useState<any>(null);

    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    // Viewability config for auto-play videos - stricter threshold
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 60, // Require 60% visibility
        minimumViewTime: 300, // Wait 300ms before considering valid
    }).current;

    const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            // Play the first fully visible item (or the one closest to top)
            setFocusedTripId(viewableItems[0].key);
        } else {
            setFocusedTripId(null);
        }
    }, []);

    // Sticky header animation
    const scrollY = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const headerTranslateY = useRef(new Animated.Value(0)).current;
    const HEADER_HEIGHT = 60 + insets.top;

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const direction = currentScrollY > lastScrollY.current ? 'down' : 'up';

        if (direction === 'down' && currentScrollY > HEADER_HEIGHT) {
            // Hide header
            Animated.timing(headerTranslateY, {
                toValue: -HEADER_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else if (direction === 'up') {
            // Show header
            Animated.timing(headerTranslateY, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }

        lastScrollY.current = currentScrollY;
    }, [HEADER_HEIGHT, headerTranslateY]);

    // Search users when query changes
    useEffect(() => {
        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        if (searchQuery.length < 2) {
            setSearchedUsers([]);
            return;
        }

        setSearchingUsers(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const searchLower = searchQuery.toLowerCase();
                const usersSnapshot = await firestore()
                    .collection('users')
                    .limit(10)
                    .get();

                const matchedUsers = usersSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(user =>
                        user.displayName?.toLowerCase().includes(searchLower) ||
                        user.username?.toLowerCase().includes(searchLower) ||
                        user.email?.toLowerCase().includes(searchLower)
                    )
                    .slice(0, 5);

                setSearchedUsers(matchedUsers);
            } catch (error) {
                // Search error

                setSearchedUsers([]);
            } finally {
                setSearchingUsers(false);
            }
        }, 300);

        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, [searchQuery]);

    const filteredTrips = useMemo(() => {
        let result = [...trips];

        // Search filter
        if (searchQuery) {
            result = result.filter(trip =>
                trip.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                trip.location?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Apply additional filters
        if (filters) {
            if (filters.destination) {
                result = result.filter(trip =>
                    trip.location?.toLowerCase().includes(filters.destination.toLowerCase())
                );
            }
            if (filters.maxCost) {
                result = result.filter(trip => (trip.cost || 0) <= filters.maxCost);
            }
            if (filters.maxTravelers) {
                result = result.filter(trip => (trip.travelers || 1) <= filters.maxTravelers);
            }
            if (filters.minDays && filters.minDays > 1) {
                result = result.filter(trip => (trip.duration || 1) >= filters.minDays);
            }
            if (filters.tripType) {
                result = result.filter(trip =>
                    trip.tripTypes?.some(t => t.toLowerCase().includes(filters.tripType.toLowerCase()))
                );
            }
            if (filters.transportMode) {
                result = result.filter(trip =>
                    trip.transportModes?.some(t => t.toLowerCase().includes(filters.transportMode.toLowerCase()))
                );
            }
            if (filters.genderPreference && filters.genderPreference !== 'anyone') {
                result = result.filter(trip =>
                    trip.genderPreference === filters.genderPreference || trip.genderPreference === 'anyone'
                );
            }
            if (filters.sortBy) {
                switch (filters.sortBy) {
                    case 'newest':
                        result.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                        break;
                    case 'oldest':
                        result.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
                        break;
                    case 'lowestCost':
                        result.sort((a, b) => (a.cost || 0) - (b.cost || 0));
                        break;
                    case 'highestCost':
                        result.sort((a, b) => (b.cost || 0) - (a.cost || 0));
                        break;
                }
            }
        }

        return result;
    }, [trips, searchQuery, filters]);

    const handleApplyFilters = (newFilters: FilterOptions) => {
        setFilters(newFilters);
    };

    const clearFilters = () => {
        setFilters(null);
        setSearchQuery('');
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        refetch();
        setTimeout(() => setRefreshing(false), 1500);
    }, [refetch]);

    const hasActiveFilters = filters !== null || searchQuery !== '';

    // Sticky header - now rendered outside FlatList
    const renderStickyHeader = () => (
        <Animated.View
            style={[
                styles.stickyHeader,
                {
                    paddingTop: insets.top,
                    backgroundColor: colors.background,
                    transform: [{ translateY: headerTranslateY }],
                    height: HEADER_HEIGHT,
                }
            ]}
        >
            <View style={styles.headerRow}>
                <AppLogo size={28} showDot={false} />
                <Text style={[styles.headerTitle, { color: colors.text }]}>Tripzi</Text>
            </View>
            <View style={styles.headerActions}>
                <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: colors.card }]}
                    onPress={() => setSearchVisible(true)}
                >
                    <Ionicons name="search-outline" size={22} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: colors.card }]}
                    onPress={() => setFilterVisible(true)}
                >
                    <Ionicons name="options-outline" size={22} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.notifyButton, { backgroundColor: colors.card }]}
                    onPress={() => setNotificationsVisible(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="notifications-outline" size={22} color={colors.text} />
                    {hasNotifications && <View style={[styles.notificationDot, { backgroundColor: colors.error }]} />}
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // Spacer for FlatList to account for sticky header
    const ListHeaderSpacer = () => (
        <View style={{ height: HEADER_HEIGHT }} />
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Sticky Header */}
            {renderStickyHeader()}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading trips...
                    </Text>
                </View>
            ) : filteredTrips.length === 0 ? (
                <FlatList
                    key="empty-list"
                    data={[]}
                    ListHeaderComponent={ListHeaderSpacer}
                    ListEmptyComponent={
                        <Animatable.View animation="fadeIn" style={styles.emptyContainer}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="compass-outline" size={48} color={colors.primary} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>No trips found</Text>
                            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                                Try adjusting your filters or search
                            </Text>
                            {hasActiveFilters && (
                                <TouchableOpacity
                                    style={[styles.clearButton, { backgroundColor: colors.primary }]}
                                    onPress={clearFilters}
                                >
                                    <Text style={styles.clearButtonText}>Clear Filters</Text>
                                </TouchableOpacity>
                            )}
                        </Animatable.View>
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    renderItem={() => null}
                />
            ) : (
                <FlatList
                    key="content-list"
                    data={filteredTrips}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={ListHeaderSpacer}
                    renderItem={({ item }) => (
                        <TripCard
                            trip={item}
                            onPress={() => navigation.navigate('TripDetails', { tripId: item.id })}
                            isVisible={focusedTripId === item.id}
                            onReportPress={(trip) => {
                                setSelectedTrip(trip);
                                setActiveModal('report');
                            }}
                        />
                    )}
                    showsVerticalScrollIndicator={false}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    initialNumToRender={4}
                    maxToRenderPerBatch={4}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                />
            )}

            {/* Search Modal - Inlined to prevent re-mounting on state change */}
            <Modal visible={searchVisible} animationType="slide" transparent>
                <View style={[styles.searchModalContainer, { backgroundColor: colors.background }]}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={styles.searchModalHeader}>
                            <View style={[styles.searchBox, { backgroundColor: colors.inputBackground }]}>
                                <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.text }]}
                                    placeholder="Search trips, places, people..."
                                    placeholderTextColor={colors.textSecondary}
                                    onChangeText={setSearchQuery}
                                    value={searchQuery}
                                    autoFocus
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setSearchVisible(false)} style={styles.cancelButton}>
                                <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>

                        {/* User Search Results */}
                        {searchQuery.length >= 2 && searchedUsers.length > 0 && (
                            <Animatable.View animation="fadeIn" style={[styles.userResultsContainer, { backgroundColor: colors.card }]}>
                                <Text style={[styles.userResultsTitle, { color: colors.textSecondary }]}>PEOPLE</Text>
                                {searchedUsers.map((user) => (
                                    <TouchableOpacity
                                        key={user.id}
                                        style={styles.userResultItem}
                                        onPress={() => {
                                            setSearchQuery('');
                                            setSearchedUsers([]);
                                            setSearchVisible(false);
                                            navigation.navigate('UserProfile', { userId: user.id });
                                        }}
                                    >
                                        <DefaultAvatar
                                            uri={user.photoURL}
                                            size={40}
                                            style={styles.userResultAvatar}
                                        />
                                        <View style={styles.userResultInfo}>
                                            <Text style={[styles.userResultName, { color: colors.text }]}>
                                                {user.displayName || 'User'}
                                            </Text>
                                            {user.username && (
                                                <Text style={[styles.userResultUsername, { color: colors.primary }]}>
                                                    @{user.username}
                                                </Text>
                                            )}
                                        </View>
                                        {user.ageVerified === true && (
                                            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </Animatable.View>
                        )}

                        {/* Trip Search Results */}
                        {searchQuery.length >= 2 && filteredTrips.length > 0 && (
                            <Animatable.View animation="fadeIn" style={[styles.userResultsContainer, { backgroundColor: colors.card }]}>
                                <Text style={[styles.userResultsTitle, { color: colors.textSecondary }]}>TRIPS</Text>
                                {filteredTrips.slice(0, 5).map((trip) => (
                                    <TouchableOpacity
                                        key={trip.id}
                                        style={styles.userResultItem}
                                        onPress={() => {
                                            setSearchQuery('');
                                            setSearchVisible(false);
                                            navigation.navigate('TripDetails', { tripId: trip.id });
                                        }}
                                    >
                                        <Image
                                            source={{ uri: trip.coverImage || trip.images?.[0] }}
                                            style={styles.tripResultImage}
                                        />
                                        <View style={styles.userResultInfo}>
                                            <Text style={[styles.userResultName, { color: colors.text }]} numberOfLines={1}>
                                                {trip.title}
                                            </Text>
                                            <Text style={[styles.userResultUsername, { color: colors.textSecondary }]}>
                                                📍 {trip.location}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </Animatable.View>
                        )}
                    </SafeAreaView>
                </View>
            </Modal>
            <NotificationsModal
                visible={notificationsVisible}
                onClose={() => setNotificationsVisible(false)}
                onNotificationsChange={(count) => setHasNotifications(count > 0)}
            />
            <FilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={handleApplyFilters}
            />

            {/* Hoisted Report Modal */}
            <ReportTripModal
                visible={activeModal === 'report'}
                onClose={() => {
                    setActiveModal('none');
                    setSelectedTrip(null);
                }}
                trip={selectedTrip}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.sm,
    },
    stickyHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    headerIcon: {
        width: 28,
        height: 28,
        borderRadius: 6,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: FONT_WEIGHT.bold,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notifyButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    searchModalContainer: {
        flex: 1,
    },
    searchModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        gap: SPACING.md,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        height: 44,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: FONT_SIZE.sm,
    },
    cancelButton: {
        paddingVertical: SPACING.sm,
    },
    cancelText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: SPACING.lg,
        fontSize: FONT_SIZE.sm,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: SPACING.xxxl * 2,
        paddingHorizontal: SPACING.xl,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.sm,
    },
    emptySubtitle: {
        fontSize: FONT_SIZE.sm,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    clearButton: {
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
    },
    clearButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
    userResultsContainer: {
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    userResultsTitle: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
        letterSpacing: 1,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
    },
    userResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    userResultAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: SPACING.md,
    },
    tripResultImage: {
        width: 50,
        height: 50,
        borderRadius: BORDER_RADIUS.md,
        marginRight: SPACING.md,
    },
    userResultInfo: {
        flex: 1,
    },
    userResultName: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
    userResultUsername: {
        fontSize: FONT_SIZE.xs,
        marginTop: 2,
    },
});

export default FeedScreen;
