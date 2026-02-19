import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ToastAndroid, Platform, Dimensions, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING } from '../styles/constants';
import AppLogo from '../components/AppLogo';

const { width } = Dimensions.get('window');

const StartScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Success', message);
    }
  };

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '334857280812-mb7tsrfd5q53ubachdlftnmogmskqu2c.apps.googleusercontent.com',
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
  }, []);

  // Unified Google Auth Handler (Sign In OR Sign Up)
  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);

    try {
      
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Force account picker by ensuring previous session is cleared
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        // Ignore if already signed out
      }

      // Attempt to sign in
      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;

      if (!idToken) throw new Error('No idToken received');

      // Create Firebase Credential
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign in to Firebase
      const userCredential = await auth().signInWithCredential(googleCredential);
      const user = userCredential.user;
      

      // Check Firestore for User Profile
      const userDocRef = firestore().collection('users').doc(user.uid);
      const userDoc = await userDocRef.get();

      // Handle both Firebase API versions for exists
      const docExists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;

      if (docExists) {
        // EXISTING USER: Login
        
        await userDocRef.update({
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        });
        showToast('Welcome back! 🎉');
      } else {
        // NEW USER: Create Profile
        
        const { email, displayName, photoURL, uid } = user;
        // Generate a simple username
        const username = email ? email.split('@')[0] : `user_${uid.substring(0, 5)}`;

        await userDocRef.set({
          userId: uid,
          email,
          displayName: displayName || 'Traveler',
          photoURL,
          username,
          createdAt: firestore.FieldValue.serverTimestamp(),
          ageVerified: false,
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        });
        showToast('Account Created! Welcome to Tripzi 🎉');
      }

      // Navigate to App
      navigation.reset({ index: 0, routes: [{ name: 'App' }] });

    } catch (error: any) {
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        
      } else if (error.code === statusCodes.IN_PROGRESS) {
        
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available or outdated.');
      } else {
        Alert.alert('Login Failed', error.message || 'Something went wrong with Google Sign-In');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Full Screen Gradient Background */}
      <LinearGradient
        colors={['#9d74f7', '#895af6', '#6d28d9']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Animated Logo Section */}
          <Animatable.View
            animation="fadeInDown"
            duration={1000}
            delay={300}
            style={styles.logoSection}
          >
            <AppLogo size={140} showDot={true} showGlow={true} />
            <View style={styles.textContainer}>
              <Text style={styles.appName}>Tripzi</Text>
              <Text style={styles.tagline}>CONNECT. PLAN. TRAVEL.</Text>
            </View>
          </Animatable.View>

          {/* Login Button Section */}
          <Animatable.View
            animation="fadeInUp"
            duration={1000}
            delay={600}
            style={styles.buttonSection}
          >
            {/* Unified Google Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              activeOpacity={0.9}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <>
                  <View style={styles.iconContainer}>
                    <Image
                      source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                      style={styles.googleLogo}
                    />
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.linkText} onPress={() => navigation.navigate('Terms')}>Terms</Text> and{' '}
              <Text style={styles.linkText} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>.
            </Text>
          </Animatable.View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'space-between',
    paddingVertical: SPACING.xxl,
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  appName: {
    fontSize: 56,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  buttonSection: {
    width: '100%',
    paddingBottom: 40,
    alignItems: 'center',
    gap: 20
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30, // Pill shape
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    gap: 12,
  },
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleLogo: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  googleButtonText: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '600',
  },
  termsText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 280,
  },
  linkText: {
    color: '#fff',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default StartScreen;

