import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import TripCard from '../components/TripCard';
import useTrips from '../api/useTrips';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import NotificationsModal from '../components/NotificationsModal';
import FilterModal, { FilterOptions } from '../components/FilterModal';

const FeedScreen = ({ navigation }) => {
    const { trips, loading } = useTrips();
    const { colors } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [filters, setFilters] = useState<FilterOptions | null>(null);

    const categories = ['All', 'Recent', 'Budget', 'Popular'];

    const filteredTrips = trips.filter(trip => {
        const categoryMatch = activeCategory === 'All' || trip.tripType === activeCategory;
        const searchMatch =
            trip.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.location?.toLowerCase().includes(searchQuery.toLowerCase());

        // Apply additional filters if set
        let filterMatch = true;
        if (filters) {
            if (filters.destination && !trip.location?.toLowerCase().includes(filters.destination.toLowerCase())) {
                filterMatch = false;
            }
            if (filters.maxCost && trip.cost > filters.maxCost) {
                filterMatch = false;
            }
        }

        return categoryMatch && searchMatch && filterMatch;
    });

    const handleApplyFilters = (newFilters: FilterOptions) => {
        setFilters(newFilters);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Tripzi</Text>
                <TouchableOpacity
                    style={styles.notificationButton}
                    onPress={() => setNotificationsVisible(true)}
                >
                    <Ionicons name="notifications-outline" size={26} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={[styles.searchBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                    <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search trips, people, or places"
                        placeholderTextColor={colors.textSecondary}
                        onChangeText={setSearchQuery}
                        value={searchQuery}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.filterButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    onPress={() => setFilterVisible(true)}
                >
                    <Ionicons name="options-outline" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Filter Pills */}
            <View style={styles.filtersSection}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filtersContainer}
                >
                    {categories.map((category) => (
                        <TouchableOpacity
                            key={category}
                            style={[
                                styles.filterPill,
                                { backgroundColor: activeCategory === category ? colors.primary : colors.inputBackground },
                            ]}
                            onPress={() => setActiveCategory(category)}
                        >
                            <Text
                                style={[
                                    styles.filterPillText,
                                    { color: activeCategory === category ? '#fff' : colors.textSecondary }
                                ]}
                            >
                                {category}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Trips List */}
            <FlatList
                data={filteredTrips}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <TripCard trip={item} navigation={navigation} />}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="airplane-outline" size={64} color="#E0E0E0" />
                        <Text style={[styles.emptyStateText, { color: colors.text }]}>No trips available yet</Text>
                        <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>Create your first trip to get started!</Text>
                        <TouchableOpacity
                            style={[styles.createButton, { backgroundColor: colors.primary }]}
                            onPress={() => navigation.navigate('CreateTrip')}
                        >
                            <Text style={styles.createButtonText}>Create Trip</Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* Modals */}
            <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
            <FilterModal visible={filterVisible} onClose={() => setFilterVisible(false)} onApply={handleApplyFilters} />
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
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    notificationButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
        gap: 10,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 48,
        gap: 10,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
    },
    filterButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    filtersSection: {
        marginBottom: 16,
    },
    filtersContainer: {
        paddingHorizontal: 20,
    },
    filterPill: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        marginRight: 10,
    },
    filterPillText: {
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 30,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 30,
    },
    createButton: {
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default FeedScreen;
