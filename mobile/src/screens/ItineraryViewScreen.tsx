import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, FlatList, Alert, Modal, ActivityIndicator, Platform, KeyboardAvoidingView, Keyboard, Share } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useTripStore } from '../store/tripStore';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import MapView, { Marker } from 'react-native-maps';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';

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
    const { places, setPlaces, checklist, setChecklist, notes, setNotes, essentials, setEssentials, tripDraft } = useTripStore();
    const [activeTab, setActiveTab] = useState<TabType>('Full Itinerary');
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [newEssentialItem, setNewEssentialItem] = useState('');
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [selectedDayTab, setSelectedDayTab] = useState('All');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [checklistModalVisible, setChecklistModalVisible] = useState(false);
    const [checklistModalMode, setChecklistModalMode] = useState<'add_category' | 'add_item' | 'edit_category'>('add_category');
    const [checklistModalTargetCategory, setChecklistModalTargetCategory] = useState('');
    const [checklistModalInputValue, setChecklistModalInputValue] = useState('');
    const [showFloatingButton, setShowFloatingButton] = useState(true);
    const scrollOffsetRef = useRef(0);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    const handleScroll = (event: any) => {
        const currentOffset = event.nativeEvent.contentOffset.y;
        if (currentOffset < 0) return;

        const diff = currentOffset - scrollOffsetRef.current;
        if (Math.abs(diff) < 5) return;

        if (currentOffset <= 20) {
            setShowFloatingButton(true);
        } else if (diff > 0) {
            setShowFloatingButton(false);
        } else {
            setShowFloatingButton(true);
        }

        scrollOffsetRef.current = currentOffset;
    };

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
            setSearchResults(data || []);
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
        setShowUserSearch(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    const getAllData = () => {
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
    };

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

        const activePlaces = selectedDayTab === 'All'
            ? getAllData()
            : places.filter(p => p.day === parseInt(selectedDayTab.replace('Day ', ''))).sort((a, b) => a.order - b.order);

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
                    onScroll={handleScroll}
                    onScrollOffsetChange={(offset) => {
                        const currentOffset = offset;
                        if (currentOffset < 0) return;

                        const diff = currentOffset - scrollOffsetRef.current;
                        if (Math.abs(diff) < 5) return;

                        if (currentOffset <= 20) {
                            setShowFloatingButton(true);
                        } else if (diff > 0) {
                            setShowFloatingButton(false);
                        } else {
                            setShowFloatingButton(true);
                        }

                        scrollOffsetRef.current = currentOffset;
                    }}
                    scrollEventThrottle={16}
                />
            </View>
        );
    };

    const renderNotes = () => (
        <View style={styles.tabPane}>
            <TextInput
                style={[styles.notesInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="Write your trip notes here..."
                placeholderTextColor={colors.textSecondary}
                multiline
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
            />
        </View>
    );

    const renderMap = () => {
        const initialRegion = places.length > 0 ? {
            latitude: places[0].latitude || 20.5937,
            longitude: places[0].longitude || 78.9629,
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
                    {places.map((place, index) => (
                        place.latitude && place.longitude ? (
                            <Marker
                                key={place.id}
                                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                                title={place.name}
                                description={place.title}
                            />
                        ) : null
                    ))}
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
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={[
                            styles.backButton,
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
                        <Icon name="CaretLeft" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{tripDraft?.title || 'Trip Itinerary'}</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontSize: 10 }]} numberOfLines={1}>
                            {tripDraft?.fromLocation ? `${tripDraft.fromLocation.split(',')[0]} → ` : ''}{tripDraft?.toLocation?.split(',')[0] || 'Ready for adventure'}
                        </Text>
                    </View>
                    {tripDraft?.tripType !== 'solo' && (
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
                                    alignItems: 'center',
                                    marginRight: 10
                                }
                            ]}
                        >
                            <Icon name="UserPlus" size={22} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={handleShareTrip}
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
                        <Icon name="ShareNetwork" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Collaborators Row */}
                {collaborators.length > 0 && (
                    <View style={{ paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: 10 }}>With:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {collaborators.map(user => (
                                <View key={user.id} style={{ marginRight: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary + '40' }}>
                                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold' }}>@{user.username}</Text>
                                </View>
                            ))}
                        </ScrollView>
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
                    <TouchableOpacity
                        onPress={() => {
                            setChecklistModalMode('add_category');
                            setChecklistModalInputValue('');
                            setChecklistModalVisible(true);
                        }}
                        style={[
                            styles.floatingActionButton,
                            styles.neumorphicButton,
                            {
                                backgroundColor: colors.card,
                                shadowColor: isDarkMode ? '#000' : '#b8c4d9',
                            }
                        ]}
                    >
                        <Icon name="Plus" size={26} color={colors.primary} weight="bold" />
                    </TouchableOpacity>
                )}

            </KeyboardAvoidingView>

            {/* Bottom Actions - Outside KeyboardAvoidingView to stay fixed */}
            {!isKeyboardVisible && (
                <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'ios' ? 30 : 20 }]}>
                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                        onPress={() => Alert.alert('Trip Saved!', 'Your itinerary has been finalized.')}
                    >
                        <Text style={styles.buttonText}>Finalize Trip</Text>
                    </TouchableOpacity>
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
            <Modal visible={showUserSearch} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.card, height: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Add Collaborators</Text>
                            <TouchableOpacity onPress={() => setShowUserSearch(false)}>
                                <Icon name="X" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.inputContainer, { marginBottom: 15 }]}>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="Search by username or name..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    if (text.length >= 1) handleSearchUsers(text);
                                }}
                                autoFocus
                            />
                            <TouchableOpacity onPress={() => handleSearchUsers()} style={[styles.addButton, { backgroundColor: colors.primary }]}>
                                {searching ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="MagnifyingGlass" size={20} color="#fff" />}
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={searchResults}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => addCollaborator(item)}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                >
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                                        <Icon name="User" size={20} color={colors.primary} />
                                    </View>
                                    <View>
                                        <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.name}</Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>@{item.username}</Text>
                                    </View>
                                    <View style={{ flex: 1 }} />
                                    <Icon name="Plus" size={20} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={() => searchQuery.length >= 1 && !searching ? (
                                <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>No users found</Text>
                            ) : null}
                        />
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
