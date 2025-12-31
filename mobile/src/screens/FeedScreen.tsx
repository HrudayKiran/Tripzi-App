import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TripCard from '../components/TripCard';
import useTrips from '../api/useTrips';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import NotificationsModal from '../components/NotificationsModal';
import FilterModal, { FilterOptions } from '../components/FilterModal';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';
import { auth } from '../firebase';
import firestore from '@react-native-firebase/firestore';



const FeedScreen = ({ navigation }) => {
    const { trips, loading, refetch } = useTrips();
    const { colors } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [filters, setFilters] = useState<FilterOptions | null>(null);
    const [hasNotifications, setHasNotifications] = useState(true);

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

            // Sorting
            if (filters.sortBy === 'newest') {
                result.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(0);
                    return dateB - dateA;
                });
            } else if (filters.sortBy === 'oldest') {
                result.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(0);
                    return dateA - dateB;
                });
            } else if (filters.sortBy === 'budget') {
                result.sort((a, b) => (a.cost || 0) - (b.cost || 0));
            } else if (filters.sortBy === 'popular') {
                result.sort((a, b) => (b.likes || 0) - (a.likes || 0));
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <Image source={require('../../assets/icon.png')} style={styles.headerIcon} />
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Tripzi</Text>
                </View>
                <TouchableOpacity
                    style={[styles.notificationButton, { backgroundColor: colors.card }]}
                    onPress={() => setNotificationsVisible(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="notifications-outline" size={22} color={colors.text} />
                    {hasNotifications && <View style={[styles.notificationDot, { backgroundColor: colors.error }]} />}
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={[styles.searchBox, { backgroundColor: colors.inputBackground }]}>
                    <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search trips, places..."
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
                    style={[
                        styles.filterButton,
                        { backgroundColor: filters ? colors.primary : colors.inputBackground }
                    ]}
                    onPress={() => setFilterVisible(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="options-outline"
                        size={22}
                        color={filters ? '#fff' : colors.text}
                    />
                </TouchableOpacity>
            </View>

            {/* Active Filters Badge */}
            {
                hasActiveFilters && (
                    <Animatable.View animation="fadeIn" style={styles.activeFiltersContainer}>
                        <View style={[styles.activeFiltersBadge, { backgroundColor: colors.primaryLight }]}>
                            <Ionicons name="filter" size={14} color={colors.primary} />
                            <Text style={[styles.activeFiltersText, { color: colors.primary }]}>
                                {filteredTrips.length} trips found
                            </Text>
                            <TouchableOpacity onPress={clearFilters}>
                                <Ionicons name="close" size={16} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </Animatable.View>
                )
            }

            {/* Trips List */}
            {
                loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                            Loading trips...
                        </Text>
                    </View>
                ) : filteredTrips.length === 0 ? (
                    <Animatable.View animation="fadeIn" style={styles.emptyContainer}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                            <Ionicons name="compass-outline" size={48} color={colors.primary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>No trips found</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                            Try adjusting your filters or search
                        </Text>
                        <TouchableOpacity
                            style={[styles.clearButton, { backgroundColor: colors.primary }]}
                            onPress={clearFilters}
                        >
                            <Text style={styles.clearButtonText}>Clear Filters</Text>
                        </TouchableOpacity>
                    </Animatable.View>
                ) : (
                    <FlatList
                        data={filteredTrips}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item, index }) => (
                            <Animatable.View animation="fadeInUp" delay={index * 50}>
                                <TripCard
                                    trip={item}
                                    onPress={() => navigation.navigate('TripDetails', { tripId: item.id })}
                                />
                            </Animatable.View>
                        )}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={[colors.primary]}
                                tintColor={colors.primary}
                            />
                        }
                    />
                )
            }

            {/* Modals */}
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
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.lg,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.md,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
    },
    notificationButton: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        borderRadius: TOUCH_TARGET.min / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.lg,
        gap: SPACING.md,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        height: TOUCH_TARGET.comfortable,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: FONT_SIZE.sm,
    },
    filterButton: {
        width: TOUCH_TARGET.comfortable,
        height: TOUCH_TARGET.comfortable,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoriesContainer: {
        marginBottom: SPACING.lg,
    },
    categoriesScroll: {
        paddingHorizontal: SPACING.xl,
        gap: SPACING.sm,
    },
    categoryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        gap: SPACING.xs,
    },
    categoryText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
    activeFiltersContainer: {
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.md,
    },
    activeFiltersBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    activeFiltersText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
    },
    listContent: {
        paddingBottom: SPACING.xxxl,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACING.md,
    },
    loadingText: {
        fontSize: FONT_SIZE.sm,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xxxl,
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
});

export default FeedScreen;
