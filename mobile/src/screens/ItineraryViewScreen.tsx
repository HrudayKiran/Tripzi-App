import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, FlatList, Alert, Modal, ActivityIndicator, Platform, KeyboardAvoidingView, Keyboard, BackHandler, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { aiService } from '../services/AIService';
import { showUploadNotification, completeUploadNotification, failUploadNotification } from '../utils/notifications';
import { useTheme } from '../contexts/ThemeContext';
import { useItineraryStore } from '../store/itineraryStore';
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
import {
    SortableItem,
    SortableGridItem,
    useSortableList,
    useGridSortableList,
    DropProvider,
    SortableDirection,
    GridOrientation,
    GridStrategy
} from 'react-native-reanimated-dnd';
import { GestureHandlerRootView, FlatList as GHFlatList, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const SortableItemAny = SortableItem as any;
const SortableGridItemAny = SortableGridItem as any;

const AnimatedFlatList = Animated.createAnimatedComponent(GHFlatList);
const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView);

interface NonFlickerSortableProps {
    data: any[];
    renderItem: (props: any) => any;
    direction?: SortableDirection;
    itemHeight?: number | number[] | ((item: any, index: number) => number);
    enableDynamicHeights?: boolean;
    estimatedItemHeight?: number;
    onHeightsMeasured?: (heights: { [id: string]: number }) => void;
    style?: any;
    contentContainerStyle?: any;
    itemKeyExtractor?: (item: any, index: number) => string;
    useFlatList?: boolean;
    onScrollBeginDrag?: any;
    onScrollEndDrag?: any;
    onMomentumScrollEnd?: any;
}

const NonFlickerSortable = React.memo(({
    data,
    renderItem,
    direction = SortableDirection.Vertical,
    itemHeight,
    enableDynamicHeights = false,
    estimatedItemHeight = 60,
    onHeightsMeasured,
    style,
    contentContainerStyle,
    itemKeyExtractor = (item: any) => item.id,
    useFlatList = true,
    ...scrollProps
}: NonFlickerSortableProps) => {
    const {
        scrollViewRef,
        dropProviderRef,
        handleScroll,
        handleScrollEnd,
        contentHeight,
        getItemProps
    } = useSortableList({
        data,
        itemHeight,
        enableDynamicHeights,
        estimatedItemHeight,
        onHeightsMeasured,
        itemKeyExtractor
    });

    const combinedOnScrollEndDrag = (e: any) => {
        handleScrollEnd();
        if (scrollProps.onScrollEndDrag) {
            scrollProps.onScrollEndDrag(e);
        }
    };

    const combinedOnMomentumScrollEnd = (e: any) => {
        handleScrollEnd();
        if (scrollProps.onMomentumScrollEnd) {
            scrollProps.onMomentumScrollEnd(e);
        }
    };

    if (useFlatList) {
        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <DropProvider ref={dropProviderRef}>
                    <AnimatedFlatList
                        ref={scrollViewRef}
                        data={data}
                        keyExtractor={itemKeyExtractor}
                        scrollEventThrottle={16}
                        onScroll={handleScroll}
                        style={[{ flex: 1, position: 'relative', backgroundColor: 'transparent' }, style]}
                        contentContainerStyle={[{ height: contentHeight }, contentContainerStyle]}
                        onScrollBeginDrag={scrollProps.onScrollBeginDrag}
                        onScrollEndDrag={combinedOnScrollEndDrag}
                        onMomentumScrollEnd={combinedOnMomentumScrollEnd}
                        simultaneousHandlers={dropProviderRef}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item, index }: any) => {
                            const itemProps = getItemProps(item, index);
                            return renderItem({
                                item,
                                index,
                                id: itemProps.id,
                                positions: itemProps.positions,
                                direction: SortableDirection.Vertical,
                                ...itemProps
                            }) as any;
                        }}
                    />
                </DropProvider>
            </GestureHandlerRootView>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <DropProvider ref={dropProviderRef}>
                <AnimatedScrollView
                    ref={scrollViewRef}
                    scrollEventThrottle={16}
                    onScroll={handleScroll}
                    style={[{ flex: 1, position: 'relative', backgroundColor: 'transparent' }, style]}
                    contentContainerStyle={[{ height: contentHeight }, contentContainerStyle]}
                    onScrollBeginDrag={scrollProps.onScrollBeginDrag}
                    onScrollEndDrag={combinedOnScrollEndDrag}
                    onMomentumScrollEnd={combinedOnMomentumScrollEnd}
                    simultaneousHandlers={dropProviderRef}
                >
                    {data.map((item, index) => {
                        const itemProps = getItemProps(item, index);
                        return renderItem({
                            item,
                            index,
                            id: itemProps.id,
                            positions: itemProps.positions,
                            direction: SortableDirection.Vertical,
                            ...itemProps
                        }) as any;
                    })}
                </AnimatedScrollView>
            </DropProvider>
        </GestureHandlerRootView>
    );
});

interface NonFlickerSortableGridProps {
    data: any[];
    renderItem: (props: any) => any;
    dimensions: {
        itemWidth: number;
        itemHeight: number;
        columns?: number;
        rows?: number;
        columnGap?: number;
        rowGap?: number;
    };
    orientation?: GridOrientation;
    strategy?: GridStrategy;
    style?: any;
    contentContainerStyle?: any;
    itemKeyExtractor?: (item: any, index: number) => string;
    scrollEnabled?: boolean;
    onScrollBeginDrag?: any;
    onScrollEndDrag?: any;
    onMomentumScrollEnd?: any;
}

const NonFlickerSortableGrid = React.memo(({
    data,
    renderItem,
    dimensions,
    orientation = GridOrientation.Vertical,
    strategy = GridStrategy.Insert,
    style,
    contentContainerStyle,
    itemKeyExtractor = (item: any) => item.id,
    scrollEnabled = true,
    ...scrollProps
}: NonFlickerSortableGridProps) => {
    const {
        scrollViewRef,
        dropProviderRef,
        handleScroll,
        handleScrollEnd,
        contentWidth,
        contentHeight,
        getItemProps
    } = useGridSortableList({
        data,
        dimensions,
        orientation,
        strategy,
        itemKeyExtractor
    });

    const combinedOnScrollEndDrag = (e: any) => {
        handleScrollEnd();
        if (scrollProps.onScrollEndDrag) {
            scrollProps.onScrollEndDrag(e);
        }
    };

    const combinedOnMomentumScrollEnd = (e: any) => {
        handleScrollEnd();
        if (scrollProps.onMomentumScrollEnd) {
            scrollProps.onMomentumScrollEnd(e);
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <DropProvider ref={dropProviderRef}>
                <AnimatedScrollView
                    ref={scrollViewRef}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    scrollEnabled={scrollEnabled}
                    style={[{ flex: 1, position: 'relative' }, style]}
                    contentContainerStyle={contentContainerStyle}
                    onScrollBeginDrag={scrollProps.onScrollBeginDrag}
                    onScrollEndDrag={combinedOnScrollEndDrag}
                    onMomentumScrollEnd={combinedOnMomentumScrollEnd}
                    simultaneousHandlers={dropProviderRef}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                >
                    <View style={{ width: contentWidth, height: contentHeight, position: 'relative' }}>
                        {data.map((item, index) => {
                            const itemProps = getItemProps(item, index);
                            return renderItem({
                                item,
                                index,
                                ...itemProps
                            }) as any;
                        })}
                    </View>
                </AnimatedScrollView>
            </DropProvider>
        </GestureHandlerRootView>
    );
});

let cachedCurrentUser: any = null;
let cachedCurrentUserProfile: any = null;

interface CategoryCardProps {
    categoryName: string;
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
        <View
            style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 16,
                borderWidth: 1.5,
                borderColor: colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 2,
            }}
        >
            {/* Category Header */}
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    height: 40,
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
                    <SortableItem.Handle>
                        <View style={{ padding: 6, marginLeft: 8 }}>
                            <Icon name="Equals" size={20} color={colors.textSecondary} />
                        </View>
                    </SortableItem.Handle>
                </View>
            </View>

            {/* Category Tasks List */}
            {catItems.length === 0 ? (
                <View style={{ height: 48, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center' }}>
                        No tasks in this category. Tap + to add!
                    </Text>
                </View>
            ) : (
                <View style={{ height: catItems.length * 58 }}>
                    <NonFlickerSortable
                        data={catItems}
                        itemHeight={58}
                        useFlatList={false}
                        style={{ backgroundColor: 'transparent', height: catItems.length * 58 }}
                        renderItem={({ item, id, positions, ...props }: any) => {
                            return (
                                <SortableItemAny
                                    key={id}
                                    id={id}
                                    data={item}
                                    positions={positions}
                                    {...props}
                                    onDrop={(draggedId: string, newPosition: number, allPositions: { [id: string]: number }) => {
                                        if (allPositions) {
                                            const sortedData = [...catItems].sort((a, b) => {
                                                const posA = allPositions[a.id] ?? 0;
                                                const posB = allPositions[b.id] ?? 0;
                                                return posA - posB;
                                            });
                                            const otherItems = checklist.filter(x => x.category !== categoryName);
                                            setChecklist([...otherItems, ...sortedData]);
                                        }
                                    }}
                                >
                                    <View style={{
                                        backgroundColor: colors.background,
                                        borderRadius: 12,
                                        paddingHorizontal: 14,
                                        height: 50,
                                        marginBottom: 8,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderWidth: 1,
                                        borderColor: colors.border,
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

                                            <SortableItemAny.Handle>
                                                <View style={{ padding: 4, marginLeft: 6, opacity: 0.6 }}>
                                                    <Icon name="Equals" size={18} color={colors.textSecondary} />
                                                </View>
                                            </SortableItemAny.Handle>
                                        </View>
                                    </View>
                                </SortableItemAny>
                            );
                        }}
                    />
                </View>
            )}
        </View>
    );
});

type TabType = 'Full Itinerary' | 'checklist' | 'notes' | 'Itinerary MapView';

export default function ItineraryViewScreen() {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { places, setPlaces, checklist, setChecklist, notes, setNotes, tripDraft, customCategories, setCustomCategories, collaborators, setCollaborators, clearDraft } = useItineraryStore();
    const isSolo = tripDraft?.travelStyle === 'solo' || tripDraft?.tripType === 'solo' || tripDraft?.travel_style === 'solo';
    const [activeTab, setActiveTab] = useState<TabType>('Full Itinerary');
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
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
    const noteTitleInputRef = useRef<TextInput>(null);
    const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);

    const [checklistModalVisible, setChecklistModalVisible] = useState(false);
    const [checklistModalMode, setChecklistModalMode] = useState<'add_category' | 'add_item' | 'edit_category'>('add_category');
    const [checklistModalTargetCategory, setChecklistModalTargetCategory] = useState('');
    const [checklistModalInputValue, setChecklistModalInputValue] = useState('');
    const [showFloatingButton, setShowFloatingButton] = useState(true);
    const scrollOffsetRef = useRef(0);

    const [finalizeModalVisible, setFinalizeModalVisible] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(cachedCurrentUser);
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(cachedCurrentUserProfile);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const user = session?.user || null;
            setCurrentUser(user);
            cachedCurrentUser = user;
            if (user) {
                const initialProfile = {
                    id: user.id,
                    name: user.user_metadata?.full_name || 'Admin',
                    display_name: user.user_metadata?.full_name || 'Admin',
                    photo_url: user.user_metadata?.avatar_url || null
                };
                if (!cachedCurrentUserProfile) {
                    setCurrentUserProfile(initialProfile);
                    cachedCurrentUserProfile = initialProfile;
                }

                const fetchProfile = async () => {
                    try {
                        const { data } = await supabase
                            .from('profiles')
                            .select('id, name, display_name, photo_url')
                            .eq('id', user.id)
                            .maybeSingle();

                        if (data) {
                            const updatedProfile = {
                                id: user.id,
                                name: data.name || data.display_name || user.user_metadata?.full_name || 'Admin',
                                display_name: data.display_name || data.name || user.user_metadata?.full_name || 'Admin',
                                photo_url: data.photo_url || user.user_metadata?.avatar_url || null
                            };
                            setCurrentUserProfile(updatedProfile);
                            cachedCurrentUserProfile = updatedProfile;
                        }
                    } catch (err) {
                        console.error('Error fetching profile in background:', err);
                    }
                };
                fetchProfile();
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
        if (!tripDraft) return;

        // Try direct fields first
        let parsedChecklist = null;
        let parsedNotes = null;
        let parsedCollaborators = null;

        // Checklist
        if (tripDraft.checklist) {
            try {
                parsedChecklist = typeof tripDraft.checklist === 'string'
                    ? JSON.parse(tripDraft.checklist)
                    : tripDraft.checklist;
            } catch (e) {
                console.error('Failed to parse tripDraft.checklist:', e);
            }
        } else if (tripDraft.checklistRaw) {
            try {
                parsedChecklist = JSON.parse(tripDraft.checklistRaw);
            } catch (e) {
                console.error('Failed to parse tripDraft.checklistRaw:', e);
            }
        }

        // Notes
        if (tripDraft.notes) {
            try {
                parsedNotes = typeof tripDraft.notes === 'string'
                    ? JSON.parse(tripDraft.notes)
                    : tripDraft.notes;
            } catch (e) {
                console.error('Failed to parse tripDraft.notes:', e);
            }
        } else if (tripDraft.notesRaw) {
            try {
                parsedNotes = JSON.parse(tripDraft.notesRaw);
            } catch (e) {
                console.error('Failed to parse tripDraft.notesRaw:', e);
            }
        }

        // Collaborators/Participants
        if (tripDraft.participants) {
            try {
                parsedCollaborators = typeof tripDraft.participants === 'string'
                    ? JSON.parse(tripDraft.participants)
                    : tripDraft.participants;
            } catch (e) {
                console.error('Failed to parse tripDraft.participants:', e);
            }
        } else if (tripDraft.participantsRaw) {
            try {
                parsedCollaborators = JSON.parse(tripDraft.participantsRaw);
            } catch (e) {
                console.error('Failed to parse tripDraft.participantsRaw:', e);
            }
        }

        // Fallback to legacy mandatory_items if direct fields are empty
        if ((!parsedChecklist || parsedChecklist.length === 0) && tripDraft.mandatory_items) {
            try {
                const items = typeof tripDraft.mandatory_items === 'string'
                    ? JSON.parse(tripDraft.mandatory_items)
                    : tripDraft.mandatory_items;

                if (Array.isArray(items) && items.length >= 3) {
                    parsedChecklist = typeof items[0] === 'string' ? JSON.parse(items[0]) : items[0];
                    const parsedCategories = typeof items[1] === 'string' ? JSON.parse(items[1]) : items[1];
                    parsedNotes = typeof items[2] === 'string' ? JSON.parse(items[2]) : items[2];
                    const collabIndex = items.length >= 5 ? 4 : 3;
                    parsedCollaborators = typeof items[collabIndex] === 'string' ? JSON.parse(items[collabIndex]) : items[collabIndex];

                    if (Array.isArray(parsedCategories) && parsedCategories.length > 0 && customCategories.length === 0) {
                        setCustomCategories(parsedCategories);
                    }
                }
            } catch (e) {
                console.error('Failed to unpack legacy custom itinerary details:', e);
            }
        }

        if (Array.isArray(parsedChecklist) && parsedChecklist.length > 0 && checklist.length === 0) {
            setChecklist(parsedChecklist);
            // Extract categories
            const cats = [...new Set(parsedChecklist.map((item: any) => item.category))];
            if (cats.length > 0 && customCategories.length === 0) {
                setCustomCategories(cats);
            }
        }
        if (Array.isArray(parsedNotes) && parsedNotes.length > 0 && notes.length === 0) {
            setNotes(parsedNotes);
        }
        if (Array.isArray(parsedCollaborators) && parsedCollaborators.length > 0 && collaborators.length === 0) {
            setCollaborators(parsedCollaborators);
        }

        // Map View
        const mapData = tripDraft.itineraryMapView || (tripDraft.itinerary_map_view ? (typeof tripDraft.itinerary_map_view === 'string' ? JSON.parse(tripDraft.itinerary_map_view) : tripDraft.itinerary_map_view) : null);
        if (mapData) {
            if (mapData.startingCoords) setStartingCoords(mapData.startingCoords);
            if (mapData.destinationCoords) setDestinationCoords(mapData.destinationCoords);
        }
    }, [tripDraft]);

    useEffect(() => {
        const backAction = () => {
            if (isProcessing) return true; // Block back during processing
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
    }, [showUserSearch, isProcessing]);

    // Scroll handling for FAB is now managed by drag events directly
    const tabs: TabType[] = ['Full Itinerary', 'checklist', 'notes', 'Itinerary MapView'];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Full Itinerary':
                return renderItineraryTab();
            case 'checklist':
                return renderChecklist();
            case 'notes':
                return renderNotes();
            case 'Itinerary MapView':
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
            Alert.alert('Authentication Required', 'Please log in to finalize your itinerary.');
            return;
        }

        // Close modal and show processing overlay
        setFinalizeModalVisible(false);
        setIsProcessing(true);
        setProcessingStatus('Saving your itinerary...');

        try {
            // 1. Fetch user's profile info
            const { data: currentUserData } = await supabase
                .from('profiles')
                .select('name, display_name, photo_url, username')
                .eq('id', currentUser.id)
                .maybeSingle();
            const userData: any = currentUserData || {};

            await showUploadNotification(0.4, 'Preparing itinerary data...');
            setProcessingStatus('Preparing itinerary data...');

            // 3. Prepare itinerary arrays and fields
            const itineraryStrings = (places || []).map(p => {
                const timeStr = p.time ? `[${p.time}] ` : '';
                return `${timeStr}${p.name}${p.address ? ` - ${p.address}` : ''}`;
            });

            const fromDateStr = tripDraft?.fromDate ? new Date(tripDraft.fromDate).toISOString() : new Date().toISOString();
            const toDateStr = tripDraft?.toDate ? new Date(tripDraft.toDate).toISOString() : new Date().toISOString();
            const durationDays = tripDraft?.duration ? parseInt(tripDraft.duration) : 1;

            const tripPayload = {
                user_id: currentUser.id,
                travel_style: tripDraft?.travelStyle || tripDraft?.tripType || 'solo',
                trip_title: tripDraft?.trip_title || tripDraft?.title || 'My Trip Itinerary',
                from_location: tripDraft?.fromLocation || null,
                to_location: tripDraft?.toLocation || null,
                from_date: fromDateStr,
                to_date: toDateStr,
                duration_days: durationDays,
                cost_per_person: parseFloat(tripDraft?.costPerPerson) || 0,
                accommodation_type: tripDraft?.accommodationType || null,
                booking_status: 'saved', // Always 'saved', posting is removed
                places_to_visit: places || [],
                itinerary: itineraryStrings,
                participants: [currentUser.id, ...(collaborators || []).map((c: any) => c.id || c.uid || c)],
                trip_types: tripDraft?.tripTypes || [],
                transport_modes: tripDraft?.transportModes || [],
                accommodation_days: tripDraft?.accommodationDays ? parseInt(tripDraft.accommodationDays) : null,
                checklist: checklist || [],
                notes: notes || [],
                itinerary_map_view: { startingCoords, destinationCoords, markers: [] },
                updated_at: new Date().toISOString(),
            };

            // 4. Save to Supabase
            setProcessingStatus('Saving to cloud...');
            await showUploadNotification(0.7, 'Saving to cloud...');

            let tripId = tripDraft?.id;

            if (tripId && tripId !== 'new-trip') {
                const { error: updateError } = await supabase
                    .from('itineraries')
                    .update(tripPayload)
                    .eq('id', tripId);
                if (updateError) throw updateError;
            } else {
                const { data: newTrip, error: insertError } = await supabase
                    .from('itineraries')
                    .insert(tripPayload)
                    .select()
                    .single();
                if (insertError) throw insertError;
                tripId = newTrip.id;
            }

            // 5. Send notifications to collaborators (excluding creator)
            if (collaborators.length > 0 && tripId) {
                setProcessingStatus('Notifying collaborators...');
                await showUploadNotification(0.9, 'Notifying collaborators...');

                const notificationRows = collaborators
                    .filter((c: any) => c.id !== currentUser.id)
                    .map((c: any) => ({
                        recipient_id: c.id,
                        type: 'trip_update',
                        title: 'Itinerary Saved! 📋',
                        message: `${userData.name || userData.display_name || 'A collaborator'} has saved the itinerary: "${tripDraft?.trip_title || tripDraft?.title || 'Trip'}"`,
                        entity_id: tripId,
                        entity_type: 'trip',
                        actor_id: currentUser.id,
                        actor_name: userData.name || userData.display_name || 'Traveler',
                        deep_link_route: 'TripDetails',
                        deep_link_params: { tripId },
                        is_read: false,
                    }));

                if (notificationRows.length > 0) {
                    await supabase.from('notifications').insert(notificationRows);
                }
            }

            // 6. Done — show completion notification and navigate
            await completeUploadNotification(
                'Itinerary Saved! 📋',
                `"${tripDraft?.trip_title || tripDraft?.title || 'Trip'}" has been saved.`
            );

            setIsProcessing(false);
            clearDraft();
            router.replace('/(tabs)/profile');
        } catch (error: any) {
            console.error(error);
            await failUploadNotification(error.message || 'Failed to finalize trip');
            setIsProcessing(false);
            Alert.alert('Error', error.message || 'Could not finalize the trip itinerary. Please try again.');
        } finally {
            setIsFinalizing(false);
        }
    };

    const renderDraggableItem = ({ item, id, positions, ...props }: any) => {
        const handleDrop = (draggedId: string, newPosition: number, allPositions?: { [id: string]: number }) => {
            if (allPositions) {
                const sortedData = [...activePlacesMemo].sort((a, b) => {
                    const posA = allPositions[a.id] ?? 0;
                    const posB = allPositions[b.id] ?? 0;
                    return posA - posB;
                });

                if (selectedDayTab === 'All') {
                    let currentDay = 1;
                    const updatedPlaces: any[] = [];
                    sortedData.forEach((item) => {
                        if (item.isHeader) {
                            currentDay = item.day;
                        } else {
                            updatedPlaces.push({ ...item, day: currentDay });
                        }
                    });
                    const duration = tripDraft?.duration || Math.max(...places.map(p => p.day), 1);
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
                    const updatedDayPlaces = sortedData.map((item, index) => ({ ...item, order: index }));
                    setPlaces([...otherDayPlaces, ...updatedDayPlaces]);
                }
            }
        };

        if (item.isHeader) {
            return (
                <SortableItem key={id} id={id} data={item} positions={positions} {...props} onDrop={handleDrop}>
                    <View style={{ height: 110, justifyContent: 'center', paddingHorizontal: 15, marginVertical: 5 }}>
                        <View style={{
                            backgroundColor: colors.primary + '15',
                            padding: 12,
                            borderRadius: 16,
                            borderWidth: 1.5,
                            borderColor: colors.primary + '30',
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}>
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: colors.primary,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 12
                            }}>
                                <Icon name="Calendar" size={20} color="#fff" weight="bold" />
                            </View>
                            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>
                                Day {item.day}{item.dateStr ? ` - ${item.dateStr}` : ''}
                            </Text>
                        </View>
                    </View>
                </SortableItem>
            );
        }

        const getColorForTitle = (title?: string) => {
            if (!title) return '#6C5CE7';
            if (title.toLowerCase().includes('hotel')) return '#6C5CE7';
            if (title.toLowerCase().includes('food')) return '#FDCB6E';
            return '#6C5CE7';
        };

        return (
            <SortableItem key={id} id={id} data={item} positions={positions} {...props} onDrop={handleDrop}>
                <View style={{ flexDirection: 'row', paddingHorizontal: 15, height: 110, alignItems: 'center', marginVertical: 5 }}>
                    <SortableItem.Handle>
                        <View style={{ padding: 5, marginRight: 5 }}>
                            <Icon name="DotsSixVertical" size={20} color={colors.textSecondary} />
                        </View>
                    </SortableItem.Handle>

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
                    </View>

                    <View style={{ flex: 1, height: 100, backgroundColor: colors.card, borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    style={{ color: colors.textSecondary, fontWeight: 'bold', fontSize: 14, marginBottom: 2, padding: 0 }}
                                    value={item.title}
                                    placeholder="Enter a title"
                                    placeholderTextColor={colors.textSecondary}
                                    onChangeText={(text) => {
                                        setPlaces(places.map(p => p.id === item.id ? { ...p, title: text } : p));
                                    }}
                                />
                                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                                {item.address ? (
                                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{item.address}</Text>
                                ) : null}
                            </View>
                            <TouchableOpacity onPress={() => handleDeletePlace(item.id)} style={{ padding: 4 }}>
                                <Icon name="Trash" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </SortableItem>
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

                <NonFlickerSortable
                    data={activePlaces}
                    itemHeight={120}
                    style={{ backgroundColor: 'transparent' }}
                    renderItem={renderDraggableItem}
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

        const categoryData = categories.map((catName) => {
            const catItems = checklist.filter(item => item.category === catName);
            const itemsHash = catItems.map(item => `${item.id}-${item.checked}`).join(',');
            return {
                id: catName,
                name: catName,
                itemsHash,
            };
        });

        const getCategoryCardHeight = (item: any) => {
            const catItems = checklist.filter(x => x.category === item.name);
            if (catItems.length === 0) {
                return 153;
            }
            return 105 + catItems.length * 58;
        };

        return (
            <View style={{ flex: 1 }}>
                <NonFlickerSortable
                    key="checklist-categories-list"
                    data={categoryData}
                    itemHeight={getCategoryCardHeight}
                    useFlatList={false}
                    style={{ backgroundColor: 'transparent' }}
                    contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: 150 }}
                    onScrollBeginDrag={() => setShowFloatingButton(false)}
                    onScrollEndDrag={() => setShowFloatingButton(true)}
                    onMomentumScrollEnd={() => setShowFloatingButton(true)}
                    renderItem={({ item, id, positions, ...props }: any) => (
                        <SortableItemAny
                            key={id}
                            id={id}
                            data={item}
                            positions={positions}
                            {...props}
                            onDrop={(draggedId: string, newPosition: number, allPositions: { [id: string]: number }) => {
                                if (allPositions) {
                                    const sortedCats = [...categoryData].sort((a, b) => {
                                        const posA = allPositions[a.id] ?? 0;
                                        const posB = allPositions[b.id] ?? 0;
                                        return posA - posB;
                                    }).map(c => c.name);
                                    setCustomCategories(sortedCats);
                                }
                            }}
                        >
                            <View style={{ paddingVertical: 10, paddingHorizontal: 15 }}>
                                <CategoryCard
                                    categoryName={item.name}
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
                            </View>
                        </SortableItemAny>
                    )}
                />
            </View>
        );
    };

    const renderNotes = () => {
        const sortedNotes = [...notes].sort((a, b) => a.order - b.order);
        const columns = 2;
        const scrollPadding = 10;
        const columnGap = 4;
        const rowGap = 4;
        const availableWidth = containerWidth - (scrollPadding * 2);
        const itemWidth = (availableWidth - columnGap) / 2;
        const itemHeight = 135;

        const renderNoteCard = ({ item, id, positions, ...props }: any) => (
            <SortableGridItemAny
                key={id}
                id={id}
                data={item}
                positions={positions}
                {...props}
                onDrop={(draggedId: string, newPosition: number, allPositions?: any) => {
                    if (allPositions) {
                        const sortedData = [...sortedNotes].sort((a, b) => {
                            const posA = allPositions[a.id];
                            const posB = allPositions[b.id];
                            const idxA = typeof posA === 'object' && posA !== null ? (posA.index ?? 0) : (posA ?? 0);
                            const idxB = typeof posB === 'object' && posB !== null ? (posB.index ?? 0) : (posB ?? 0);
                            return idxA - idxB;
                        });
                        const updated = sortedData.map((noteItem, index) => ({ ...noteItem, order: index }));
                        setNotes(updated);
                    }
                }}
            >
                <View style={{ flex: 1, padding: 6 }}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                            setEditingNoteId(item.id);
                            setNoteTitleInput(item.title);
                            setNoteContentInput(item.content);
                            setNoteModalVisible(true);
                        }}
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 16,
                            padding: 12,
                            flex: 1,
                            borderWidth: 1.5,
                            borderColor: colors.border,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 4,
                            elevation: 2,
                            justifyContent: 'space-between'
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 6 }} numberOfLines={1}>
                                {item.title || 'Untitled'}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 14 }} numberOfLines={4}>
                                {item.content || 'Empty note'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </SortableGridItemAny>
        );

        return (
            <View
                style={{ flex: 1 }}
                onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0 && w !== containerWidth) {
                        setContainerWidth(w);
                    }
                }}
            >
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
                    <NonFlickerSortableGrid
                        data={sortedNotes}
                        dimensions={{ columns, itemWidth, itemHeight, columnGap, rowGap }}
                        style={{ backgroundColor: 'transparent' }}
                        contentContainerStyle={{ paddingHorizontal: scrollPadding, paddingVertical: 10, paddingBottom: 150 }}
                        renderItem={renderNoteCard}
                        onScrollBeginDrag={() => setShowFloatingButton(false)}
                        onScrollEndDrag={() => setShowFloatingButton(true)}
                        onMomentumScrollEnd={() => setShowFloatingButton(true)}
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



    return (
        <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <NeumorphicBackButton />
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{tripDraft?.trip_title || tripDraft?.title || 'Trip Itinerary'}</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontSize: 10 }]} numberOfLines={1}>
                            {tripDraft?.fromLocation ? `${tripDraft.fromLocation.split(',')[0]} → ` : ''}{tripDraft?.toLocation?.split(',')[0] || 'Ready for adventure'}
                        </Text>
                    </View>
                    {!isSolo && (
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
                    )}
                </View>

                {/* Collaborators Row */}
                <View style={{ height: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
                    {(currentUserProfile || collaborators.length > 0) ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: 15 }}>Collaborators:</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: colors.border,
                                        opacity: 0.3,
                                        borderWidth: 2,
                                        borderColor: colors.card,
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Icon name="User" size={18} color={colors.textSecondary} />
                                </View>
                            </View>
                        </>
                    )}
                </View>

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
                        <Text style={styles.buttonText}>Save Itinerary</Text>
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
                            <Icon name="FloppyDisk" size={32} color={colors.primary} weight="fill" />
                        </View>

                        <Text style={{
                            color: colors.text,
                            fontSize: 22,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            marginBottom: 8
                        }}>
                            Save Itinerary
                        </Text>

                        <Text style={{
                            color: colors.textSecondary,
                            fontSize: 14,
                            textAlign: 'center',
                            marginBottom: 24,
                            paddingHorizontal: 10,
                            lineHeight: 20
                        }}>
                            Are you sure you want to save this travel itinerary? It will be stored in your saved itineraries list and you can share it with others.
                        </Text>

                        {/* Option: Save Itinerary */}
                        <TouchableOpacity
                            disabled={isFinalizing}
                            onPress={() => handleFinalizeAction('saved')}
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
                                    Save Itinerary
                                </Text>
                            )}
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

            {/* Processing Overlay */}
            {isProcessing && (
                <View style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 9999,
                }}>
                    <View style={{
                        backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                        borderRadius: 24,
                        padding: 32,
                        alignItems: 'center',
                        width: '80%',
                        maxWidth: 320,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.3,
                        shadowRadius: 20,
                        elevation: 15,
                    }}>
                        <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 20 }} />
                        <Text style={{
                            color: colors.text,
                            fontSize: 18,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            marginBottom: 8,
                        }}>
                            Please wait
                        </Text>
                        <Text style={{
                            color: colors.textSecondary,
                            fontSize: 14,
                            textAlign: 'center',
                            lineHeight: 20,
                        }}>
                            {processingStatus}
                        </Text>
                    </View>
                </View>
            )}
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
                onShow={() => {
                    if (!editingNoteId) {
                        setTimeout(() => {
                            noteTitleInputRef.current?.focus();
                        }, 100);
                    }
                }}
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
                            ref={noteTitleInputRef}
                            style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 15 }}
                            placeholder="Title"
                            placeholderTextColor={colors.textSecondary + '80'}
                            value={noteTitleInput}
                            onChangeText={setNoteTitleInput}
                            autoFocus={!editingNoteId}
                        />
                        <TextInput
                            style={{ fontSize: 16, color: colors.text, lineHeight: 24 }}
                            placeholder="Note"
                            placeholderTextColor={colors.textSecondary + '80'}
                            multiline
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
