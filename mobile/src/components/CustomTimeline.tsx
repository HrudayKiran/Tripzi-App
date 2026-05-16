import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Platform, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from './Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import MapView, { Marker } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { deleteTripImagesFromR2, uploadTripImageToR2 } from '../utils/imageUpload';
import { showUploadNotification, completeUploadNotification, failUploadNotification } from '../utils/notifications';
import { syncDatabase } from '../database/sync';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTripStore } from '../store/tripStore';

type TimelineItem = {
    title: string;
    time?: string;
    description?: string;
    icon?: string;
};

type StructuredPlace = {
    id: string;
    name: string;
    day: number;
    order: number;
    latitude?: number;
    longitude?: number;
    address?: string;
    time?: string;
    title?: string;
};

type CustomTimelineProps = {
    items?: string[] | TimelineItem[];
};

export default function CustomTimeline({ items: propItems }: CustomTimelineProps) {
    const { colors, isDarkMode } = useTheme();
    const params = useLocalSearchParams();
    const router = useRouter();
    const tripId = params.id as string;
    const tripDataParam = params.tripData as string;
    const tripImagesParam = params.tripImages as string;

    // Store
    const { places, setPlaces, tripDraft, setTripDraft } = useTripStore();

    // State for Screen mode
    const [trip, setTrip] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useState('All');
    const [isFABVisible, setIsFABVisible] = useState(true);
    const [mapHeight, setMapHeight] = useState(Dimensions.get('window').height * 0.4);
    const isDraggingMap = useRef(false);
    const startY = useRef(0);
    const startHeight = useRef(0);
    const [searchQuery, setSearchQuery] = useState('');
    const latestQueryRef = useRef('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
    const [passedImages, setPassedImages] = useState<any[]>([]);
    const [startingCoords, setStartingCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number, lng: number } | null>(null);
    const mapRef = useRef<MapView>(null);
    const [mapRegion, setMapRegion] = useState({
        latitude: 20.5937,
        longitude: 78.9629,
        latitudeDelta: 10,
        longitudeDelta: 10,
    });

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
    }, []);

    const getDuration = (fromStr: string, toStr: string) => {
        const from = new Date(fromStr);
        const to = new Date(toStr);
        const diffTime = Math.abs(to.getTime() - from.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    };

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

                if (mapRef.current && type === 'starting') { // Only pan to starting loc initially
                    mapRef.current.animateToRegion({
                        latitude: loc.lat,
                        longitude: loc.lng,
                        latitudeDelta: 0.1,
                        longitudeDelta: 0.1,
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Geocoding error:', error);
        }
    };

    useEffect(() => {
        if (!propItems) {
            if (tripDataParam) {
                try {
                    const parsedData = JSON.parse(tripDataParam);
                    
                    // Only update if data is different to avoid unnecessary renders
                    setTrip(parsedData);
                    setTripDraft(parsedData);

                    if (parsedData.fromLocation) {
                        setTimeout(() => geocodeLocation(parsedData.fromLocation, 'starting'), 1000);
                    }
                    if (parsedData.toLocation) {
                        setTimeout(() => geocodeLocation(parsedData.toLocation, 'destination'), 1500);
                    }

                    if (tripImagesParam) {
                        setPassedImages(JSON.parse(tripImagesParam));
                    }

                    if (parsedData.fromDate && parsedData.toDate) {
                        const dur = getDuration(parsedData.fromDate, parsedData.toDate);
                        setTrip((prev: any) => ({ ...prev, duration: dur }));
                    }
                } catch (e) {
                    console.error('Failed to parse trip data', e);
                }
            } else if (tripId) {
                fetchTripDetails();
            } else if (tripDraft && !trip) {
                // Only recover from store if we don't have local trip state yet
                setTrip(tripDraft);
                if (tripDraft.fromLocation) geocodeLocation(tripDraft.fromLocation, 'starting');
                if (tripDraft.toLocation) geocodeLocation(tripDraft.toLocation, 'destination');
                const dur = getDuration(tripDraft.fromDate, tripDraft.toDate);
                setTrip((prev: any) => ({ ...prev, duration: dur }));
            }
        }
    }, [tripId, propItems, tripDataParam, tripImagesParam]); // Removed tripDraft from here

    const fetchTripDetails = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('id', tripId)
                .single();

            if (error) throw error;
            setTrip(data);
            
            // Update store draft for ItineraryViewScreen
            setTripDraft({
                ...data,
                fromLocation: data.from_location,
                toLocation: data.to_location,
                fromDate: data.from_date,
                toDate: data.to_date,
            });

            // Parse places_to_visit if it's JSON
            if (data.places_to_visit) {
                try {
                    const parsedPlaces = typeof data.places_to_visit === 'string'
                        ? JSON.parse(data.places_to_visit)
                        : data.places_to_visit;

                    if (Array.isArray(parsedPlaces) && parsedPlaces.length > 0 && typeof parsedPlaces[0] === 'object') {
                        setPlaces(parsedPlaces);
                    } else {
                        // Fallback: convert string array to structured places
                        const initialPlaces = (parsedPlaces as string[]).map((name, index) => ({
                            id: `${index}`,
                            name,
                            day: 1,
                            order: index,
                        }));
                        setPlaces(initialPlaces);
                    }
                } catch (e) {
                    // Not JSON, fallback handled above
                }
            }

            if (data.to_location) {
                // Move map to destination if we had coordinates, but for now just leave default or search
            }
        } catch (error: any) {
            Alert.alert('Error', `Failed to load trip: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const searchPlaces = async (query: string) => {
        latestQueryRef.current = query;
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        // Check if query is a maps link
        if (query.includes('maps.google.com') || query.includes('google.com/maps') || query.includes('maps.app.goo.gl') || query.includes('share.google')) {
            let targetUrl = query;
            if (query.includes('maps.app.goo.gl') || query.includes('share.google')) {
                const resolved = await resolveShortLink(query);
                if (resolved) targetUrl = resolved;
            }

            const regexAt = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
            const regexEx = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
            const regexLL = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
            
            const matchAt = targetUrl.match(regexAt);
            const matchEx = targetUrl.match(regexEx);
            const matchLL = targetUrl.match(regexLL);
            
            const match = matchAt || matchEx || matchLL;

            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);

                // Auto add to itinerary
                const currentDay = selectedTab === 'All' ? 1 : parseInt(selectedTab.replace('Day ', ''));
                const dayPlaces = places.filter(p => p.day === currentDay);

                const fullAddress = await reverseGeocode(lat, lng);
                const namePart = fullAddress.split(',')[0];
                const addrPart = fullAddress.split(',').slice(1).join(',').trim() || fullAddress;

                const newPlace: StructuredPlace = {
                    id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: namePart,
                    address: addrPart,
                    day: currentDay,
                    order: dayPlaces.length,
                    latitude: lat,
                    longitude: lng,
                    time: null,
                    title: '',
                };

                setPlaces([...places, newPlace]);
                setSearchResults([]);
                setSearchQuery('');
                return;
            } else {
                // Fallback: Try to extract place name or just search for the URL!
                const regexPlace = /\/place\/([^\/]+)/;
                const matchPlace = targetUrl.match(regexPlace);
                let searchTerm = query;
                if (matchPlace) {
                    searchTerm = decodeURIComponent(matchPlace[1].replace(/\+/g, ' '));
                } else {
                    const regexQ = /[?&](q|query)=([^&]+)/;
                    const matchQ = targetUrl.match(regexQ);
                    if (matchQ) {
                        searchTerm = decodeURIComponent(matchQ[2].replace(/\+/g, ' '));
                    }
                }

                const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
                const res = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchTerm)}&inputtype=textquery&fields=geometry,formatted_address,name&key=${apiKey}&language=en`);
                const data = await res.json();
                if (data.candidates && data.candidates.length > 0) {
                    const candidate = data.candidates[0];
                    const loc = candidate.geometry.location;

                    const currentDay = selectedTab === 'All' ? 1 : parseInt(selectedTab.replace('Day ', ''));
                    const dayPlaces = places.filter(p => p.day === currentDay);

                    const newPlace: StructuredPlace = {
                        id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name: candidate.name || 'Location from Link',
                        address: candidate.formatted_address || query,
                        day: currentDay,
                        order: dayPlaces.length,
                        latitude: loc.lat,
                        longitude: loc.lng,
                        time: null,
                        title: '',
                    };

                    setPlaces([...places, newPlace]);
                    setSearchResults([]);
                    setSearchQuery('');
                    return;
                }
            }
        }

        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return;

        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&language=en`);
            const data = await response.json();
            if (data.predictions && latestQueryRef.current === query) {
                setSearchResults(data.predictions);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    };

    const fetchPlaceDetails = async (placeId: string) => {
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return null;

        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,name,formatted_address&key=${apiKey}&language=en`);
            const data = await response.json();
            if (data.result) {
                return {
                    location: data.result.geometry?.location,
                    name: data.result.name,
                    address: data.result.formatted_address
                };
            }
        } catch (error) {
            console.error('Details error:', error);
        }
        return null;
    };

    const handleAddPlace = async (item: any) => {
        let location;
        let name = item.structured_formatting.main_text;
        let address = item.structured_formatting.secondary_text;

        if (item.isLink) {
            location = { lat: item.latitude, lng: item.longitude };
        } else {
            const details = await fetchPlaceDetails(item.place_id);
            if (details) {
                location = details.location;
                name = details.name || name;
                address = details.address || address;
            }
        }

        const currentDay = selectedTab === 'All' ? 1 : parseInt(selectedTab.replace('Day ', ''));
        const dayPlaces = places.filter(p => p.day === currentDay);

        const newPlace: StructuredPlace = {
            id: `${item.place_id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: name,
            address: address,
            day: currentDay,
            order: dayPlaces.length,
            latitude: location?.lat,
            longitude: location?.lng,
            time: null,
            title: '',
        };

        setPlaces([...places, newPlace]);
        setSearchQuery('');
        setSearchResults([]);
        setIsSearchVisible(false);

        if (location && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: location.lat,
                longitude: location.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }, 1000);
        }
    };

    const handleDeletePlace = (id: string) => {
        setPlaces(places.filter(p => p.id !== id));
    };

    const handleSaveItinerary = async () => {
        // First save to Supabase if it's an existing trip or we want to persist it now
        // But the user specifically asked to go to ItineraryViewScreen.tsx
        
        // Let's ensure the current places are in the store
        // setPlaces(places); // Already happening via state in CustomTimeline if we use store directly

        router.push('/trip/view');
    };

    // Component Mode logic
    const items = propItems || [];
    const normalizedItems: TimelineItem[] = items.map((item, index) => {
        if (typeof item === 'string') {
            const dayMatch = item.match(/^Day\s+(\d+):/i);
            const timeMatch = item.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-/i);

            if (dayMatch) {
                return {
                    title: item.substring(dayMatch[0].length).trim(),
                    time: dayMatch[0].trim(),
                    icon: 'MapPin',
                };
            } else if (timeMatch) {
                return {
                    title: item.substring(timeMatch[0].length).trim(),
                    time: timeMatch[1].trim(),
                    icon: 'Clock',
                };
            }
            return { title: item, icon: 'Circle' };
        }
        return item;
    });

    if (propItems) {
        // Render simple component mode
        return (
            <View style={styles.container}>
                {normalizedItems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icon name="CalendarBlank" size={40} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No itinerary planned yet.</Text>
                    </View>
                ) : (
                    normalizedItems.map((item, index) => (
                        <MotiView
                            key={index}
                            from={{ opacity: 0, translateY: 20 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 400, delay: index * 100 }}
                            style={styles.itemRow}
                        >
                            <View style={styles.timelineLineContainer}>
                                <Svg height="100%" width="20">
                                    {index !== normalizedItems.length - 1 && (
                                        <Line x1="10" y1="20" x2="10" y2="100%" stroke={colors.border} strokeWidth="2" />
                                    )}
                                    <Circle cx="10" cy="10" r="6" fill={colors.primary} />
                                </Svg>
                            </View>
                            <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                {item.time && <Text style={[styles.timeText, { color: colors.primary }]}>{item.time}</Text>}
                                <Text style={[styles.titleText, { color: colors.text }]}>{item.title}</Text>
                                {item.description && <Text style={[styles.descText, { color: colors.textSecondary }]}>{item.description}</Text>}
                            </View>
                        </MotiView>
                    ))
                )}
            </View>
        );
    }

    // Screen Mode Render
    if (loading && !trip) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const handleAddDay = () => {
        if (!trip) return;
        const newDuration = (trip.duration || 1) + 1;
        const updatedTrip = { ...trip, duration: newDuration };
        
        // Update toDate
        if (updatedTrip.fromDate) {
            const newToDate = new Date(new Date(updatedTrip.fromDate).getTime() + (newDuration - 1) * 24 * 60 * 60 * 1000);
            updatedTrip.toDate = newToDate.toISOString();
        }
        
        setTrip(updatedTrip);
        setTripDraft(updatedTrip);
    };

    const handleRemoveDay = (dayNum: number) => {
        if (!trip || (trip.duration || 1) <= 1) return;
        
        Alert.alert(
            "Remove Day",
            `Are you sure you want to remove Day ${dayNum}? All places on this day will be deleted.`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Remove", 
                    style: "destructive",
                    onPress: () => {
                        const filteredPlaces = places.filter(p => p.day !== dayNum);
                        const updatedPlaces = filteredPlaces.map(p => {
                            if (p.day > dayNum) return { ...p, day: p.day - 1 };
                            return p;
                        });
                        const newDuration = (trip.duration || 1) - 1;
                        const updatedTrip = { ...trip, duration: newDuration };
                        
                        // Update toDate
                        if (updatedTrip.fromDate) {
                            const newToDate = new Date(new Date(updatedTrip.fromDate).getTime() + (newDuration - 1) * 24 * 60 * 60 * 1000);
                            updatedTrip.toDate = newToDate.toISOString();
                        }

                        setPlaces(updatedPlaces);
                        setTrip(updatedTrip);
                        setTripDraft(updatedTrip);
                        
                        if (selectedTab === `Day ${dayNum}`) setSelectedTab('All');
                    }
                }
            ]
        );
    };

    const compactDays = () => {
        if (!trip) return;
        const usedDays = Array.from(new Set(places.map(p => p.day))).sort((a, b) => a - b);
        
        // If there are no places at all, we keep at least Day 1
        const finalDuration = usedDays.length > 0 ? usedDays.length : 1;
        
        const dayMapping: { [key: number]: number } = {};
        usedDays.forEach((day, index) => {
            dayMapping[day] = index + 1;
        });

        const updatedPlaces = places.map(p => ({
            ...p,
            day: dayMapping[p.day]
        }));

        const updatedTrip = { ...trip, duration: finalDuration };
        
        // Update toDate
        if (updatedTrip.fromDate) {
            const newToDate = new Date(new Date(updatedTrip.fromDate).getTime() + (finalDuration - 1) * 24 * 60 * 60 * 1000);
            updatedTrip.toDate = newToDate.toISOString();
        }

        setPlaces(updatedPlaces);
        setTrip(updatedTrip);
        setTripDraft(updatedTrip);
    };

    const duration = trip?.duration || 1;
    const fromDate = trip?.fromDate ? new Date(trip.fromDate) : null;

    const tabs = [
        { label: 'All', date: null, dayNum: 0 },
        ...Array.from({ length: duration }, (_, i) => {
            let dateStr = '';
            if (fromDate) {
                const currentDate = new Date(fromDate);
                currentDate.setDate(fromDate.getDate() + i);
                dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            return { label: `Day ${i + 1}`, date: dateStr, dayNum: i + 1 };
        })
    ];
    const activePlaces = selectedTab === 'All'
        ? places.sort((a, b) => a.day === b.day ? a.order - b.order : a.day - b.day)
        : places.filter(p => p.day === parseInt(selectedTab.replace('Day ', ''))).sort((a, b) => a.order - b.order);

    const getAllData = () => {
        const data = [];
        const duration = trip?.duration || 1;
        const fromDate = trip?.fromDate ? new Date(trip.fromDate) : null;

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

    const handlePlacePress = (item: StructuredPlace) => {
        if (item.latitude && item.longitude && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: item.latitude,
                longitude: item.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }, 1000);
        }
    };

    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBURfArYP_txIxAGEPYhNKm-FCtY4gQ7oQ';
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en`);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                return data.results[0].formatted_address;
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
        }
        return 'Dropped Pin Location';
    };

    const resolveShortLink = async (url: string) => {
        try {
            const res = await fetch(url, { 
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
                }
            });
            return res.url;
        } catch (e) {
            console.error('Failed to resolve short link:', e);
            return null;
        }
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }

        if (event.type === 'set' && selectedDate && editingPlaceId) {
            const timeStr = selectedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            setPlaces(places.map(p => p.id === editingPlaceId ? { ...p, time: timeStr } : p));
        }

        if (Platform.OS === 'ios') {
            setShowTimePicker(true);
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
            if (title.toLowerCase().includes('hotel') || title.toLowerCase().includes('check-in')) return '#6C5CE7';
            if (title.toLowerCase().includes('check-out')) return '#74B9FF';
            if (title.toLowerCase().includes('beach') || title.toLowerCase().includes('boardwalk')) return '#FF7675';
            if (title.toLowerCase().includes('bar') || title.toLowerCase().includes('bistro') || title.toLowerCase().includes('food')) return '#FDCB6E';
            return '#6C5CE7';
        };

        const getIconForTitle = (title?: string) => {
            return 'MapPin';
        };

        return (
            <ScaleDecorator>
                <View style={{ flexDirection: 'row', paddingHorizontal: 15, marginVertical: 10, alignItems: 'center' }}>
                    <TouchableOpacity onLongPress={drag} style={{ padding: 5, marginRight: 5 }}>
                        <Icon name="DotsSixVertical" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    
                    <View style={{ width: 80, alignItems: 'center' }}>
                        <View style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            backgroundColor: getColorForTitle(item.title),
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 5
                        }}>
                            <Icon name={getIconForTitle(item.title) as any} size={16} color="#fff" weight="fill" />
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
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                backgroundColor: colors.background,
                                minWidth: 85,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>{item.time || 'Pick a time'}</Text>
                        </TouchableOpacity>
                        <View style={{ width: 2, height: 40, backgroundColor: colors.border, marginVertical: 5 }} />
                    </View>

                    <View
                        style={[
                            styles.draggableItem,
                            {
                                flex: 1,
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                                borderRadius: 16,
                                padding: 16,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                elevation: 3,
                                borderWidth: 1,
                            }
                        ]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    style={{ color: colors.textSecondary, fontWeight: 'bold', fontSize: 14, marginBottom: 4, padding: 0 }}
                                    value={item.title}
                                    placeholder="Enter a title"
                                    placeholderTextColor={colors.textSecondary}
                                    cursorColor={colors.primary}
                                    selectionColor={colors.primary + '40'}
                                    returnKeyType="done"
                                    blurOnSubmit={true}
                                    onChangeText={(text) => {
                                        setPlaces(places.map(p => p.id === item.id ? { ...p, title: text } : p));
                                    }}
                                />
                                <TouchableOpacity onPress={() => handlePlacePress(item)}>
                                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>{item.name}</Text>
                                    {item.address && (
                                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{item.address}</Text>
                                    )}
                                </TouchableOpacity>
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

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={{ height: 40 }} />

            <View style={{ height: mapHeight, position: 'relative' }}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    initialRegion={mapRegion}
                    onPoiClick={async (e) => {
                        const poi = e.nativeEvent;
                        let name = poi.name;
                        let address = await reverseGeocode(poi.coordinate.latitude, poi.coordinate.longitude);

                        if (poi.placeId) {
                            const details = await fetchPlaceDetails(poi.placeId);
                            if (details) {
                                name = details.name || name;
                                address = details.address || address;
                            }
                        }

                        const currentDay = selectedTab === 'All' ? 1 : parseInt(selectedTab.replace('Day ', ''));
                        const dayPlaces = places.filter(p => p.day === currentDay);

                        const newPlace: StructuredPlace = {
                            id: `poi-${poi.placeId || Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            name: name,
                            address: address,
                            day: currentDay,
                            order: dayPlaces.length,
                            latitude: poi.coordinate.latitude,
                            longitude: poi.coordinate.longitude,
                            time: null,
                            title: '',
                        };
                        setPlaces([...places, newPlace]);
                    }}
                    onPress={async (e) => {
                        const coord = e.nativeEvent.coordinate;
                        const address = await reverseGeocode(coord.latitude, coord.longitude);
                        const currentDay = selectedTab === 'All' ? 1 : parseInt(selectedTab.replace('Day ', ''));
                        const dayPlaces = places.filter(p => p.day === currentDay);

                        const newPlace: StructuredPlace = {
                            id: `map-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            name: 'Dropped Pin',
                            address: address,
                            day: currentDay,
                            order: dayPlaces.length,
                            latitude: coord.latitude,
                            longitude: coord.longitude,
                            time: null,
                            title: '',
                        };
                        setPlaces([...places, newPlace]);
                    }}
                >
                    {startingCoords && (
                        <Marker
                            coordinate={{ latitude: startingCoords.lat, longitude: startingCoords.lng }}
                            title={`Starting Point`}
                            description={trip?.fromLocation}
                            pinColor="green"
                        />
                    )}
                    {destinationCoords && (
                        <Marker
                            coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }}
                            title={`Destination`}
                            description={trip?.toLocation}
                            pinColor="blue"
                        />
                    )}
                    {places.map((place, index) => (
                        place.latitude && place.longitude ? (
                            <Marker
                                key={`${place.id}-${index}`}
                                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                                title={place.name}
                            />
                        ) : null
                    ))}
                </MapView>

                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        position: 'absolute',
                        top: 2,
                        left: 16,
                        backgroundColor: colors.card,
                        borderRadius: 20,
                        width: 40,
                        height: 40,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                    }}
                >
                    <Icon name="CaretLeft" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={{
                    position: 'absolute',
                    top: 2,
                    right: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                }}>
                    {isSearchVisible && (
                        <MotiView
                            from={{ width: 0, opacity: 0 }}
                            animate={{ width: Dimensions.get('window').width - 135, opacity: 1 }}
                            transition={{ type: 'timing', duration: 300 }}
                            style={{
                                backgroundColor: colors.card,
                                borderRadius: 20,
                                height: 40,
                                marginRight: 10,
                                paddingHorizontal: 15,
                                justifyContent: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 3.84,
                                elevation: 5,
                            }}
                        >
                            <TextInput
                                style={{ color: colors.text, flex: 1 }}
                                placeholder="Search places..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    latestQueryRef.current = text;
                                    if (!text.trim()) {
                                        setSearchResults([]);
                                    } else {
                                        searchPlaces(text);
                                    }
                                }}
                                autoFocus
                            />
                        </MotiView>
                    )}

                    <TouchableOpacity
                        onPress={() => setIsSearchVisible(!isSearchVisible)}
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 20,
                            width: 40,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                            elevation: 5,
                        }}
                    >
                        <Icon name="MagnifyingGlass" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {isSearchVisible && searchResults.length > 0 && (
                    <View style={{
                        position: 'absolute',
                        top: 50,
                        left: 65,
                        width: Dimensions.get('window').width - 135,
                        backgroundColor: colors.card,
                        borderRadius: 8,
                        padding: 10,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                        zIndex: 1000,
                    }}>
                        {searchResults.map((item: any, index: number) => (
                            <TouchableOpacity
                                key={`${item.place_id || 'result'}-${index}`}
                                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                onPress={() => handleAddPlace(item)}
                            >
                                <Text style={{ color: colors.text }}>{item.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Resizable Divider */}
            <View 
                style={{
                    height: 15,
                    backgroundColor: colors.card,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                }}
                {...{
                    onStartShouldSetResponder: () => true,
                    onResponderGrant: (e) => { 
                        isDraggingMap.current = true; 
                        startY.current = e.nativeEvent.pageY;
                        startHeight.current = mapHeight;
                    },
                    onResponderMove: (e) => {
                        if (isDraggingMap.current) {
                            const delta = e.nativeEvent.pageY - startY.current;
                            const newHeight = startHeight.current + delta;
                            if (newHeight > 120 && newHeight < Dimensions.get('window').height * 0.7) {
                                setMapHeight(newHeight);
                            }
                        }
                    },
                    onResponderRelease: () => { isDraggingMap.current = false; }
                }}
            >
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textSecondary + '40' }} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {tabs.map(tab => (
                        <TouchableOpacity
                            key={tab.label}
                            onPress={() => setSelectedTab(tab.label)}
                            style={{
                                backgroundColor: selectedTab === tab.label ? colors.primary : colors.card,
                                paddingHorizontal: 15,
                                paddingVertical: 8,
                                borderRadius: 15,
                                marginRight: 10,
                                borderWidth: 1,
                                borderColor: selectedTab === tab.label ? colors.primary : colors.border,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 70,
                            }}
                        >
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                {tab.date && <Text style={{ color: selectedTab === tab.label ? '#fff' : colors.textSecondary, fontSize: 8, marginBottom: 1 }}>{tab.date}</Text>}
                                <Text style={{ color: selectedTab === tab.label ? '#fff' : colors.text, fontWeight: 'bold', fontSize: 11 }}>{tab.label}</Text>
                            </View>
                            {tab.label !== 'All' && (
                                <TouchableOpacity 
                                    onPress={() => handleRemoveDay(tab.dayNum!)}
                                    style={{ 
                                        marginLeft: 10, 
                                        width: 20, 
                                        height: 20, 
                                        justifyContent: 'center', 
                                        alignItems: 'center' 
                                    }}
                                >
                                    <Icon name="Trash" size={14} color={selectedTab === tab.label ? '#fff' : colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={{ flex: 1 }}>
                {selectedTab === 'All' ? (
                    <DraggableFlatList
                        data={getAllData()}
                        renderItem={renderDraggableItem}
                        keyExtractor={item => item.id}
                        onDragEnd={({ data }) => {
                            let currentDay = 1;
                            const updatedPlaces = [];
                            data.forEach((item) => {
                                if (item.isHeader) {
                                    currentDay = item.day;
                                } else {
                                    updatedPlaces.push({ ...item, day: currentDay });
                                }
                            });

                            const finalPlaces = [];
                            const duration = trip?.duration || 1;
                            for (let day = 1; day <= duration; day++) {
                                const dayPlaces = updatedPlaces.filter(p => p.day === day);
                                dayPlaces.forEach((p, index) => {
                                    finalPlaces.push({ ...p, order: index });
                                });
                            }

                            setPlaces(finalPlaces);
                        }}
                        onScrollBeginDrag={() => setIsFABVisible(false)}
                        onScrollEndDrag={() => setIsFABVisible(true)}
                        onMomentumScrollEnd={() => setIsFABVisible(true)}
                    />
                ) : (
                    <DraggableFlatList
                        data={activePlaces}
                        renderItem={renderDraggableItem}
                        keyExtractor={item => item.id}
                        onDragEnd={({ data }) => {
                            const currentDay = parseInt(selectedTab.replace('Day ', ''));
                            const otherDayPlaces = places.filter(p => p.day !== currentDay);
                            const updatedDayPlaces = data.map((item, index) => ({ ...item, order: index }));
                            setPlaces([...otherDayPlaces, ...updatedDayPlaces]);
                        }}
                        onScrollBeginDrag={() => setIsFABVisible(false)}
                        onScrollEndDrag={() => setIsFABVisible(true)}
                        onMomentumScrollEnd={() => setIsFABVisible(true)}
                    />
                )}
            </View>

            </KeyboardAvoidingView>

            {isFABVisible && (
                <TouchableOpacity
                    onPress={handleAddDay}
                    style={[
                        styles.floatingAddButton,
                        { 
                            backgroundColor: colors.card,
                            bottom: 100,
                            shadowColor: '#000'
                        }
                    ]}
                >
                    <Icon name="Plus" size={24} color={colors.primary} weight="bold" />
                </TouchableOpacity>
            )}

            <View style={{ padding: 20, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
                <TouchableOpacity
                    onPress={() => {
                        compactDays();
                        router.push('/trip/view');
                    }}
                    style={{ 
                        backgroundColor: colors.primary, 
                        padding: 15, 
                        borderRadius: 25,
                        alignItems: 'center',
                        width: 250,
                        alignSelf: 'center',
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 5,
                        elevation: 5
                    }}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Save Itinerary</Text>
                </TouchableOpacity>
            </View>

            {showTimePicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onTimeChange}
                />
            )}
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 10,
        paddingHorizontal: 5,
    },
    itemRow: {
        flexDirection: 'row',
        marginBottom: 10,
        minHeight: 60,
    },
    timelineLineContainer: {
        width: 20,
        alignItems: 'center',
    },
    contentCard: {
        flex: 1,
        marginLeft: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    timeText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    titleText: {
        fontSize: 14,
        fontWeight: '600',
    },
    descText: {
        fontSize: 12,
        marginTop: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        marginTop: 10,
        fontSize: 14,
    },
    draggableItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 10,
        marginHorizontal: 10,
    },
    floatingAddButton: {
        position: 'absolute',
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    },
});
