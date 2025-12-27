
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const SuggestFeatureScreen = ({ navigation }) => {
  const [feature, setFeature] = useState('');

  const handleSubmit = async () => {
    if (!feature) {
      return;
    }

    const currentUser = auth().currentUser;

    await firestore().collection('suggestions').add({
      feature,
      userId: currentUser.uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    Alert.alert('Thank you!', 'Your suggestion has been submitted.');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suggest a Feature</Text>
      <TextInput
        style={styles.input}
        placeholder="Describe the feature you'd like to see"
        value={feature}
        onChangeText={setFeature}
        multiline
      />
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Submit</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
    height: 150,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#8A2BE2',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SuggestFeatureScreen;
