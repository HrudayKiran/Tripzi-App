
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const StartScreen = ({ navigation }) => {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: 'YOUR_WEB_CLIENT_ID', // Replace with your web client ID
    });
  }, []);

  const onGoogleButtonPress = async () => {
    try {
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Get the users ID token
      const { idToken } = await GoogleSignin.signIn();

      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign-in the user with the credential
      const userCredential = await auth().signInWithCredential(googleCredential);

      // Get user information
      const { user } = userCredential;
      const { uid, displayName, email } = user;

      // Check if user exists in Firestore
      const userDocument = await firestore().collection('users').doc(uid).get();

      if (!userDocument.exists) {
        // Create a new user document in Firestore
        await firestore().collection('users').doc(uid).set({
          displayName,
          email,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      // Navigate to the main app
      navigation.navigate('App');

    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // play services not available or outdated
      } else {
        // some other error happened
        Alert.alert('Error', error.toString());
      }
    }
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Start Your Adventure</Text>
      <Text style={styles.subtitle}>Join thousands of solo travelers exploring the world.</Text>
      <TouchableOpacity style={styles.googleButton} onPress={onGoogleButtonPress}>
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>
      <Text style={styles.orContinueWith}>OR CONTINUE WITH</Text>
      <View style={styles.socialButtonsContainer}>
        <TouchableOpacity style={styles.socialButton}>
          {/* Replace with Apple icon */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButton}>
          {/* Replace with Facebook icon */}
        </TouchableOpacity>
      </View>
      <TouchableOpacity 
        style={styles.emailButton}
        onPress={() => navigation.navigate('SignUp')}
      >
        <Text style={styles.emailButtonText}>Sign Up with Email</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.signInButton}
        onPress={() => navigation.navigate('SignIn')}
      >
        <Text style={styles.signInButtonText}>Sign In with Email</Text>
      </TouchableOpacity>
      <Text style={styles.termsText}>
        By continuing, you agree to our <Text style={styles.linkText}>Terms of Service</Text> & <Text style={styles.linkText}>Privacy Policy.</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 50,
    marginBottom: 30,
  },
  googleButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    paddingHorizontal: 80,
    borderRadius: 25,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orContinueWith: {
    color: '#666',
    marginBottom: 20,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  socialButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 25,
    marginHorizontal: 10,
  },
  emailButton: {
    backgroundColor: '#F0E6FF',
    paddingVertical: 15,
    paddingHorizontal: 90,
    borderRadius: 25,
    marginBottom: 15,
  },
  emailButtonText: {
    color: '#8A2BE2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signInButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 15,
    paddingHorizontal: 95,
    borderRadius: 25,
  },
  signInButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsText: {
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 50,
    marginTop: 30,
  },
  linkText: {
    color: '#8A2BE2',
  },
});

export default StartScreen;
