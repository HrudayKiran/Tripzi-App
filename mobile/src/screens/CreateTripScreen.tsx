import React, { useState } from 'react';
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
import { useKycGate } from '../hooks/useKycGate';
import KycBlockingModal from '../components/KycBlockingModal';

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

const CreateTripScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const { isKycVerified, kycStatus, isLoading: isKycLoading } = useKycGate();
    const [showKycModal, setShowKycModal] = useState(false);
    const [step, setStep] = useState(1);
    const totalSteps = 5;

    // Step 1: Basic Info
    const [title, setTitle] = useState('');
    const [images, setImages] = useState<string[]>([]);

    // Step 2: Location & Dates
    const [fromLocation, setFromLocation] = useState('');
    const [toLocation, setToLocation] = useState('');
    const [mapsLink, setMapsLink] = useState('');
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
    const [showDateModal, setShowDateModal] = useState<'from' | 'to' | null>(null);

    // Step 3: Trip Details
    const [tripTypes, setTripTypes] = useState<string[]>([]);
    const [transportModes, setTransportModes] = useState<string[]>([]);
    const [costPerPerson, setCostPerPerson] = useState('');

    // Step 4: Accommodation & Group
    const [accommodationType, setAccommodationType] = useState('');
    const [bookingStatus, setBookingStatus] = useState('');
    const [accommodationDays, setAccommodationDays] = useState('');
    const [maxTravelers, setMaxTravelers] = useState('');
    const [genderPreference, setGenderPreference] = useState('anyone');

    // Step 5: Description
    const [description, setDescription] = useState('');
    const [mandatoryItems, setMandatoryItems] = useState('');
    const [placesToVisit, setPlacesToVisit] = useState('');

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

        // Check KYC status using the hook (already loaded)
        if (!isKycVerified && kycStatus !== 'loading') {
            setShowKycModal(true);
            return;
        }

        setIsPosting(true);

        try {
            // Upload images to Firebase Storage first
            let uploadedImageUrls: string[] = [];
            if (images.length > 0) {
                console.log('Uploading', images.length, 'images to Firebase Storage...');
                for (let i = 0; i < images.length; i++) {
                    const imageUri = images[i];
                    const filename = `trips/${currentUser.uid}/${Date.now()}_${i}.jpg`;
                    const reference = storage().ref(filename);

                    try {
                        await reference.putFile(imageUri);
                        const downloadUrl = await reference.getDownloadURL();
                        uploadedImageUrls.push(downloadUrl);
                        console.log(`Image ${i + 1} uploaded:`, downloadUrl.substring(0, 50) + '...');
                    } catch (uploadError) {
                        console.log('Image upload error:', uploadError);
                        // Continue with other images
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
                participants: [currentUser.uid],
                likes: [],
                createdAt: firestore.FieldValue.serverTimestamp(),
                location: toLocation,
                tripType: tripTypes[0] || 'Adventure',
                coverImage: finalImages[0],
            };

            // Create trip
            const tripRef = await firestore().collection('trips').add(tripData);
            console.log('Trip created with ID:', tripRef.id);

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

    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            {[1, 2, 3, 4, 5].map((s) => (
                <View key={s} style={styles.stepRow}>
                    <View style={[styles.stepDot, { backgroundColor: s <= step ? colors.primary : colors.border }]}>
                        {s < step ? (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                        ) : (
                            <Text style={[styles.stepNumber, { color: s <= step ? '#fff' : colors.textSecondary }]}>{s}</Text>
                        )}
                    </View>
                    {s < 5 && <View style={[styles.stepLine, { backgroundColor: s < step ? colors.primary : colors.border }]} />}
                </View>
            ))}
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerButton, { backgroundColor: colors.card }]}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Create Trip</Text>
                <View style={{ width: 40 }} />
            </View>

            {renderStepIndicator()}

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
            <View style={[styles.bottomActions, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                {step > 1 && (
                    <TouchableOpacity style={[styles.backButton, { borderColor: colors.primary }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={colors.primary} />
                        <Text style={[styles.backButtonText, { color: colors.primary }]}>Back</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.nextButton} onPress={step === totalSteps ? handlePostTrip : handleNext}>
                    <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.nextGradient}>
                        <Text style={styles.nextButtonText}>{step === totalSteps ? 'Post Trip 🚀' : 'Next'}</Text>
                        {step < totalSteps && <Ionicons name="arrow-forward" size={20} color="#fff" />}
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* KYC Blocking Modal */}
            <KycBlockingModal
                visible={showKycModal}
                onClose={() => setShowKycModal(false)}
                action="create a trip"
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg },
    stepRow: { flexDirection: 'row', alignItems: 'center' },
    stepDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    stepNumber: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    stepLine: { width: 30, height: 3, marginHorizontal: 4 },
    scrollView: { flex: 1 },
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
    bottomActions: { flexDirection: 'row', padding: SPACING.lg, gap: SPACING.md, borderTopWidth: 1 },
    backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 2, gap: SPACING.xs },
    backButtonText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    nextButton: { flex: 1 },
    nextGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, gap: SPACING.xs },
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
});

export default CreateTripScreen;
