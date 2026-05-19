import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, FlatList, Alert, Modal, ActivityIndicator, Platform, KeyboardAvoidingView, Keyboard, Share, BackHandler, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useTripStore } from '../store/tripStore';
import Icon from '../components/Icon';
import {
    NeumorphicBackButton,
    NeumorphicFloatingButton,
    NeumorphicCloseButton,
    NeumorphicSearchButton,
    NeumorphicLoadingIcon,
    NeumorphicIconButton
} from '../components/NeumorphicIconButtons';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import MapView, { Marker, Polyline } from 'react-native-maps';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface CategoryCardProps {
    categoryName: string;
    drag: () => void;
    isActive: boolean;
    checklist: any[];
    colors: any;
    isDarkMode: boolean;
    toggleItem: (id: string) => void;
    deleteItem: (id: string) => void;
    deleteCategory: (catName: string) => void;
    setChecklistModalMode: (mode: 'add_category' | 'add_item' | 'edit_category') => void;
    setChecklistModalTargetCategory: (cat: string) => void;
    setChecklistModalInputValue: (val: string) => void;
    setChecklistModalVisible: (visible: boolean) => void;
    setChecklist: (list: any[]) => void;
}

const CategoryCard = React.memo(({
    categoryName,
    drag,
    isActive,
    checklist,
    colors,
    isDarkMode,
    toggleItem,
    deleteItem,
    deleteCategory,
    setChecklistModalMode,
    setChecklistModalTargetCategory,
    setChecklistModalInputValue,
    setChecklistModalVisible,
    setChecklist
}: CategoryCardProps) => {
    const catItems = checklist.filter(item => item.category === categoryName);

    return (
        <ScaleDecorator>
            <View
                style={{
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    padding: 16,
                    marginVertical: 10,
                    borderWidth: 1.5,
                    borderColor: isActive ? colors.primary : colors.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: isActive ? 6 : 2 },
                    shadowOpacity: isActive ? 0.15 : 0.04,
                    shadowRadius: isActive ? 8 : 4,
                    elevation: isActive ? 6 : 2,
                }}
            >
                {/* Category Header */}
                <TouchableOpacity
                    onLongPress={drag}
                    delayLongPress={150}
                    activeOpacity={0.9}
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        paddingBottom: 12,
                        marginBottom: 10
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{categoryName}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={() => {
                                setChecklistModalMode('add_item');
                                setChecklistModalTargetCategory(categoryName);
                                setChecklistModalInputValue('');
                                setChecklistModalVisible(true);
                            }}
                            style={{ padding: 6, marginLeft: 8 }}
                        >
                            <Icon name="Plus" size={20} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                setChecklistModalMode('edit_category');
                                setChecklistModalTargetCategory(categoryName);
                                setChecklistModalInputValue(categoryName);
                                setChecklistModalVisible(true);
                            }}
                            style={{ padding: 6, marginLeft: 8 }}
                        >
                            <Icon name="PencilSimple" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => deleteCategory(categoryName)}
                            style={{ padding: 6, marginLeft: 8 }}
                        >
                            <Icon name="Trash" size={20} color="#D63031" />
                        </TouchableOpacity>
                        <View style={{ padding: 6, marginLeft: 8, opacity: 0.6 }}>
                            <Icon name="Equals" size={20} color={colors.textSecondary} />
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Category Tasks List */}
                {catItems.length === 0 ? (
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 15 }}>
                        No tasks in this category. Tap + to add!
                    </Text>
                ) : (
                    <DraggableFlatList
                        data={catItems}
                        keyExtractor={item => item.id}
                        scrollEnabled={false}
                        onDragEnd={({ data }) => {
                            const otherItems = checklist.filter(x => x.category !== categoryName);
                            setChecklist([...otherItems, ...data]);
                        }}
                        renderItem={({ item, drag: dragTask, isActive: isTaskActive }) => {
                            return (
                                <ScaleDecorator>
                                    <View style={{
                                        backgroundColor: isTaskActive ? colors.card : colors.background,
                                        borderRadius: 12,
                                        paddingHorizontal: 14,
                                        paddingVertical: 12,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginVertical: 4,
                                        borderWidth: 1,
                                        borderColor: isTaskActive ? colors.primary : colors.border,
                                        opacity: isTaskActive ? 0.9 : 1,
                                    }}>
                                        <TouchableOpacity
                                            onPress={() => toggleItem(item.id)}
                                            style={{ padding: 2 }}
                                        >
                                            <Icon
                                                name={item.checked ? "CheckSquare" : "Square"}
                                                size={20}
                                                color={item.checked ? colors.primary : colors.textSecondary}
                                                weight={item.checked ? "fill" : "regular"}
                                            />
                                        </TouchableOpacity>

                                        <View style={{ flex: 1, marginLeft: 12, alignSelf: 'stretch', justifyContent: 'center' }}>
                                            <View style={{ alignSelf: 'flex-start', justifyContent: 'center' }}>
                                                <Text style={{
                                                    fontSize: 14,
                                                    color: item.checked ? colors.textSecondary : colors.text,
                                                    opacity: item.checked ? 0.6 : 1,
                                                }}>
                                                    {item.text}
                                                </Text>
                                                {item.checked && (
                                                    <View style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        right: 0,
                                                        height: 2.5,
                                                        backgroundColor: isDarkMode ? '#2ECC71' : '#27AE60',
                                                        opacity: 0.9
                                                    }} />
                                                )}
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <TouchableOpacity
                                                onPress={() => deleteItem(item.id)}
                                                style={{ padding: 4, opacity: 0.6 }}
                                            >
                                                <Icon name="Trash" size={16} color={colors.textSecondary} />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onLongPress={dragTask}
                                                delayLongPress={100}
                                                style={{ padding: 4, marginLeft: 6, opacity: 0.6 }}
                                            >
                                                <Icon name="Equals" size={18} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </ScaleDecorator>
                            );
                        }}
                    />
                )}
            </View>
        </ScaleDecorator>
    );
});

type TabType = 'Full Itinerary' | 'checklist' | 'notes' | 'itinerary mapview';

export default function ItineraryViewScreen() {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { places, setPlaces, checklist, setChecklist, notes, setNotes, essentials, setEssentials, tripDraft, customCategories, setCustomCategories, collaborators, setCollaborators } = useTripStore();
    const [activeTab, setActiveTab] = useState<TabType>('Full Itinerary');
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [newEssentialItem, setNewEssentialItem] = useState('');
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedDayTab, setSelectedDayTab] = useState('All');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    const [startingCoords, setStartingCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number, lng: number } | null>(null);

    useEffect(() => {
        const geocodeLocation = async (address: string, type: 'starting' | 'destination') => {
            try {
                const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBURfArYP_txIxAGEPYhNKm-FCtY4gQ7oQ';
                const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const loc = data.results[0].geometry.location;
                    if (type === 'starting') {
                        setStartingCoords({ lat: loc.lat, lng: loc.lng });
                    } else {
                        setDestinationCoords({ lat: loc.lat, lng: loc.lng });
                    }
                }
            } catch (error) {
                console.error('Geocoding error:', error);
            }
        };

        if (tripDraft?.fromLocation && !startingCoords) {
            geocodeLocation(tripDraft.fromLocation, 'starting');
        }
        if (tripDraft?.toLocation && !destinationCoords) {
            geocodeLocation(tripDraft.toLocation, 'destination');
        }
    }, [tripDraft?.fromLocation, tripDraft?.toLocation]);


    const [noteModalVisible, setNoteModalVisible] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteTitleInput, setNoteTitleInput] = useState('');
    const [noteContentInput, setNoteContentInput] = useState('');

    const [checklistModalVisible, setChecklistModalVisible] = useState(false);
    const [checklistModalMode, setChecklistModalMode] = useState<'add_category' | 'add_item' | 'edit_category'>('add_category');
    const [checklistModalTargetCategory, setChecklistModalTargetCategory] = useState('');
    const [checklistModalInputValue, setChecklistModalInputValue] = useState('');
    const [showFloatingButton, setShowFloatingButton] = useState(true);
    const scrollOffsetRef = useRef(0);

    const [finalizeModalVisible, setFinalizeModalVisible] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            setCurrentUser(user);
            if (user) {
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('id, name, display_name, photo_url')
                        .eq('id', user.id)
                        .maybeSingle();
                    
                    setCurrentUserProfile({
                        id: user.id,
                        name: data?.name || data?.display_name || user.user_metadata?.full_name || 'Admin',
                        display_name: data?.display_name || data?.name || user.user_metadata?.full_name || 'Admin',
                        photo_url: data?.photo_url || user.user_metadata?.avatar_url || null
                    });
                } catch (err) {
                    console.error('Error fetching profile:', err);
                    setCurrentUserProfile({
                        id: user.id,
                        name: user.user_metadata?.full_name || 'Admin',
                        display_name: user.user_metadata?.full_name || 'Admin',
                        photo_url: user.user_metadata?.avatar_url || null
                    });
                }
            }
        });
    }, []);

    useEffect(() => {
        if (!showUserSearch) {
            setSearchQuery('');
            setSearchResults([]);
        }
    }, [showUserSearch]);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    useEffect(() => {
        if (tripDraft && tripDraft.mandatory_items) {
            try {
                const items = typeof tripDraft.mandatory_items === 'string'
                    ? JSON.parse(tripDraft.mandatory_items)
                    : tripDraft.mandatory_items;
                
                if (Array.isArray(items) && items.length >= 5) {
                    const parsedChecklist = typeof items[0] === 'string' ? JSON.parse(items[0]) : items[0];
                    const parsedCategories = typeof items[1] === 'string' ? JSON.parse(items[1]) : items[1];
                    const parsedNotes = typeof items[2] === 'string' ? JSON.parse(items[2]) : items[2];
                    const parsedEssentials = typeof items[3] === 'string' ? JSON.parse(items[3]) : items[3];
                    const parsedCollaborators = typeof items[4] === 'string' ? JSON.parse(items[4]) : items[4];
                    
                    if (Array.isArray(parsedChecklist) && parsedChecklist.length > 0) setChecklist(parsedChecklist);
                    if (Array.isArray(parsedCategories) && parsedCategories.length > 0) setCustomCategories(parsedCategories);
                    if (Array.isArray(parsedNotes) && parsedNotes.length > 0) setNotes(parsedNotes);
                    if (Array.isArray(parsedEssentials) && parsedEssentials.length > 0) setEssentials(parsedEssentials);
                    if (Array.isArray(parsedCollaborators) && parsedCollaborators.length > 0) setCollaborators(parsedCollaborators);
                }
            } catch (e) {
                console.error('Failed to unpack custom itinerary details:', e);
            }
        }
    }, [tripDraft]);

    useEffect(() => {
        const backAction = () => {
            if (showUserSearch) {
                setShowUserSearch(false);
                setSearchQuery('');
                setSearchResults([]);
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [showUserSearch]);

    // Scroll handling for FAB is now managed by drag events directly
    const tabs: TabType[] = ['Full Itinerary', 'checklist', 'notes', 'itinerary mapview'];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Full Itinerary':
                return renderItineraryTab();
            case 'checklist':
                return renderChecklist();
            case 'notes':
                return renderNotes();
            case 'itinerary mapview':
                return renderMap();
            default:
                return null;
        }
    };

    const handleSearchUsers = async (query: string = searchQuery) => {
        if (query.trim().length < 1) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, username, photo_url')
                .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
                .limit(10);

            if (error) throw error;
            const filteredResults = (data || []).filter((item: any) => item.id !== currentUser?.id);
            setSearchResults(filteredResults);
        } catch (error) {
            console.error('Search error:', error);
            Alert.alert('Search Error', 'Could not search for users. Please try again.');
        } finally {
            setSearching(false);
        }
    };

    const handleShareTrip = async () => {
        try {
            const tripId = tripDraft?.id || 'new-trip';
            const shareUrl = `https://nxtvibes.app/trip/${tripId}`;
            const message = `Check out my trip itinerary on NxtVibes: ${tripDraft?.title || 'Trip'}\n\nJoin me here: ${shareUrl}`;

            const result = await Share.share({
                message,
                url: shareUrl, // iOS only
                title: 'Share Trip Itinerary'
            });

            if (result.action === Share.sharedAction) {
                if (result.activityType) {
                    // shared with activity type of result.activityType
                } else {
                    // shared
                }
            } else if (result.action === Share.dismissedAction) {
                // dismissed
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const addCollaborator = (user: any) => {
        if (collaborators.find(c => c.id === user.id)) {
            Alert.alert('Already added', 'This user is already part of the trip.');
            return;
        }
        setCollaborators([...collaborators, user]);
    };

    const removeCollaborator = (userId: string) => {
        Alert.alert(
            'Remove Collaborator',
            'Are you sure you want to remove this collaborator from this itinerary?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        setCollaborators(collaborators.filter(c => c.id !== userId));
                    }
                }
            ]
        );
    };


    const allData = React.useMemo(() => {
        const data = [];
        const duration = tripDraft?.duration || Math.max(...places.map(p => p.day), 1);
        const fromDate = tripDraft?.fromDate ? new Date(tripDraft.fromDate) : null;

        for (let day = 1; day <= duration; day++) {
            const dayPlaces = places.filter(p => p.day === day).sort((a, b) => a.order - b.order);
            if (dayPlaces.length > 0) {
                let dateStr = '';
                if (fromDate) {
                    const currentDate = new Date(fromDate);
                    currentDate.setDate(fromDate.getDate() + day - 1);
                    dateStr = currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                }
                data.push({ id: `day-${day}-header`, isHeader: true, day, dateStr });
                data.push(...dayPlaces);
            }
        }
        return data;
    }, [places, tripDraft?.duration, tripDraft?.fromDate]);

    const activePlacesMemo = React.useMemo(() => {
        return selectedDayTab === 'All'
            ? allData
            : [...places].filter(p => p.day === parseInt(selectedDayTab.replace('Day ', ''))).sort((a, b) => a.order - b.order);
    }, [places, selectedDayTab, allData]);

    const onTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }

        if (event.type === 'set' && selectedDate && editingPlaceId) {
            const timeStr = selectedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            setPlaces(places.map(p => p.id === editingPlaceId ? { ...p, time: timeStr } : p));
        }
    };

    const handleDeletePlace = (id: string) => {
        setPlaces(places.filter(p => p.id !== id));
    };

    const handleFinalizeAction = async (bookingStatus: 'posted' | 'saved') => {
        if (!currentUser) {
            Alert.alert('Authentication Required', 'Please log in to finalize your trip.');
            return;
        }

        setIsFinalizing(true);
        try {
            // 1. Fetch user's profile info
            const { data: currentUserData } = await supabase
                .from('profiles')
                .select('name, display_name, photo_url, username')
                .eq('id', currentUser.id)
                .maybeSingle();
            const userData: any = currentUserData || {};

            // 2. Prepare itinerary arrays and fields
            // Map places list to simple string list for itinerary vertical timeline view
            const itineraryStrings = (places || []).map(p => {
                const timeStr = p.time ? `[${p.time}] ` : '';
                return `${timeStr}${p.name}${p.address ? ` - ${p.address}` : ''}`;
            });

            // Mapped places to JSON string in places_to_visit
            const placesToVisitJSON = JSON.stringify(places || []);

            // Packing checklist, categories, notes, essentials, collaborators to mandatory_items
            const mandatoryItemsArray = [
                JSON.stringify(checklist || []),
                JSON.stringify(customCategories || []),
                JSON.stringify(notes || []),
                JSON.stringify(essentials || []),
                JSON.stringify(collaborators || [])
            ];

            const fromDateStr = tripDraft?.fromDate ? new Date(tripDraft.fromDate).toISOString() : new Date().toISOString();
            const toDateStr = tripDraft?.toDate ? new Date(tripDraft.toDate).toISOString() : new Date().toISOString();
            const durationDays = tripDraft?.duration ? parseInt(tripDraft.duration) : 1;

            const tripPayload = {
                user_id: currentUser.id,
                title: tripDraft?.title || 'My Trip Itinerary',
                description: tripDraft?.description || '',
                from_location: tripDraft?.fromLocation || null,
                to_location: tripDraft?.toLocation || null,
                from_date: fromDateStr,
                to_date: toDateStr,
                duration_days: durationDays,
                duration: tripDraft?.duration ? String(tripDraft.duration) : String(durationDays),
                cost: parseFloat(tripDraft?.costPerPerson) || 0,
                cost_per_person: parseFloat(tripDraft?.costPerPerson) || 0,
                total_cost: parseFloat(tripDraft?.costPerPerson) || 0,
                max_travelers: parseInt(tripDraft?.maxTravelers) || 10,
                current_travelers: 1,
                trip_type: tripDraft?.tripType || 'solo',
                transport_mode: tripDraft?.transportMode || null,
                accommodation_type: tripDraft?.accommodationType || null,
                gender_preference: tripDraft?.genderPreference || 'anyone',
                booking_status: bookingStatus, // 'posted' or 'saved'
                places_to_visit: [placesToVisitJSON],
                mandatory_items: mandatoryItemsArray,
                itinerary: itineraryStrings,
                images: tripDraft?.images || [],
                cover_image: tripDraft?.images?.[0] || null,
                image_object_keys: tripDraft?.imageObjectKeys || [],
                image_locations: tripDraft?.imageLocations || [],
                owner_display_name: userData.name || userData.display_name || currentUser.user_metadata?.full_name || 'Traveler',
                owner_photo_url: userData.photo_url || currentUser.user_metadata?.avatar_url || null,
                owner_username: userData.username || null,
                participants: [currentUser.id, ...(collaborators || []).map(c => c.id || c.uid || c)],
                location: tripDraft?.toLocation || '',
                trip_types: tripDraft?.tripTypes || [],
                transport_modes: tripDraft?.transportModes || [],
                accommodation_days: tripDraft?.accommodationDays ? parseInt(tripDraft.accommodationDays) : null,
                updated_at: new Date().toISOString(),
            };

            let tripId = tripDraft?.id;
            
            // Check if we should insert or update in Supabase
            if (tripId && tripId !== 'new-trip') {
                const { error: updateError } = await supabase
                    .from('trips')
                    .update(tripPayload)
                    .eq('id', tripId);
                if (updateError) throw updateError;
            } else {
                const { data: newTrip, error: insertError } = await supabase
                    .from('trips')
                    .insert(tripPayload)
                    .select()
                    .single();
                if (insertError) throw insertError;
                tripId = newTrip.id;
            }

            setFinalizeModalVisible(false);
            Alert.alert(
                bookingStatus === 'posted' ? 'Itinerary Published!' : 'Itinerary Saved!',
                bookingStatus === 'posted'
                    ? 'Your itinerary is now published as a live trip!'
                    : 'Your itinerary has been saved under saved tab.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            router.replace('/(tabs)/profile');
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', error.message || 'Could not finalize the trip itinerary. Please try again.');
        } finally {
            setIsFinalizing(false);
        }
    };

    const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<any>) => {
        if (item.isHeader) {
            return (
                <View style={{ paddingHorizontal: 15, paddingVertical: 5, marginTop: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>
                        Day {item.day}{item.dateStr ? ` - ${item.dateStr}` : ''}
                    </Text>
                </View>
            );
        }

        const getColorForTitle = (title?: string) => {
            if (!title) return '#6C5CE7';
            if (title.toLowerCase().includes('hotel')) return '#6C5CE7';
            if (title.toLowerCase().includes('food')) return '#FDCB6E';
            return '#6C5CE7';
        };

        return (
            <ScaleDecorator>
                <View style={{ flexDirection: 'row', paddingHorizontal: 15, marginVertical: 10, alignItems: 'center' }}>
                    <TouchableOpacity onLongPress={drag} style={{ padding: 5, marginRight: 5 }}>
                        <Icon name="DotsSixVertical" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={{ width: 60, alignItems: 'center' }}>
                        <View style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            backgroundColor: getColorForTitle(item.title),
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 5
                        }}>
                            <Icon name="MapPin" size={16} color="#fff" weight="fill" />
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                setEditingPlaceId(item.id);
                                setShowTimePicker(true);
                            }}
                            style={{
                                zIndex: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 12,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                backgroundColor: colors.background,
                                minWidth: 70,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: '600' }}>{item.time || 'Pick a time'}</Text>
                        </TouchableOpacity>
                        <View style={{ width: 2, height: 40, backgroundColor: colors.border, marginVertical: 5 }} />
                    </View>

                    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    style={{ color: colors.textSecondary, fontWeight: 'bold', fontSize: 14, marginBottom: 4, padding: 0 }}
                                    value={item.title}
                                    placeholder="Enter a title"
                                    placeholderTextColor={colors.textSecondary}
                                    onChangeText={(text) => {
                                        setPlaces(places.map(p => p.id === item.id ? { ...p, title: text } : p));
                                    }}
                                />
                                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>{item.name}</Text>
                                {item.address && (
                                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{item.address}</Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => handleDeletePlace(item.id)}>
                                <Icon name="Trash" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScaleDecorator>
        );
    };

    const renderItineraryTab = () => {
        const duration = tripDraft?.duration || Math.max(...places.map(p => p.day), 1);
        const dayTabs = [
            { label: 'All', date: null },
            ...Array.from({ length: duration }, (_, i) => ({
                label: `Day ${i + 1}`,
                date: tripDraft?.fromDate ? new Date(new Date(tripDraft.fromDate).getTime() + i * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
            }))
        ];

        const activePlaces = activePlacesMemo;

        return (
            <View style={{ flex: 1 }}>
                <View style={{ paddingVertical: 10, backgroundColor: colors.card }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 15 }}>
                        {dayTabs.map(tab => (
                            <TouchableOpacity
                                key={tab.label}
                                onPress={() => setSelectedDayTab(tab.label)}
                                style={{
                                    backgroundColor: selectedDayTab === tab.label ? colors.primary : colors.card,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    marginRight: 6,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: colors.border
                                }}
                            >
                                {tab.date && <Text style={{ color: selectedDayTab === tab.label ? '#fff' : colors.textSecondary, fontSize: 8 }}>{tab.date}</Text>}
                                <Text style={{ color: selectedDayTab === tab.label ? '#fff' : colors.text, fontWeight: 'bold', fontSize: 10 }}>{tab.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <DraggableFlatList
                    data={activePlaces}
                    renderItem={renderDraggableItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 150 }}
                    onDragEnd={({ data }) => {
                        if (selectedDayTab === 'All') {
                            let currentDay = 1;
                            const updatedPlaces: any[] = [];
                            data.forEach((item) => {
                                if (item.isHeader) {
                                    currentDay = item.day;
                                } else {
                                    updatedPlaces.push({ ...item, day: currentDay });
                                }
                            });
                            // Reorder within days
                            const finalPlaces: any[] = [];
                            for (let day = 1; day <= duration; day++) {
                                const dayPlaces = updatedPlaces.filter(p => p.day === day);
                                dayPlaces.forEach((p, index) => {
                                    finalPlaces.push({ ...p, order: index });
                                });
                            }
                            setPlaces(finalPlaces);
                        } else {
                            const currentDay = parseInt(selectedDayTab.replace('Day ', ''));
                            const otherDayPlaces = places.filter(p => p.day !== currentDay);
                            const updatedDayPlaces = data.map((item, index) => ({ ...item, order: index }));
                            setPlaces([...otherDayPlaces, ...updatedDayPlaces]);
                        }
                    }}
                />
            </View>
        );
    };

    const addItemToCategory = (catName: string, text: string) => {
        if (!text.trim()) return;
        setChecklist([...checklist, {
            id: `item-${Date.now()}`,
            text: text.trim(),
            checked: false,
            category: catName
        }]);
    };

    const addNewCategory = (catName: string) => {
        if (!catName.trim()) return;
        const trimmed = catName.trim();
        if (!customCategories.includes(trimmed)) {
            setCustomCategories([...customCategories, trimmed]);
        }
    };

    const renameCategory = (oldName: string, newName: string) => {
        if (!newName.trim() || oldName === newName) return;
        const trimmed = newName.trim();
        setCustomCategories(customCategories.map(c => c === oldName ? trimmed : c));
        setChecklist(checklist.map(item => item.category === oldName ? { ...item, category: trimmed } : item));
    };

    const renderChecklist = () => {
        const toggleItem = (id: string) => {
            setChecklist(checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
        };

        const deleteItem = (id: string) => {
            setChecklist(checklist.filter(item => item.id !== id));
        };

        const deleteCategory = (catName: string) => {
            Alert.alert(
                'Delete Category',
                `Are you sure you want to delete "${catName}" and all its tasks?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                            setCustomCategories(customCategories.filter(c => c !== catName));
                            setChecklist(checklist.filter(item => item.category !== catName));
                        }
                    }
                ]
            );
        };

        // Dynamically compute the set of categories
        const categories = Array.from(new Set([
            ...customCategories,
            ...checklist.map(item => item.category)
        ])).filter(Boolean);

        if (categories.length === 0) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, paddingTop: 60 }}>
                    <View style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: colors.primary + '15',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 20
                    }}>
                        <Icon name="CheckSquare" size={40} color={colors.primary} weight="duotone" />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
                        Your checklist is empty
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20, lineHeight: 20 }}>
                        Organize your trip by creating custom categories like "Documents", "Packing", or "Medicines" and add tasks inside them.
                    </Text>
                </View>
            );
        }

        const renderCategoryCard = ({ item: categoryName, drag, isActive }: RenderItemParams<string>) => {
            return (
                <CategoryCard
                    categoryName={categoryName}
                    drag={drag}
                    isActive={isActive}
                    checklist={checklist}
                    colors={colors}
                    isDarkMode={isDarkMode}
                    toggleItem={toggleItem}
                    deleteItem={deleteItem}
                    deleteCategory={deleteCategory}
                    setChecklistModalMode={setChecklistModalMode}
                    setChecklistModalTargetCategory={setChecklistModalTargetCategory}
                    setChecklistModalInputValue={setChecklistModalInputValue}
                    setChecklistModalVisible={setChecklistModalVisible}
                    setChecklist={setChecklist}
                />
            );
        };

        const handleCategoryDragEnd = ({ data }: { data: string[] }) => {
            setCustomCategories(data);
        };

        return (
            <View style={{ flex: 1 }}>
                <DraggableFlatList
                    data={categories}
                    renderItem={renderCategoryCard}
                    keyExtractor={item => item}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
                    onDragEnd={handleCategoryDragEnd}
                    onScrollBeginDrag={() => setShowFloatingButton(false)}
                    onScrollEndDrag={() => setShowFloatingButton(true)}
                    onMomentumScrollEnd={() => setShowFloatingButton(true)}
                    scrollEventThrottle={16}
                />
            </View>
        );
    };

    const renderNotes = () => {
        const handleNoteDragEnd = ({ data }: { data: any[] }) => {
            const updated = data.map((item, index) => ({ ...item, order: index }));
            setNotes(updated);
        };

        const renderNoteCard = ({ item, drag, isActive }: RenderItemParams<any>) => (
            <ScaleDecorator>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onLongPress={drag}
                    onPress={() => {
                        setEditingNoteId(item.id);
                        setNoteTitleInput(item.title);
                        setNoteContentInput(item.content);
                        setNoteModalVisible(true);
                    }}
                    style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 16,
                        marginVertical: 8,
                        marginHorizontal: 20,
                        borderWidth: 1.5,
                        borderColor: isActive ? colors.primary : colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: isActive ? 6 : 2 },
                        shadowOpacity: isActive ? 0.15 : 0.04,
                        shadowRadius: isActive ? 8 : 4,
                        elevation: isActive ? 6 : 2,
                    }}
                >
                    {item.title ? (
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 8 }} numberOfLines={1}>
                            {item.title}
                        </Text>
                    ) : null}
                    <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }} numberOfLines={5}>
                        {item.content || 'Empty note'}
                    </Text>
                </TouchableOpacity>
            </ScaleDecorator>
        );

        return (
            <View style={{ flex: 1 }}>
                {notes.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, paddingTop: 60 }}>
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: colors.primary + '15',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 20
                        }}>
                            <Icon name="Notebook" size={40} color={colors.primary} weight="duotone" />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
                            No notes yet
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20, lineHeight: 20 }}>
                            Tap the + button to add a new note for your trip.
                        </Text>
                    </View>
                ) : (
                    <DraggableFlatList
                        data={[...notes].sort((a, b) => a.order - b.order)}
                        renderItem={renderNoteCard}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingVertical: 10, paddingBottom: 150 }}
                        onDragEnd={handleNoteDragEnd}
                        onScrollBeginDrag={() => setShowFloatingButton(false)}
                        onScrollEndDrag={() => setShowFloatingButton(true)}
                        onMomentumScrollEnd={() => setShowFloatingButton(true)}
                        scrollEventThrottle={16}
                    />
                )}
            </View>
        );
    };

    const renderMap = () => {
        const mapPlacesCoords = places.filter(p => p.latitude && p.longitude).map(p => ({
            latitude: p.latitude!,
            longitude: p.longitude!,
            title: p.name,
            description: p.title || p.address
        }));

        const allCoords: { latitude: number, longitude: number, title?: string, description?: string, type?: string }[] = [];

        if (startingCoords) {
            allCoords.push({ latitude: startingCoords.lat, longitude: startingCoords.lng, title: tripDraft?.fromLocation || 'Start', type: 'start' });
        }

        allCoords.push(...mapPlacesCoords);

        if (destinationCoords) {
            allCoords.push({ latitude: destinationCoords.lat, longitude: destinationCoords.lng, title: tripDraft?.toLocation || 'Destination', type: 'end' });
        }

        const initialRegion = allCoords.length > 0 ? {
            latitude: allCoords[0].latitude,
            longitude: allCoords[0].longitude,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
        } : {
            latitude: 20.5937,
            longitude: 78.9629,
            latitudeDelta: 10,
            longitudeDelta: 10,
        };

        return (
            <View style={{ flex: 1 }}>
                <MapView
                    style={StyleSheet.absoluteFill}
                    initialRegion={initialRegion}
                >
                    {allCoords.map((coord, index) => (
                        <Marker
                            key={`marker-${index}`}
                            coordinate={{ latitude: coord.latitude, longitude: coord.longitude }}
                            title={coord.title}
                            description={coord.description}
                            pinColor={coord.type === 'start' ? 'green' : (coord.type === 'end' ? 'blue' : 'red')}
                        />
                    ))}
                    {allCoords.length > 1 && (
                        <Polyline
                            coordinates={allCoords}
                            strokeColor={colors.primary}
                            strokeWidth={3}
                            lineDashPattern={[5, 5]}
                        />
                    )}
                </MapView>
            </View>
        );
    };

    const renderEssentials = () => {
        const addItem = () => {
            if (newEssentialItem.trim()) {
                setEssentials([...essentials, { id: Date.now().toString(), text: newEssentialItem, packed: false }]);
                setNewEssentialItem('');
            }
        };

        const toggleItem = (id: string) => {
            setEssentials(essentials.map(item => item.id === id ? { ...item, packed: !item.packed } : item));
        };

        return (
            <View style={styles.tabPane}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        placeholder="Add essential item..."
                        placeholderTextColor={colors.textSecondary}
                        value={newEssentialItem}
                        onChangeText={setNewEssentialItem}
                        onSubmitEditing={addItem}
                    />
                    <TouchableOpacity onPress={addItem} style={[styles.addButton, { backgroundColor: colors.primary }]}>
                        <Icon name="Plus" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={essentials}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.listItem}>
                            <TouchableOpacity onPress={() => toggleItem(item.id)} style={styles.checkRow}>
                                <Icon
                                    name={(item.packed ? "Package" : "Cube") as any}
                                    size={24}
                                    color={item.packed ? colors.primary : colors.textSecondary}
                                    weight={item.packed ? "fill" : "regular"}
                                />
                                <Text style={[styles.listText, { color: colors.text, opacity: item.packed ? 0.6 : 1 }]}>
                                    {item.text}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            </View>
        );
    };

    return (
        <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <NeumorphicBackButton style={styles.backButton} />
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{tripDraft?.title || 'Trip Itinerary'}</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontSize: 10 }]} numberOfLines={1}>
                            {tripDraft?.fromLocation ? `${tripDraft.fromLocation.split(',')[0]} → ` : ''}{tripDraft?.toLocation?.split(',')[0] || 'Ready for adventure'}
                        </Text>
                    </View>
                        <TouchableOpacity
                            onPress={() => setShowUserSearch(true)}
                            style={[
                                styles.shareButton,
                                styles.neumorphicButton,
                                {
                                    backgroundColor: colors.card,
                                    shadowColor: isDarkMode ? '#000' : '#d1d9e6',
                                    width: 45,
                                    height: 45,
                                    borderRadius: 22.5,
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }
                            ]}
                        >
                            <Icon name="UserPlus" size={22} color={colors.text} />
                        </TouchableOpacity>
                </View>

                {/* Collaborators Row */}
                {(currentUserProfile || collaborators.length > 0) && (
                    <View style={{ paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: 15 }}>Collaborators:</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {currentUserProfile && (
                                <TouchableOpacity
                                    key={currentUserProfile.id}
                                    onPress={() => router.push(`/profile/${currentUserProfile.id}`)}
                                    style={{
                                        zIndex: 100,
                                        position: 'relative',
                                    }}
                                >
                                    {currentUserProfile.photo_url ? (
                                        <Image
                                            source={{ uri: currentUserProfile.photo_url }}
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                borderWidth: 2,
                                                borderColor: colors.card
                                            }}
                                        />
                                    ) : (
                                        <View
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: colors.primary,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                borderWidth: 2,
                                                borderColor: colors.card
                                            }}
                                        >
                                            <Icon name="User" size={18} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                            {collaborators.map((user, index) => (
                                <TouchableOpacity
                                    key={user.id}
                                    onPress={() => router.push(`/profile/${user.id}`)}
                                    style={{
                                        marginLeft: -15,
                                        zIndex: 99 - index,
                                    }}
                                >
                                    {user.photo_url ? (
                                        <Image
                                            source={{ uri: user.photo_url }}
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                borderWidth: 2,
                                                borderColor: colors.card
                                            }}
                                        />
                                    ) : (
                                        <View
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: colors.primary,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                borderWidth: 2,
                                                borderColor: colors.card
                                            }}
                                        >
                                            <Icon name="User" size={18} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Premium Tab Bar */}
                <View style={{ backgroundColor: colors.card }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
                        {tabs.map(tab => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                style={[
                                    styles.tabItem,
                                    activeTab === tab && { borderBottomColor: colors.primary }
                                ]}
                            >
                                <Text style={[
                                    styles.tabText,
                                    { color: activeTab === tab ? colors.primary : colors.textSecondary },
                                    activeTab === tab && { fontWeight: 'bold' }
                                ]}>
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Main Content */}
                <View style={{ flex: 1 }}>
                    {renderTabContent()}
                </View>

                {activeTab === 'checklist' && showFloatingButton && !isKeyboardVisible && (
                    <NeumorphicFloatingButton
                        onPress={() => {
                            setChecklistModalMode('add_category');
                            setChecklistModalInputValue('');
                            setChecklistModalVisible(true);
                        }}
                        bottom={10}
                    />
                )}
                {activeTab === 'notes' && showFloatingButton && !isKeyboardVisible && (
                    <NeumorphicFloatingButton
                        onPress={() => {
                            setEditingNoteId(null);
                            setNoteTitleInput('');
                            setNoteContentInput('');
                            setNoteModalVisible(true);
                        }}
                        bottom={10}
                    />
                )}

            </KeyboardAvoidingView>

            {/* Bottom Actions - Outside KeyboardAvoidingView to stay fixed */}
            {!isKeyboardVisible && (
                <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'ios' ? 30 : 20 }]}>
                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                        onPress={() => setFinalizeModalVisible(true)}
                    >
                        <Text style={styles.buttonText}>Finalize Trip</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Finalize Trip Center Modal */}
            <Modal
                visible={finalizeModalVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setFinalizeModalVisible(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20
                }}>
                    <View style={{
                        width: '90%',
                        backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                        borderRadius: 24,
                        padding: 24,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.25,
                        shadowRadius: 20,
                        elevation: 10,
                    }}>
                        {/* Beautiful Header Icon */}
                        <View style={{
                            width: 60,
                            height: 60,
                            borderRadius: 30,
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}>
                            <Icon name="PaperPlaneTilt" size={32} color={colors.primary} weight="fill" />
                        </View>

                        <Text style={{
                            color: colors.text,
                            fontSize: 22,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            marginBottom: 8
                        }}>
                            Finalize Itinerary
                        </Text>

                        <Text style={{
                            color: colors.textSecondary,
                            fontSize: 14,
                            textAlign: 'center',
                            marginBottom: 24,
                            paddingHorizontal: 10,
                            lineHeight: 20
                        }}>
                            Choose how you would like to save this trip itinerary.
                        </Text>

                        {/* Option 1: Post as Trip */}
                        <TouchableOpacity
                            disabled={isFinalizing}
                            onPress={() => handleFinalizeAction('posted')}
                            style={{
                                width: '100%',
                                backgroundColor: colors.primary,
                                borderRadius: 16,
                                paddingVertical: 16,
                                alignItems: 'center',
                                marginBottom: 12,
                                shadowColor: colors.primary,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 6,
                                elevation: 3,
                            }}
                        >
                            {isFinalizing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                            ) : (
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>
                                    Post Itinerary as Trip
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* Option 2: Save Itinerary */}
                        <TouchableOpacity
                            disabled={isFinalizing}
                            onPress={() => handleFinalizeAction('saved')}
                            style={{
                                width: '100%',
                                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                                borderRadius: 16,
                                paddingVertical: 16,
                                alignItems: 'center',
                                marginBottom: 20,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>
                                Save Itinerary
                            </Text>
                        </TouchableOpacity>

                        {/* Cancel Button */}
                        <TouchableOpacity
                            disabled={isFinalizing}
                            onPress={() => setFinalizeModalVisible(false)}
                            style={{
                                paddingVertical: 8,
                            }}
                        >
                            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {showTimePicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={onTimeChange}
                />
            )}
            {/* User Search Modal */}
            <Modal
                visible={showUserSearch}
                animationType="slide"
                transparent
                onRequestClose={() => setShowUserSearch(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.card, height: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Add Collaborators</Text>
                            <NeumorphicCloseButton onPress={() => setShowUserSearch(false)} />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                            <TextInput
                                style={[
                                    styles.input, 
                                    { 
                                        backgroundColor: colors.background, 
                                        color: colors.text, 
                                        borderColor: colors.border, 
                                        flex: 1, 
                                        height: 45, 
                                        borderRadius: 12,
                                        paddingHorizontal: 15,
                                        marginRight: 10,
                                        paddingVertical: 0
                                    }
                                ]}
                                placeholder="Search by username or name..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    if (text.length >= 1) handleSearchUsers(text);
                                }}
                                autoFocus
                            />
                            <NeumorphicSearchButton onPress={() => handleSearchUsers()} size={45} iconSize={20} />
                        </View>

                        {searching ? (
                            <View style={{ marginTop: 10 }}>
                                {[1, 2, 3].map((key) => (
                                    <MotiView
                                        key={key}
                                        from={{ opacity: 0.5 }}
                                        animate={{ opacity: 1 }}
                                        transition={{
                                            loop: true,
                                            type: 'timing',
                                            duration: 800,
                                            repeatReverse: true
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                    >
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDarkMode ? '#333' : '#E5E7EB', marginRight: 15 }} />
                                        <View>
                                            <View style={{ width: 120, height: 16, backgroundColor: isDarkMode ? '#333' : '#E5E7EB', borderRadius: 4, marginBottom: 8 }} />
                                            <View style={{ width: 80, height: 12, backgroundColor: isDarkMode ? '#333' : '#E5E7EB', borderRadius: 4 }} />
                                        </View>
                                    </MotiView>
                                ))}
                            </View>
                        ) : (
                            <FlatList
                                data={searchResults}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => {
                                    const isCollaborator = collaborators.some(c => c.id === item.id);
                                    return (
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (isCollaborator) {
                                                    removeCollaborator(item.id);
                                                } else {
                                                    addCollaborator(item);
                                                }
                                            }}
                                            style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                        >
                                            {item.photo_url ? (
                                                <Image
                                                    source={{ uri: item.photo_url }}
                                                    style={{ width: 40, height: 40, borderRadius: 20, marginRight: 15 }}
                                                />
                                            ) : (
                                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                                                    <Icon name="User" size={20} color={colors.primary} />
                                                </View>
                                            )}
                                            <View>
                                                <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.name}</Text>
                                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>@{item.username}</Text>
                                            </View>
                                            <View style={{ flex: 1 }} />
                                            {isCollaborator ? (
                                                <NeumorphicIconButton 
                                                    onPress={() => removeCollaborator(item.id)} 
                                                    iconName="Trash" 
                                                    size={36} 
                                                    iconSize={18} 
                                                    iconColorOverride="#EF4444"
                                                />
                                            ) : (
                                                <NeumorphicIconButton 
                                                    onPress={() => addCollaborator(item)} 
                                                    iconName="Plus" 
                                                    size={36} 
                                                    iconSize={18} 
                                                />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={() => searchQuery.length >= 1 && !searching ? (
                                    <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>No users found</Text>
                                ) : null}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Checklist Operations Modal */}
            <Modal
                visible={checklistModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setChecklistModalVisible(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20,
                }}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ width: '100%', alignItems: 'center' }}
                    >
                        <View style={{
                            backgroundColor: colors.card,
                            borderRadius: 20,
                            padding: 20,
                            width: '100%',
                            maxWidth: 400,
                            borderWidth: 1,
                            borderColor: colors.border,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 5,
                            elevation: 10,
                        }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 15 }}>
                                {checklistModalMode === 'add_category' && 'Add New Category'}
                                {checklistModalMode === 'add_item' && `Add Task to ${checklistModalTargetCategory}`}
                                {checklistModalMode === 'edit_category' && 'Rename Category'}
                            </Text>

                            <TextInput
                                style={{
                                    backgroundColor: colors.background,
                                    color: colors.text,
                                    borderColor: colors.border,
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 15,
                                    paddingVertical: 12,
                                    fontSize: 15,
                                    marginBottom: 20,
                                    width: '100%',
                                }}
                                placeholder={
                                    checklistModalMode === 'add_category' ? 'Enter category name (e.g. Packing)' : 'Enter task/item name'
                                }
                                placeholderTextColor={colors.textSecondary}
                                value={checklistModalInputValue}
                                onChangeText={setChecklistModalInputValue}
                                autoFocus
                            />

                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                                <TouchableOpacity
                                    onPress={() => setChecklistModalVisible(false)}
                                    style={{
                                        paddingHorizontal: 18,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        marginRight: 10,
                                    }}
                                >
                                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        if (checklistModalInputValue.trim()) {
                                            if (checklistModalMode === 'add_category') {
                                                addNewCategory(checklistModalInputValue);
                                            } else if (checklistModalMode === 'add_item') {
                                                addItemToCategory(checklistModalTargetCategory, checklistModalInputValue);
                                            } else if (checklistModalMode === 'edit_category') {
                                                renameCategory(checklistModalTargetCategory, checklistModalInputValue);
                                            }
                                        }
                                        setChecklistModalVisible(false);
                                    }}
                                    style={{
                                        backgroundColor: colors.primary,
                                        paddingHorizontal: 20,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
            {/* Note Editor Modal */}
            <Modal
                visible={noteModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => {
                    const title = noteTitleInput.trim();
                    const content = noteContentInput.trim();
                    if (title || content) {
                        if (editingNoteId) {
                            setNotes(notes.map(n => n.id === editingNoteId ? { ...n, title, content } : n));
                        } else {
                            setNotes([...notes, { id: Date.now().toString(), title, content, order: notes.length }]);
                        }
                    } else if (editingNoteId) {
                        setNotes(notes.filter(n => n.id !== editingNoteId));
                    }
                    setNoteModalVisible(false);
                }}
            >
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: Math.max(insets.top, 20), paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
                        <NeumorphicBackButton
                            onPress={() => {
                                const title = noteTitleInput.trim();
                                const content = noteContentInput.trim();
                                if (title || content) {
                                    if (editingNoteId) {
                                        setNotes(notes.map(n => n.id === editingNoteId ? { ...n, title, content } : n));
                                    } else {
                                        setNotes([...notes, { id: Date.now().toString(), title, content, order: notes.length }]);
                                    }
                                } else if (editingNoteId) {
                                    setNotes(notes.filter(n => n.id !== editingNoteId));
                                }
                                setNoteModalVisible(false);
                            }}
                            size={40}
                        />
                        <View style={{ flex: 1 }} />
                        {editingNoteId && (
                            <TouchableOpacity
                                onPress={() => {
                                    Alert.alert(
                                        'Delete Note',
                                        'Are you sure you want to delete this note?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete',
                                                style: 'destructive',
                                                onPress: () => {
                                                    setNotes(notes.filter(n => n.id !== editingNoteId));
                                                    setNoteModalVisible(false);
                                                }
                                            }
                                        ]
                                    );
                                }}
                                style={{ padding: 10 }}
                            >
                                <Icon name="Trash" size={24} color="#D63031" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <ScrollView style={{ flex: 1, padding: 20 }}>
                        <TextInput
                            style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 15 }}
                            placeholder="Title"
                            placeholderTextColor={colors.textSecondary + '80'}
                            value={noteTitleInput}
                            onChangeText={setNoteTitleInput}
                        />
                        <TextInput
                            style={{ fontSize: 16, color: colors.text, lineHeight: 24 }}
                            placeholder="Note"
                            placeholderTextColor={colors.textSecondary + '80'}
                            multiline
                            autoFocus={!editingNoteId}
                            value={noteContentInput}
                            onChangeText={setNoteContentInput}
                            textAlignVertical="top"
                        />
                    </ScrollView>
                </View>
            </Modal>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        borderRadius: 12,
    },
    neumorphicButton: {
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 4,
    },
    headerTitleContainer: {
        flex: 1,
        marginLeft: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 12,
    },
    shareButton: {
        padding: 8,
    },
    tabBar: {
        paddingHorizontal: 16,
    },
    tabItem: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 14,
    },
    tabPane: {
        flex: 1,
        padding: 20,
    },
    itineraryCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    itineraryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dayBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    dayText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    timeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    placeTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    placeName: {
        fontSize: 14,
        marginBottom: 4,
    },
    placeAddress: {
        fontSize: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    input: {
        flex: 1,
        height: 45,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 15,
        marginRight: 10,
    },
    addButton: {
        width: 45,
        height: 45,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    listText: {
        fontSize: 15,
        marginLeft: 12,
    },
    notesInput: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        padding: 15,
        fontSize: 16,
    },
    bottomBar: {
        padding: 20,
        borderTopWidth: 1,
        alignItems: 'center',
    },
    primaryButton: {
        width: '100%',
        paddingVertical: 15,
        borderRadius: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    floatingActionButton: {
        position: 'absolute',
        bottom: 10,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
    },
});
