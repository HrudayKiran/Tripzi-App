import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const { width, height } = Dimensions.get('window');

type FilterModalProps = {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: FilterOptions) => void;
};

export type FilterOptions = {
    sortBy: string;
    maxCost: number;
    maxTravelers: number;
    minDays: number;
    destination: string;
    tripType?: string;
    transportMode?: string;
    genderPreference?: string;
};

const SORT_OPTIONS = [
    { id: 'newest', label: 'Newest First', icon: 'time-outline', color: '#9d74f7' },
    { id: 'oldest', label: 'Oldest First', icon: 'hourglass-outline', color: '#6B7280' },
    { id: 'budget', label: 'Budget (Low to High)', icon: 'wallet-outline', color: '#10B981' },
    { id: 'popular', label: 'Most Popular', icon: 'flame-outline', color: '#F59E0B' },
];

const BUDGET_OPTIONS = [
    { id: 10000, label: '₹10K', color: '#10B981' },
    { id: 25000, label: '₹25K', color: '#10B981' },
    { id: 50000, label: '₹50K', color: '#10B981' },
    { id: 100000, label: '₹1L', color: '#10B981' },
    { id: 500000, label: '₹5L+', color: '#10B981' },
];

const TRAVELERS_OPTIONS = [
    { id: 20, label: '10-20' },
    { id: 50, label: '20+' },
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

const FilterModal = ({ visible, onClose, onApply }: FilterModalProps) => {
    const { colors } = useTheme();
    const [sortBy, setSortBy] = useState('newest');
    const [destination, setDestination] = useState('');
    const [maxCost, setMaxCost] = useState(500000);
    const [maxTravelers, setMaxTravelers] = useState(50);
    const [tripType, setTripType] = useState<string | undefined>(undefined);
    const [transportMode, setTransportMode] = useState<string | undefined>(undefined);
    const [genderPreference, setGenderPreference] = useState<string | undefined>(undefined);
    const slideAnim = useRef(new Animated.Value(width)).current;

    useEffect(() => {
        if (visible) {
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

    const handleReset = () => {
        setSortBy('newest');
        setDestination('');
        setMaxCost(500000);
        setMaxTravelers(50);
        setTripType(undefined);
        setTransportMode(undefined);
        setGenderPreference(undefined);
    };

    const handleApply = () => {
        onApply({
            sortBy,
            maxCost,
            maxTravelers,
            minDays: 1,
            destination,
            tripType,
            transportMode,
            genderPreference,
        });
        onClose();
    };

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
                    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                        {/* Header */}
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <View style={styles.headerLeft}>
                                <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
                                    <Ionicons name="options" size={20} color={colors.primary} />
                                </View>
                                <Text style={[styles.title, { color: colors.text }]}>Filters</Text>
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                                            <Ionicons
                                                name={option.icon as any}
                                                size={18}
                                                color={sortBy === option.id ? '#fff' : option.color}
                                            />
                                            <Text style={[
                                                styles.sortOptionText,
                                                { color: sortBy === option.id ? '#fff' : colors.text }
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
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
                                                    backgroundColor: maxCost === option.id ? '#10B981' : colors.card,
                                                    borderColor: maxCost === option.id ? '#10B981' : colors.border,
                                                }
                                            ]}
                                            onPress={() => setMaxCost(option.id)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[
                                                styles.optionChipText,
                                                { color: maxCost === option.id ? '#fff' : colors.text }
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Custom Budget Input */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="cash-outline" size={20} color="#9d74f7" />
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Custom Budget</Text>
                                </View>
                                <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                    <Text style={{ color: colors.textSecondary, marginRight: SPACING.xs }}>₹</Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        placeholder="Enter max budget..."
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="numeric"
                                        value={!BUDGET_OPTIONS.some(opt => opt.id === maxCost) ? maxCost.toString() : ''}
                                        onChangeText={(text) => {
                                            if (text === '') {
                                                // When cleared, keep current value or reset to highest
                                                setMaxCost(500000);
                                            } else {
                                                const num = parseInt(text);
                                                if (!isNaN(num) && num > 0) {
                                                    setMaxCost(num);
                                                }
                                            }
                                        }}
                                    />
                                    {!BUDGET_OPTIONS.some(opt => opt.id === maxCost) && maxCost < 500000 && (
                                        <TouchableOpacity onPress={() => setMaxCost(500000)}>
                                            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Max Travelers */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="people-outline" size={20} color="#F59E0B" />
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Group Size</Text>
                                </View>
                                <View style={styles.optionsRow}>
                                    {TRAVELERS_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.optionChip,
                                                {
                                                    backgroundColor: maxTravelers === option.id ? '#F59E0B' : colors.card,
                                                    borderColor: maxTravelers === option.id ? '#F59E0B' : colors.border,
                                                }
                                            ]}
                                            onPress={() => setMaxTravelers(option.id)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[
                                                styles.optionChipText,
                                                { color: maxTravelers === option.id ? '#fff' : colors.text }
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Trip Type */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="compass-outline" size={20} color={colors.primary} />
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Trip Type</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionsRow}>
                                    {TRIP_TYPES.map((option) => (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.optionChip,
                                                {
                                                    backgroundColor: tripType === option.id ? colors.primary : colors.card,
                                                    borderColor: tripType === option.id ? colors.primary : colors.border,
                                                }
                                            ]}
                                            onPress={() => setTripType(tripType === option.id ? undefined : option.id)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name={option.icon as any} size={16} color={tripType === option.id ? '#fff' : colors.text} style={{ marginRight: 6 }} />
                                            <Text style={[
                                                styles.optionChipText,
                                                { color: tripType === option.id ? '#fff' : colors.text }
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Transport Mode */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="train-outline" size={20} color="#9d74f7" />
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Transport Mode</Text>
                                </View>
                                <View style={styles.optionsRow}>
                                    {TRANSPORT_MODES.map((option) => (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.optionChip,
                                                {
                                                    backgroundColor: transportMode === option.id ? '#9d74f7' : colors.card,
                                                    borderColor: transportMode === option.id ? '#9d74f7' : colors.border,
                                                }
                                            ]}
                                            onPress={() => setTransportMode(transportMode === option.id ? undefined : option.id)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name={option.icon as any} size={16} color={transportMode === option.id ? '#fff' : colors.text} style={{ marginRight: 6 }} />
                                            <Text style={[
                                                styles.optionChipText,
                                                { color: transportMode === option.id ? '#fff' : colors.text }
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
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
                                            style={[
                                                styles.optionChip,
                                                {
                                                    backgroundColor: genderPreference === option.id ? '#EF4444' : colors.card,
                                                    borderColor: genderPreference === option.id ? '#EF4444' : colors.border,
                                                }
                                            ]}
                                            onPress={() => setGenderPreference(genderPreference === option.id ? undefined : option.id)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name={option.icon as any} size={16} color={genderPreference === option.id ? '#fff' : colors.text} style={{ marginRight: 6 }} />
                                            <Text style={[
                                                styles.optionChipText,
                                                { color: genderPreference === option.id ? '#fff' : colors.text }
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={{ height: SPACING.xxl }} />
                        </ScrollView>

                        {/* Buttons */}
                        <View style={[styles.buttonContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                            <TouchableOpacity
                                style={[styles.resetButton, { borderColor: colors.border }]}
                                onPress={handleReset}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                                <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.applyButton, { backgroundColor: colors.primary }]}
                                onPress={handleApply}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="checkmark" size={18} color="#fff" />
                                <Text style={styles.applyButtonText}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    modalContainer: { flex: 1, width: '100%', height: '100%' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.lg,
        borderBottomWidth: 1,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    headerIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    closeButton: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
    section: { marginBottom: SPACING.xxl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
    sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, flex: 1 },
    sortGrid: { gap: SPACING.sm },
    sortOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        gap: SPACING.sm,
    },
    sortOptionText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    optionChip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
    },
    optionChipText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        gap: SPACING.sm,
    },
    input: { flex: 1, fontSize: FONT_SIZE.sm, paddingVertical: SPACING.xs },
    buttonContainer: {
        flexDirection: 'row',
        gap: SPACING.md,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.lg,
        borderTopWidth: 1,
    },
    resetButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        gap: SPACING.sm,
    },
    resetButtonText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
    applyButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
    },
    applyButtonText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    helperText: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
});

export default FilterModal;
