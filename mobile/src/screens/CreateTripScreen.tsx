import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions, Image, Platform, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';


const { width } = Dimensions.get('window');

const TRIP_TYPES = [
    { id: 'adventure', label: 'Adventure', icon: 'compass', color: '#F59E0B' },
    { id: 'trekking', label: 'Trekking', icon: 'walk', color: '#10B981' },
    { id: 'bike_ride', label: 'Bike Ride', icon: 'bicycle', color: '#EF4444' },
    { id: 'road_trip', label: 'Road Trip', icon: 'car-sport', color: '#8B5CF6' },
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

const CreateTripScreen = ({ navigation, route }: any) => {
    const { colors } = useTheme();
    const initialData = route.params?.initialTripData;

    const [step, setStep] = useState(1);
    const totalSteps = 5;

    // Step 1: Basic Info
    const [title, setTitle] = useState(initialData?.title || '');
    // Initialize images from AI data if available (passed as 'images' array of URLs)
    const [images, setImages] = useState<string[]>(initialData?.images || []);
    const [imageLocations, setImageLocations] = useState<string[]>([]); // To store specific place names

    // ... (existing code) ...


    // Step 2: Location & Dates
    const [fromLocation, setFromLocation] = useState(initialData?.fromLocation || '');
    const [toLocation, setToLocation] = useState(initialData?.toLocation || '');
    const [mapsLink, setMapsLink] = useState(initialData?.mapsLink || '');
    const [fromDate, setFromDate] = useState(initialData?.fromDate?.toDate ? initialData.fromDate.toDate() : new Date());
    const [toDate, setToDate] = useState(initialData?.toDate?.toDate ? initialData.toDate.toDate() : new Date(Date.now() + (initialData?.durationDays || 3) * 24 * 60 * 60 * 1000));
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
    const [genderPreference, setGenderPreference] = useState(initialData?.genderPreference || 'anyone');

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
            allowsMultipleSelection: true,
            quality: 0.7,
            selectionLimit: 5,
        });

        if (!result.canceled) {
            const newImages = result.assets.map(asset => asset.uri);
            setImages(prev => [...prev, ...newImages].slice(0, 5));
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setImageLocations(prev => prev.filter((_, i) => i !== index));
    };

    const toggleSelection = (id: string, list: string[], setList: (val: string[]) => void) => {
        if (list.includes(id)) {
            setList(list.filter(item => item !== id));
        } else {
            setList([...list, id]);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getDuration = () => {
        const diff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? `${diff} day${diff > 1 ? 's' : ''}` : '1 day';
    };

    const validateStep = (currentStep: number) => {
        const newErrors: { [key: string]: string } = {};

        switch (currentStep) {
            case 1:
                if (!title.trim()) newErrors.title = 'Trip title is required';
                break;
            case 2:
                if (!fromLocation.trim()) newErrors.fromLocation = 'Starting location is required';
                if (!toLocation.trim()) newErrors.toLocation = 'Destination is required';
                break;
            case 3:
                if (tripTypes.length === 0) newErrors.tripTypes = 'Select at least one trip type';
                if (transportModes.length === 0) newErrors.transportModes = 'Select at least one transport mode';
                if (!costPerPerson.trim()) newErrors.costPerPerson = 'Cost per person is required';
                break;
            case 4:
                if (!accommodationType) newErrors.accommodationType = 'Select accommodation type';
                if (!maxTravelers.trim()) newErrors.maxTravelers = 'Max travelers is required';
                break;
            case 5:
                if (!description.trim()) newErrors.description = 'Trip description is required';
                break;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(step)) {
            setStep(step + 1);
        }
    };

    const handleBack = () => setStep(step - 1);

    const generateMapsLink = (destination: string) => {
        const encoded = encodeURIComponent(destination);
        return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    };

    const handlePostTrip = async () => {
        if (!validateStep(step)) return;

        const currentUser = auth().currentUser;
        if (!currentUser) {
            Alert.alert('Error', 'You need to be logged in to create a trip.');
            navigation.navigate('Start');
            return;
        }

        setIsPosting(true);

        try {
            const currentUserDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const currentUserData = currentUserDoc.data() || {};

            // Upload images to Firebase Storage first
            let uploadedImageUrls: string[] = [];
            if (images.length > 0) {
                for (let i = 0; i < images.length; i++) {
                    const imageUri = images[i];

                    // Check if it's already a remote URL (e.g. from AI)
                    if (imageUri.startsWith('http') || imageUri.startsWith('https')) {
                        uploadedImageUrls.push(imageUri);
                        continue;
                    }

                    const filename = `trips/${currentUser.uid}/${Date.now()}_${i}.jpg`;
                    const reference = storage().ref(filename);

                    try {
                        await reference.putFile(imageUri, { contentType: 'image/jpeg' });
                        const downloadUrl = await reference.getDownloadURL();
                        uploadedImageUrls.push(downloadUrl);
                    } catch (uploadError) {

                    }
                }
            }

            // Use uploaded URLs or fallback image
            const finalImages = uploadedImageUrls.length > 0
                ? uploadedImageUrls
                : ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'];

            const tripData = {
                title,
                images: finalImages,
                imageLocations: imageLocations.slice(0, finalImages.length), // Save specific place names
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
                ownerDisplayName: currentUserData.displayName || currentUser.displayName || 'Traveler',
                ownerPhotoURL: currentUserData.photoURL || currentUser.photoURL || null,
                ownerUsername: currentUserData.username || null,
                participants: [currentUser.uid],
                likes: [],
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
            setIsPosting(false);
            Alert.alert('Error', `Failed to post trip: ${error?.message || 'Unknown error'}. Please try again.`);
        }
    };

    const progress = step / totalSteps;

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => step > 1 ? handleBack() : navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                    <LinearGradient
                        colors={[colors.primary, '#A78BFA']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]}
                    />
                </View>
                <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                    Step {step} of {totalSteps}
                </Text>
            </View>
        </View>
    );

    const renderEmpty = () => null;

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient
                colors={[colors.background, colors.card]}
                style={StyleSheet.absoluteFill}
            />
            <SafeAreaView style={styles.container}>
                {renderHeader()}

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Step 1: Basic Info */}
                    {step === 1 && (
                        <Animatable.View animation="fadeInRight" style={styles.stepContent}>
                            <Text style={[styles.stepTitle, { color: colors.text }]}>Let's Start! 🚀</Text>
                            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Give your trip an exciting title</Text>

                            <Text style={[styles.label, { color: colors.text }]}>Trip Title <Text style={styles.required}>*</Text></Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.title ? '#EF4444' : colors.border }]}
                                placeholder="e.g., Mystical Ladakh Adventure"
                                placeholderTextColor={colors.textSecondary}
                                value={title}
                                onChangeText={setTitle}
                            />
                            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

                            <Text style={[styles.label, { color: colors.text }]}>Trip Images (Optional - Max 5)</Text>
                            <View style={styles.imagesContainer}>
                                {images.map((uri, index) => (
                                    <View key={index} style={styles.imageWrapper}>
                                        <Image source={{ uri }} style={styles.tripImage} />
                                        <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(index)}>
                                            <Ionicons name="close-circle" size={24} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {images.length < 5 && (
                                    <TouchableOpacity style={[styles.addImageButton, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={pickImages}>
                                        <Ionicons name="add" size={32} color={colors.primary} />
                                        <Text style={[styles.addImageText, { color: colors.textSecondary }]}>Add</Text>
                                    </TouchableOpacity>
                                )}
                            </View>




                        </Animatable.View>
                    )}

                    {/* Step 2: Location & Dates */}
                    {step === 2 && (
                        <Animatable.View animation="fadeInRight" style={styles.stepContent}>
                            <Text style={[styles.stepTitle, { color: colors.text }]}>Where & When? 📍</Text>
                            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Set your journey details</Text>

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
                        </Animatable.View>
                    )}

                    {/* Date Selection Modal */}
                    <Modal visible={showDateModal !== null} transparent animationType="fade">
                        <View style={styles.dateModalOverlay}>
                            <View style={[styles.dateModalContent, { backgroundColor: colors.background }]}>
                                <View style={styles.dateModalHeader}>
                                    <Text style={[styles.dateModalTitle, { color: colors.text }]}>
                                        Select {showDateModal === 'from' ? 'Start' : 'End'} Date
                                    </Text>
                                    <TouchableOpacity onPress={() => setShowDateModal(null)}>
                                        <Ionicons name="close" size={24} color={colors.text} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.dateList} showsVerticalScrollIndicator={false}>
                                    {Array.from({ length: 60 }, (_, i) => {
                                        const date = new Date();
                                        date.setDate(date.getDate() + i);
                                        const isSelected = showDateModal === 'from'
                                            ? date.toDateString() === fromDate.toDateString()
                                            : date.toDateString() === toDate.toDateString();
                                        const isDisabled = showDateModal === 'to' && date.getTime() < fromDate.getTime();

                                        return (
                                            <TouchableOpacity
                                                key={i}
                                                style={[
                                                    styles.dateOption,
                                                    { backgroundColor: isSelected ? colors.primary : colors.card },
                                                    isDisabled && { opacity: 0.5 }
                                                ]}
                                                onPress={() => {
                                                    if (isDisabled) return;
                                                    if (showDateModal === 'from') {
                                                        setFromDate(date);
                                                        if (date.getTime() > toDate.getTime()) setToDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
                                                    } else {
                                                        setToDate(date);
                                                    }
                                                    setShowDateModal(null);
                                                }}
                                                disabled={isDisabled}
                                            >
                                                <Text style={[
                                                    styles.dateOptionDay,
                                                    { color: isSelected ? '#fff' : colors.text }
                                                ]}>
                                                    {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                                                </Text>
                                                <Text style={[
                                                    styles.dateOptionDate,
                                                    { color: isSelected ? '#fff' : colors.text }
                                                ]}>
                                                    {date.getDate()}
                                                </Text>
                                                <Text style={[
                                                    styles.dateOptionMonth,
                                                    { color: isSelected ? '#fff' : colors.textSecondary }
                                                ]}>
                                                    {date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>

                    {/* Step 3: Trip Details */}
                    {step === 3 && (
                        <Animatable.View animation="fadeInRight" style={styles.stepContent}>
                            <Text style={[styles.stepTitle, { color: colors.text }]}>Trip Style 🎯</Text>
                            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>What kind of adventure is this?</Text>

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
                        </Animatable.View>
                    )}

                    {/* Step 4: Accommodation & Group */}
                    {step === 4 && (
                        <Animatable.View animation="fadeInRight" style={styles.stepContent}>
                            <Text style={[styles.stepTitle, { color: colors.text }]}>Stay & Group 🏕️</Text>
                            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Where will you stay and who can join?</Text>

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
                                        style={[styles.chip, { backgroundColor: genderPreference === pref.id ? '#8B5CF6' : colors.card, borderColor: '#8B5CF6' }]}
                                        onPress={() => setGenderPreference(pref.id)}
                                    >
                                        <Ionicons name={pref.icon as any} size={18} color={genderPreference === pref.id ? '#fff' : '#8B5CF6'} />
                                        <Text style={[styles.chipText, { color: genderPreference === pref.id ? '#fff' : colors.text }]}>{pref.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>


                        </Animatable.View>
                    )}

                    {/* Step 5: Description */}
                    {step === 5 && (
                        <Animatable.View animation="fadeInRight" style={styles.stepContent}>
                            <Text style={[styles.stepTitle, { color: colors.text }]}>Final Details ✨</Text>
                            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Help travelers know more about this trip</Text>

                            <Text style={[styles.label, { color: colors.text }]}>Trip Description <Text style={styles.required}>*</Text></Text>
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
                    )}

                    <View style={{ height: 120 }} />
                </ScrollView>

                {/* Bottom Actions */}
                <View style={styles.footer}>
                    {step > 1 && (
                        <TouchableOpacity
                            style={[styles.navButton, { borderColor: colors.border, borderWidth: 1 }]}
                            onPress={() => setStep(step - 1)}
                        >
                            <Text style={[styles.navButtonText, { color: colors.text }]}>Back</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.navButton, styles.nextButton]}
                        onPress={step === totalSteps ? handlePostTrip : handleNext}
                        disabled={isPosting}
                    >
                        <LinearGradient
                            colors={[colors.primary, '#7C3AED']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientButton}
                        >
                            {isPosting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.nextButtonText}>
                                        {step === totalSteps ? 'Post Trip' : 'Next'}
                                    </Text>
                                    {step < totalSteps && <Ionicons name="arrow-forward" size={20} color="#fff" />}
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

        </View>
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
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: SPACING.lg,
        backgroundColor: 'transparent',
        gap: SPACING.md,
    },
    navButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.xl,
        gap: SPACING.sm,
        // elevation: 2,
    },
    navButtonText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    nextButton: {
        paddingVertical: 0, // Reset for gradient container
        overflow: 'hidden',
        borderWidth: 0,
        elevation: 5,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    gradientButton: {
        flex: 1,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
    },
    nextButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
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
    toggleButtonActive: { backgroundColor: '#8B5CF6' },
    toggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', elevation: 2 },
    toggleCircleActive: { alignSelf: 'flex-end' },
});

export default CreateTripScreen;
