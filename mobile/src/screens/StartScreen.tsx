import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ToastAndroid, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const StartScreen = ({ navigation }) => {
  const { colors } = useTheme();

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
    });
  }, []);

  const onGoogleButtonPress = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      try {
        await GoogleSignin.signOut();
      } catch (e) { }

      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;

      if (!idToken) {
        throw new Error('No idToken received from Google Sign-In');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleCredential);

      showToast('Login successful! 🎉');
      // Navigate directly to App - username setup can be done from profile
      navigation.navigate('App');
    } catch (error: any) {
      if (error?.code !== statusCodes.SIGN_IN_CANCELLED) {
        // Error handled silently
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Animatable.View animation="fadeInUp" duration={500} style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
          </View>

          {/* Welcome Text */}
          <Text style={[styles.welcome, { color: colors.text }]}>Welcome to Tripzi</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Explore the world, not alone
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.emailButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('SignIn')}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={20} color="#fff" />
              <Text style={styles.emailButtonText}>Sign in with Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.googleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={onGoogleButtonPress}
              activeOpacity={0.8}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[styles.googleButtonText, { color: colors.text }]}>Sign in with Google</Text>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>

            <TouchableOpacity
              style={[styles.createButton, { borderColor: colors.primary }]}
              onPress={() => navigation.navigate('SignUp')}
              activeOpacity={0.8}
            >
              <Text style={[styles.createButtonText, { color: colors.primary }]}>Create New Account</Text>
            </TouchableOpacity>

            {/* Google Sign Up */}
            <TouchableOpacity
              style={[styles.googleSignUpButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={async () => {
                try {
                  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                  try { await GoogleSignin.signOut(); } catch (e) { }

                  const signInResult = await GoogleSignin.signIn();
                  const idToken = (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;

                  if (!idToken) {
                    throw new Error('No idToken received');
                  }

                  const googleCredential = GoogleAuthProvider.credential(idToken);
                  const userCredential = await signInWithCredential(auth, googleCredential);
                  console.log('Google Sign Up successful, user:', userCredential.user.uid);

                  // Try to check if user profile exists, but navigate anyway if Firestore is unavailable
                  let isExistingUser = false;
                  try {
                    const firestore = require('@react-native-firebase/firestore').default;
                    const userDoc = await firestore().collection('users').doc(userCredential.user.uid).get();
                    isExistingUser = userDoc.exists;
                  } catch (firestoreError: any) {
                    console.log('Firestore check failed (will treat as new user):', firestoreError?.code);
                    // Continue as new user - profile completion will create the doc
                  }

                  if (!isExistingUser) {
                    // New user or Firestore unavailable - go to profile completion
                    console.log('Navigating to GoogleProfile');
                    navigation.navigate('GoogleProfile', {
                      user: {
                        uid: userCredential.user.uid,
                        email: userCredential.user.email,
                        displayName: userCredential.user.displayName,
                        photoURL: userCredential.user.photoURL,
                      }
                    });
                  } else {
                    // Existing user - go to app
                    console.log('Existing Google user, navigating to App');
                    showToast('Welcome back! 🎉');
                    navigation.navigate('App');
                  }
                } catch (error: any) {
                  console.log('Google Sign Up error:', error);
                  if (error?.code !== statusCodes.SIGN_IN_CANCELLED) {
                    // Only show error if it's not a Firestore issue (user is already signed in at this point)
                    if (error?.code === 'firestore/unavailable') {
                      // User is signed in, just navigate to profile completion
                      navigation.navigate('GoogleProfile', {
                        user: {
                          uid: auth.currentUser?.uid,
                          email: auth.currentUser?.email,
                          displayName: auth.currentUser?.displayName,
                          photoURL: auth.currentUser?.photoURL,
                        }
                      });
                    } else {
                      Alert.alert('Sign Up Failed', error?.message || 'Could not sign up with Google');
                    }
                  }
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[styles.googleButtonText, { color: colors.text }]}>Sign up with Google</Text>
            </TouchableOpacity>
          </View>
        </Animatable.View>

        {/* Terms */}
        <Animatable.Text
          animation="fadeIn"
          delay={300}
          style={[styles.terms, { color: colors.textSecondary }]}
        >
          By continuing, you agree to our{' '}
          <Text style={{ color: colors.primary }} onPress={() => navigation.navigate('Terms')}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text style={{ color: colors.primary }} onPress={() => navigation.navigate('PrivacyPolicy')}>
            Privacy Policy
          </Text>
        </Animatable.Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    justifyContent: 'space-between',
    paddingBottom: SPACING.xxl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.xl,
  },
  welcome: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    marginBottom: SPACING.xxxl,
    lineHeight: 24,
  },
  buttonsContainer: {
    gap: SPACING.lg,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
  },
  googleIcon: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: SPACING.lg,
    fontSize: FONT_SIZE.sm,
  },
  createButton: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  googleSignUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  terms: {
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default StartScreen;
