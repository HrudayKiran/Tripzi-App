import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Icon from '../components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';

interface LocationPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectLocation: (location: { latitude: number; longitude: number; address?: string }) => void;
}

const DEFAULT_REGION = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 12,
    longitudeDelta: 12,
};

const LocationPickerModal = ({ visible, onClose, onSelectLocation }: LocationPickerModalProps) => {
    const { colors, isDarkMode } = useTheme();
    const mapRef = React.useRef<MapView>(null);
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const shimmerAnim = React.useRef(new Animated.Value(0.3)).current;
    const [loading, setLoading] = useState(true);
    const [addressLoading, setAddressLoading] = useState(false);
    const [address, setAddress] = useState('');
    const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

    useEffect(() => {
        if (visible) {
            void initializeMap();
        }
    }, [visible]);

    useEffect(() => {
        if (loading && visible) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(shimmerAnim, {
                        toValue: 0.8,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shimmerAnim, {
                        toValue: 0.3,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            shimmerAnim.setValue(0.3);
        }
    }, [loading, visible]);

    const initializeMap = async () => {
        setLoading(true);
        setAddress('');
        setLocationPermissionDenied(false);
        setSelectedLocation(null);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationPermissionDenied(true);
                setSelectedLocation(null);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const targetRegion = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
            
            setTimeout(() => {
                mapRef.current?.animateToRegion(targetRegion, 1000);
            }, 500);

        } catch (error) {
            setSelectedLocation(null);
            setAddress('');
        } finally {
            setLoading(false);
        }
    };

    const fetchAddress = async (lat: number, lng: number) => {
        setAddressLoading(true);
        try {
            const [result] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (result) {
                const addr = [result.name, result.street, result.city].filter(Boolean).join(', ');
                setAddress(addr);
            }
        } catch (error) {
            setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally {
            setAddressLoading(false);
        }
    };

    const handlePress = async (e: any) => {
        const coordinate = e.nativeEvent?.coordinate;
        if (!coordinate) return;
        const { latitude, longitude } = coordinate;
        setSelectedLocation({ latitude, longitude });
        await fetchAddress(latitude, longitude);
        mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        }, 300);
    };

    const handleDragEnd = async (e: any) => {
        const coordinate = e.nativeEvent?.coordinate;
        if (!coordinate) return;
        const { latitude, longitude } = coordinate;
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
                {loading ? (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDarkMode ? '#121212' : '#F3F4F6' }]}>
                        {/* Map Area Skeleton */}
                        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDarkMode ? '#1E1E1E' : '#E5E7EB', opacity: shimmerAnim }]} />
                        
                        {/* Header Back Button Skeleton */}
                        <View style={[styles.backButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }]} />
                        
                        {/* Bottom Card Skeleton */}
                        <View style={[styles.bottomCard, { backgroundColor: colors.card }]}>
                            <View style={styles.locationInfo}>
                                <Animated.View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#2A2A2A' : '#E5E7EB', opacity: shimmerAnim }]} />
                                <View style={{ flex: 1, gap: 8 }}>
                                    <Animated.View style={{ width: 80, height: 12, borderRadius: 6, backgroundColor: isDarkMode ? '#2A2A2A' : '#E5E7EB', opacity: shimmerAnim }} />
                                    <Animated.View style={{ width: '90%', height: 16, borderRadius: 8, backgroundColor: isDarkMode ? '#2A2A2A' : '#E5E7EB', opacity: shimmerAnim }} />
                                </View>
                            </View>
                            <Animated.View style={[styles.confirmButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#E5E7EB', opacity: shimmerAnim, height: 48, borderRadius: BORDER_RADIUS.lg }]} />
                        </View>
                    </View>
                ) : (
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={DEFAULT_REGION}
                        onPress={handlePress}
                        onPoiClick={handlePress}
                        showsUserLocation={!locationPermissionDenied}
                        showsMyLocationButton={!locationPermissionDenied}
                    >
                        {selectedLocation && (
                            <Marker 
                                coordinate={selectedLocation} 
                                draggable
                                onDragEnd={handleDragEnd}
                            />
                        )}
                    </MapView>
                )}

                {/* Header Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={onClose}>
                    <Icon name="ArrowLeft" size={24} color="#000" />
                </TouchableOpacity>

                {locationPermissionDenied && (
                    <View style={[styles.permissionBanner, { backgroundColor: colors.card }]}>
                        <Icon name="Info" size={18} color={colors.primary} />
                        <Text style={[styles.permissionText, { color: colors.text }]}>
                            Location permission is off. You can still pick a place manually on the map.
                        </Text>
                    </View>
                )}

                {/* Bottom Card */}
                <View style={[styles.bottomCard, { backgroundColor: colors.card }]}>
                    <View style={styles.locationInfo}>
                        <View style={styles.iconContainer}>
                            <Icon name="MapPin" size={24} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Selected Location</Text>
                            {addressLoading ? (
                                <Animated.View style={{ width: '85%', height: 16, borderRadius: 8, backgroundColor: isDarkMode ? '#2A2A2A' : '#E5E7EB', opacity: shimmerAnim, marginTop: 4 }} />
                            ) : (
                                <Text style={[styles.address, { color: colors.text }]} numberOfLines={2}>
                                    {address || 'Tap on map to select'}
                                </Text>
                            )}
                        </View>
                    </View>

                    {selectedLocation && (
                        <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                            onPress={handleConfirm}
                        >
                            <Text style={styles.confirmButtonText}>Share Location</Text>
                            <Icon name="PaperPlaneTilt" size={16} color="#fff" />
                        </TouchableOpacity>
                    )}
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
    permissionBanner: {
        position: 'absolute',
        top: 104,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
    },
    permissionText: {
        flex: 1,
        fontSize: FONT_SIZE.sm,
        lineHeight: 18,
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
