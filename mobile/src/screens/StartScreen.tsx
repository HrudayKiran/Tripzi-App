import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

const StartScreen = ({ navigation }) => {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '881054128450-dho8i7lsv2a5enu2u3s0sac75ttmp0fg.apps.googleusercontent.com',
    });
  }, []);

  const onGoogleButtonPress = async () => {
    try {
      console.log('Starting Google Sign-In...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('Google Play Services available');

      const signInResult = (await GoogleSignin.signIn()) as any;
      console.log('Google Sign-In successful, got token');

      const { idToken } = signInResult;
      const googleCredential = GoogleAuthProvider.credential(idToken);
      console.log('Created Google credential');

      const userCredential = await signInWithCredential(auth, googleCredential);
      console.log('Firebase sign-in successful');

      const { user } = userCredential;
      const { uid, displayName, email } = user;

      const userRef = doc(db, 'users', uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        console.log('Creating new user document');
        await setDoc(userRef, {
          displayName,
          email,
          createdAt: serverTimestamp(),
        });
      }

      console.log('Navigating to App...');
      navigation.navigate('App');
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);

      if (error?.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google Sign-In Error', error?.message || error?.toString());
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <View style={styles.gradientBackground}>
        {/* Small Logo at Top */}
        <View style={styles.topLogo}>
          <Text style={styles.topLogoEmoji}>🚀</Text>
        </View>
      </View>

      {/* White Bottom Card */}
      <View style={styles.bottomCard}>
        <Text style={styles.title}>Start Your Adventure</Text>
        <Text style={styles.subtitle}>
          Join thousands of solo travelers exploring the world.
        </Text>

        {/* Continue with Google Button */}
        <TouchableOpacity style={styles.googleButton} onPress={onGoogleButtonPress}>
          <Ionicons name="logo-google" size={20} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>OR CONTINUE WITH</Text>

        {/* Social Icons */}
        <View style={styles.socialIconsContainer}>
          <TouchableOpacity style={styles.socialIcon}>
            <Ionicons name="logo-apple" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialIcon}>
            <Ionicons name="logo-facebook" size={24} color="#1877F2" />
          </TouchableOpacity>
        </View>

        {/* Sign Up with Email */}
        <TouchableOpacity
          style={styles.signUpButton}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Ionicons name="person-add-outline" size={20} color="#8A2BE2" />
          <Text style={styles.signUpButtonText}>Sign Up with Email</Text>
        </TouchableOpacity>

        {/* Sign In with Email */}
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => navigation.navigate('SignIn')}
        >
          <Ionicons name="log-in-outline" size={20} color="#1a1a1a" />
          <Text style={styles.signInButtonText}>Sign In with Email</Text>
        </TouchableOpacity>

        {/* Terms and Privacy */}
        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms')}>
            Terms of Service
          </Text>{' '}
          &{' '}
          <Text style={styles.termsLink} onPress={() => navigation.navigate('PrivacyPolicy')}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5A65A',
  },
  gradientBackground: {
    height: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5896B',
  },
  topLogo: {
    width: 60,
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  topLogoEmoji: {
    fontSize: 30,
  },
  bottomCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 40,
    paddingBottom: 30,
    marginTop: -20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  googleButton: {
    backgroundColor: '#8A2BE2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  googleIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 10,
    backgroundColor: '#fff',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    letterSpacing: 1,
    marginVertical: 15,
  },
  socialIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 25,
  },
  socialIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpButton: {
    backgroundColor: '#F3E8FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 15,
    gap: 8,
  },
  signUpButtonText: {
    color: '#8A2BE2',
    fontSize: 16,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
    gap: 8,
  },
  signInButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: '#8A2BE2',
    fontWeight: '600',
  },
});

export default StartScreen;
