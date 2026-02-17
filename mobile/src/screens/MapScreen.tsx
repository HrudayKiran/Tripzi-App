
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const MapScreen = ({ navigation, route }) => {
  const [location, setLocation] = useState(null);
  const { onSelectLocation } = route.params;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);
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
      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          <Marker
            coordinate={location}
            draggable
            onDragEnd={(e) => setLocation(e.nativeEvent.coordinate)}
          />
        </MapView>
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
