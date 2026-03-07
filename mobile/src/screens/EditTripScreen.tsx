import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Dimensions, Image, Platform, ActivityIndicator, KeyboardAvoidingView, Vibration, LayoutAnimation } from 'react-native';
import { GestureHandlerRootView, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { ScaleDecorator, NestableScrollContainer, NestableDraggableFlatList } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';

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

const GENDER_PREFERENCES = [
    { id: 'anyone', label: 'Anyone', icon: 'people' },
    { id: 'male', label: 'Male Only', icon: 'male' },
    { id: 'female', label: 'Female Only', icon: 'female' },
];

const EditTripScreen = ({ navigation, route }: any) => {
    const { colors } = useTheme();
    const tripId = route.params?.tripId;
    const initialData = route.params?.tripData;

    // Unified Image & Location state with stable IDs
    const [title, setTitle] = useState(initialData?.title || '');
    const [tripImages, setTripImages] = useState<{ id: string, uri: string, location: string }[]>(
        initialData?.images?.map((uri: string, i: number) => ({
            id: `img-${Date.now()}-${i}`,
            uri,
            location: initialData?.imageLocations?.[i] || ''
        })) || []
    );

    // Location & Dates
    const [fromLocation, setFromLocation] = useState(initialData?.fromLocation || '');
    const [toLocation, setToLocation] = useState(initialData?.toLocation || initialData?.location || '');
    const [mapsLink, setMapsLink] = useState(initialData?.mapsLink || '');
    const [fromDate, setFromDate] = useState(initialData?.fromDate?.toDate ? initialData.fromDate.toDate() : new Date());
    const [toDate, setToDate] = useState(initialData?.toDate?.toDate ? initialData.toDate.toDate() : new Date());
    const [showDateModal, setShowDateModal] = useState<'from' | 'to' | null>(null);

    // Trip Details
    const [tripTypes, setTripTypes] = useState<string[]>(initialData?.tripTypes || (initialData?.tripType ? [initialData.tripType] : []));
    const [transportModes, setTransportModes] = useState<string[]>(initialData?.transportModes || (initialData?.transportMode ? [initialData.transportMode] : []));
    const [costPerPerson, setCostPerPerson] = useState(initialData?.costPerPerson ? String(initialData.costPerPerson) : (initialData?.cost ? String(initialData.cost) : ''));

    // Accommodation & Group
    const [accommodationType, setAccommodationType] = useState(initialData?.accommodationType || '');
    const [bookingStatus, setBookingStatus] = useState(initialData?.bookingStatus || '');
    const [accommodationDays, setAccommodationDays] = useState(initialData?.accommodationDays ? String(initialData.accommodationDays) : (initialData?.durationDays ? String(initialData.durationDays) : ''));
    const [maxTravelers, setMaxTravelers] = useState(initialData?.maxTravelers ? String(initialData.maxTravelers) : '');
    const [genderPreference, setGenderPreference] = useState(initialData?.genderPreference || 'anyone');

    // Description
    const [description, setDescription] = useState(initialData?.description || '');
    const [mandatoryItems, setMandatoryItems] = useState(Array.isArray(initialData?.mandatoryItems) ? initialData.mandatoryItems.join(', ') : (initialData?.mandatoryItems || ''));
    const [placesToVisit, setPlacesToVisit] = useState(Array.isArray(initialData?.placesToVisit) ? initialData.placesToVisit.join(', ') : (initialData?.placesToVisit || ''));

    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isPosting, setIsPosting] = useState(false);
    const [fetching, setFetching] = useState(!initialData && !!tripId);

    useEffect(() => {
        if (!initialData && tripId) {
            const fetchTrip = async () => {
                setFetching(true);
                try {
                    const doc = await firestore().collection('trips').doc(tripId).get();
                    if (doc.exists) {
                        const data = doc.data();
                        if (data) {
                            setTitle(data.title || '');

                            // Transform into object array with stable IDs
                            const imgUris = data.images || [];
                            const imgLocs = data.imageLocations || [];
                            setTripImages(imgUris.map((uri: string, i: number) => ({
                                id: `img-${tripId}-${i}`,
                                uri,
                                location: imgLocs[i] || ''
                            })));

                            setFromLocation(data.fromLocation || '');
                            setToLocation(data.toLocation || data.location || '');
                            setMapsLink(data.mapsLink || '');
                            setFromDate(data.fromDate?.toDate ? data.fromDate.toDate() : new Date());
                            setToDate(data.toDate?.toDate ? data.toDate.toDate() : new Date());
                            setTripTypes(data.tripTypes || (data.tripType ? [data.tripType] : []));
                            setTransportModes(data.transportModes || (data.transportMode ? [data.transportMode] : []));
                            setCostPerPerson(data.costPerPerson ? String(data.costPerPerson) : (data.cost ? String(data.cost) : ''));
                            setAccommodationType(data.accommodationType || '');
                            setBookingStatus(data.bookingStatus || '');
                            setAccommodationDays(data.accommodationDays ? String(data.accommodationDays) : (data.durationDays ? String(data.durationDays) : ''));
                            setMaxTravelers(data.maxTravelers ? String(data.maxTravelers) : '');
                            setGenderPreference(data.genderPreference || 'anyone');
                            setDescription(data.description || '');
                            setMandatoryItems(Array.isArray(data.mandatoryItems) ? data.mandatoryItems.join(', ') : (data.mandatoryItems || ''));
                            setPlacesToVisit(Array.isArray(data.placesToVisit) ? data.placesToVisit.join(', ') : (data.placesToVisit || ''));
                        }
                    }
                } catch (error) {
                    console.error('Error fetching trip:', error);
                } finally {
                    setFetching(false);
                }
            };
            fetchTrip();
        }
    }, [tripId, initialData]);

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
            quality: 0.7,
            allowsMultipleSelection: false,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newImage = {
                id: `img-new-${Date.now()}`,
                uri: result.assets[0].uri,
                location: ''
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

    const moveImage = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= tripImages.length) return;

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        const newTripImages = [...tripImages];
        const temp = newTripImages[index];
        newTripImages[index] = newTripImages[newIndex];
        newTripImages[newIndex] = temp;
        setTripImages(newTripImages);

        // Provide tacticle feedback when swapping
        Vibration.vibrate(10);
    };

    // Simplified PanResponder moved to creation helper above

    const formatDate = (date: Date) => {
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
        const diff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? `${diff} day${diff > 1 ? 's' : ''}` : '1 day';
    };

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (!title.trim()) newErrors.title = 'Trip title is required';
        if (!fromLocation.trim()) newErrors.fromLocation = 'Starting location is required';
        if (!toLocation.trim()) newErrors.toLocation = 'Destination is required';
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

    const handleUpdateTrip = async () => {
        if (!validateForm()) return;
        if (!tripId) {
            Alert.alert("Error", "Missing Trip ID");
            return;
        }

        const currentUser = auth().currentUser;
        if (!currentUser) return;

        setIsPosting(true);

        try {
            // Upload new images to Firebase Storage
            let uploadedImageData: { uri: string, location: string }[] = [];

            for (let i = 0; i < tripImages.length; i++) {
                const img = tripImages[i];
                const imageUri = img.uri;

                // Check if it's already a remote URL
                if (imageUri.startsWith('http') || imageUri.startsWith('https')) {
                    uploadedImageData.push({ uri: imageUri, location: img.location });
                    continue;
                }

                const filename = `trips/${currentUser.uid}/${Date.now()}_${i}.jpg`;
                const reference = storage().ref(filename);

                try {
                    await reference.putFile(imageUri, { contentType: 'image/jpeg' });
                    const downloadUrl = await reference.getDownloadURL();
                    uploadedImageData.push({ uri: downloadUrl, location: img.location });
                } catch (uploadError) {
                    console.error('Image upload failed', uploadError);
                }
            }

            const finalImages = uploadedImageData.map(d => d.uri);
            const finalLocations = uploadedImageData.map(d => d.location);

            if (finalImages.length === 0) {
                finalImages.push('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800');
                finalLocations.push('');
            }

            const tripData = {
                title,
                images: finalImages,
                imageLocations: finalLocations,
                fromLocation,
                toLocation,
                location: toLocation,
                mapsLink: mapsLink || generateMapsLink(toLocation),
                fromDate: firestore.Timestamp.fromDate(fromDate),
                toDate: firestore.Timestamp.fromDate(toDate),
                duration: getDuration(),
                tripTypes,
                tripType: tripTypes[0] || 'Adventure',
                transportModes,
                costPerPerson: parseFloat(costPerPerson) || 0,
                totalCost: parseFloat(costPerPerson) || 0,
                cost: parseFloat(costPerPerson) || 0,
                accommodationType,
                bookingStatus,
                accommodationDays: accommodationDays ? parseInt(accommodationDays) : null,
                maxTravelers: parseInt(maxTravelers) || 5,
                genderPreference,
                description,
                mandatoryItems: mandatoryItems.split(',').map(item => item.trim()).filter(Boolean),
                placesToVisit: placesToVisit.split(',').map(place => place.trim()).filter(Boolean),
                coverImage: finalImages[0],
                updatedAt: firestore.FieldValue.serverTimestamp(),
            };

            await firestore().collection('trips').doc(tripId).update(tripData);

            // Update chat title if exists
            try {
                await firestore().collection('chats').doc(`trip_${tripId}`).update({
                    tripTitle: title
                });
            } catch (e) {
                // Ignore if chat doesn't exist
            }

            setIsPosting(false);
            Alert.alert('Success! 🎉', 'Your trip has been updated!');
            navigation.goBack();
        } catch (error: any) {
            setIsPosting(false);
            Alert.alert('Error', `Failed to update trip: ${error?.message || 'Unknown error'}. Please try again.`);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Trip</Text>
            <TouchableOpacity
                onPress={handleUpdateTrip}
                disabled={isPosting || fetching}
                style={[styles.headerSaveButton, { opacity: (isPosting || fetching) ? 0.6 : 1 }]}
            >
                {isPosting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                    <Text style={[styles.saveHeaderText, { color: colors.primary }]}>Save</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <LinearGradient
                colors={[colors.background, colors.card]}
                style={StyleSheet.absoluteFill}
            />
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    style={styles.keyboardContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
                >
                    {renderHeader()}

                    {fetching ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading trip details...</Text>
                        </View>
                    ) : (
                        <NestableScrollContainer
                            contentContainerStyle={styles.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Animatable.View animation="fadeInUp" style={styles.formSection}>

                                {/* Section 1: Basic Info */}
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Basic Information</Text>

                                <Text style={[styles.label, { color: colors.text }]}>Trip Title <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.title ? '#EF4444' : colors.border }]}
                                    placeholder="e.g., Mystical Ladakh Adventure"
                                    placeholderTextColor={colors.textSecondary}
                                    value={title}
                                    onChangeText={setTitle}
                                />
                                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

                                <View style={styles.sectionHeaderRow}>
                                    <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Trip Images (Max 5)</Text>
                                </View>

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

                                <Text style={[styles.label, { color: colors.text }]}>Starting From <Text style={styles.required}>*</Text></Text>
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

                                <Text style={[styles.label, { color: colors.text }]}>Trip Type <Text style={styles.required}>*</Text></Text>
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
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Stay & Group</Text>

                                <Text style={[styles.label, { color: colors.text }]}>Accommodation Type <Text style={styles.required}>*</Text></Text>
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

                                {
                                    accommodationType && accommodationType !== 'none' && (
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
                                    )
                                }

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
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Description & details</Text>

                                <Text style={[styles.label, { color: colors.text }]}>Trip Description <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.textArea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.description ? '#EF4444' : colors.border }]}
                                    placeholder="Describe your trip in detail..."
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
                                    placeholder="e.g., ID proof, warm clothes"
                                    placeholderTextColor={colors.textSecondary}
                                    value={mandatoryItems}
                                    onChangeText={setMandatoryItems}
                                />

                                <Text style={[styles.label, { color: colors.text }]}>Places to Visit</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                    placeholder="e.g., Pangong Lake, Nubra Valley"
                                    placeholderTextColor={colors.textSecondary}
                                    value={placesToVisit}
                                    onChangeText={setPlacesToVisit}
                                />

                                {/* iOS close button for inline picker placed strategically below fields if visible */}
                                {
                                    showDateModal === 'from' && (
                                        <DateTimePicker
                                            value={fromDate}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            minimumDate={new Date()}
                                            onChange={handleFromDateChange}
                                        />
                                    )
                                }
                                {
                                    showDateModal === 'to' && (
                                        <DateTimePicker
                                            value={toDate}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            minimumDate={fromDate}
                                            onChange={handleToDateChange}
                                        />
                                    )
                                }
                                {
                                    Platform.OS === 'ios' && showDateModal !== null && (
                                        <View style={{ alignItems: 'flex-end', paddingRight: SPACING.md }}>
                                            <TouchableOpacity onPress={() => setShowDateModal(null)}>
                                                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Done</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )
                                }

                            </Animatable.View>
                            <View style={{ height: 150 }} />
                        </NestableScrollContainer>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    keyboardContainer: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.md,
    },
    backButton: {
        padding: SPACING.xs,
    },
    headerTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
    },
    headerSaveButton: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveHeaderText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    loadingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    content: {
        padding: SPACING.xl,
    },
    formSection: {
        marginBottom: SPACING.xl,
    },
    sectionHeading: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.lg,
        marginTop: SPACING.md,
    },
    label: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.xs,
        marginTop: SPACING.md,
    },
    required: {
        color: '#EF4444',
    },
    input: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    textArea: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: FONT_SIZE.md,
        minHeight: 120,
    },
    errorText: {
        color: '#EF4444',
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
    },
    hint: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
    },
    imagesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    imageWrapper: {
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },
    tripImage: {
        width: '100%',
        height: '100%',
    },
    removeImage: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#fff',
        borderRadius: 12,
        elevation: 2,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.md,
        marginBottom: SPACING.xs,
    },
    reorderToggle: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    thumbnailWrapper: {
        width: (width - SPACING.xl * 2 - SPACING.md * 2) / 3,
        height: (width - SPACING.xl * 2 - SPACING.md * 2) / 3,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: SPACING.md,
    },
    thumbnailImageContainer: {
        width: '100%',
        height: '100%',
    },
    reorderContainerVertical: {
        flexDirection: 'column',
    },
    reorderItemVertical: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.sm,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
        width: '100%',
        borderWidth: 1,
        borderColor: BRAND.primary + '30', // Semi-transparent primary
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
    reorderButtonsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    reorderBtnSmall: {
        padding: 8,
        borderRadius: 20,
        elevation: 2,
    },
    addImageButton: {
        width: (width - SPACING.xl * 2 - SPACING.md * 2) / 3,
        height: (width - SPACING.xl * 2 - SPACING.md * 2) / 3,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addImageText: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
        fontWeight: FONT_WEIGHT.medium,
    },
    dateRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    dateField: {
        flex: 1,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
    },
    dateText: {
        marginLeft: SPACING.sm,
        fontSize: FONT_SIZE.md,
    },
    durationText: {
        marginTop: SPACING.sm,
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
        textAlign: 'right',
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
    },
    chipText: {
        marginLeft: SPACING.xs,
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
    radioGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    radioItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.xs,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    radioText: {
        fontSize: FONT_SIZE.sm,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: SPACING.xl,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default EditTripScreen;
