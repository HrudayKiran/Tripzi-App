import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Dimensions, Animated, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles';

const { width } = Dimensions.get('window');

type FilterModalProps = {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: FilterOptions) => void;
    currentFilters?: FilterOptions | null;
};

export type FilterOptions = {
    sortBy: string;
    maxCost: number;
    maxTravelers: number;
    minDays: number;
    destination: string;
    startingFrom?: string;
    tripTypes?: string[];
    transportModes?: string[];
    genderPreference?: string;
    accommodationType?: string;
    bookingStatus?: string;
    startDate?: string;
    endDate?: string;
    // Backward compat
    tripType?: string;
    transportMode?: string;
};

const SORT_OPTIONS = [
    { id: 'newest', label: 'Newest First', icon: 'time-outline', color: '#9d74f7' },
    { id: 'oldest', label: 'Oldest First', icon: 'hourglass-outline', color: '#6B7280' },
    { id: 'lowestCost', label: 'Budget (Low)', icon: 'wallet-outline', color: '#10B981' },
    { id: 'highestCost', label: 'Budget (High)', icon: 'trending-up-outline', color: '#F59E0B' },
];

const BUDGET_OPTIONS = [
    { id: 5000, label: '₹5K' },
    { id: 10000, label: '₹10K' },
    { id: 25000, label: '₹25K' },
    { id: 50000, label: '₹50K' },
    { id: 100000, label: '₹1L' },
];

const TRIP_TYPES = [
    { id: 'adventure', label: 'Adventure', icon: 'compass-outline' },
    { id: 'trekking', label: 'Trekking', icon: 'footsteps-outline' },
    { id: 'bike_ride', label: 'Bike Ride', icon: 'bicycle-outline' },
    { id: 'road_trip', label: 'Road Trip', icon: 'car-outline' },
    { id: 'camping', label: 'Camping', icon: 'bonfire-outline' },
    { id: 'sightseeing', label: 'Sightseeing', icon: 'camera-outline' },
    { id: 'beach', label: 'Beach', icon: 'water-outline' },
    { id: 'pilgrimage', label: 'Pilgrimage', icon: 'rose-outline' },
];

const TRANSPORT_MODES = [
    { id: 'train', label: 'Train', icon: 'train-outline' },
    { id: 'bus', label: 'Bus', icon: 'bus-outline' },
    { id: 'car', label: 'Car', icon: 'car-sport-outline' },
    { id: 'flight', label: 'Flight', icon: 'airplane-outline' },
    { id: 'bike', label: 'Bike', icon: 'bicycle-outline' },
];

const GENDER_PREFERENCES = [
    { id: 'anyone', label: 'Anyone', icon: 'people-outline' },
    { id: 'male', label: 'Male Only', icon: 'man-outline' },
    { id: 'female', label: 'Female Only', icon: 'woman-outline' },
];

const ACCOMMODATION_TYPES = [
    { id: 'hotel', label: 'Hotel', icon: 'bed-outline' },
    { id: 'hostel', label: 'Hostel', icon: 'business-outline' },
    { id: 'homestay', label: 'Homestay', icon: 'home-outline' },
    { id: 'camping', label: 'Camping', icon: 'bonfire-outline' },
    { id: 'resort', label: 'Resort', icon: 'sunny-outline' },
    { id: 'none', label: 'Not Needed', icon: 'close-circle-outline' },
];

const BOOKING_STATUSES = [
    { id: 'booked', label: 'Booked', icon: 'checkmark-circle-outline', color: '#10B981' },
    { id: 'to_book', label: 'To Book', icon: 'time-outline', color: '#F59E0B' },
    { id: 'not_needed', label: 'Not Needed', icon: 'close-circle-outline', color: '#6B7280' },
];

const FilterModal = ({ visible, onClose, onApply, currentFilters }: FilterModalProps) => {
    const { colors } = useTheme();
    const [sortBy, setSortBy] = useState('newest');
    const [destination, setDestination] = useState('');
    const [startingFrom, setStartingFrom] = useState('');
    const [maxCost, setMaxCost] = useState<number | undefined>(undefined);
    const [customBudget, setCustomBudget] = useState('');
    const [groupSize, setGroupSize] = useState('');
    const [tripTypes, setTripTypes] = useState<string[]>([]);
    const [transportModes, setTransportModes] = useState<string[]>([]);
    const [genderPreference, setGenderPreference] = useState<string | undefined>(undefined);
    const [accommodationType, setAccommodationType] = useState<string | undefined>(undefined);
    const [bookingStatus, setBookingStatus] = useState<string | undefined>(undefined);
    const [startDateObj, setStartDateObj] = useState<Date | null>(null);
    const [endDateObj, setEndDateObj] = useState<Date | null>(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const slideAnim = useRef(new Animated.Value(width)).current;

    // Reset internal state when modal opens or when currentFilters changes to null (clear)
    useEffect(() => {
        if (visible) {
            if (!currentFilters) {
                // All filters cleared externally — reset everything
                handleReset();
            } else {
                // Restore from current filters
                setSortBy(currentFilters.sortBy || 'newest');
                setDestination(currentFilters.destination || '');
                setStartingFrom(currentFilters.startingFrom || '');
                setMaxCost(currentFilters.maxCost);
                setGroupSize(currentFilters.maxTravelers && currentFilters.maxTravelers < 50 ? currentFilters.maxTravelers.toString() : '');
                setTripTypes(currentFilters.tripTypes || []);
                setTransportModes(currentFilters.transportModes || []);
                setGenderPreference(currentFilters.genderPreference);
                setAccommodationType(currentFilters.accommodationType);
                setBookingStatus(currentFilters.bookingStatus);
                setStartDateObj(currentFilters.startDate ? new Date(currentFilters.startDate) : null);
                setEndDateObj(currentFilters.endDate ? new Date(currentFilters.endDate) : null);
            }

            slideAnim.setValue(width);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                speed: 14,
                bounciness: 0,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: width,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const toggleMultiSelect = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, id: string) => {
        setArr(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
    };

    const handleReset = () => {
        setSortBy('newest');
        setDestination('');
        setStartingFrom('');
        setMaxCost(undefined);
        setCustomBudget('');
        setGroupSize('');
        setTripTypes([]);
        setTransportModes([]);
        setGenderPreference(undefined);
        setAccommodationType(undefined);
        setBookingStatus(undefined);
        setStartDateObj(null);
        setEndDateObj(null);

        onApply({
            sortBy: 'newest',
            maxCost: undefined,
            maxTravelers: 50,
            minDays: 1,
            destination: '',
            startingFrom: '',
            tripTypes: undefined,
            transportModes: undefined,
            genderPreference: undefined,
            accommodationType: undefined,
            bookingStatus: undefined,
            startDate: undefined,
            endDate: undefined,
        });
        onClose();
    };

    const handleApply = () => {
        const finalBudget = customBudget ? parseInt(customBudget) : maxCost;
        const finalGroupSize = groupSize ? parseInt(groupSize) : 50;

        onApply({
            sortBy,
            maxCost: finalBudget,
            maxTravelers: isNaN(finalGroupSize) ? 50 : finalGroupSize,
            minDays: 1,
            destination,
            startingFrom,
            tripTypes: tripTypes.length > 0 ? tripTypes : undefined,
            transportModes: transportModes.length > 0 ? transportModes : undefined,
            genderPreference,
            accommodationType,
            bookingStatus,
            startDate: startDateObj ? startDateObj.toISOString() : undefined,
            endDate: endDateObj ? endDateObj.toISOString() : undefined,
            tripType: tripTypes.length === 1 ? tripTypes[0] : tripTypes.length > 0 ? tripTypes[0] : undefined,
            transportMode: transportModes.length === 1 ? transportModes[0] : transportModes.length > 0 ? transportModes[0] : undefined,
        });
        onClose();
    };

    const formatPickedDate = (date: Date | null) => {
        if (!date) return 'Select';
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const onStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowStartPicker(false);
        if (event.type === 'set' && selectedDate) {
            setStartDateObj(selectedDate);
        }
    };

    const onEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowEndPicker(false);
        if (event.type === 'set' && selectedDate) {
            setEndDateObj(selectedDate);
        }
    };

    // Count active filters
    const activeCount = [
        sortBy !== 'newest',
        destination !== '',
        startingFrom !== '',
        maxCost !== undefined || customBudget !== '',
        groupSize !== '' && parseInt(groupSize) < 50,
        tripTypes.length > 0,
        transportModes.length > 0,
        genderPreference !== undefined && genderPreference !== 'anyone',
        accommodationType !== undefined,
        bookingStatus !== undefined,
        startDateObj !== null,
        endDateObj !== null,
    ].filter(Boolean).length;

    return (
        <Modal visible={visible} transparent={true} onRequestClose={onClose} animationType="none">
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <Animated.View
                    style={[
                        styles.modalContainer,
                        { backgroundColor: colors.background },
                        { transform: [{ translateX: slideAnim }] }
                    ]}
                >
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
                    >
                        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                            {/* Header */}
                            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                                <View style={styles.headerLeft}>
                                    <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
                                        <Ionicons name="options" size={20} color={colors.primary} />
                                    </View>
                                    <Text style={[styles.title, { color: colors.text }]}>Filters</Text>
                                    {activeCount > 0 && (
                                        <View style={[styles.filterCountBadge, { backgroundColor: colors.primary }]}>
                                            <Text style={styles.filterCountText}>{activeCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={styles.closeButton}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                {/* Sort By */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="swap-vertical" size={20} color={colors.primary} />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sort By</Text>
                                    </View>
                                    <View style={styles.sortGrid}>
                                        {SORT_OPTIONS.map((option) => (
                                            <TouchableOpacity
                                                key={option.id}
                                                style={[
                                                    styles.sortOption,
                                                    {
                                                        backgroundColor: sortBy === option.id ? option.color : colors.card,
                                                        borderColor: sortBy === option.id ? option.color : colors.border,
                                                    }
                                                ]}
                                                onPress={() => setSortBy(option.id)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name={option.icon as any} size={18} color={sortBy === option.id ? '#fff' : option.color} />
                                                <Text style={[styles.sortOptionText, { color: sortBy === option.id ? '#fff' : colors.text }]}>
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Destination */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="location-outline" size={20} color="#EF4444" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Destination</Text>
                                    </View>
                                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                        <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="Search destination..."
                                            placeholderTextColor={colors.textSecondary}
                                            value={destination}
                                            onChangeText={setDestination}
                                        />
                                        {destination !== '' && (
                                            <TouchableOpacity onPress={() => setDestination('')}>
                                                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Starting From */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="navigate-outline" size={20} color="#6366F1" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Starting From</Text>
                                    </View>
                                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                        <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="Origin city..."
                                            placeholderTextColor={colors.textSecondary}
                                            value={startingFrom}
                                            onChangeText={setStartingFrom}
                                        />
                                        {startingFrom !== '' && (
                                            <TouchableOpacity onPress={() => setStartingFrom('')}>
                                                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Max Budget */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="wallet-outline" size={20} color="#10B981" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Max Budget</Text>
                                    </View>
                                    <View style={styles.optionsRow}>
                                        {BUDGET_OPTIONS.map((option) => (
                                            <TouchableOpacity
                                                key={option.id}
                                                style={[
                                                    styles.optionChip,
                                                    {
                                                        backgroundColor: maxCost === option.id && !customBudget ? '#10B981' : colors.card,
                                                        borderColor: maxCost === option.id && !customBudget ? '#10B981' : colors.border,
                                                    }
                                                ]}
                                                onPress={() => { setMaxCost(option.id); setCustomBudget(''); }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[styles.optionChipText, { color: maxCost === option.id && !customBudget ? '#fff' : colors.text }]}>
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, marginTop: SPACING.sm }]}>
                                        <Text style={{ color: colors.textSecondary }}>₹</Text>
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="Custom amount..."
                                            placeholderTextColor={colors.textSecondary}
                                            keyboardType="numeric"
                                            value={customBudget}
                                            onChangeText={(text) => {
                                                setCustomBudget(text);
                                                if (text) setMaxCost(0);
                                            }}
                                        />
                                    </View>
                                </View>

                                {/* Group Size */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="people-outline" size={20} color="#F59E0B" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Group Size (max)</Text>
                                    </View>
                                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                        <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="Enter max travelers..."
                                            placeholderTextColor={colors.textSecondary}
                                            keyboardType="numeric"
                                            value={groupSize}
                                            onChangeText={setGroupSize}
                                            maxLength={3}
                                        />
                                        {groupSize !== '' && (
                                            <TouchableOpacity onPress={() => setGroupSize('')}>
                                                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Date Range — Calendar Picker */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="calendar-outline" size={20} color="#EC4899" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Date Range</Text>
                                    </View>
                                    <View style={styles.dateRow}>
                                        <TouchableOpacity
                                            style={[styles.datePickerBtn, { backgroundColor: colors.inputBackground, borderColor: startDateObj ? '#EC4899' : colors.border }]}
                                            onPress={() => setShowStartPicker(true)}
                                        >
                                            <Ionicons name="calendar-outline" size={16} color={startDateObj ? '#EC4899' : colors.textSecondary} />
                                            <Text style={[styles.datePickerText, { color: startDateObj ? colors.text : colors.textSecondary }]}>
                                                {formatPickedDate(startDateObj) || 'Start Date'}
                                            </Text>
                                        </TouchableOpacity>
                                        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>→</Text>
                                        <TouchableOpacity
                                            style={[styles.datePickerBtn, { backgroundColor: colors.inputBackground, borderColor: endDateObj ? '#EC4899' : colors.border }]}
                                            onPress={() => setShowEndPicker(true)}
                                        >
                                            <Ionicons name="calendar-outline" size={16} color={endDateObj ? '#EC4899' : colors.textSecondary} />
                                            <Text style={[styles.datePickerText, { color: endDateObj ? colors.text : colors.textSecondary }]}>
                                                {formatPickedDate(endDateObj) || 'End Date'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    {(startDateObj || endDateObj) && (
                                        <TouchableOpacity
                                            style={{ marginTop: SPACING.xs, alignSelf: 'flex-end' }}
                                            onPress={() => { setStartDateObj(null); setEndDateObj(null); }}
                                        >
                                            <Text style={{ color: '#EC4899', fontSize: FONT_SIZE.xs }}>Clear dates</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Trip Type — Multi-select */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="compass-outline" size={20} color={colors.primary} />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Trip Type</Text>
                                        {tripTypes.length > 0 && (
                                            <Text style={[styles.selectionCount, { color: colors.primary }]}>{tripTypes.length} selected</Text>
                                        )}
                                    </View>
                                    <View style={styles.optionsRow}>
                                        {TRIP_TYPES.map((option) => {
                                            const selected = tripTypes.includes(option.id);
                                            return (
                                                <TouchableOpacity
                                                    key={option.id}
                                                    style={[styles.optionChip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
                                                    onPress={() => toggleMultiSelect(tripTypes, setTripTypes, option.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name={option.icon as any} size={16} color={selected ? '#fff' : colors.text} style={{ marginRight: 4 }} />
                                                    <Text style={[styles.optionChipText, { color: selected ? '#fff' : colors.text }]}>{option.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Transport Mode — Multi-select */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="train-outline" size={20} color="#9d74f7" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Transport Mode</Text>
                                        {transportModes.length > 0 && (
                                            <Text style={[styles.selectionCount, { color: '#9d74f7' }]}>{transportModes.length} selected</Text>
                                        )}
                                    </View>
                                    <View style={styles.optionsRow}>
                                        {TRANSPORT_MODES.map((option) => {
                                            const selected = transportModes.includes(option.id);
                                            return (
                                                <TouchableOpacity
                                                    key={option.id}
                                                    style={[styles.optionChip, { backgroundColor: selected ? '#9d74f7' : colors.card, borderColor: selected ? '#9d74f7' : colors.border }]}
                                                    onPress={() => toggleMultiSelect(transportModes, setTransportModes, option.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name={option.icon as any} size={16} color={selected ? '#fff' : colors.text} style={{ marginRight: 4 }} />
                                                    <Text style={[styles.optionChipText, { color: selected ? '#fff' : colors.text }]}>{option.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Accommodation Type */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="bed-outline" size={20} color="#0EA5E9" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Accommodation</Text>
                                    </View>
                                    <View style={styles.optionsRow}>
                                        {ACCOMMODATION_TYPES.map((option) => {
                                            const selected = accommodationType === option.id;
                                            return (
                                                <TouchableOpacity
                                                    key={option.id}
                                                    style={[styles.optionChip, { backgroundColor: selected ? '#0EA5E9' : colors.card, borderColor: selected ? '#0EA5E9' : colors.border }]}
                                                    onPress={() => setAccommodationType(selected ? undefined : option.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name={option.icon as any} size={16} color={selected ? '#fff' : colors.text} style={{ marginRight: 4 }} />
                                                    <Text style={[styles.optionChipText, { color: selected ? '#fff' : colors.text }]}>{option.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Booking Status */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="bookmark-outline" size={20} color="#F59E0B" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Booking Status</Text>
                                    </View>
                                    <View style={styles.optionsRow}>
                                        {BOOKING_STATUSES.map((option) => {
                                            const selected = bookingStatus === option.id;
                                            return (
                                                <TouchableOpacity
                                                    key={option.id}
                                                    style={[styles.optionChip, { backgroundColor: selected ? option.color : colors.card, borderColor: selected ? option.color : colors.border }]}
                                                    onPress={() => setBookingStatus(selected ? undefined : option.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name={option.icon as any} size={16} color={selected ? '#fff' : colors.text} style={{ marginRight: 4 }} />
                                                    <Text style={[styles.optionChipText, { color: selected ? '#fff' : colors.text }]}>{option.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Gender Preference */}
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="people-circle-outline" size={20} color="#EF4444" />
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Who can join?</Text>
                                    </View>
                                    <View style={styles.optionsRow}>
                                        {GENDER_PREFERENCES.map((option) => (
                                            <TouchableOpacity
                                                key={option.id}
                                                style={[styles.optionChip, { backgroundColor: genderPreference === option.id ? '#EF4444' : colors.card, borderColor: genderPreference === option.id ? '#EF4444' : colors.border }]}
                                                onPress={() => setGenderPreference(genderPreference === option.id ? undefined : option.id)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name={option.icon as any} size={16} color={genderPreference === option.id ? '#fff' : colors.text} style={{ marginRight: 4 }} />
                                                <Text style={[styles.optionChipText, { color: genderPreference === option.id ? '#fff' : colors.text }]}>{option.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={{ height: SPACING.xxl }} />
                            </ScrollView>

                            {/* Buttons */}
                            <View style={[styles.buttonContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                                <TouchableOpacity style={[styles.resetButton, { borderColor: colors.border }]} onPress={handleReset} activeOpacity={0.7}>
                                    <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                                    <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Reset</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.applyButton, { backgroundColor: colors.primary }]} onPress={handleApply} activeOpacity={0.8}>
                                    <Ionicons name="checkmark" size={18} color="#fff" />
                                    <Text style={styles.applyButtonText}>Apply Filters</Text>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </KeyboardAvoidingView>

                    {/* Date picker modals */}
                    {showStartPicker && (
                        <DateTimePicker
                            value={startDateObj || new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                            onChange={onStartDateChange}
                            minimumDate={new Date()}
                        />
                    )}
                    {showEndPicker && (
                        <DateTimePicker
                            value={endDateObj || startDateObj || new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                            onChange={onEndDateChange}
                            minimumDate={startDateObj || new Date()}
                        />
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    modalContainer: { flex: 1, width: '100%', height: '100%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderBottomWidth: 1 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    headerIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    filterCountBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    filterCountText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    closeButton: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
    section: { marginBottom: SPACING.xxl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
    sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, flex: 1 },
    selectionCount: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
    sortGrid: { gap: SPACING.sm },
    sortOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.sm },
    sortOptionText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    optionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    optionChipText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.sm },
    input: { flex: 1, fontSize: FONT_SIZE.sm, paddingVertical: SPACING.xs },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    datePickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md + 2, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    datePickerText: { fontSize: FONT_SIZE.sm },
    buttonContainer: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderTopWidth: 1 },
    resetButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.sm },
    resetButtonText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
    applyButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, gap: SPACING.sm },
    applyButtonText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
});

export default FilterModal;
