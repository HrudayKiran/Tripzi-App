import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions, Image, Platform, Modal, ActivityIndicator, KeyboardAvoidingView, Vibration } from 'react-native';
import { GestureHandlerRootView, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { ScaleDecorator, NestableScrollContainer, NestableDraggableFlatList } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';
import { deleteTripImagesFromR2, uploadTripImageToR2 } from '../utils/imageUpload';


const { width } = Dimensions.get('window');

const TRIP_TYPES = [
    { id: 'adventure', label: 'Adventure', icon: 'compass', color: '#F59E0B' },
    { id: 'trekking', label: 'Trekking', icon: 'walk', color: '#10B981' },
    { id: 'bike_ride', label: 'Bike Ride', icon: 'bicycle', color: '#EF4444' },
    { id: 'road_trip', label: 'Road Trip', icon: 'car-sport', color: '#9d74f7' },
    { id: 'camping', label: 'Camping', icon: 'bonfire', color: '#F97316' },
    { id: 'sightseeing', label: 'Sightseeing', icon: 'camera', color: '#3B82F6' },
    { id: 'beach', label: 'Beach', icon: 'sunny', color: '#06B6D4' },
    { id: 'pilgrimage', label: 'Pilgrimage', icon: 'heart', color: '#EC4899' },
];

const TRANSPORT_MODES = [
    { id: 'train', label: 'Train', icon: 'train' },
    { id: 'bus', label: 'Bus', icon: 'bus' },
    { id: 'car', label: 'Car', icon: 'car' },
    { id: 'flight', label: 'Flight', icon: 'airplane' },
    { id: 'bike', label: 'Bike', icon: 'bicycle' },
    { id: 'mixed', label: 'Mixed', icon: 'shuffle' },
];

const ACCOMMODATION_TYPES = [
    { id: 'hotel', label: 'Hotel', icon: 'bed' },
    { id: 'hostel', label: 'Hostel', icon: 'home' },
    { id: 'camping', label: 'Camping', icon: 'bonfire' },
    { id: 'homestay', label: 'Homestay', icon: 'people' },
    { id: 'none', label: 'Not Needed', icon: 'close-circle' },
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

const GENDER_PREFERENCES = [
    { id: 'anyone', label: 'Anyone', icon: 'people' },
    { id: 'male', label: 'Male Only', icon: 'male' },
    { id: 'female', label: 'Female Only', icon: 'female' },
];

const CreateTripScreen = ({ navigation, route }: any) => {
    const { colors } = useTheme();
    const initialData = route.params?.initialTripData;

    const [step, setStep] = useState(1);
    const totalSteps = 5;

    // Step 1: Basic Info
    const [title, setTitle] = useState(initialData?.title || '');
    // Unified Image & Location state with stable IDs (from EditTripScreen)
    const [tripImages, setTripImages] = useState<TripImageItem[]>(
        initialData?.images?.map((uri: string, i: number) => ({
            id: `img-${Date.now()}-${i}`,
            uri,
            location: initialData?.imageLocations?.[i] || '',
            objectKey: initialData?.imageObjectKeys?.[i] || null,
        })) || []
    );

    // ... (existing code) ...


    // Step 2: Location & Dates
    const [fromLocation, setFromLocation] = useState(initialData?.fromLocation || '');
    const [toLocation, setToLocation] = useState(initialData?.toLocation || '');
    const [mapsLink, setMapsLink] = useState(initialData?.mapsLink || '');
    const [fromDate, setFromDate] = useState<Date | undefined>(initialData?.fromDate?.toDate ? initialData.fromDate.toDate() : undefined);
    const [toDate, setToDate] = useState<Date | undefined>(initialData?.toDate?.toDate ? initialData.toDate.toDate() : undefined);
    const [showDateModal, setShowDateModal] = useState<'from' | 'to' | null>(null);

    // Step 3: Trip Details
    // AI returns single string for tripType usually, but we use array
    const [tripTypes, setTripTypes] = useState<string[]>(initialData?.tripTypes || (initialData?.tripType ? [initialData.tripType] : []));

    // AI returns single string transportMode usually, but we use array
    const [transportModes, setTransportModes] = useState<string[]>(initialData?.transportModes || (initialData?.transportMode ? [initialData.transportMode] : []));

    const [costPerPerson, setCostPerPerson] = useState(initialData?.costPerPerson ? String(initialData.costPerPerson) : (initialData?.cost ? String(initialData.cost) : ''));

    // Step 4: Accommodation & Group
    const [accommodationType, setAccommodationType] = useState(initialData?.accommodationType || '');
    const [bookingStatus, setBookingStatus] = useState(initialData?.bookingStatus || '');
    const [accommodationDays, setAccommodationDays] = useState(initialData?.accommodationDays ? String(initialData.accommodationDays) : (initialData?.durationDays ? String(initialData.durationDays) : ''));
    const [maxTravelers, setMaxTravelers] = useState(initialData?.maxTravelers ? String(initialData.maxTravelers) : '');
    const [genderPreference, setGenderPreference] = useState(initialData?.genderPreference || '');

    // Step 5: Description
    const [description, setDescription] = useState(initialData?.description || '');
    const [mandatoryItems, setMandatoryItems] = useState(Array.isArray(initialData?.mandatoryItems) ? initialData.mandatoryItems.join(', ') : (initialData?.mandatoryItems || ''));
    const [placesToVisit, setPlacesToVisit] = useState(Array.isArray(initialData?.placesToVisit) ? initialData.placesToVisit.join(', ') : (initialData?.placesToVisit || ''));

    const [errors, setErrors] = useState<{ [key: string]: string }>({});
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
            setFromDate(selectedDate);
            if (selectedDate > toDate) {
                setToDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000));
            }
        }
    };

    const handleToDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDateModal(null);
        if (event.type === 'set' && selectedDate) {
            if (selectedDate >= fromDate) {
                setToDate(selectedDate);
            } else {
                Alert.alert('Invalid Date', 'End date cannot be earlier than start date.');
            }
        }
    };

    const getDuration = () => {
        if (!fromDate || !toDate) return '0 days';
        const diff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? `${diff} day${diff > 1 ? 's' : ''}` : '1 day';
    };

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (!title.trim()) newErrors.title = 'Trip title is required';
        if (!fromLocation.trim()) newErrors.fromLocation = 'Starting location is required';
        if (!toLocation.trim()) newErrors.toLocation = 'Destination is required';
        if (!fromDate) newErrors.fromDate = 'Start date is required';
        if (!toDate) newErrors.toDate = 'End date is required';
        if (tripTypes.length === 0) newErrors.tripTypes = 'Select at least one trip type';
        if (transportModes.length === 0) newErrors.transportModes = 'Select at least one transport mode';
        if (!costPerPerson.trim()) newErrors.costPerPerson = 'Cost per person is required';
        if (!accommodationType) newErrors.accommodationType = 'Select accommodation type';
        if (!maxTravelers.trim()) newErrors.maxTravelers = 'Max travelers is required';
        if (!description.trim()) newErrors.description = 'Trip description is required';

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            Alert.alert('Validation Error', 'Please fill in all required fields indicated by *');
            return false;
        }
        return true;
    };

    const generateMapsLink = (destination: string) => {
        const encoded = encodeURIComponent(destination);
        return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    };

    const handlePostTrip = async () => {
        if (!validateForm()) return;

        const currentUser = auth().currentUser;
        if (!currentUser) {
            Alert.alert('Error', 'You need to be logged in to create a trip.');
            navigation.navigate('Start');
            return;
        }

        setIsPosting(true);
        const newObjectKeys: string[] = [];

        try {
            const currentUserDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const currentUserData = currentUserDoc.data() || {};

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
                        const uploadResult = await uploadTripImageToR2(imageUri, currentUser.uid);
                        if (uploadResult.success && uploadResult.url && uploadResult.objectKey) {
                            uploadedImageData.push({
                                uri: uploadResult.url,
                                location: img.location,
                                objectKey: uploadResult.objectKey,
                            });
                            newObjectKeys.push(uploadResult.objectKey);
                        }
                    } catch (uploadError) {
                        console.error('Image upload failed', uploadError);
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
                title,
                images: finalImages,
                imageLocations: finalLocations, // Save specific place names
                fromLocation,
                toLocation,
                mapsLink: generateMapsLink(toLocation),
                fromDate: firestore.Timestamp.fromDate(fromDate),
                toDate: firestore.Timestamp.fromDate(toDate),
                duration: getDuration(),
                tripTypes,
                transportModes,
                costPerPerson: parseFloat(costPerPerson) || 0,
                totalCost: parseFloat(costPerPerson) || 0,
                cost: parseFloat(costPerPerson) || 0,
                accommodationType,
                bookingStatus,
                accommodationDays: accommodationDays ? parseInt(accommodationDays) : null,
                maxTravelers: parseInt(maxTravelers) || 5,
                currentTravelers: 1,
                genderPreference,
                description,
                mandatoryItems: mandatoryItems.split(',').map(item => item.trim()).filter(Boolean),
                placesToVisit: placesToVisit.split(',').map(place => place.trim()).filter(Boolean),
                userId: currentUser.uid,
                ownerDisplayName: currentUserData.name || currentUserData.displayName || currentUser.displayName || 'Traveler',
                ownerPhotoURL: currentUserData.photoURL || currentUser.photoURL || null,
                ownerUsername: currentUserData.username || null,
                participants: [currentUser.uid],
                likes: [],
                imageObjectKeys: finalObjectKeys,

                createdAt: firestore.FieldValue.serverTimestamp(),
                location: toLocation,
                tripType: tripTypes[0] || 'Adventure',
                coverImage: finalImages[0],
                // video removed
            };

            // Create trip
            const tripRef = await firestore().collection('trips').add(tripData);


            // Create group chat for the trip
            try {
                await firestore().collection('chats').doc(`trip_${tripRef.id}`).set({
                    type: 'group',
                    tripId: tripRef.id,
                    tripTitle: title,
                    participants: [currentUser.uid],
                    createdBy: currentUser.uid,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    lastMessage: 'Trip group created!',
                    lastMessageTime: firestore.FieldValue.serverTimestamp(),
                });
            } catch {
                // Group chat creation failed (non-critical)
            }

            setIsPosting(false);
            Alert.alert('Success! 🎉', 'Your trip has been posted!');
            navigation.navigate('UserProfile', { userId: auth().currentUser?.uid });
        } catch (error: any) {
            if (newObjectKeys.length > 0) {
                await deleteTripImagesFromR2(newObjectKeys);
            }
            setIsPosting(false);
            Alert.alert('Error', `Failed to post trip: ${error?.message || 'Unknown error'}. Please try again.`);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Create Trip</Text>
            <TouchableOpacity
                onPress={handlePostTrip}
                disabled={isPosting}
                style={[styles.headerSaveButton, { opacity: isPosting ? 0.6 : 1 }]}
            >
                {isPosting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                    <Text style={[styles.saveHeaderText, { color: colors.primary }]}>Post</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    const renderEmpty = () => null;

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

                        <NestableScrollContainer
                            contentContainerStyle={styles.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        >
                            <Animatable.View animation="fadeInUp" style={styles.formSection}>
                                {/* Section 1: Basic Info */}
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Basic Information</Text>

                                <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Trip Title <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.title ? '#EF4444' : colors.border }]}
                                    placeholder="e.g., Mystical Ladakh Adventure"
                                    placeholderTextColor={colors.textSecondary}
                                    value={title}
                                    onChangeText={setTitle}
                                />
                                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

                                <Text style={[styles.label, { color: colors.text }]}>Trip Images (Optional - Max 5)</Text>
                                <NestableDraggableFlatList
                                    data={tripImages}
                                    onDragEnd={({ data }) => setTripImages(data)}
                                    keyExtractor={(item) => item.id}
                                    renderItem={({ item, drag, isActive }) => (
                                        <GHTouchableOpacity
                                            activeOpacity={0.9}
                                            onLongPress={drag}
                                            disabled={isActive}
                                            delayLongPress={200}
                                            style={[
                                                styles.reorderItemVertical,
                                                isActive && {
                                                    elevation: 8,
                                                    shadowColor: '#000',
                                                    shadowOffset: { width: 0, height: 4 },
                                                    shadowOpacity: 0.3,
                                                    shadowRadius: 5,
                                                    backgroundColor: colors.card,
                                                    transform: [{ scale: 1.02 }]
                                                }
                                            ]}
                                        >
                                            <View style={[styles.reorderImageVertical, { overflow: 'hidden' }]}>
                                                <Image source={{ uri: item.uri }} style={styles.tripImage} />
                                            </View>

                                            <View style={styles.verticalReorderControls}>
                                                <View style={styles.reorderInfo}>
                                                    <Text style={[styles.reorderIndexText, { color: colors.text }]} numberOfLines={1}>
                                                        Long press to move
                                                    </Text>
                                                </View>
                                                <View style={styles.reorderActionArea}>
                                                    <View style={styles.dragHandleContainer}>
                                                        <View style={styles.dragHandleColumn}>
                                                            <View style={[styles.dragDot, { backgroundColor: colors.textSecondary }]} />
                                                            <View style={[styles.dragDot, { backgroundColor: colors.textSecondary }]} />
                                                            <View style={[styles.dragDot, { backgroundColor: colors.textSecondary }]} />
                                                        </View>
                                                        <View style={styles.dragHandleColumn}>
                                                            <View style={[styles.dragDot, { backgroundColor: colors.textSecondary }]} />
                                                            <View style={[styles.dragDot, { backgroundColor: colors.textSecondary }]} />
                                                            <View style={[styles.dragDot, { backgroundColor: colors.textSecondary }]} />
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={[styles.removeImage, { position: 'relative', top: 0, right: 0, marginLeft: 10, elevation: 0, backgroundColor: 'transparent' }]}
                                                        onPress={() => removeImage(item.id)}
                                                    >
                                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </GHTouchableOpacity>
                                    )}
                                />

                                {tripImages.length < 5 && (
                                    <TouchableOpacity style={[styles.addImageButton, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10, alignSelf: 'flex-start', width: 'auto', paddingHorizontal: 20, height: 40, borderStyle: 'dashed' }]} onPress={pickImages}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="add" size={20} color={colors.primary} />
                                            <Text style={[styles.addImageText, { color: colors.primary, marginTop: 0, marginLeft: 5 }]}>Add Images</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}

                                <View style={styles.divider} />

                                {/* Section 2: Location & Dates */}
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Location & Dates</Text>

                                <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Starting From <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.fromLocation ? '#EF4444' : colors.border }]}
                                    placeholder="e.g., Bangalore, Karnataka"
                                    placeholderTextColor={colors.textSecondary}
                                    value={fromLocation}
                                    onChangeText={setFromLocation}
                                />
                                {errors.fromLocation && <Text style={styles.errorText}>{errors.fromLocation}</Text>}

                                <Text style={[styles.label, { color: colors.text }]}>Destination <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.toLocation ? '#EF4444' : colors.border }]}
                                    placeholder="e.g., Leh, Ladakh"
                                    placeholderTextColor={colors.textSecondary}
                                    value={toLocation}
                                    onChangeText={(text) => {
                                        setToLocation(text);
                                        setMapsLink(generateMapsLink(text));
                                    }}
                                />
                                {errors.toLocation && <Text style={styles.errorText}>{errors.toLocation}</Text>}
                                {toLocation.length > 3 && (
                                    <Text style={[styles.mapsLink, { color: colors.primary }]}>📍 Maps link will be auto-generated</Text>
                                )}

                                <View style={styles.dateRow}>
                                    <View style={styles.dateField}>
                                        <Text style={[styles.label, { color: colors.text }]}>From Date <Text style={styles.required}>*</Text></Text>
                                        <TouchableOpacity
                                            style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                            onPress={() => setShowDateModal('from')}
                                        >
                                            <Ionicons name="calendar" size={20} color={colors.primary} />
                                            <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(fromDate)}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.dateField}>
                                        <Text style={[styles.label, { color: colors.text }]}>To Date <Text style={styles.required}>*</Text></Text>
                                        <TouchableOpacity
                                            style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                            onPress={() => setShowDateModal('to')}
                                        >
                                            <Ionicons name="calendar" size={20} color={colors.primary} />
                                            <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(toDate)}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <Text style={[styles.durationText, { color: colors.primary }]}>Duration: {getDuration()}</Text>

                                <View style={styles.divider} />

                                {/* Section 3: Trip Details */}
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Trip Details</Text>

                                <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Trip Type <Text style={styles.required}>*</Text></Text>
                                <View style={styles.chipGrid}>
                                    {TRIP_TYPES.map((type) => (
                                        <TouchableOpacity
                                            key={type.id}
                                            style={[styles.chip, { backgroundColor: tripTypes.includes(type.id) ? type.color : colors.card, borderColor: type.color }]}
                                            onPress={() => toggleSelection(type.id, tripTypes, setTripTypes)}
                                        >
                                            <Ionicons name={type.icon as any} size={18} color={tripTypes.includes(type.id) ? '#fff' : type.color} />
                                            <Text style={[styles.chipText, { color: tripTypes.includes(type.id) ? '#fff' : colors.text }]}>{type.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {errors.tripTypes && <Text style={styles.errorText}>{errors.tripTypes}</Text>}

                                <Text style={[styles.label, { color: colors.text }]}>Transport Mode <Text style={styles.required}>*</Text></Text>
                                <View style={styles.chipGrid}>
                                    {TRANSPORT_MODES.map((mode) => (
                                        <TouchableOpacity
                                            key={mode.id}
                                            style={[styles.chip, { backgroundColor: transportModes.includes(mode.id) ? colors.primary : colors.card, borderColor: colors.primary }]}
                                            onPress={() => toggleSelection(mode.id, transportModes, setTransportModes)}
                                        >
                                            <Ionicons name={mode.icon as any} size={18} color={transportModes.includes(mode.id) ? '#fff' : colors.primary} />
                                            <Text style={[styles.chipText, { color: transportModes.includes(mode.id) ? '#fff' : colors.text }]}>{mode.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {errors.transportModes && <Text style={styles.errorText}>{errors.transportModes}</Text>}

                                <Text style={[styles.label, { color: colors.text }]}>Cost Per Person (₹) <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.costPerPerson ? '#EF4444' : colors.border }]}
                                    placeholder="e.g., 5000"
                                    placeholderTextColor={colors.textSecondary}
                                    value={costPerPerson}
                                    onChangeText={setCostPerPerson}
                                    keyboardType="numeric"
                                />
                                {errors.costPerPerson && <Text style={styles.errorText}>{errors.costPerPerson}</Text>}

                                <View style={styles.divider} />

                                {/* Section 4: Accommodation & Group */}
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Accommodation & Group</Text>

                                <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Accommodation Type <Text style={styles.required}>*</Text></Text>
                                <View style={styles.chipGrid}>
                                    {ACCOMMODATION_TYPES.map((type) => (
                                        <TouchableOpacity
                                            key={type.id}
                                            style={[styles.chip, { backgroundColor: accommodationType === type.id ? '#10B981' : colors.card, borderColor: '#10B981' }]}
                                            onPress={() => setAccommodationType(type.id)}
                                        >
                                            <Ionicons name={type.icon as any} size={18} color={accommodationType === type.id ? '#fff' : '#10B981'} />
                                            <Text style={[styles.chipText, { color: accommodationType === type.id ? '#fff' : colors.text }]}>{type.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {errors.accommodationType && <Text style={styles.errorText}>{errors.accommodationType}</Text>}

                                {accommodationType && accommodationType !== 'none' && (
                                    <>
                                        <Text style={[styles.label, { color: colors.text }]}>Booking Status</Text>
                                        <View style={styles.radioGroup}>
                                            {BOOKING_STATUS.map((status) => (
                                                <TouchableOpacity
                                                    key={status.id}
                                                    style={styles.radioItem}
                                                    onPress={() => setBookingStatus(status.id)}
                                                >
                                                    <View style={[styles.radio, { borderColor: colors.primary }]}>
                                                        {bookingStatus === status.id && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                                                    </View>
                                                    <Text style={[styles.radioText, { color: colors.text }]}>{status.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text style={[styles.label, { color: colors.text }]}>Accommodation Days</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                            placeholder="e.g., 3"
                                            placeholderTextColor={colors.textSecondary}
                                            value={accommodationDays}
                                            onChangeText={setAccommodationDays}
                                            keyboardType="numeric"
                                        />
                                    </>
                                )}

                                <Text style={[styles.label, { color: colors.text }]}>Max Travelers <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.maxTravelers ? '#EF4444' : colors.border }]}
                                    placeholder="e.g., 5"
                                    placeholderTextColor={colors.textSecondary}
                                    value={maxTravelers}
                                    onChangeText={setMaxTravelers}
                                    keyboardType="numeric"
                                />
                                {errors.maxTravelers && <Text style={styles.errorText}>{errors.maxTravelers}</Text>}

                                <Text style={[styles.label, { color: colors.text }]}>Who Can Join? <Text style={styles.required}>*</Text></Text>
                                <View style={styles.chipGrid}>
                                    {GENDER_PREFERENCES.map((pref) => (
                                        <TouchableOpacity
                                            key={pref.id}
                                            style={[styles.chip, { backgroundColor: genderPreference === pref.id ? '#9d74f7' : colors.card, borderColor: '#9d74f7' }]}
                                            onPress={() => setGenderPreference(pref.id)}
                                        >
                                            <Ionicons name={pref.icon as any} size={18} color={genderPreference === pref.id ? '#fff' : '#9d74f7'} />
                                            <Text style={[styles.chipText, { color: genderPreference === pref.id ? '#fff' : colors.text }]}>{pref.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.divider} />

                                {/* Section 5: Description */}
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Final Details</Text>

                                <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Trip Description <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.textArea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.description ? '#EF4444' : colors.border }]}
                                    placeholder="Describe your trip in detail - what to expect, daily itinerary, activities planned..."
                                    placeholderTextColor={colors.textSecondary}
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    numberOfLines={6}
                                    textAlignVertical="top"
                                />
                                {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

                                <Text style={[styles.label, { color: colors.text }]}>Mandatory Items to Bring</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                    placeholder="e.g., ID proof, warm clothes, medicines"
                                    placeholderTextColor={colors.textSecondary}
                                    value={mandatoryItems}
                                    onChangeText={setMandatoryItems}
                                />
                                <Text style={[styles.hint, { color: colors.textSecondary }]}>Separate items with commas</Text>

                                <Text style={[styles.label, { color: colors.text }]}>Places to Visit</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                    placeholder="e.g., Pangong Lake, Nubra Valley, Khardung La"
                                    placeholderTextColor={colors.textSecondary}
                                    value={placesToVisit}
                                    onChangeText={setPlacesToVisit}
                                />
                                <Text style={[styles.hint, { color: colors.textSecondary }]}>Separate places with commas</Text>
                            </Animatable.View>

                            <View style={{ height: 120 }} />
                        </NestableScrollContainer>

                        {showDateModal && Platform.OS === 'ios' && (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}>
                                <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                                    <View style={styles.dateModalHeader}>
                                        <Text style={[styles.dateModalTitle, { color: colors.text }]}>Select Date</Text>
                                        <TouchableOpacity onPress={() => setShowDateModal(null)}>
                                            <Ionicons name="close" size={24} color={colors.text} />
                                        </TouchableOpacity>
                                    </View>
                                    <DateTimePicker
                                        value={(showDateModal === 'from' ? fromDate : toDate) || new Date()}
                                        mode="date"
                                        display="inline"
                                        onChange={showDateModal === 'from' ? handleFromDateChange : handleToDateChange}
                                        minimumDate={showDateModal === 'to' && fromDate ? fromDate : new Date()}
                                    />
                                </View>
                            </View>
                        )}
                        {showDateModal && Platform.OS === 'android' && (
                            <DateTimePicker
                                value={(showDateModal === 'from' ? fromDate : toDate) || new Date()}
                                mode="date"
                                display="calendar"
                                onChange={showDateModal === 'from' ? handleFromDateChange : handleToDateChange}
                                minimumDate={showDateModal === 'to' && fromDate ? fromDate : new Date()}
                            />
                        )}

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
    toggleButton: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', justifyContent: 'center', paddingHorizontal: 2 },
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
});

export default CreateTripScreen;
