import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TripCard from '../components/TripCard';
import useTrips from '../api/useTrips';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import NotificationsModal from '../components/NotificationsModal';
import FilterModal, { FilterOptions } from '../components/FilterModal';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const CATEGORIES = [
    { id: 'All', label: 'All', icon: 'apps', color: '#8B5CF6' },
    { id: 'Recent', label: 'Recent', icon: 'time', color: '#3B82F6' },
    { id: 'Budget', label: 'Budget', icon: 'wallet', color: '#10B981' },
    { id: 'Popular', label: 'Popular', icon: 'flame', color: '#F59E0B' },
    { id: 'Adventure', label: 'Adventure', icon: 'compass', color: '#EC4899' },
];

const FeedScreen = ({ navigation }) => {
    const { trips, loading } = useTrips();
    const { colors } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [filters, setFilters] = useState<FilterOptions | null>(null);

    const filteredTrips = useMemo(() => {
        let result = [...trips];

        // Search filter
        if (searchQuery) {
            result = result.filter(trip =>
                trip.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                trip.location?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Category filter
        if (activeCategory !== 'All') {
            if (activeCategory === 'Recent') {
                // Sort by creation date and take latest
                result = result.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(0);
                    return dateB - dateA;
                });
            } else if (activeCategory === 'Budget') {
                result = result.filter(trip => (trip.cost || 0) < 20000);
            } else if (activeCategory === 'Popular') {
                result = result.filter(trip => (trip.likes || 0) > 5 || (trip.travelers || 0) > 3);
            } else if (activeCategory === 'Adventure') {
                result = result.filter(trip =>
                    trip.tripType?.toLowerCase() === 'adventure' ||
                    trip.title?.toLowerCase().includes('trek') ||
                    trip.title?.toLowerCase().includes('hiking')
                );
            }
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
    }, [trips, searchQuery, activeCategory, filters]);

    const handleApplyFilters = (newFilters: FilterOptions) => {
        setFilters(newFilters);
    };

    const clearFilters = () => {
        setFilters(null);
        setActiveCategory('All');
        setSearchQuery('');
    };

    const hasActiveFilters = filters !== null || activeCategory !== 'All' || searchQuery !== '';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.greeting, { color: colors.textSecondary }]}>Explore</Text>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Discover Trips 🌍</Text>
                </View>
                <TouchableOpacity
                    style={[styles.notificationButton, { backgroundColor: colors.card }]}
                    onPress={() => setNotificationsVisible(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="notifications-outline" size={22} color={colors.text} />
                    <View style={[styles.notificationDot, { backgroundColor: colors.error }]} />
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

            {/* Category Pills */}
            <View style={styles.categoriesContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesScroll}
                >
                    {CATEGORIES.map((category, index) => {
                        const isActive = activeCategory === category.id;
                        return (
                            <Animatable.View
                                key={category.id}
                                animation="fadeInRight"
                                delay={index * 50}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.categoryPill,
                                        {
                                            backgroundColor: isActive ? category.color : colors.card,
                                            borderColor: isActive ? category.color : colors.border,
                                        }
                                    ]}
                                    onPress={() => setActiveCategory(category.id)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={category.icon as any}
                                        size={16}
                                        color={isActive ? '#fff' : category.color}
                                    />
                                    <Text style={[
                                        styles.categoryText,
                                        { color: isActive ? '#fff' : colors.text }
                                    ]}>
                                        {category.label}
                                    </Text>
                                </TouchableOpacity>
                            </Animatable.View>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Active Filters Badge */}
            {hasActiveFilters && (
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
            )}

            {/* Trips List */}
            {loading ? (
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
                />
            )}

            {/* Modals */}
            <NotificationsModal
                visible={notificationsVisible}
                onClose={() => setNotificationsVisible(false)}
            />
            <FilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={handleApplyFilters}
            />
        </SafeAreaView>
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
    greeting: {
        fontSize: FONT_SIZE.sm,
        marginBottom: SPACING.xs,
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
        paddingVertical: SPACING.md,
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
        paddingHorizontal: SPACING.xl,
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
