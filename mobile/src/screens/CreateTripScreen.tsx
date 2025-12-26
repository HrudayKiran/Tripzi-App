
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';

// The Cloud Function URL
const CREATE_TRIP_URL = 'https://us-central1-tripzi-52736816-98c83.cloudfunctions.net/createTrip';

const CreateTripScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateTrip = async () => {
    if (!title || !destination || !startDate || !endDate) {
      Alert.alert('Error', 'Please fill out all fields.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(CREATE_TRIP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          destination,
          start_date: startDate,
          end_date: endDate,
          // Add other trip properties here as needed
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create trip');
      }

      await response.json();
      Alert.alert('Success', 'Trip created successfully!');
      navigation.goBack(); // Go back to the previous screen
    } catch (error) {
      console.error("Error creating trip:", error);
      Alert.alert('Error', 'There was an issue creating your trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Create a New Trip</Text>
      <TextInput
        style={styles.input}
        placeholder="Trip Title (e.g., 'Summer Vacation')"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Destination (e.g., 'Paris, France')"
        value={destination}
        onChangeText={setDestination}
      />
      <TextInput
        style={styles.input}
        placeholder="Start Date (e.g., 'YYYY-MM-DD')"
        value={startDate}
        onChangeText={setStartDate}
      />
      <TextInput
        style={styles.input}
        placeholder="End Date (e.g., 'YYYY-MM-DD')"
        value={endDate}
        onChangeText={setEndDate}
      />
      <Button title={loading ? 'Creating...' : 'Create Trip'} onPress={handleCreateTrip} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
});

export default CreateTripScreen;
