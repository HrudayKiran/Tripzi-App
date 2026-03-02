import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ToastAndroid, Platform, Dimensions, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BRAND, NEUTRAL } from '../styles';
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
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      Alert.alert('Configuration Error', 'Missing Google Web Client ID. Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.');
      return;
    }

    GoogleSignin.configure({
      webClientId,
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

      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;
      const googleUser = (signInResult as any)?.data?.user || (signInResult as any)?.user;
      const googleEmail = googleUser?.email;
      const googleDisplayName = googleUser?.name || googleUser?.displayName || '';
      const googlePhotoURL = googleUser?.photo || googleUser?.photoURL || null;

      if (!idToken) throw new Error('No idToken received');
      if (!googleEmail) throw new Error('No email received from Google');

      // Check whether this Google account is already an existing Tripzi user.
      const checkGoogleUserStatus = functions().httpsCallable('checkGoogleUserStatus');
      const statusResult = await checkGoogleUserStatus({ email: googleEmail });
      const isExistingUser = !!statusResult?.data?.existing;

      if (isExistingUser) {
        // Existing users: sign in to Firebase Auth and proceed directly.
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);
        const userCredential = await auth().signInWithCredential(googleCredential);
        const user = userCredential.user;
        const userDocRef = firestore().collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();
        const docExists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;

        if (!docExists) {
          navigation.navigate('CompleteProfile');
          return;
        }

        // Navigate immediately — don't block on non-critical Firestore updates
        showToast('Welcome back! 🎉');
        navigation.reset({ index: 0, routes: [{ name: 'App' }] });

        // Fire-and-forget: update last login and consolidate name in background
        const userData = userDoc.data ? userDoc.data() : {};
        const resolvedName = userData?.name || userData?.displayName || user.displayName || 'User';

        userDocRef.set({
          name: resolvedName,
          displayName: firestore.FieldValue.delete(),
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => { });

        try {
          if (auth().currentUser) {
            auth().currentUser?.updateProfile({ displayName: resolvedName }).catch(() => { });
          }
        } catch (e) { }
      } else {
        // New users: DO NOT create Firebase Auth yet. Go to profile completion first.
        navigation.navigate('CompleteProfile', {
          idToken,
          email: googleEmail,
          displayName: googleDisplayName,
          photoURL: googlePhotoURL,
        });
        return;
      }

    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled, do nothing
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Sign in already in progress
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
        colors={[...BRAND.authGradient]}
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
                <ActivityIndicator color={NEUTRAL.dark} />
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
    color: NEUTRAL.white,
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
    backgroundColor: NEUTRAL.white,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30, // Pill shape
    width: '100%',
    maxWidth: 320,
    shadowColor: NEUTRAL.black,
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
    color: NEUTRAL.dark,
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
    color: NEUTRAL.white,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default StartScreen;

