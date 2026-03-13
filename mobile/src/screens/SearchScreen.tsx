import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import FilterModal, { FilterOptions } from '../components/FilterModal';
import DefaultAvatar from '../components/DefaultAvatar';
import TripCard from '../components/TripCard';
import useTrips from '../hooks/useTrips';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { searchUsersByPrefix } from '../utils/searchUsers';
import { applyTripFilters } from '../utils/filterUtils';
import auth from '@react-native-firebase/auth';

const { width } = Dimensions.get('window');

const SearchScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const { allTrips } = useTrips();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterVisible, setFilterVisible] = useState(false);
    const [filters, setFilters] = useState<FilterOptions | null>(null);
    const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const searchInputRef = useRef<TextInput>(null);

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
        const currentUserUid = auth().currentUser?.uid;
        return applyTripFilters(allTrips, searchQuery, filters, currentUserUid, false);
    }, [allTrips, searchQuery, filters]);
    
    // Count active filters for badge
    const activeFilterCount = useMemo(() => {
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
    }, [filters]);

    const handleApplyFilters = (newFilters: FilterOptions) => {
        setFilters(newFilters);
    };

    const clearFilters = () => {
        setFilters(null);
        setSearchQuery('');
    };

    const hasActiveFilters = filters !== null || searchQuery !== '';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Search</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={[styles.searchBox, { backgroundColor: colors.inputBackground }]}>
                    <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                        ref={searchInputRef}
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search trips, places, people..."
                        placeholderTextColor={colors.textSecondary}
                        onChangeText={setSearchQuery}
                        value={searchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={[styles.filterButton, { backgroundColor: activeFilterCount > 0 ? colors.primary : colors.card }]}
                    onPress={() => setFilterVisible(true)}
                >
                    <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? '#fff' : colors.text} />
                    {activeFilterCount > 0 && (
                        <View style={[styles.filterBadge, { backgroundColor: '#EF4444' }]}>
                            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Active Filters Indicator */}
            {hasActiveFilters && (
                <TouchableOpacity style={styles.clearFiltersRow} onPress={clearFilters}>
                    <View style={[styles.activeFilterBadge, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.activeFilterText, { color: colors.primary }]}>
                            {filters ? 'Filters applied' : ''} {searchQuery ? `"${searchQuery}"` : ''}
                        </Text>
                        <Ionicons name="close" size={14} color={colors.primary} />
                    </View>
                </TouchableOpacity>
            )}

            {/* User Search Results */}
            {searchQuery.length >= 2 && searchedUsers.length > 0 && (
                <Animatable.View animation="fadeIn" style={[styles.userResultsContainer, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PEOPLE</Text>
                    {searchedUsers.map((user) => (
                        <TouchableOpacity
                            key={user.id}
                            style={styles.userResultItem}
                            onPress={() => {
                                setSearchQuery('');
                                setSearchedUsers([]);
                                navigation.navigate('UserProfile', { userId: user.id });
                            }}
                        >
                            <DefaultAvatar
                                uri={user.photoURL}
                                size={40}
                                style={styles.userAvatar}
                            />
                            <View style={styles.userInfo}>
                                <Text style={[styles.userName, { color: colors.text }]}>
                                    {user.displayName || 'User'}
                                </Text>
                                {user.username && (
                                    <Text style={[styles.userHandle, { color: colors.primary }]}>
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

            {/* Trip Results */}
            <FlatList
                data={filteredTrips}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TripCard
                        trip={item}
                        onPress={() => navigation.navigate('TripDetails', { tripId: item.id })}
                        onReportPress={() => { }}
                        showOptions={false}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    searchQuery.length >= 2 && filteredTrips.length > 0 ? (
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginHorizontal: SPACING.lg }]}>
                            TRIPS
                        </Text>
                    ) : null
                }
                ListEmptyComponent={
                    searchQuery.length >= 2 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No results found for "{searchQuery}"
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="compass-outline" size={64} color={colors.textSecondary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                Discover Adventures
                            </Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                Search for trips, destinations, or travelers
                            </Text>
                        </View>
                    )
                }
            />

            <FilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={handleApplyFilters}
                currentFilters={filters}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
    },
    searchContainer: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        height: 48,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: FONT_SIZE.md,
    },
    filterButton: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearFiltersRow: {
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    activeFilterBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        gap: SPACING.xs,
    },
    activeFilterText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
    },
    userResultsContainer: {
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    sectionLabel: {
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
    userAvatar: {
        marginRight: SPACING.md,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
    userHandle: {
        fontSize: FONT_SIZE.xs,
        marginTop: 2,
    },
    listContent: {
        paddingBottom: SPACING.xxxl,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: SPACING.xxxl * 2,
        paddingHorizontal: SPACING.xl,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        fontSize: FONT_SIZE.sm,
        textAlign: 'center',
    },
    filterBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    filterBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default SearchScreen;
