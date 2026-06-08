import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useItineraryStore } from '../store/itineraryStore';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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
];



const TRIP_FLOW_TYPES = [
    { id: 'solo', label: 'Solo', icon: 'User' },
    { id: 'couple', label: 'Couple', icon: 'Heart' },
    { id: 'family', label: 'Family', icon: 'UsersThree' },
    { id: 'friends', label: 'Friends', icon: 'Users' },
    { id: 'business', label: 'Business', icon: 'Briefcase' },
];

const tripSchema = z.object({
    trip_title: z.string().min(1, 'Trip title is required'),
    fromLocation: z.string().min(1, 'Starting location is required'),
    toLocation: z.string().min(1, 'Destination is required'),
    fromDate: z.date({ message: 'Start date is required' }),
    toDate: z.date({ message: 'End date is required' }),
    tripTypes: z.array(z.string()).min(1, 'Select at least one trip activity type'),
    transportModes: z.array(z.string()).min(1, 'Select at least one transport mode'),
    costPerPerson: z.string().min(1, 'Cost per person is required'),
    accommodationType: z.string().min(1, 'Select accommodation type'),
    bookingStatus: z.string().optional(),
    accommodationDays: z.string().optional(),
    tripType: z.string().min(1, 'Select trip type'),
    placesToVisit: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.accommodationType && data.accommodationType !== 'none') {
        if (!data.bookingStatus || data.bookingStatus.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Booking status is required',
                path: ['bookingStatus'],
            });
        }
        if (!data.accommodationDays || data.accommodationDays.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Accommodation days is required',
                path: ['accommodationDays'],
            });
        }
    }
});

type TripFormData = z.infer<typeof tripSchema>;

const CreateItineraryScreen = () => {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { tripDraft, setTripDraft, clearDraft } = useItineraryStore();

    useEffect(() => {
        clearDraft();
    }, []);

    useEffect(() => {
        if (tripDraft) {
            if (tripDraft.fromDate) setValue('fromDate', new Date(tripDraft.fromDate));
            if (tripDraft.toDate) setValue('toDate', new Date(tripDraft.toDate));
        }
    }, [tripDraft?.fromDate, tripDraft?.toDate]);

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
    const totalSteps = 4;

    const { control, handleSubmit, formState: { errors: formErrors }, setValue, watch, trigger } = useForm<TripFormData>({
        resolver: zodResolver(tripSchema),
        defaultValues: {
            trip_title: initialData?.trip_title || initialData?.title || '',
            fromLocation: initialData?.fromLocation || '',
            toLocation: initialData?.toLocation || '',
            fromDate: initialData?.fromDate 
                ? (typeof initialData.fromDate === 'string' 
                    ? new Date(initialData.fromDate) 
                    : (initialData.fromDate.toDate && typeof initialData.fromDate.toDate === 'function' ? initialData.fromDate.toDate() : new Date(initialData.fromDate))) 
                : undefined,
            toDate: initialData?.toDate 
                ? (typeof initialData.toDate === 'string' 
                    ? new Date(initialData.toDate) 
                    : (initialData.toDate.toDate && typeof initialData.toDate.toDate === 'function' ? initialData.toDate.toDate() : new Date(initialData.toDate))) 
                : undefined,
            tripTypes: initialData?.tripTypes || [],
            transportModes: initialData?.transportModes || [],
            costPerPerson: initialData?.costPerPerson ? String(initialData.costPerPerson) : '',
            accommodationType: initialData?.accommodationType || '',
            bookingStatus: initialData?.bookingStatus || '',
            accommodationDays: initialData?.accommodationDays ? String(initialData.accommodationDays) : '',
            tripType: initialData?.tripType || '',
            placesToVisit: Array.isArray(initialData?.placesToVisit) ? initialData.placesToVisit.join(', ') : (initialData?.placesToVisit || ''),
        }
    });


    const [showDateModal, setShowDateModal] = useState<'from' | 'to' | null>(null);



    const formatDate = (date?: Date) => {
        if (!date) return 'Select Date';
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const handleFromDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDateModal(null);
        if (event.type === 'set' && selectedDate) {
            setValue('fromDate', selectedDate);
            const toDate = watch('toDate');
            if (toDate && selectedDate > toDate) {
                setValue('toDate', new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000));
            }
        }
    };

    const handleToDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDateModal(null);
        if (event.type === 'set' && selectedDate) {
            const fromDate = watch('fromDate');
            if (!fromDate || selectedDate >= fromDate) {
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

                        <ScrollView
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
                                                                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
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
                                                                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
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
                                        name="trip_title"
                                        render={({ field: { onChange, onBlur, value } }) => (
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: formErrors.trip_title ? '#EF4444' : colors.border }]}
                                                placeholder="e.g., Mystical Ladakh Adventure"
                                                placeholderTextColor={colors.textSecondary}
                                                onBlur={onBlur}
                                                onChangeText={onChange}
                                                value={value}
                                            />
                                        )}
                                    />
                                    {formErrors.trip_title && <Text style={styles.errorText}>{formErrors.trip_title.message}</Text>}
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

                                </MotiView>
                            )}

                            {/* Wizard Navigation Buttons */}
                            <View style={[styles.buttonRow, step === 1 ? { justifyContent: 'center' } : {}]}>
                                {step > 1 && (
                                    <TouchableOpacity
                                        style={[styles.stepButton, styles.neumorphicButton, { backgroundColor: isDarkMode ? '#000' : '#fff', width: '48%' }]}
                                        onPress={() => {
                                            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                                            Keyboard.dismiss();
                                            setTimeout(() => {
                                                setStep(s => s - 1);
                                            }, 50);
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
                                                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                                                Keyboard.dismiss();
                                                let fieldsToValidate: any[] = [];
                                                if (step === 1) fieldsToValidate = ['tripType'];
                                                if (step === 2) fieldsToValidate = ['title', 'fromLocation', 'toLocation', 'fromDate', 'toDate'];
                                                if (step === 3) fieldsToValidate = ['tripTypes', 'transportModes', 'costPerPerson'];

                                                const isValid = await trigger(fieldsToValidate);
                                                if (isValid) {
                                                    setTimeout(() => {
                                                        setStep(s => s + 1);
                                                    }, 50);
                                                }
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
                                            setTripDraft(data); // Persist draft
                                            router.push({
                                                pathname: '/trip/timeline',
                                                params: {
                                                    tripData: JSON.stringify(data),
                                                }
                                            });
                                        })}
                                    >
                                        <Text style={{ color: isDarkMode ? '#000' : '#fff', fontWeight: 'bold' }}>Create Itinerary</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={{ height: 120 }} />
                        </ScrollView>

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
    label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm, marginTop: SPACING.lg },
    required: { color: '#EF4444' },
    input: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, fontSize: FONT_SIZE.md },
    errorText: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
    dateRow: { flexDirection: 'row', gap: SPACING.md },
    dateField: { flex: 1 },
    dateButton: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.sm },
    dateText: { fontSize: FONT_SIZE.sm },
    durationText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginTop: SPACING.sm },
    radioGroup: { gap: SPACING.sm },
    radioItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    radioInner: { width: 12, height: 12, borderRadius: 6 },
    radioText: { fontSize: FONT_SIZE.sm },
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
    dateModalContent: { width: '85%', maxHeight: '70%', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg },
    dateModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    dateModalTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    neumorphicButton: {
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
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

export default CreateItineraryScreen;
