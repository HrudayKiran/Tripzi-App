import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, RefreshControl, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { NeumorphicBackButton } from '../components/NeumorphicIconButtons';
import { supabase } from '../lib/supabase';
import { useItineraryStore } from '../store/itineraryStore';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';

const TypedFlashList = FlashList as any;
const { width } = Dimensions.get('window');

// ─── Memoized Trip Card Component ───────────────────────────────────
const TripCard = React.memo(({ trip, activeTab, isDarkMode, colors, onSelect, formatDate }: any) => {
    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onSelect(trip)}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
            <View style={styles.imageContainer}>
                <LinearGradient
                    colors={isDarkMode ? ['#2D3436', '#0984E3'] : ['#E0E0E0', '#74B9FF']}
                    style={styles.cardGradient}
                >
                    <Icon name="MapTrifold" size={40} color="#FFFFFF" weight="duotone" />
                </LinearGradient>
                
                {/* Overlay badge */}
                <View style={styles.badgeContainer}>
                    <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                        <Text style={styles.badgeText}>
                            {trip.duration ? `${trip.duration} Days` : `${trip.duration_days || 1} Days`}
                        </Text>
                    </View>
                    {trip.cost_per_person > 0 && (
                        <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.6)', marginLeft: 8 }]}>
                            <Text style={styles.badgeText}>
                                ${trip.cost_per_person}/person
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.cardDetails}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {trip.trip_title || trip.title}
                </Text>

                {/* Route location mapping */}
                <View style={styles.routeContainer}>
                    <Icon name="MapPin" size={16} color={colors.primary} weight="fill" />
                    <Text style={[styles.routeText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {trip.from_location ? `${trip.from_location.split(',')[0]} → ` : ''}
                        {trip.to_location?.split(',')[0] || 'Ready for adventure'}
                    </Text>
                </View>

                {/* Date Range */}
                <View style={styles.dateContainer}>
                    <Icon name="CalendarBlank" size={16} color={colors.textSecondary} />
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                        {formatDate(trip.from_date)} - {formatDate(trip.to_date)}
                    </Text>
                </View>

                {/* Owner profile details row */}
                {activeTab === 'Shared' && (
                    <View style={[styles.ownerRow, { borderTopColor: colors.border }]}>
                        <Image
                            source={{ uri: trip.owner_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80' }}
                            style={styles.ownerAvatar}
                        />
                        <View style={styles.ownerInfo}>
                            <Text style={[styles.ownerLabel, { color: colors.textSecondary }]}>Shared by</Text>
                            <Text style={[styles.ownerName, { color: colors.text }]} numberOfLines={1}>
                                {trip.owner_display_name || 'Traveler'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
});

const ItinerariesScreen = () => {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const { setTripDraft, setPlaces } = useItineraryStore();
    const [activeTab, setActiveTab] = useState<'Saved' | 'Shared'>('Saved');
    const [trips, setTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Fetch user on mount
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUser(user);
        });
    }, []);

    // Fetch trips whenever activeTab or currentUser changes
    const fetchTrips = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Query all itineraries in the itineraries table
            const { data, error } = await supabase
                .from('itineraries')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter itineraries based on active tab and ownership
            const filtered = (data || []).filter((t: any) => {
                const isOwner = t.user_id === currentUser.id;
                
                // Parse participants list
                let participantsList: string[] = [];
                try {
                    participantsList = Array.isArray(t.participants) 
                        ? t.participants 
                        : JSON.parse(t.participants || '[]');
                } catch {
                    participantsList = [];
                }
                
                const isParticipant = participantsList.includes(currentUser.id);
                
                if (activeTab === 'Saved') {
                    // Saved itineraries owned by user
                    return isOwner;
                } else {
                    // Shared: participant is user, but user is not the owner
                    return !isOwner && isParticipant;
                }
            });

            setTrips(filtered);
        } catch (error) {
            console.error('Error fetching itineraries:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchTrips();
        }
    }, [activeTab, currentUser]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTrips();
    };

    const handleSelectTrip = useCallback(async (trip: any) => {
        // Set the tripDraft in the Zustand store
        setTripDraft({
            ...trip,
            fromLocation: trip.from_location,
            toLocation: trip.to_location,
            fromDate: trip.from_date,
            toDate: trip.to_date,
        });

        // Parse places_to_visit
        if (trip.places_to_visit) {
            try {
                const parsedPlaces = typeof trip.places_to_visit === 'string'
                    ? JSON.parse(trip.places_to_visit)
                    : trip.places_to_visit;

                if (Array.isArray(parsedPlaces) && parsedPlaces.length > 0 && typeof parsedPlaces[0] === 'object') {
                    setPlaces(parsedPlaces);
                } else if (Array.isArray(parsedPlaces) && typeof parsedPlaces[0] === 'string') {
                    // If it's a string array, try parsing each string
                    const firstElem = parsedPlaces[0];
                    try {
                        const nested = JSON.parse(firstElem);
                        if (Array.isArray(nested)) {
                            setPlaces(nested);
                        }
                    } catch {
                        // Fallback convert string array to structured places
                        const initialPlaces = parsedPlaces.map((name: string, index: number) => ({
                            id: `${index}`,
                            name,
                            day: 1,
                            order: index,
                        }));
                        setPlaces(initialPlaces);
                    }
                }
            } catch (e) {
                console.error('Error parsing places_to_visit:', e);
            }
        } else {
            // Default to empty array if no places
            setPlaces([]);
        }

        // Navigate to /trip/view
        router.push('/trip/view');
    }, [router, setTripDraft, setPlaces]);

    const formatDate = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }, []);

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
                <Icon 
                    name={activeTab === 'Shared' ? 'Users' : 'BookmarkSimple'} 
                    size={48} 
                    color={isDarkMode ? '#FFFFFF' : '#000000'} 
                />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No {activeTab} Itineraries
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {activeTab === 'Shared' 
                    ? "Itineraries shared with you by other travelers will appear here."
                    : "Itineraries you've saved will appear here."}
            </Text>
            <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
                onPress={() => router.push('/(tabs)/create')}
            >
                <Text style={[styles.actionButtonText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Create New Trip</Text>
            </TouchableOpacity>
        </View>
    );

    const renderTripItem = useCallback(({ item }: { item: any }) => {
        return (
            <TripCard
                trip={item}
                activeTab={activeTab}
                isDarkMode={isDarkMode}
                colors={colors}
                onSelect={handleSelectTrip}
                formatDate={formatDate}
            />
        );
    }, [activeTab, isDarkMode, colors, handleSelectTrip, formatDate]);

    const themeActiveBg = isDarkMode ? '#FFFFFF' : '#000000';
    const themeActiveText = isDarkMode ? '#000000' : '#FFFFFF';

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <NeumorphicBackButton onPress={() => router.back()} />
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Itineraries</Text>
                    <View style={{ width: 45 }} />
                </View>

                {/* Tab Bar */}
                <View style={styles.tabBarContainer}>
                    <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('Saved')}
                            style={[
                                styles.tab, 
                                activeTab === 'Saved' && [styles.activeTab, { backgroundColor: themeActiveBg }]
                            ]}
                        >
                            <Text style={[
                                styles.tabText, 
                                { color: activeTab === 'Saved' ? themeActiveText : colors.textSecondary }
                            ]}>
                                Saved
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('Shared')}
                            style={[
                                styles.tab, 
                                activeTab === 'Shared' && [styles.activeTab, { backgroundColor: themeActiveBg }]
                            ]}
                        >
                            <Text style={[
                                styles.tabText, 
                                { color: activeTab === 'Shared' ? themeActiveText : colors.textSecondary }
                            ]}>
                                Shared
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator color={colors.primary} size="large" />
                    </View>
                ) : trips.length === 0 ? (
                    renderEmptyState()
                ) : (
                    <TypedFlashList
                        data={trips}
                        renderItem={renderTripItem}
                        keyExtractor={(item: any) => item.id}
                        estimatedItemSize={250}
                        contentContainerStyle={[styles.contentScroll, { paddingHorizontal: 20 }]}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
    },
    tabBarContainer: {
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    tabBar: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeTab: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tabText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
    contentScroll: {
        paddingBottom: 40,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingTop: 60,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: 10,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: FONT_SIZE.md,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 30,
    },
    actionButton: {
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 30,
        elevation: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    imageContainer: {
        height: 150,
        width: '100%',
        position: 'relative',
    },
    cardImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    cardGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeContainer: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        flexDirection: 'row',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardDetails: {
        padding: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    routeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    routeText: {
        fontSize: 14,
        marginLeft: 6,
        fontWeight: '600',
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    dateText: {
        fontSize: 13,
        marginLeft: 6,
    },
    ownerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        marginTop: 12,
        paddingTop: 12,
    },
    ownerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    ownerInfo: {
        marginLeft: 10,
        flex: 1,
    },
    ownerLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    ownerName: {
        fontSize: 13,
        fontWeight: 'bold',
    }
});

export default ItinerariesScreen;
