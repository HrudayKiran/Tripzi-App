
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const DEFAULT_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

const MapScreen = ({ navigation, route }) => {
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const { onSelectLocation } = route.params;

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
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={region}
          onPress={(e) => setLocation(e.nativeEvent.coordinate)}
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
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>
            Location permission is off. Pick a place manually on the map.
          </Text>
        </View>
      )}
      <TouchableOpacity style={styles.sendButton} onPress={handleSelectLocation}>
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
