
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';

const DEFAULT_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#1c1c1e" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8e8e93" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#1c1c1e" }]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{ "color": "#3a3a3c" }]
  },
  {
    "featureType": "administrative.country",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#3a3a3c" }]
  },
  {
    "featureType": "landscape.man_made",
    "elementType": "geometry",
    "stylers": [{ "color": "#1c1c1e" }]
  },
  {
    "featureType": "landscape.natural",
    "elementType": "geometry",
    "stylers": [{ "color": "#1c1c1e" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#2c2c2e" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8e8e93" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#2c2c2e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#1c1c1e" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8e8e93" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#3a3a3c" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#2c2c2e" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#0a0a0c" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#3a3a3c" }]
  }
];

const MapScreen = () => {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const params = useLocalSearchParams();
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  
  // Note: onSelectLocation was a callback prop in legacy navigation.
  // In Expo Router, you should pass data back via router.push or query params.
  const onSelectLocation = (loc: any) => {
    // Implement return logic here if needed
  };

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionDenied(true);
          setLocation(DEFAULT_REGION);
          return;
        }

        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const selectedCoords = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
        setLocation(selectedCoords);
        setRegion({
          ...selectedCoords,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectLocation = () => {
    if (onSelectLocation) {
      onSelectLocation(location);
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading map...</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={region}
          onPress={(e) => setLocation(e.nativeEvent.coordinate)}
          customMapStyle={isDarkMode ? darkMapStyle : undefined}
        >
          {location && (
            <Marker
              coordinate={location}
              draggable
              onDragEnd={(e) => setLocation(e.nativeEvent.coordinate)}
            />
          )}
        </MapView>
      )}
      {locationPermissionDenied && (
        <View style={[styles.permissionBanner, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.permissionText, { color: colors.text }]}>
            Location permission is off. Pick a place manually on the map.
          </Text>
        </View>
      )}
      <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={handleSelectLocation}>
        <Text style={styles.sendButtonText}>Send Location</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#4B5563',
  },
  permissionBanner: {
    position: 'absolute',
    top: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  permissionText: {
    color: '#111827',
    fontSize: 13,
  },
  sendButton: {
    position: 'absolute',
    bottom: 30,
    left: '25%',
    right: '25%',
    backgroundColor: '#8A2BE2',
    padding: 15,
    borderRadius: 20,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default MapScreen;
