import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ToastAndroid, Platform, Dimensions, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import AppLogo from '../components/AppLogo';

const { width } = Dimensions.get('window');

const StartScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

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

  // Google Sign-In for EXISTING users only
  const handleGoogleAuth = async () => {
    try {
      console.log('[handleGoogleAuth] Starting Google Sign-In flow');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try { await GoogleSignin.signOut(); } catch (e) { }

      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;

      if (!idToken) throw new Error('No idToken received');

      console.log('[handleGoogleAuth] Got idToken, signing in with Firebase');
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      console.log('[handleGoogleAuth] Firebase signed in, UID:', userCredential.user.uid);

      // Check if user exists in Firestore (existing user check)
      try {
        console.log('[handleGoogleAuth] Checking Firestore for user...');
        const userDoc = await firestore().collection('users').doc(userCredential.user.uid).get();

        // Handle both Firebase API versions (exists as property or function)
        const docExists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
        console.log('[handleGoogleAuth] Firestore check complete. Exists:', docExists);

        if (!docExists) {
          // User not registered - sign out and show error
          console.log('[handleGoogleAuth] User NOT found in Firestore, signing out...');
          await auth().signOut();
          await GoogleSignin.signOut();
          console.log('[handleGoogleAuth] Signed out, showing alert');
          Alert.alert(
            'Account Not Found',
            'No account found for this Google email. Please tap "Sign Up" to create a new account.',
            [{ text: 'OK' }]
          );
          return;
        }
        console.log('[handleGoogleAuth] User EXISTS in Firestore, proceeding to App');
      } catch (firestoreError: any) {
        // If we get permission denied, it likely means the doc doesn't exist
        console.log('[handleGoogleAuth] Firestore error:', firestoreError.message);
        await auth().signOut();
        await GoogleSignin.signOut();
        Alert.alert(
          'Account Not Found',
          'No account found for this Google email. Please tap "Sign Up" to create a new account.',
          [{ text: 'OK' }]
        );
        return;
      }

      // User exists - proceed to app
      showToast('Welcome back! 🎉');
      navigation.reset({ index: 0, routes: [{ name: 'App' }] });
    } catch (error: any) {
      console.log('[handleGoogleAuth] Error:', error?.code, error?.message);
      if (error?.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google Sign-In Failed', error.message);
      }
    }
  };

  // Google Sign-Up for NEW users only
  const handleGoogleSignUp = async () => {
    setShowSignUpModal(false);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try { await GoogleSignin.signOut(); } catch (e) { }

      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;

      if (!idToken) throw new Error('No idToken received');

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);

      // Check if user already exists
      let userExists = false;
      try {
        const userDoc = await firestore().collection('users').doc(userCredential.user.uid).get();
        // Handle both Firebase API versions (exists as property or function)
        userExists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
      } catch (e) {
        // Permission error means doc doesn't exist - that's what we want for sign-up
        userExists = false;
      }

      if (userExists) {
        // User already registered - sign out and show error
        await auth().signOut();
        await GoogleSignin.signOut();
        Alert.alert(
          'Account Already Exists',
          'You already have an account with this Google email. Please use "Continue with Google" to sign in.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Create new user (using 'pending' to match Firestore rules)
      const { uid, email, displayName, photoURL } = userCredential.user;
      const username = email ? email.split('@')[0] : `user_${uid.substring(0, 5)}`;
      await firestore().collection('users').doc(uid).set({
        userId: uid, email, displayName, photoURL, username,
        createdAt: firestore.FieldValue.serverTimestamp(),
        role: 'user', ageVerified: false, followers: [], following: [],
      });

      showToast('Account Created! 🎉');
      navigation.reset({ index: 0, routes: [{ name: 'App' }] });
    } catch (error: any) {
      if (error?.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google Sign-Up Failed', error.message);
      }
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
            <AppLogo size={120} showDot={true} showGlow={true} />
            <View style={styles.textContainer}>
              <Text style={styles.appName}>Tripzi</Text>
              <Text style={styles.tagline}>CONNECT. PLAN. TRAVEL.</Text>
            </View>
          </Animatable.View>

          {/* Buttons Section - Glassmorphism Style */}
          <Animatable.View
            animation="fadeInUp"
            duration={1000}
            delay={600}
            style={styles.buttonSection}
          >
            {/* Have an account? Sign In */}
            <View style={styles.textLinkContainer}>
              <Text style={styles.promptText}>Have an account? </Text>
              <TouchableOpacity onPress={() => setShowSignInModal(true)}>
                <Text style={styles.actionLinkText}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Don't have an account? Sign Up */}
            <View style={styles.textLinkContainer}>
              <Text style={styles.promptText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => setShowSignUpModal(true)}>
                <Text style={styles.actionLinkText}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Terms Links */}
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.linkText} onPress={() => navigation.navigate('Terms')}>Terms</Text> and{' '}
              <Text style={styles.linkText} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>.
            </Text>
          </Animatable.View>
        </View>
      </SafeAreaView>

      {/* Sign In Modal */}
      <Modal
        visible={showSignInModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSignInModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSignInModal(false)}
        >
          <Animatable.View
            animation="zoomIn"
            duration={300}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Welcome Back</Text>
            <Text style={styles.modalSubtitle}>Choose how you'd like to sign in</Text>

            {/* Continue with Google - First */}
            <TouchableOpacity
              style={styles.modalButtonGoogle}
              onPress={() => {
                setShowSignInModal(false);
                handleGoogleAuth();
              }}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                style={styles.googleLogoImage}
              />
              <Text style={styles.modalButtonGoogleText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Sign In with Email */}
            <TouchableOpacity
              style={styles.modalButtonManual}
              onPress={() => {
                setShowSignInModal(false);
                navigation.navigate('SignIn');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={20} color="#fff" />
              <Text style={styles.modalButtonManualText}>Sign In with Email</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowSignInModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animatable.View>
        </TouchableOpacity>
      </Modal>

      {/* Sign Up Modal */}
      <Modal
        visible={showSignUpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSignUpModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSignUpModal(false)}
        >
          <Animatable.View
            animation="zoomIn"
            duration={300}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Create Account</Text>
            <Text style={styles.modalSubtitle}>Choose how you'd like to sign up</Text>

            {/* Sign Up with Google */}
            <TouchableOpacity
              style={styles.modalButtonGoogle}
              onPress={handleGoogleSignUp}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                style={styles.googleLogoImage}
              />
              <Text style={styles.modalButtonGoogleText}>Sign Up with Google</Text>
            </TouchableOpacity>

            {/* Create New Account (Manual) */}
            <TouchableOpacity
              style={styles.modalButtonManual}
              onPress={() => {
                setShowSignUpModal(false);
                navigation.navigate('SignUp');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={20} color="#fff" />
              <Text style={styles.modalButtonManualText}>Create New Account</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowSignUpModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animatable.View>
        </TouchableOpacity>
      </Modal>
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
    fontSize: 48,
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
    gap: 16,
    width: '100%',
    paddingBottom: 24,
  },
  glassButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#6d28d9',
    fontSize: 16,
    fontWeight: '700',
  },
  glassButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    color: '#6d28d9',
    fontWeight: '900',
    fontSize: 16,
  },
  dividerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  glassButtonOutline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  termsText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 16,
    lineHeight: 16,
  },
  linkText: {
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalButtonGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 12,
    width: '100%',
  },
  modalButtonGoogleText: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonManual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 12,
    width: '100%',
  },
  modalButtonManualText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalCancelButton: {
    paddingVertical: 12,
  },
  modalCancelText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  // Google Logo Image Style
  googleLogoImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  // Text Link Styles
  textLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  promptText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  promptTextCenter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  actionLinkText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  // Compact Button Styles
  compactButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'transparent',
  },
  compactButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default StartScreen;
