import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Dimensions, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';

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

const GENDER_PREFERENCES = [
    { id: 'anyone', label: 'Anyone', icon: 'Users' },
    { id: 'male', label: 'Male Only', icon: 'User' },
    { id: 'female', label: 'Female Only', icon: 'User' },
];

const EditItineraryScreen = () => {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();
    
    const tripId = params.tripId as string;
    let initialData: any = null;
    if (typeof params.tripData === 'string') {
        try {
            initialData = JSON.parse(params.tripData);
        } catch (e) {}
    } else if (params.tripData) {
        initialData = params.tripData;
    }

    const [tripTitle, setTripTitle] = useState(initialData?.trip_title || initialData?.title || '');

    // Location & Dates
    const [fromLocation, setFromLocation] = useState(initialData?.from_location || initialData?.fromLocation || '');
    const [toLocation, setToLocation] = useState(initialData?.to_location || initialData?.toLocation || '');
    const [mapsLink, setMapsLink] = useState(initialData?.mapsLink || '');
    const [fromDate, setFromDate] = useState(initialData?.from_date ? new Date(initialData.from_date) : (initialData?.fromDate ? new Date(initialData.fromDate) : new Date()));
    const [toDate, setToDate] = useState(initialData?.to_date ? new Date(initialData.to_date) : (initialData?.toDate ? new Date(initialData.toDate) : new Date()));
    const [showDateModal, setShowDateModal] = useState<'from' | 'to' | null>(null);

    // Trip Details
    const [tripTypes, setTripTypes] = useState<string[]>(initialData?.tripTypes || (initialData?.tripType ? [initialData.tripType] : []));
    const [transportModes, setTransportModes] = useState<string[]>(initialData?.transportModes || (initialData?.transportMode ? [initialData.transportMode] : []));
    const [costPerPerson, setCostPerPerson] = useState(initialData?.costPerPerson ? String(initialData.costPerPerson) : (initialData?.cost ? String(initialData.cost) : ''));

    // Accommodation & Group
    const [accommodationType, setAccommodationType] = useState(initialData?.accommodationType || '');
    const [bookingStatus, setBookingStatus] = useState(initialData?.bookingStatus || '');
    const [accommodationDays, setAccommodationDays] = useState(initialData?.accommodationDays ? String(initialData.accommodationDays) : (initialData?.durationDays ? String(initialData.durationDays) : ''));

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
                    const { data: doc } = await supabase.from('itineraries').select('*').eq('id', tripId).maybeSingle();
                    if (doc) {
                        const data = doc;
                         if (data) {
                            setTripTitle(data.trip_title || data.title || '');

                            setFromLocation(data.from_location || data.fromLocation || '');
                            setToLocation(data.to_location || data.toLocation || '');
                            setMapsLink(data.mapsLink || '');
                            setFromDate(data.from_date ? new Date(data.from_date) : new Date());
                            setToDate(data.to_date ? new Date(data.to_date) : new Date());
                            setTripTypes(data.trip_types || (data.trip_type ? [data.trip_type] : []));
                            setTransportModes(data.transport_modes || (data.transport_mode ? [data.transport_mode] : []));
                            setCostPerPerson(data.cost_per_person ? String(data.cost_per_person) : (data.cost ? String(data.cost) : ''));
                            setAccommodationType(data.accommodation_type || '');
                            setBookingStatus(data.booking_status || '');
                            setAccommodationDays(data.accommodation_days ? String(data.accommodation_days) : '');
                            setMandatoryItems(Array.isArray(data.mandatory_items) ? data.mandatory_items.join(', ') : (data.mandatory_items || ''));
                            setPlacesToVisit(Array.isArray(data.places_to_visit) ? data.places_to_visit.join(', ') : (data.places_to_visit || ''));
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

        if (!tripTitle.trim()) newErrors.tripTitle = 'Trip title is required';
        if (!fromLocation.trim()) newErrors.fromLocation = 'Starting location is required';
        if (!toLocation.trim()) newErrors.toLocation = 'Destination is required';
        if (tripTypes.length === 0) newErrors.tripTypes = 'Select at least one trip type';
        if (transportModes.length === 0) newErrors.transportModes = 'Select at least one transport mode';
        if (!costPerPerson.trim()) newErrors.costPerPerson = 'Cost per person is required';
        if (!accommodationType) newErrors.accommodationType = 'Select accommodation type';

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

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) return;

        setIsPosting(true);

        try {
            const tripData = {
                trip_title: tripTitle,
                from_location: fromLocation,
                to_location: toLocation,
                from_date: fromDate.toISOString(),
                to_date: toDate.toISOString(),
                duration_days: Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)),
                trip_types: tripTypes,
                transport_modes: transportModes,
                cost_per_person: parseFloat(costPerPerson) || 0,
                accommodation_type: accommodationType,
                booking_status: bookingStatus || null,
                accommodation_days: accommodationDays ? parseInt(accommodationDays) : null,
                mandatory_items: mandatoryItems.split(',').map(item => item.trim()).filter(Boolean),
                places_to_visit: placesToVisit.split(',').map(place => place.trim()).filter(Boolean),
            };

            await supabase.from('itineraries').update(tripData).eq('id', tripId);

            setIsPosting(false);
            Alert.alert('Success! 🎉', 'Your itinerary has been updated!');
            router.back();
        } catch (error: any) {
            setIsPosting(false);
            Alert.alert('Error', `Failed to update trip: ${error?.message || 'Unknown error'}. Please try again.`);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Icon name="CaretLeft" size={24} color={colors.text} />
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
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
                >
                    {renderHeader()}

                    {fetching ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading trip details...</Text>
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <MotiView
                                from={{ opacity: 0, translateY: 20 }}
                                animate={{ opacity: 1, translateY: 0 }}
                                transition={{ type: 'timing', duration: 400 }}
                                style={styles.formSection}
                            >

                                {/* Section 1: Basic Info */}
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Basic Information</Text>

                                <Text style={[styles.label, { color: colors.text }]}>Trip Title <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.tripTitle ? '#EF4444' : colors.border }]}
                                    placeholder="e.g., Mystical Ladakh Adventure"
                                    placeholderTextColor={colors.textSecondary}
                                    value={tripTitle}
                                    onChangeText={setTripTitle}
                                />
                                {errors.tripTitle && <Text style={styles.errorText}>{errors.tripTitle}</Text>}

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
                                            <Icon name="Calendar" size={20} color={colors.primary} />
                                            <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(fromDate)}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.dateField}>
                                        <Text style={[styles.label, { color: colors.text }]}>To Date <Text style={styles.required}>*</Text></Text>
                                        <TouchableOpacity
                                            style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                            onPress={() => setShowDateModal('to')}
                                        >
                                            <Icon name="Calendar" size={20} color={colors.primary} />
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
                                            <Icon name={type.icon as any} size={18} color={tripTypes.includes(type.id) ? '#fff' : type.color} />
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
                                            <Icon name={mode.icon as any} size={18} color={transportModes.includes(mode.id) ? '#fff' : colors.primary} />
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
                                            <Icon name={type.icon as any} size={18} color={accommodationType === type.id ? '#fff' : '#10B981'} />
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

                                <View style={styles.divider} />

                                {/* Section 5: Description & details */}
                                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Description & details</Text>

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

                            </MotiView>
                            <View style={{ height: 150 }} />
                        </ScrollView>
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

export default EditItineraryScreen;
