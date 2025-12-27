
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';

const KycScreen = ({ navigation }) => {
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarImage, setAadhaarImage] = useState(null);
  const [userImage, setUserImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const selectImage = (setImage) => {
    launchImageLibrary({ mediaType: 'photo' }, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
      } else {
        setImage(response.assets[0]);
      }
    });
  };

  const uploadImage = async (image, path) => {
    const uploadUri = image.uri;
    const reference = storage().ref(path);
    await reference.putFile(uploadUri);
    return reference.getDownloadURL();
  };

  const handleSubmitKyc = async () => {
    if (!aadhaarNumber || !aadhaarImage || !userImage) {
      Alert.alert('Error', 'Please fill all fields and upload both images.');
      return;
    }

    setUploading(true);
    const currentUser = auth.currentUser;

    try {
      const aadhaarImageUrl = await uploadImage(aadhaarImage, `kyc/${currentUser.uid}/aadhaar.jpg`);
      const userImageUrl = await uploadImage(userImage, `kyc/${currentUser.uid}/user.jpg`);

      await firestore().collection('users').doc(currentUser.uid).update({
        kyc: {
          aadhaarNumber,
          aadhaarImageUrl,
          userImageUrl,
          status: 'pending',
        },
      });

      setUploading(false);
      Alert.alert('Success', 'KYC submitted for review.');
      navigation.goBack();
    } catch (error) {
      setUploading(false);
      Alert.alert('Error', 'Something went wrong during KYC submission.');
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>KYC Verification</Text>
      <TextInput
        style={styles.input}
        placeholder="Aadhaar Card Number"
        value={aadhaarNumber}
        onChangeText={setAadhaarNumber}
        keyboardType="numeric"
      />
      <TouchableOpacity style={styles.imagePicker} onPress={() => selectImage(setAadhaarImage)}>
        {aadhaarImage ? <Image source={{ uri: aadhaarImage.uri }} style={styles.previewImage} /> : <Text>Upload Aadhaar Card Image</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.imagePicker} onPress={() => selectImage(setUserImage)}>
        {userImage ? <Image source={{ uri: userImage.uri }} style={styles.previewImage} /> : <Text>Upload Your Photo</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmitKyc} disabled={uploading}>
        {uploading ? <Text style={styles.submitButtonText}>Submitting...</Text> : <Text style={styles.submitButtonText}>Submit KYC</Text>}
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
  },
  imagePicker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
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

export default KycScreen;
