
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import * as Animatable from 'react-native-animatable';
import * as Progress from 'react-native-progress';

const { width } = Dimensions.get('window');

const CreateTripScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);

  // Form States
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [maxTravelers, setMaxTravelers] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [description, setDescription] = useState('');
  const [placesToVisit, setPlacesToVisit] = useState('');

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handlePostTrip = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      try {
        await firestore().collection('trips').add({
          title,
          location,
          fromDate,
          toDate,
          maxTravelers: parseInt(maxTravelers, 10),
          totalCost: parseFloat(totalCost),
          description,
          placesToVisit: placesToVisit.split(',').map(place => place.trim()),
          userId: currentUser.uid,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        Alert.alert('Success', 'Your trip has been posted!');
        navigation.navigate('Feed');

      } catch (error) {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } else {
        Alert.alert('Error', 'You need to be logged in to create a trip.');
        navigation.navigate('Start');
    }
  };

  const progress = step / 4;

  return (
    <ScrollView style={styles.container}>
        <Progress.Bar progress={progress} width={width - 40} style={styles.progressBar} />

        {step === 1 && (
            <Animatable.View animation="fadeInRight">
                <Text style={styles.title}>The Adventure Starts Here</Text>
                <Text style={styles.label}>What's the title of your trip?</Text>
                <TextInput style={styles.input} placeholder="e.g. Mystical Ladakh" value={title} onChangeText={setTitle} />
                
                <Text style={styles.label}>Where are you heading?</Text>
                <TextInput style={styles.input} placeholder="e.g. Leh, Ladakh" value={location} onChangeText={setLocation} />
            </Animatable.View>
        )}

        {step === 2 && (
            <Animatable.View animation="fadeInRight">
                <Text style={styles.title}>The Timeline</Text>
                <Text style={styles.label}>When does the adventure begin and end?</Text>
                <View style={styles.dateContainer}>
                    <TextInput style={[styles.input, styles.dateInput]} placeholder="From (YYYY-MM-DD)" value={fromDate} onChangeText={setFromDate} />
                    <TextInput style={[styles.input, styles.dateInput]} placeholder="To (YYYY-MM-DD)" value={toDate} onChangeText={setToDate} />
                </View>

                <Text style={styles.label}>How many people can join?</Text>
                <TextInput style={styles.input} placeholder="e.g. 4" value={maxTravelers} onChangeText={setMaxTravelers} keyboardType="numeric" />
            </Animatable.View>
        )}

        {step === 3 && (
            <Animatable.View animation="fadeInRight">
                <Text style={styles.title}>The Finer Details</Text>
                <Text style={styles.label}>Tell us about your trip</Text>
                <TextInput style={styles.textArea} placeholder="Describe the journey..." value={description} onChangeText={setDescription} multiline />

                <Text style={styles.label}>What are the key places to visit?</Text>
                <TextInput style={styles.textArea} placeholder="Enter places separated by commas" value={placesToVisit} onChangeText={setPlacesToVisit} multiline />
            </Animatable.View>
        )}

        {step === 4 && (
            <Animatable.View animation="fadeInRight">
                <Text style={styles.title}>The Budget</Text>
                <Text style={styles.label}>What's the estimated total cost for the trip?</Text>
                <TextInput style={styles.input} placeholder="e.g. 25000" value={totalCost} onChangeText={setTotalCost} keyboardType="numeric" />
                
                {/* Placeholder for image upload */}
                <TouchableOpacity style={styles.uploadButton}>
                    <Text style={styles.uploadButtonText}>Upload a Trip Photo</Text>
                </TouchableOpacity>
            </Animatable.View>
        )}

        <View style={styles.navigationButtons}>
            {step > 1 && <TouchableOpacity style={styles.backButton} onPress={handleBack}><Text style={styles.buttonText}>Back</Text></TouchableOpacity>}
            {step < 4 && <TouchableOpacity style={styles.nextButton} onPress={handleNext}><Text style={styles.buttonText}>Next</Text></TouchableOpacity>}
            {step === 4 && <TouchableOpacity style={styles.postButton} onPress={handlePostTrip}><Text style={styles.buttonText}>Post Trip</Text></TouchableOpacity>}
        </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    progressBar: {
        marginBottom: 20,
        color: '#8A2BE2'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 20,
    },
    label: {
        fontSize: 18,
        color: '#555',
        marginBottom: 10,
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        marginBottom: 20,
    },
    textArea: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        height: 120,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    dateContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dateInput: {
        width: '48%',
    },
    navigationButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
    },
    backButton: {
        backgroundColor: '#6c757d',
        padding: 15,
        borderRadius: 10,
        flex: 1,
        marginRight: 10,
        alignItems: 'center',
    },
    nextButton: {
        backgroundColor: '#8A2BE2',
        padding: 15,
        borderRadius: 10,
        flex: 1,
        marginLeft: 10,
        alignItems: 'center',
    },
    postButton: {
        backgroundColor: '#28a745',
        padding: 15,
        borderRadius: 10,
        flex: 1,
        marginLeft: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    uploadButton: {
        backgroundColor: '#007bff',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
    },
    uploadButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});

export default CreateTripScreen;
