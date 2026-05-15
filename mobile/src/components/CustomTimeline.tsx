import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native';
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

    // State for Screen mode
    const [trip, setTrip] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useState('All');
    const [places, setPlaces] = useState<StructuredPlace[]>([]);
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
                    setTrip(parsedData);

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
            }
        }
    }, [tripId, propItems, tripDataParam, tripImagesParam]);

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
        if (query.includes('maps.google.com') || query.includes('google.com/maps') || query.includes('maps.app.goo.gl')) {
            let targetUrl = query;
            if (query.includes('maps.app.goo.gl')) {
                const resolved = await resolveShortLink(query);
                if (resolved) targetUrl = resolved;
            }

            const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
            const match = targetUrl.match(regex);
            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);

                // Auto add to itinerary
                const currentDay = selectedTab === 'All' ? 1 : parseInt(selectedTab.replace('Day ', ''));
                const dayPlaces = places.filter(p => p.day === currentDay);

                const newPlace: StructuredPlace = {
                    id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: 'Location from Link',
                    address: query,
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
                const res = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchTerm)}&inputtype=textquery&fields=geometry,formatted_address,name&key=${apiKey}`);
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
            const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}`);
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
            const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${apiKey}`);
            const data = await response.json();
            if (data.result && data.result.geometry) {
                return data.result.geometry.location;
            }
        } catch (error) {
            console.error('Details error:', error);
        }
        return null;
    };

    const handleAddPlace = async (item: any) => {
        let location;
        if (item.isLink) {
            location = { lat: item.latitude, lng: item.longitude };
        } else {
            location = await fetchPlaceDetails(item.place_id);
        }

        const currentDay = selectedTab === 'All' ? 1 : parseInt(selectedTab.replace('Day ', ''));
        const dayPlaces = places.filter(p => p.day === currentDay);

        const newPlace: StructuredPlace = {
            id: `${item.place_id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: item.structured_formatting.main_text,
            address: item.structured_formatting.secondary_text,
            day: currentDay,
            order: dayPlaces.length,
            latitude: location?.lat,
            longitude: location?.lng,
            time: 'Pick a time', // Default time
            title: 'Enter a title', // Default title
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
        if (!currentUser) {
            Alert.alert('Error', 'You need to be logged in to save the trip.');
            return;
        }

        setLoading(true);
        const newObjectKeys: string[] = [];

        try {
            if (tripDataParam && trip) {
                // Creation Mode: Save trip first
                await showUploadNotification(0, 'Preparing trip post...');

                const { data: currentUserData } = await supabase
                    .from('profiles')
                    .select('name, display_name, photo_url, username')
                    .eq('id', currentUser.id)
                    .maybeSingle();
                const userData: { name?: string; display_name?: string; photo_url?: string; username?: string } = currentUserData || {};

                let uploadedImageData: Array<{ uri: string, location: string, objectKey: string | null }> = [];
                if (passedImages.length > 0) {
                    for (let i = 0; i < passedImages.length; i++) {
                        const img = passedImages[i];
                        const imageUri = img.uri;

                        if (imageUri.startsWith('http') || imageUri.startsWith('https')) {
                            uploadedImageData.push({
                                uri: imageUri,
                                location: img.location,
                                objectKey: img.objectKey || null,
                            });
                            continue;
                        }

                        try {
                            const progress = (i / passedImages.length) * 0.7;
                            await showUploadNotification(progress, `Uploading image ${i + 1}/${passedImages.length}...`);
                            const uploadResult = await uploadTripImageToR2(imageUri, currentUser.id);
                            if (uploadResult.success && uploadResult.url && uploadResult.objectKey) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                uploadedImageData.push({
                                    uri: uploadResult.url,
                                    location: img.location,
                                    objectKey: uploadResult.objectKey,
                                });
                                newObjectKeys.push(uploadResult.objectKey);
                            }
                        } catch (uploadError) {
                            // Image upload failed
                        }
                    }
                }

                const finalImages = uploadedImageData.map(d => d.uri);
                const finalLocations = uploadedImageData.map(d => d.location);
                const finalObjectKeys = uploadedImageData.map(d => d.objectKey || null);

                if (finalImages.length === 0) {
                    finalImages.push('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800');
                    finalLocations.push('');
                    finalObjectKeys.push(null);
                }

                const generateMapsLink = (destination: string) => {
                    const encoded = encodeURIComponent(destination);
                    return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
                };

                const tripDataToSave = {
                    title: trip.title,
                    images: finalImages,
                    image_locations: finalLocations,
                    from_location: trip.fromLocation,
                    to_location: trip.toLocation,
                    maps_link: generateMapsLink(trip.toLocation),
                    from_date: trip.fromDate,
                    to_date: trip.toDate,
                    duration: trip.duration,
                    trip_types: trip.tripTypes,
                    transport_modes: trip.transportModes,
                    cost_per_person: parseFloat(trip.costPerPerson) || 0,
                    total_cost: parseFloat(trip.costPerPerson) || 0,
                    cost: parseFloat(trip.costPerPerson) || 0,
                    accommodation_type: trip.accommodationType,
                    booking_status: trip.bookingStatus,
                    accommodation_days: trip.accommodationDays ? parseInt(trip.accommodationDays) : null,
                    max_travelers: parseInt(trip.maxTravelers) || 5,
                    current_travelers: 1,
                    places_to_visit: JSON.stringify(places),
                    user_id: currentUser.id,
                    owner_display_name: userData.name || userData.display_name || currentUser.user_metadata?.full_name || 'Traveler',
                    owner_photo_url: userData.photo_url || currentUser.user_metadata?.avatar_url || null,
                    owner_username: userData.username || null,
                    participants: [currentUser.id],
                    image_object_keys: finalObjectKeys,
                    location: trip.toLocation,
                    trip_type: trip.tripType,
                    cover_image: finalImages[0],
                };

                const { data: tripRow, error: tripErr } = await supabase.from('trips').insert(tripDataToSave).select('id').single();
                if (tripErr || !tripRow) throw tripErr || new Error('Failed to create trip');

                await showUploadNotification(0.8, 'Creating trip group...');

                try {
                    await supabase.from('group_chats').insert({
                        trip_id: tripRow.id,
                        group_name: trip.title,
                        trip_image: finalImages[0] || null,
                        participants: [currentUser.id],
                        participant_details: {
                            [currentUser.id]: {
                                displayName: tripDataToSave.owner_display_name,
                                photoURL: tripDataToSave.owner_photo_url || '',
                            },
                        },
                        member_count: 1,
                        created_by: currentUser.id,
                        last_message: { text: 'Trip group created!', sender_id: null, created_at: new Date().toISOString() },
                    });
                } catch {
                    // Group chat creation is non-critical
                }

                await completeUploadNotification('Trip Posted! 🎉', 'Your trip has been posted successfully.');
                syncDatabase().catch(err => console.error('[CustomTimeline] Post-creation sync failed:', err));

                Alert.alert('Success', 'Trip created successfully!', [
                    { text: 'OK', onPress: () => router.replace({ pathname: '/profile/[id]', params: { id: currentUser.id } }) }
                ]);
            } else if (tripId) {
                // Update Mode: Just update places
                const { error } = await supabase
                    .from('trips')
                    .update({ places_to_visit: JSON.stringify(places) })
                    .eq('id', tripId);

                if (error) throw error;
                Alert.alert('Success', 'Itinerary saved successfully!');
            }
        } catch (error: any) {
            if (newObjectKeys.length > 0) {
                await deleteTripImagesFromR2(newObjectKeys);
            }
            await failUploadNotification(error?.message || 'Failed to save trip');
            Alert.alert('Error', `Failed to save: ${error.message}`);
        } finally {
            setLoading(false);
        }
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

    const duration = trip?.duration || 1;
    const fromDate = trip?.fromDate ? new Date(trip.fromDate) : null;

    const tabs = [
        { label: 'All', date: null },
        ...Array.from({ length: duration }, (_, i) => {
            let dateStr = '';
            if (fromDate) {
                const currentDate = new Date(fromDate);
                currentDate.setDate(fromDate.getDate() + i);
                dateStr = currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
            return { label: `Day ${i + 1}`, date: dateStr };
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
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
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
        setShowTimePicker(Platform.OS === 'ios');

        if (selectedDate && editingPlaceId) {
            const timeStr = selectedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            setPlaces(places.map(p => p.id === editingPlaceId ? { ...p, time: timeStr } : p));
        }

        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }
    };

    const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<any>) => {
        if (item.isHeader) {
            return (
                <View style={{ paddingHorizontal: 15, paddingVertical: 5, marginTop: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>{item.dateStr || `Day ${item.day}`}</Text>
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
                    {/* Drag Handle */}
                    <TouchableOpacity onLongPress={drag} style={{ padding: 5, marginRight: 5 }}>
                        <Icon name="DotsSixVertical" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    
                    {/* Left: Time and Timeline Line */}
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
                            style={{ zIndex: 10 }}
                        >
                            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{item.time || 'Pick a time'}</Text>
                        </TouchableOpacity>
                        <View style={{ width: 2, height: 40, backgroundColor: colors.border, marginVertical: 5 }} />
                    </View>

                    {/* Right: Card (Styled like image) */}
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
                                <Icon name="Trash" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handlePlacePress(item)}>
                                <Icon name="CaretRight" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScaleDecorator>
        );
    };

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Spacing above map */}
            <View style={{ height: 40 }} />

            {/* Map and Search */}
            <View style={{ height: Dimensions.get('window').height * 0.4, position: 'relative' }}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    initialRegion={mapRegion}
                    onPoiClick={async (e) => {
                        const poi = e.nativeEvent;
                        const address = await reverseGeocode(poi.coordinate.latitude, poi.coordinate.longitude);
                        const currentDay = selectedTab === 'All' ? 1 : parseInt(selectedTab.replace('Day ', ''));
                        const dayPlaces = places.filter(p => p.day === currentDay);

                        const newPlace: StructuredPlace = {
                            id: `poi-${poi.placeId || Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            name: poi.name,
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

                {/* Back Button Floating on Map */}
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

                {/* Search Box & Magnifying Glass */}
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

                {/* Search Results Dropdown (Floating on Map) */}
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

            {/* Tabs (Now below the map) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {tabs.map(tab => (
                        <TouchableOpacity
                            key={tab.label}
                            onPress={() => setSelectedTab(tab.label)}
                            style={{
                                paddingVertical: 4,
                                paddingHorizontal: 10,
                                backgroundColor: selectedTab === tab.label ? colors.primary : colors.background,
                                borderRadius: 15,
                                marginRight: 8,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: selectedTab === tab.label ? colors.primary : colors.border,
                                minWidth: 50,
                            }}
                        >
                            {tab.date && (
                                <Text style={{ color: selectedTab === tab.label ? '#fff' : colors.textSecondary, fontSize: 9, marginBottom: 1 }}>{tab.date}</Text>
                            )}
                            <Text style={{ color: selectedTab === tab.label ? '#fff' : colors.text, fontWeight: 'bold', fontSize: 11 }}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Content List */}
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

                            // Recalculate order for each day
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
                    />
                )}
            </View>

            {/* Save Button */}
            <View style={{ padding: 20, backgroundColor: colors.card }}>
                <TouchableOpacity
                    onPress={handleSaveItinerary}
                    style={{ backgroundColor: colors.primary, padding: 15, borderRadius: 8, alignItems: 'center' }}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Itinerary</Text>
                </TouchableOpacity>
            </View>
            {showTimePicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="time"
                    is24Hour={false}
                    display="default"
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
});
