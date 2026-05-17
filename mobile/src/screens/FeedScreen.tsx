import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Dimensions, Animated, NativeSyntheticEvent, NativeScrollEvent, Platform, ScrollView } from 'react-native';
import { FlashList } from "@shopify/flash-list";

const TypedFlashList = FlashList as any;
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import TripCard from '../components/TripCard';
import DefaultAvatar from '../components/DefaultAvatar';
import TripCardSkeleton from '../components/TripCardSkeleton';
import useTripsQuery from '../hooks/useTripsQuery';
import usePermissions from '../hooks/usePermissions';
import Icon from '../components/Icon';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import NotificationsModal from '../components/NotificationsModal';
import FilterModal, { FilterOptions } from '../components/FilterModal';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, NEUTRAL } from '../styles';
import AppLogo from '../components/AppLogo';
import ReportTripModal from '../components/ReportTripModal'; // Imported
import { searchUsersByPrefix } from '../utils/searchUsers';
import { applyTripFilters } from '../utils/filterUtils';
import { PREFERENCE_KEYS, getBooleanPreference, setBooleanPreference } from '../utils/preferences';
import { syncNotificationPreference } from '../utils/notificationPermissions';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

const getActiveFilterCount = (filters: FilterOptions | null) => {
    if (!filters) return 0;

    let count = 0;
    if (filters.destination) count++;
    if (filters.startingFrom) count++;
    if (filters.maxCost !== undefined) count++;
    if (filters.maxTravelers && filters.maxTravelers < 50) count++;
    if (filters.tripTypes && filters.tripTypes.length > 0) count++;
    if (filters.transportModes && filters.transportModes.length > 0) count++;
    if (filters.genderPreference && filters.genderPreference !== 'anyone') count++;
    if (filters.accommodationType) count++;
    if (filters.bookingStatus) count++;
    if (filters.sortBy && filters.sortBy !== 'newest') count++;
    if (filters.startDate || filters.endDate) count++;
    return count;
};

const FeedScreen = () => {
    const { trips, loading, refetch, currentUserId } = useTripsQuery();
    const { requestNotificationPermission } = usePermissions();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    useEffect(() => {
        if (loading) return; // Wait until feed is completely loaded

        const timer = setTimeout(async () => {
            try {
                const hasPrompted = await getBooleanPreference(PREFERENCE_KEYS.notificationPrompted, false);
                if (!hasPrompted) {
                    const granted = await requestNotificationPermission();

                    const { data: { user: currentUser } } = await supabase.auth.getUser();
                    if (currentUser) {
                        await syncNotificationPreference(
                            currentUser.id,
                            granted ? 'granted' : 'denied',
                            granted
                        );
                    }

                    await setBooleanPreference(PREFERENCE_KEYS.notificationPrompted, true);
                }
            } catch (error) {
                // Ignore errors
            }
        }, 1500); // Delay for 1.5 seconds after loading completes

        return () => clearTimeout(timer);
    }, [loading]);
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
                const matchedUsers = await searchUsersByPrefix(searchQuery, 5);
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

    // Filter trips using centralized utility
    const filteredTrips = useMemo(() => {
        return applyTripFilters(trips, searchQuery, filters, currentUserId || undefined, true);
    }, [trips, searchQuery, filters, currentUserId]);

    const handleApplyFilters = (newFilters: FilterOptions) => {
        setFilters(getActiveFilterCount(newFilters) > 0 ? newFilters : null);
    };

    const clearFilters = () => {
        setFilters(null);
        setSearchQuery('');
        setSearchedUsers([]);
        setSearchingUsers(false);
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        refetch();
        setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setRefreshing(false);
        }, 1500);
    }, [refetch]);

    const activeFilterCount = useMemo(() => getActiveFilterCount(filters), [filters]);
    const hasActiveFilters = activeFilterCount > 0 || searchQuery !== '';

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
                <Text style={[styles.headerTitle, { color: colors.text }]}>NxtVibes</Text>
            </View>
            <View style={styles.headerActions}>
                <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: colors.card }]}
                    onPress={() => setSearchVisible(true)}
                    testID="search-button"
                >
                    <Icon name="MagnifyingGlass" size={22} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: colors.card }]}
                    onPress={() => setFilterVisible(true)}
                    testID="filter-button"
                >
                    <Icon name="Sliders" size={22} color={activeFilterCount > 0 ? colors.primary : colors.text} />
                    {activeFilterCount > 0 && (
                        <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.notifyButton, { backgroundColor: colors.card }]}
                    onPress={() => setNotificationsVisible(true)}
                    activeOpacity={0.7}
                    testID="notifications-button"
                >
                    <Icon name="Bell" size={22} color={colors.text} />
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
                <ScrollView 
                    style={{ flex: 1 }} 
                    contentContainerStyle={{ padding: SPACING.md, paddingTop: HEADER_HEIGHT + SPACING.md }} 
                    showsVerticalScrollIndicator={false}
                >
                    <TripCardSkeleton />
                    <TripCardSkeleton />
                    <TripCardSkeleton />
                </ScrollView>
            ) : filteredTrips.length === 0 ? (
                <TypedFlashList
                    key="empty-list"
                    data={[]}
                    ListHeaderComponent={ListHeaderSpacer}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <MotiView
                            from={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ type: 'timing', duration: 300 }}
                            style={styles.emptyContainer}
                        >
                            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                                <Icon name="Compass" size={48} color={colors.primary} />
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
                        </MotiView>
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
                    estimatedItemSize={200}
                />
            ) : (
                <TypedFlashList
                    key="content-list"
                    data={filteredTrips}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={ListHeaderSpacer}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <TripCard
                            trip={item}
                            onPress={() => router.push({ pathname: '/trip/[id]', params: { id: item.id } })}
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
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    estimatedItemSize={100}
                />
            )}

            {/* Search Modal - Inlined to prevent re-mounting on state change */}
            <Modal visible={searchVisible} animationType="slide" transparent>
                <View style={[styles.searchModalContainer, { backgroundColor: colors.background }]}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={styles.searchModalHeader}>
                            <View style={[styles.searchBox, { backgroundColor: colors.inputBackground }]}>
                                <Icon name="MagnifyingGlass" size={20} color={colors.textSecondary} />
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
                                        <Icon name="XCircle" size={18} color={colors.textSecondary} weight="fill" />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    setSearchQuery('');
                                    setSearchedUsers([]);
                                    setSearchingUsers(false);
                                    setSearchVisible(false);
                                }}
                                style={styles.cancelButton}
                            >
                                <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {/* Loading State */}
                            {searchingUsers && searchQuery.length >= 2 && (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: 16 }}>Searching...</Text>
                                </View>
                            )}

                            {/* Empty State */}
                            {!searchingUsers && searchQuery.length >= 2 && searchedUsers.length === 0 && filteredTrips.length === 0 && (
                                <View style={{ padding: 40, alignItems: 'center', marginTop: 20 }}>
                                    <Icon name="MagnifyingGlass" size={64} color={colors.border} />
                                    <Text style={{ marginTop: 16, fontSize: 16, color: colors.textSecondary, textAlign: 'center' }}>
                                        No results found for "{searchQuery}"
                                    </Text>
                                </View>
                            )}

                            {/* User Search Results */}
                            {searchQuery.length >= 2 && searchedUsers.length > 0 && (
                                <MotiView
                                    from={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ type: 'timing', duration: 300 }}
                                    style={[styles.userResultsContainer, { backgroundColor: colors.card }]}
                                >
                                    <Text style={[styles.userResultsTitle, { color: colors.textSecondary }]}>PEOPLE</Text>
                                    {searchedUsers.map((user) => (
                                        <TouchableOpacity
                                            key={user.id}
                                            style={styles.userResultItem}
                                            onPress={() => {
                                                setSearchQuery('');
                                                setSearchedUsers([]);
                                                setSearchVisible(false);
                                                router.push({ pathname: '/profile/[id]', params: { id: user.id } });
                                            }}
                                        >
                                            <DefaultAvatar
                                                uri={user.photoURL}
                                                name={user.displayName || user.name || 'User'}
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
                                                <Icon name="ShieldCheck" size={16} color="#10B981" weight="fill" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </MotiView>
                            )}

                            {/* Trip Search Results */}
                            {searchQuery.length >= 2 && filteredTrips.length > 0 && (
                                <MotiView
                                    from={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ type: 'timing', duration: 300 }}
                                    style={[styles.userResultsContainer, { backgroundColor: colors.card }]}
                                >
                                    <Text style={[styles.userResultsTitle, { color: colors.textSecondary }]}>TRIPS</Text>
                                    {filteredTrips.slice(0, 5).map((trip) => (
                                        <TouchableOpacity
                                            key={trip.id}
                                            style={styles.userResultItem}
                                            onPress={() => {
                                                setSearchQuery('');
                                                setSearchVisible(false);
                                                router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
                                            }}
                                        >
                                            <Image
                                                source={{ uri: trip.coverImage || trip.images?.[0] }}
                                                style={styles.tripResultImage}
                                                contentFit="cover"
                                                transition={200}
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
                                </MotiView>
                            )}
                        </ScrollView>
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
                currentFilters={filters}
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
        shadowColor: NEUTRAL.black,
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
    filterBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: NEUTRAL.white,
        fontSize: 10,
        fontWeight: FONT_WEIGHT.bold,
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
        color: NEUTRAL.white,
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
