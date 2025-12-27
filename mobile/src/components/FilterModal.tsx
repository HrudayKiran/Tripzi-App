import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

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
};

const FilterModal = ({ visible, onClose, onApply }: FilterModalProps) => {
    const { colors } = useTheme();
    const [sortBy, setSortBy] = useState('Newest First');
    const [destination, setDestination] = useState('');
    const slideAnim = React.useRef(new Animated.Value(width * 0.7)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                speed: 14,
                bounciness: 0,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: width * 0.7,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const handleReset = () => {
        setSortBy('Newest First');
        setDestination('');
    };

    const handleApply = () => {
        onApply({
            sortBy,
            maxCost: 500000,
            maxTravelers: 50,
            minDays: 0,
            destination
        });
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            onRequestClose={onClose}
            animationType="none"
        >
            <View style={styles.modalOverlay}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <Animated.View
                    style={[
                        styles.modalContainer,
                        { backgroundColor: colors.background },
                        { transform: [{ translateX: slideAnim }] }
                    ]}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Filter & Sort</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Sort By */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="swap-vertical" size={20} color={colors.primary} />
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Sort By</Text>
                            </View>
                            <View style={[styles.dropdown, { backgroundColor: colors.inputBackground, borderColor: colors.primary }]}>
                                <Text style={[styles.dropdownText, { color: colors.text }]}>{sortBy}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                            </View>
                        </View>

                        {/* Destination */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.text }]}>Destination</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                placeholder="e.g., Paris"
                                placeholderTextColor={colors.textSecondary}
                                value={destination}
                                onChangeText={setDestination}
                            />
                        </View>

                        <View style={{ height: 20 }} />
                    </ScrollView>

                    {/* Buttons */}
                    <View style={[styles.buttonContainer, { borderTopColor: colors.border }]}>
                        <TouchableOpacity style={[styles.resetButton, { borderColor: colors.border }]} onPress={handleReset}>
                            <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.applyButton, { backgroundColor: colors.primary }]} onPress={handleApply}>
                            <Text style={styles.applyButtonText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdrop: {
        flex: 1,
    },
    modalContainer: {
        width: width * 0.7,
        height: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    dropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
    },
    dropdownText: {
        fontSize: 15,
        fontWeight: '500',
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        borderWidth: 1,
    },
    buttonContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
        borderTopWidth: 1,
    },
    resetButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default FilterModal;
