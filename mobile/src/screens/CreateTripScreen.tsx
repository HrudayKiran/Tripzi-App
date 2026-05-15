import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions, Platform, Modal, ActivityIndicator, KeyboardAvoidingView, Vibration } from 'react-native';
import { Image } from 'expo-image';
import { GestureHandlerRootView, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { syncDatabase } from '../database/sync';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';
import { deleteTripImagesFromR2, uploadTripImageToR2 } from '../utils/imageUpload';
import { showUploadNotification, completeUploadNotification, failUploadNotification } from '../utils/notifications';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import MapView, { Marker } from 'react-native-maps';
const { width } = Dimensions.get('window');

const TRIP_TYPES = [
    { id: 'adventure', label: 'Adventure', icon: 'Compass', color: '#F59E0B' },
    { id: 'trekking', label: 'Trekking', icon: 'MapPin', color: '#10B981' },
    { id: 'bike_ride', label: 'Bike Ride', icon: 'Bicycle', color: '#EF4444' },
    { id: 'road_trip', label: 'Road Trip', icon: 'Car', color: '#9d74f7' },
    { id: 'camping', label: 'Camping', icon: 'Tent', color: '#F97316' },
    { id: 'sightseeing', label: 'Sightseeing', icon: 'Camera', color: '#3B82F6' },
    { id: 'beach', label: 'Beach', icon: 'Sun', color: '#06B6D4' },
    { id: 'pilgrimage', label: 'Pilgrimage', icon: 'Heart', color: '#EC4899' },
];

const TRANSPORT_MODES = [
    { id: 'train', label: 'Train', icon: 'Train' },
    { id: 'bus', label: 'Bus', icon: 'Bus' },
    { id: 'car', label: 'Car', icon: 'Car' },
    { id: 'flight', label: 'Flight', icon: 'Airplane' },
    { id: 'bike', label: 'Bike', icon: 'Bicycle' },
    { id: 'mixed', label: 'Mixed', icon: 'Shuffle' },
];

const ACCOMMODATION_TYPES = [
    { id: 'hotel', label: 'Hotel', icon: 'Bed' },
    { id: 'hostel', label: 'Hostel', icon: 'House' },
    { id: 'camping', label: 'Camping', icon: 'Tent' },
    { id: 'homestay', label: 'Homestay', icon: 'Users' },
    { id: 'none', label: 'Not Needed', icon: 'XCircle' },
];

const BOOKING_STATUS = [
    { id: 'booked', label: 'Already Booked' },
    { id: 'to_book', label: 'Yet to Book' },
    { id: 'not_needed', label: 'Not Needed' },
];

type TripImageItem = {
    id: string;
    uri: string;
    location: string;
    objectKey?: string | null;
};


const TRIP_FLOW_TYPES = [
    { id: 'solo', label: 'Solo', icon: 'User' },
    { id: 'couple', label: 'Couple', icon: 'Heart' },
    { id: 'family', label: 'Family', icon: 'UsersThree' },
    { id: 'friends', label: 'Friends', icon: 'Users' },
    { id: 'business', label: 'Business', icon: 'Briefcase' },
];

const tripSchema = z.object({
    title: z.string().min(1, 'Trip title is required'),
    fromLocation: z.string().min(1, 'Starting location is required'),
    toLocation: z.string().min(1, 'Destination is required'),
    fromDate: z.date({ message: 'Start date is required' }),
    toDate: z.date({ message: 'End date is required' }),
    tripTypes: z.array(z.string()).min(1, 'Select at least one trip activity type'),
    transportModes: z.array(z.string()).min(1, 'Select at least one transport mode'),
    costPerPerson: z.string().min(1, 'Cost per person is required'),
    accommodationType: z.string().min(1, 'Select accommodation type'),
    bookingStatus: z.string().min(1, 'Booking status is required'),
    accommodationDays: z.string().min(1, 'Accommodation days is required'),
    maxTravelers: z.string().min(1, 'Max travelers is required'),
    tripType: z.string().min(1, 'Select trip type'),
    placesToVisit: z.string().optional(),
});

type TripFormData = z.infer<typeof tripSchema>;

const CreateTripScreen = () => {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parse initialData if it comes as a string (common in Expo Router)
    let initialData: any = null;
    if (typeof params.initialTripData === 'string') {
        try {
            initialData = JSON.parse(params.initialTripData);
        } catch (e) { }
    } else if (params.initialTripData) {
        initialData = params.initialTripData;
    }

    const [step, setStep] = useState(1);
    const [showSuccess, setShowSuccess] = useState(false);
    const [createdTripId, setCreatedTripId] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const totalSteps = 4;
    const [mapRegion, setMapRegion] = useState({
        latitude: 20.5937,
        longitude: 78.9629,
        latitudeDelta: 10,
        longitudeDelta: 10,
    });
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
    }, []);

    const { control, handleSubmit, formState: { errors: formErrors }, setValue, watch, trigger } = useForm<TripFormData>({
        resolver: zodResolver(tripSchema),
        defaultValues: {
            title: initialData?.title || '',
            fromLocation: initialData?.fromLocation || '',
            toLocation: initialData?.toLocation || '',
            fromDate: initialData?.fromDate?.toDate ? initialData.fromDate.toDate() : undefined,
            toDate: initialData?.toDate?.toDate ? initialData.toDate.toDate() : undefined,
            tripTypes: initialData?.tripTypes || [],
            transportModes: initialData?.transportModes || [],
            costPerPerson: initialData?.costPerPerson ? String(initialData.costPerPerson) : '',
            accommodationType: initialData?.accommodationType || '',
            bookingStatus: initialData?.bookingStatus || '',
            accommodationDays: initialData?.accommodationDays ? String(initialData.accommodationDays) : '',
            maxTravelers: initialData?.maxTravelers ? String(initialData.maxTravelers) : '',
            tripType: initialData?.tripType || '',
            placesToVisit: Array.isArray(initialData?.placesToVisit) ? initialData.placesToVisit.join(', ') : (initialData?.placesToVisit || ''),
        }
    });

    const [tripImages, setTripImages] = useState<TripImageItem[]>(
        initialData?.images?.map((uri: string, i: number) => ({
            id: `img-${Date.now()}-${i}`,
            uri,
            location: initialData?.imageLocations?.[i] || '',
            objectKey: initialData?.imageObjectKeys?.[i] || null,
        })) || []
    );

    const [showDateModal, setShowDateModal] = useState<'from' | 'to' | null>(null);

    const searchPlaces = async (query: string) => {
        if (!query) {
            setSearchResults([]);
            return;
        }
        try {
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
            const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}`);
            const data = await response.json();
            if (data.predictions) {
                setSearchResults(data.predictions);
            }
        } catch (error) {
            console.error('Error searching places:', error);
        }
    };
    const [isPosting, setIsPosting] = useState(false);

    const pickImages = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera roll permissions.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
            allowsMultipleSelection: false,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newImage = {
                id: `img-new-${Date.now()}`,
                uri: result.assets[0].uri,
                location: '',
                objectKey: null,
            };
            setTripImages(prev => [...prev, newImage].slice(0, 5));
        }
    };

    const removeImage = (imgId: string) => {
        setTripImages(prev => prev.filter(img => img.id !== imgId));
    };

    const toggleSelection = (id: string, list: string[], setList: (val: string[]) => void) => {
        if (list.includes(id)) {
            setList(list.filter(item => item !== id));
        } else {
            setList([...list, id]);
        }
    };

    const formatDate = (date?: Date) => {
        if (!date) return 'Select Date';
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const handleFromDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDateModal(null);
        if (event.type === 'set' && selectedDate) {
            setValue('fromDate', selectedDate);
            const toDate = watch('toDate');
            if (selectedDate > (toDate || new Date())) {
                setValue('toDate', new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000));
            }
        }
    };

    const handleToDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDateModal(null);
        if (event.type === 'set' && selectedDate) {
            const fromDate = watch('fromDate');
            if (selectedDate >= (fromDate || new Date())) {
                setValue('toDate', selectedDate);
            } else {
                Alert.alert('Invalid Date', 'End date cannot be earlier than start date.');
            }
        }
    };

    const getDuration = () => {
        const fromDate = watch('fromDate');
        const toDate = watch('toDate');
        if (!fromDate || !toDate) return '0 days';
        const diff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return diff > 0 ? `${diff} day${diff > 1 ? 's' : ''}` : '1 day';
    };

    const generateMapsLink = (destination: string) => {
        const encoded = encodeURIComponent(destination);
        return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    };

    const handlePostTrip = async (data: TripFormData) => {
        if (!currentUser) {
            Alert.alert('Error', 'You need to be logged in to create a trip.');
            router.push('/(auth)/start');
            return;
        }

        setIsPosting(true);
        await showUploadNotification(0, 'Preparing trip post...');
        const newObjectKeys: string[] = [];

        try {
            const { data: currentUserData } = await supabase
                .from('profiles')
                .select('name, display_name, photo_url, username')
                .eq('id', currentUser.id)
                .maybeSingle();
            const userData: { name?: string; display_name?: string; photo_url?: string; username?: string } = currentUserData || {};

            let uploadedImageData: Array<{ uri: string, location: string, objectKey: string | null }> = [];
            if (tripImages.length > 0) {
                for (let i = 0; i < tripImages.length; i++) {
                    const img = tripImages[i];
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
                        const progress = (i / tripImages.length) * 0.7;
                        await showUploadNotification(progress, `Uploading image ${i + 1}/${tripImages.length}...`);
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

            const tripData = {
                title: data.title,
                images: finalImages,
                image_locations: finalLocations,
                from_location: data.fromLocation,
                to_location: data.toLocation,
                maps_link: generateMapsLink(data.toLocation),
                from_date: data.fromDate.toISOString(),
                to_date: data.toDate.toISOString(),
                duration: getDuration(),
                trip_types: data.tripTypes,
                transport_modes: data.transportModes,
                cost_per_person: parseFloat(data.costPerPerson) || 0,
                total_cost: parseFloat(data.costPerPerson) || 0,
                cost: parseFloat(data.costPerPerson) || 0,
                accommodation_type: data.accommodationType,
                booking_status: data.bookingStatus,
                accommodation_days: data.accommodationDays ? parseInt(data.accommodationDays) : null,
                max_travelers: parseInt(data.maxTravelers) || 5,
                current_travelers: 1,
                places_to_visit: data.placesToVisit ? data.placesToVisit.split(',').map(place => place.trim()).filter(Boolean) : [],
                user_id: currentUser.id,
                owner_display_name: userData.name || userData.display_name || currentUser.user_metadata?.full_name || 'Traveler',
                owner_photo_url: userData.photo_url || currentUser.user_metadata?.avatar_url || null,
                owner_username: userData.username || null,
                participants: [currentUser.id],
                image_object_keys: finalObjectKeys,
                location: data.toLocation,
                trip_type: data.tripType,
                cover_image: finalImages[0],
            };

            // Create trip
            const { data: tripRow, error: tripErr } = await supabase.from('trips').insert(tripData).select('id').single();
            if (tripErr || !tripRow) throw tripErr || new Error('Failed to create trip');
            setCreatedTripId(tripRow.id);

            await showUploadNotification(0.8, 'Creating trip group...');


            // Create group chat for the trip
            try {
                await supabase.from('group_chats').insert({
                    trip_id: tripRow.id,
                    group_name: data.title,
                    trip_image: finalImages[0] || null,
                    participants: [currentUser.id],
                    participant_details: {
                        [currentUser.id]: {
                            displayName: tripData.owner_display_name,
                            photoURL: tripData.owner_photo_url || '',
                        },
                    },
                    member_count: 1,
                    created_by: currentUser.id,
                    last_message: { text: 'Trip group created!', sender_id: null, created_at: new Date().toISOString() },
                });
            } catch {
                // Group chat creation is non-critical — user can still access the trip
            }

            setIsPosting(false);
            await completeUploadNotification('Trip Posted! 🎉', 'Your trip has been posted successfully.');

            // Trigger sync to update local database immediately
            syncDatabase().catch(err => console.error('[CreateTrip] Post-creation sync failed:', err));

            setShowSuccess(true);
        } catch (error: any) {
            if (newObjectKeys.length > 0) {
                await deleteTripImagesFromR2(newObjectKeys);
            }
            setIsPosting(false);
            await failUploadNotification(error?.message || 'Failed to post trip');
            Alert.alert('Error', `Failed to post trip: ${error?.message || 'Unknown error'}. Please try again.`);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity
                onPress={() => router.back()}
                style={[
                    styles.backButton,
                    {
                        backgroundColor: isDarkMode ? '#000' : '#fff',
                        borderRadius: 20,
                        width: 40,
                        height: 40,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 3,
                    }
                ]}
            >
                <Icon name="CaretLeft" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Manual Trip Planning({step}/{totalSteps})</Text>
            {/* Header Next/Post buttons removed as requested */}
        </View>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
                <LinearGradient
                    colors={[colors.background, colors.card]}
                    style={StyleSheet.absoluteFill}
                />
                <SafeAreaView style={styles.container}>
                    <KeyboardAvoidingView
                        style={styles.keyboardContainer}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
                    >
                        {renderHeader()}

                        {/* Progress Bar */}
                        <View style={{ height: 4, backgroundColor: colors.border, width: '100%' }}>
                            <View style={{ height: '100%', backgroundColor: isDarkMode ? '#fff' : '#000', width: `${(step / totalSteps) * 100}%` }} />
                        </View>

                        <NestableScrollContainer
                            contentContainerStyle={styles.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                            scrollEnabled={step !== 5}
                        >
                            {step === 1 && (
                                <MotiView
                                    from={{ opacity: 0, translateX: 50 }}
                                    animate={{ opacity: 1, translateX: 0 }}
                                    transition={{ type: 'timing', duration: 300 }}
                                    style={styles.formSection}
                                >
                                    {/* Section 1: Trip Type */}
                                    <Text style={[styles.sectionHeading, { color: colors.text, fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginTop: 20 }]}>What is your travel style?</Text>
                                    <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 30 }}>What kind of trip are you planning?</Text>

                                    <Controller
                                        control={control}
                                        name="tripType"
                                        render={({ field: { onChange, value } }) => (
                                            <View style={{ alignItems: 'center' }}>
                                                {/* Row 1 (3 items) */}
                                                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
                                                    {TRIP_FLOW_TYPES.slice(0, 3).map((type) => (
                                                        <TouchableOpacity
                                                            key={type.id}
                                                            style={{ alignItems: 'center', width: 80 }}
                                                            onPress={() => {
                                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                                if (value === type.id) {
                                                                    onChange(null); // Deselect
                                                                } else {
                                                                    onChange(type.id);
                                                                    if (type.id === 'solo') {
                                                                        setValue('maxTravelers', '1');
                                                                    } else {
                                                                        setValue('maxTravelers', '');
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <LinearGradient
                                                                colors={value === type.id ? [isDarkMode ? '#fff' : '#000', isDarkMode ? '#fff' : '#000'] : [isDarkMode ? '#1a1a1a' : '#f0f0f0', isDarkMode ? '#2a2a2a' : '#ffffff']}
                                                                style={{
                                                                    width: 60,
                                                                    height: 60,
                                                                    borderRadius: 30,
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    borderWidth: value === type.id ? 2 : 0,
                                                                    borderColor: isDarkMode ? '#fff' : '#000',
                                                                    shadowColor: '#000',
                                                                    shadowOffset: { width: 0, height: 4 },
                                                                    shadowOpacity: 0.2,
                                                                    shadowRadius: 6,
                                                                    elevation: 4,
                                                                    overflow: 'hidden', // Fixes hexagonal bug!
                                                                }}
                                                            >
                                                                <Icon name={type.icon as any} size={24} color={value === type.id ? (isDarkMode ? '#000' : '#fff') : colors.text} />
                                                            </LinearGradient>
                                                            <Text style={{ color: value === type.id ? (isDarkMode ? '#fff' : '#000') : colors.text, marginTop: 8, fontSize: 14, fontWeight: 'bold' }}>{type.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>

                                                {/* Row 2 (2 items) */}
                                                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
                                                    {TRIP_FLOW_TYPES.slice(3).map((type) => (
                                                        <TouchableOpacity
                                                            key={type.id}
                                                            style={{ alignItems: 'center', width: 80 }}
                                                            onPress={() => {
                                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                                if (value === type.id) {
                                                                    onChange(null); // Deselect
                                                                } else {
                                                                    onChange(type.id);
                                                                    if (type.id === 'solo') {
                                                                        setValue('maxTravelers', '1');
                                                                    } else {
                                                                        setValue('maxTravelers', '');
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <LinearGradient
                                                                colors={value === type.id ? [isDarkMode ? '#fff' : '#000', isDarkMode ? '#fff' : '#000'] : [isDarkMode ? '#1a1a1a' : '#f0f0f0', isDarkMode ? '#2a2a2a' : '#ffffff']}
                                                                style={{
                                                                    width: 60,
                                                                    height: 60,
                                                                    borderRadius: 30,
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    borderWidth: value === type.id ? 2 : 0,
                                                                    borderColor: isDarkMode ? '#fff' : '#000',
                                                                    shadowColor: '#000',
                                                                    shadowOffset: { width: 0, height: 4 },
                                                                    shadowOpacity: 0.2,
                                                                    shadowRadius: 6,
                                                                    elevation: 4,
                                                                    overflow: 'hidden', // Fixes hexagonal bug!
                                                                }}
                                                            >
                                                                <Icon name={type.icon as any} size={24} color={value === type.id ? (isDarkMode ? '#000' : '#fff') : colors.text} />
                                                            </LinearGradient>
                                                            <Text style={{ color: value === type.id ? (isDarkMode ? '#fff' : '#000') : colors.text, marginTop: 8, fontSize: 14, fontWeight: 'bold' }}>{type.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                    />
                                    {formErrors.tripType && <Text style={styles.errorText}>{formErrors.tripType.message}</Text>}
                                </MotiView>
                            )}

                            {step === 2 && (
                                <MotiView
                                    from={{ opacity: 0, translateX: 50 }}
                                    animate={{ opacity: 1, translateX: 0 }}
                                    transition={{ type: 'timing', duration: 300 }}
                                    style={styles.formSection}
                                >
                                    <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Trip Title <Text style={styles.required}>*</Text></Text>
                                    <Controller
                                        control={control}
                                        name="title"
                                        render={({ field: { onChange, onBlur, value } }) => (
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: formErrors.title ? '#EF4444' : colors.border }]}
                                                placeholder="e.g., Mystical Ladakh Adventure"
                                                placeholderTextColor={colors.textSecondary}
                                                onBlur={onBlur}
                                                onChangeText={onChange}
                                                value={value}
                                            />
                                        )}
                                    />
                                    {formErrors.title && <Text style={styles.errorText}>{formErrors.title.message}</Text>}
                                    {/* Section 2: Location & Dates */}
                                    <Text style={[styles.sectionHeading, { color: colors.primary, marginTop: SPACING.xl }]}>Location & Dates</Text>

                                    <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Starting From <Text style={styles.required}>*</Text></Text>
                                    <Controller
                                        control={control}
                                        name="fromLocation"
                                        render={({ field: { onChange, onBlur, value } }) => (
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: formErrors.fromLocation ? '#EF4444' : colors.border }]}
                                                placeholder="e.g., Bangalore, Karnataka"
                                                placeholderTextColor={colors.textSecondary}
                                                onBlur={onBlur}
                                                onChangeText={onChange}
                                                value={value}
                                            />
                                        )}
                                    />
                                    {formErrors.fromLocation && <Text style={styles.errorText}>{formErrors.fromLocation.message}</Text>}

                                    <Text style={[styles.label, { color: colors.text, marginTop: SPACING.md }]}>Destination <Text style={styles.required}>*</Text></Text>
                                    <Controller
                                        control={control}
                                        name="toLocation"
                                        render={({ field: { onChange, onBlur, value } }) => (
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: formErrors.toLocation ? '#EF4444' : colors.border }]}
                                                placeholder="e.g., Leh, Ladakh"
                                                placeholderTextColor={colors.textSecondary}
                                                onBlur={onBlur}
                                                onChangeText={onChange}
                                                value={value}
                                            />
                                        )}
                                    />
                                    {formErrors.toLocation && <Text style={styles.errorText}>{formErrors.toLocation.message}</Text>}
                                    {watch('toLocation')?.length > 3 && (
                                        <Text style={[styles.mapsLink, { color: colors.primary }]}>📍 Maps link will be auto-generated</Text>
                                    )}

                                    <View style={styles.dateRow}>
                                        <View style={styles.dateField}>
                                            <Text style={[styles.label, { color: colors.text }]}>From Date <Text style={styles.required}>*</Text></Text>
                                            <TouchableOpacity
                                                style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                                onPress={() => setShowDateModal('from')}
                                            >
                                                <Icon name="Calendar" size={20} color={isDarkMode ? '#fff' : '#000'} />
                                                <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(watch('fromDate'))}</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.dateField}>
                                            <Text style={[styles.label, { color: colors.text }]}>To Date <Text style={styles.required}>*</Text></Text>
                                            <TouchableOpacity
                                                style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                                onPress={() => setShowDateModal('to')}
                                            >
                                                <Icon name="Calendar" size={20} color={isDarkMode ? '#fff' : '#000'} />
                                                <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(watch('toDate'))}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <Text style={[styles.durationText, { color: isDarkMode ? '#fff' : '#000' }]}>Duration: {getDuration()}</Text>
                                </MotiView>
                            )}

                            {step === 3 && (
                                <MotiView
                                    from={{ opacity: 0, translateX: 50 }}
                                    animate={{ opacity: 1, translateX: 0 }}
                                    transition={{ type: 'timing', duration: 300 }}
                                    style={styles.formSection}
                                >
                                    {/* Section 3: Trip Details */}
                                    <Text style={[styles.sectionHeading, { color: colors.primary }]}>Trip Details</Text>

                                    <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Trip Type <Text style={styles.required}>*</Text></Text>
                                    <Controller
                                        control={control}
                                        name="tripTypes"
                                        render={({ field: { onChange, value } }) => (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'center' }}>
                                                {TRIP_TYPES.map((type) => (
                                                    <TouchableOpacity
                                                        key={type.id}
                                                        style={{ alignItems: 'center', width: 70 }}
                                                        onPress={() => {
                                                            const newValue = value.includes(type.id)
                                                                ? value.filter(item => item !== type.id)
                                                                : [...value, type.id];
                                                            onChange(newValue);
                                                        }}
                                                    >
                                                        <LinearGradient
                                                            colors={value.includes(type.id) ? [isDarkMode ? '#fff' : '#000', isDarkMode ? '#fff' : '#000'] : [isDarkMode ? '#1a1a1a' : '#f0f0f0', isDarkMode ? '#2a2a2a' : '#ffffff']}
                                                            style={{
                                                                width: 50,
                                                                height: 50,
                                                                borderRadius: 25,
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                                borderWidth: value.includes(type.id) ? 2 : 0,
                                                                borderColor: isDarkMode ? '#fff' : '#000',
                                                                shadowColor: '#000',
                                                                shadowOffset: { width: 0, height: 2 },
                                                                shadowOpacity: 0.2,
                                                                shadowRadius: 4,
                                                                elevation: 3,
                                                                overflow: 'hidden',
                                                            }}
                                                        >
                                                            <Icon name={type.icon as any} size={20} color={value.includes(type.id) ? (isDarkMode ? '#000' : '#fff') : colors.text} />
                                                        </LinearGradient>
                                                        <Text style={{ color: value.includes(type.id) ? (isDarkMode ? '#fff' : '#000') : colors.text, marginTop: 4, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{type.label}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    />
                                    {formErrors.tripTypes && <Text style={styles.errorText}>{formErrors.tripTypes.message}</Text>}

                                    <Text style={[styles.label, { color: colors.text, marginTop: SPACING.md }]}>Transport Mode <Text style={styles.required}>*</Text></Text>
                                    <Controller
                                        control={control}
                                        name="transportModes"
                                        render={({ field: { onChange, value } }) => (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'center' }}>
                                                {TRANSPORT_MODES.map((mode) => (
                                                    <TouchableOpacity
                                                        key={mode.id}
                                                        style={{ alignItems: 'center', width: 70 }}
                                                        onPress={() => {
                                                            let newValue;
                                                            if (mode.id === 'mixed') {
                                                                newValue = value.includes('mixed') ? [] : ['mixed'];
                                                            } else {
                                                                const withoutMixed = value.filter(item => item !== 'mixed');
                                                                newValue = withoutMixed.includes(mode.id)
                                                                    ? withoutMixed.filter(item => item !== mode.id)
                                                                    : [...withoutMixed, mode.id];
                                                            }
                                                            onChange(newValue);
                                                        }}
                                                    >
                                                        <LinearGradient
                                                            colors={value.includes(mode.id) ? [isDarkMode ? '#fff' : '#000', isDarkMode ? '#fff' : '#000'] : [isDarkMode ? '#1a1a1a' : '#f0f0f0', isDarkMode ? '#2a2a2a' : '#ffffff']}
                                                            style={{
                                                                width: 50,
                                                                height: 50,
                                                                borderRadius: 25,
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                                borderWidth: value.includes(mode.id) ? 2 : 0,
                                                                borderColor: isDarkMode ? '#fff' : '#000',
                                                                shadowColor: '#000',
                                                                shadowOffset: { width: 0, height: 2 },
                                                                shadowOpacity: 0.2,
                                                                shadowRadius: 4,
                                                                elevation: 3,
                                                                overflow: 'hidden',
                                                            }}
                                                        >
                                                            <Icon name={mode.icon as any} size={20} color={value.includes(mode.id) ? (isDarkMode ? '#000' : '#fff') : colors.text} />
                                                        </LinearGradient>
                                                        <Text style={{ color: value.includes(mode.id) ? (isDarkMode ? '#fff' : '#000') : colors.text, marginTop: 4, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{mode.label}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    />
                                    {formErrors.transportModes && <Text style={styles.errorText}>{formErrors.transportModes.message}</Text>}

                                    <Text style={[styles.label, { color: colors.text, marginTop: SPACING.md }]}>Cost Per Person (₹) <Text style={styles.required}>*</Text></Text>
                                    <Controller
                                        control={control}
                                        name="costPerPerson"
                                        render={({ field: { onChange, onBlur, value } }) => (
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: formErrors.costPerPerson ? '#EF4444' : colors.border }]}
                                                placeholder="e.g., 5000"
                                                placeholderTextColor={colors.textSecondary}
                                                onBlur={onBlur}
                                                onChangeText={onChange}
                                                value={value}
                                                keyboardType="numeric"
                                            />
                                        )}
                                    />
                                    {formErrors.costPerPerson && <Text style={styles.errorText}>{formErrors.costPerPerson.message}</Text>}
                                </MotiView>
                            )}

                            {step === 4 && (
                                <MotiView
                                    from={{ opacity: 0, translateX: 50 }}
                                    animate={{ opacity: 1, translateX: 0 }}
                                    transition={{ type: 'timing', duration: 300 }}
                                    style={styles.formSection}
                                >
                                    {/* Section 4: Accommodation & Group */}
                                    <Text style={[styles.sectionHeading, { color: colors.primary }]}>Accommodation & Group</Text>

                                    <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Accommodation Type <Text style={styles.required}>*</Text></Text>
                                    <Controller
                                        control={control}
                                        name="accommodationType"
                                        render={({ field: { onChange, value } }) => (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'center' }}>
                                                {ACCOMMODATION_TYPES.map((type) => (
                                                    <TouchableOpacity
                                                        key={type.id}
                                                        style={{ alignItems: 'center', width: 75 }}
                                                        onPress={() => {
                                                            if (value === type.id) {
                                                                onChange(null); // Deselect
                                                            } else {
                                                                onChange(type.id);
                                                            }
                                                        }}
                                                    >
                                                        <LinearGradient
                                                            colors={value === type.id ? [isDarkMode ? '#fff' : '#000', isDarkMode ? '#fff' : '#000'] : [isDarkMode ? '#1a1a1a' : '#f0f0f0', isDarkMode ? '#2a2a2a' : '#ffffff']}
                                                            style={{
                                                                width: 50,
                                                                height: 50,
                                                                borderRadius: 25,
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                                borderWidth: value === type.id ? 2 : 0,
                                                                borderColor: isDarkMode ? '#fff' : '#000',
                                                                shadowColor: '#000',
                                                                shadowOffset: { width: 0, height: 2 },
                                                                shadowOpacity: 0.2,
                                                                shadowRadius: 4,
                                                                elevation: 3,
                                                                overflow: 'hidden',
                                                            }}
                                                        >
                                                            <Icon name={type.icon as any} size={20} color={value === type.id ? (isDarkMode ? '#000' : '#fff') : colors.text} />
                                                        </LinearGradient>
                                                        <Text style={{ color: value === type.id ? (isDarkMode ? '#fff' : '#000') : colors.text, marginTop: 4, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{type.label}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    />
                                    {formErrors.accommodationType && <Text style={styles.errorText}>{formErrors.accommodationType.message}</Text>}

                                    {watch('accommodationType') && watch('accommodationType') !== 'none' && (
                                        <>
                                            <Text style={[styles.label, { color: colors.text, marginTop: SPACING.md }]}>Booking Status <Text style={styles.required}>*</Text></Text>
                                            <Controller
                                                control={control}
                                                name="bookingStatus"
                                                render={({ field: { onChange, value } }) => (
                                                    <View style={styles.radioGroup}>
                                                        {BOOKING_STATUS.map((status) => (
                                                            <TouchableOpacity
                                                                key={status.id}
                                                                style={styles.radioItem}
                                                                onPress={() => onChange(status.id)}
                                                            >
                                                                <View style={[styles.radio, { borderColor: isDarkMode ? '#fff' : '#000' }]}>
                                                                    {value === status.id && <View style={[styles.radioInner, { backgroundColor: isDarkMode ? '#fff' : '#000' }]} />}
                                                                </View>
                                                                <Text style={[styles.radioText, { color: colors.text }]}>{status.label}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                )}
                                            />

                                            <Text style={[styles.label, { color: colors.text, marginTop: SPACING.md }]}>Accommodation Days <Text style={styles.required}>*</Text></Text>
                                            <Controller
                                                control={control}
                                                name="accommodationDays"
                                                render={({ field: { onChange, onBlur, value } }) => (
                                                    <TextInput
                                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: formErrors.accommodationDays ? '#EF4444' : colors.border }]}
                                                        placeholder="e.g., 3"
                                                        placeholderTextColor={colors.textSecondary}
                                                        onBlur={onBlur}
                                                        onChangeText={onChange}
                                                        value={value}
                                                        keyboardType="numeric"
                                                    />
                                                )}
                                            />
                                            {formErrors.accommodationDays && <Text style={styles.errorText}>{formErrors.accommodationDays.message}</Text>}
                                        </>
                                    )}

                                    <Text style={[styles.label, { color: colors.text, marginTop: SPACING.md }]}>Max Travelers <Text style={styles.required}>*</Text></Text>
                                    <Controller
                                        control={control}
                                        name="maxTravelers"
                                        render={({ field: { onChange, onBlur, value } }) => (
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: formErrors.maxTravelers ? '#EF4444' : colors.border, opacity: watch('tripType') === 'solo' ? 0.6 : 1 }]}
                                                placeholder="e.g., 5"
                                                placeholderTextColor={colors.textSecondary}
                                                onBlur={onBlur}
                                                onChangeText={onChange}
                                                value={value}
                                                keyboardType="numeric"
                                                editable={watch('tripType') !== 'solo'}
                                            />
                                        )}
                                    />
                                    {formErrors.maxTravelers && <Text style={styles.errorText}>{formErrors.maxTravelers.message}</Text>}

                                </MotiView>
                            )}

                            {/* Wizard Navigation Buttons */}
                            <View style={[styles.buttonRow, step === 1 ? { justifyContent: 'center' } : {}]}>
                                {step > 1 && (
                                    <TouchableOpacity
                                        style={[styles.stepButton, styles.neumorphicButton, { backgroundColor: isDarkMode ? '#000' : '#fff', width: '48%' }]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setStep(s => s - 1);
                                        }}
                                    >
                                        <Text style={{ color: isDarkMode ? '#fff' : '#000', fontWeight: 'bold' }}>Back</Text>
                                    </TouchableOpacity>
                                )}
                                {step < 4 ? (
                                    (step !== 1 || watch('tripType')) ? (
                                        <TouchableOpacity
                                            style={[styles.stepButton, styles.neumorphicButton, { backgroundColor: isDarkMode ? '#fff' : '#000', width: step === 1 ? 200 : '48%' }]}
                                            onPress={async () => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                let fieldsToValidate: any[] = [];
                                                if (step === 1) fieldsToValidate = ['tripType'];
                                                if (step === 2) fieldsToValidate = ['title', 'fromLocation', 'toLocation', 'fromDate', 'toDate'];
                                                if (step === 3) fieldsToValidate = ['tripTypes', 'transportModes', 'costPerPerson'];
                                                
                                                const isValid = await trigger(fieldsToValidate);
                                                if (isValid) setStep(s => s + 1);
                                            }}
                                        >
                                            <Text style={{ color: isDarkMode ? '#000' : '#fff', fontWeight: 'bold' }}>Next</Text>
                                        </TouchableOpacity>
                                    ) : null
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.stepButton, styles.neumorphicButton, { backgroundColor: isDarkMode ? '#fff' : '#000', width: '48%' }]}
                                        onPress={handleSubmit((data) => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            router.push({
                                                pathname: '/trip/timeline',
                                                params: { 
                                                    tripData: JSON.stringify(data),
                                                    tripImages: JSON.stringify(tripImages)
                                                }
                                            });
                                        })}
                                    >
                                        <Text style={{ color: isDarkMode ? '#000' : '#fff', fontWeight: 'bold' }}>Create Itinerary</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={{ height: 120 }} />
                        </NestableScrollContainer>

                        {showDateModal && Platform.OS === 'ios' && (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}>
                                <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                                    <View style={styles.dateModalHeader}>
                                        <Text style={[styles.dateModalTitle, { color: colors.text }]}>Select Date</Text>
                                        <TouchableOpacity onPress={() => setShowDateModal(null)}>
                                            <Icon name="X" size={24} color={colors.text} />
                                        </TouchableOpacity>
                                    </View>
                                    <DateTimePicker
                                        value={(showDateModal === 'from' ? watch('fromDate') : watch('toDate')) || new Date()}
                                        mode="date"
                                        display="inline"
                                        onChange={showDateModal === 'from' ? handleFromDateChange : handleToDateChange}
                                        minimumDate={showDateModal === 'to' ? watch('fromDate') : undefined}
                                    />
                                </View>
                            </View>
                        )}
                        {showDateModal && Platform.OS === 'android' && (
                            <DateTimePicker
                                value={(showDateModal === 'from' ? watch('fromDate') : watch('toDate')) || new Date()}
                                mode="date"
                                display="calendar"
                                onChange={showDateModal === 'from' ? handleFromDateChange : handleToDateChange}
                                minimumDate={showDateModal === 'to' ? watch('fromDate') : undefined}
                            />
                        )}

                        <Modal visible={showSuccess} transparent animationType="fade">
                            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                                <View style={{ backgroundColor: colors.card, padding: SPACING.xl, borderRadius: BORDER_RADIUS.md, alignItems: 'center' }}>
                                    <LottieView
                                        source={{ uri: 'https://assets9.lottiefiles.com/packages/lf20_s2lryxtd.json' }}
                                        autoPlay
                                        loop={false}
                                        style={{ width: 150, height: 150 }}
                                        onAnimationFinish={() => {
                                            setShowSuccess(false);
                                            if (createdTripId) {
                                                router.replace({ pathname: '/trip/timeline', params: { id: createdTripId } });
                                            } else {
                                                router.replace({ pathname: '/profile/[id]', params: { id: currentUser.id } });
                                            }
                                        }}
                                    />
                                    <Text style={{ color: colors.text, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.md }}>
                                        Trip Posted Successfully!
                                    </Text>
                                </View>
                            </View>
                        </Modal>

                    </KeyboardAvoidingView>
                </SafeAreaView>
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    container: { flex: 1 },
    keyboardContainer: { flex: 1 },
    content: { padding: SPACING.lg, paddingBottom: 100 },
    backButton: { padding: SPACING.sm, marginRight: SPACING.sm },
    progressContainer: { flex: 1, gap: 4 },
    progressBar: {
        height: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    stepText: { fontSize: 10, fontWeight: FONT_WEIGHT.medium },
    stepContent: { paddingHorizontal: SPACING.xl },
    stepTitle: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
    stepSubtitle: { fontSize: FONT_SIZE.sm, marginBottom: SPACING.xl },
    label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm, marginTop: SPACING.lg },
    required: { color: '#EF4444' },
    input: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, fontSize: FONT_SIZE.md },
    textArea: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, fontSize: FONT_SIZE.md, minHeight: 140, textAlignVertical: 'top' },
    errorText: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
    hint: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
    imagesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    imageWrapper: { position: 'relative' },
    tripImage: { width: 80, height: 80, borderRadius: BORDER_RADIUS.md },
    removeImage: { position: 'absolute', top: -8, right: -8 },
    addImageButton: { width: 80, height: 80, borderRadius: BORDER_RADIUS.md, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    addImageText: { fontSize: FONT_SIZE.xs },
    dateRow: { flexDirection: 'row', gap: SPACING.md },
    dateField: { flex: 1 },
    dateButton: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.sm },
    dateText: { fontSize: FONT_SIZE.sm },
    durationText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginTop: SPACING.sm },
    mapsLink: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, gap: SPACING.xs },
    chipText: { fontSize: FONT_SIZE.sm },
    radioGroup: { gap: SPACING.sm },
    radioItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    radioInner: { width: 12, height: 12, borderRadius: 6 },
    radioText: { fontSize: FONT_SIZE.sm },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: SPACING.xl,
    },
    sectionHeading: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.lg,
    },
    formSection: {
        marginBottom: SPACING.xl,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        flex: 1,
    },
    headerSaveButton: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: '#E0E7FF',
    },
    saveHeaderText: {
        color: '#4F46E5',
        fontWeight: FONT_WEIGHT.bold,
        fontSize: FONT_SIZE.sm,
    },
    dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    dateModalContent: { width: '85%', maxHeight: '70%', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg },
    dateModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    dateModalTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    dateList: { maxHeight: 400 },
    dateOption: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm, gap: SPACING.md },
    dateOptionDay: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, width: 40 },
    dateOptionDate: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, width: 40 },
    dateOptionMonth: { fontSize: FONT_SIZE.sm, flex: 1 },

    // Auto-image toggle styles
    autoImageToggle: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xl, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: 'rgba(139, 92, 246, 0.1)' },
    hintText: { fontSize: FONT_SIZE.xs },
    toggleButton: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#E5E5EB', justifyContent: 'center', paddingHorizontal: 2 },
    toggleButtonActive: { backgroundColor: '#9d74f7' },
    toggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', elevation: 2 },
    toggleCircleActive: { alignSelf: 'flex-end' },

    // Reorder styles
    reorderItemVertical: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.sm,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
        width: '100%',
        borderWidth: 1,
        borderColor: BRAND.primary + '30',
    },
    reorderImageVertical: {
        width: 60,
        height: 60,
        borderRadius: BORDER_RADIUS.sm,
    },
    verticalReorderControls: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: SPACING.md,
    },
    reorderInfo: {
        flex: 1,
    },
    reorderIndexText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
    reorderActionArea: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    dragHandleContainer: {
        flexDirection: 'row',
        gap: 2,
        padding: 4,
    },
    dragHandleColumn: {
        gap: 2,
    },
    dragDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        opacity: 0.6,
    },
    neumorphicButton: {
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    neumorphicInput: {
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        height: 50,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.xl,
        gap: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    stepButton: {
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default CreateTripScreen;
