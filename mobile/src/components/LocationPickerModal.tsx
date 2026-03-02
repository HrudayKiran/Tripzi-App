import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, SafeAreaView, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';

interface LocationPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectLocation: (location: { latitude: number; longitude: number; address?: string }) => void;
}

const { width, height } = Dimensions.get('window');

const LocationPickerModal = ({ visible, onClose, onSelectLocation }: LocationPickerModalProps) => {
    const { colors } = useTheme();
    const [region, setRegion] = useState<any>(null);
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [address, setAddress] = useState('');

    useEffect(() => {
        if (visible) {
            getCurrentLocation();
        }
    }, [visible]);

    const getCurrentLocation = async () => {
        setLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const initialRegion = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
            setRegion(initialRegion);
            setSelectedLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
            await fetchAddress(location.coords.latitude, location.coords.longitude);
        } catch (error) {

        } finally {
            setLoading(false);
        }
    };

    const fetchAddress = async (lat: number, lng: number) => {
        try {
            const [result] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (result) {
                const addr = [result.name, result.street, result.city].filter(Boolean).join(', ');
                setAddress(addr);
            }
        } catch (error) {
            setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
    };

    const handlePress = async (e: any) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        setSelectedLocation({ latitude, longitude });
        await fetchAddress(latitude, longitude);
    };

    const handleConfirm = () => {
        if (selectedLocation) {
            onSelectLocation({
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                address,
            });
            onClose();
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={styles.container}>
                {region ? (
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={region}
                        onPress={handlePress}
                        showsUserLocation
                        showsMyLocationButton
                    >
                        {selectedLocation && (
                            <Marker coordinate={selectedLocation} />
                        )}
                    </MapView>
                ) : (
                    <View style={[styles.map, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }]}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: 10, color: '#666' }}>Loading Map...</Text>
                    </View>
                )}

                {/* Header Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={onClose}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>

                {/* Bottom Card */}
                <View style={[styles.bottomCard, { backgroundColor: colors.card }]}>
                    <View style={styles.locationInfo}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="location" size={24} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Selected Location</Text>
                            <Text style={[styles.address, { color: colors.text }]} numberOfLines={2}>
                                {address || 'Tap on map to select'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.confirmButton, { backgroundColor: colors.primary, opacity: selectedLocation ? 1 : 0.5 }]}
                        onPress={handleConfirm}
                        disabled={!selectedLocation}
                    >
                        <Text style={styles.confirmButtonText}>Share Location</Text>
                        <Ionicons name="send" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    map: { ...StyleSheet.absoluteFillObject },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: '#fff',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    bottomCard: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        padding: SPACING.lg,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.lg,
        gap: SPACING.md,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: FONT_SIZE.xs,
        marginBottom: 4,
    },
    address: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default LocationPickerModal;
