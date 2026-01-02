import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ToastAndroid, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
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
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
  }, []);

  // Unified Google Auth Handler
  const handleGoogleAuth = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Always sign out first to force account picker
      try { await GoogleSignin.signOut(); } catch (e) { }

      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;

      if (!idToken) throw new Error('No idToken received');

      // Use React Native Firebase auth
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);

      // Check if user exists in Firestore
      let isExistingUser = false;
      const userDoc = await firestore().collection('users').doc(userCredential.user.uid).get();
      isExistingUser = userDoc.exists;

      // Update timestamps
      if (isExistingUser) {
        await firestore().collection('users').doc(userCredential.user.uid).update({
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        });
        console.log('📱 [AUTH] Google Login existing user:', userCredential.user.uid);
      } else {
        console.log('📱 [AUTH] Google Sign-Up new user:', userCredential.user.uid);
      }

    } catch (error: any) {
      console.error('📱 [AUTH] Google auth error:', error);
      if (error?.code !== statusCodes.SIGN_IN_CANCELLED) {
        showToast('Google Sign-In failed. Please try again.');
        Alert.alert('Sign Up Failed', error.message || 'Could not sign up');
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

            {/* Google Continue Button */}
            <TouchableOpacity
              style={[styles.googleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleGoogleAuth}
              activeOpacity={0.8}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[styles.googleButtonText, { color: colors.text }]}>Continue with Google</Text>
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
              <Text style={[styles.createButtonText, { color: colors.primary }]}>Create New Account via Email</Text>
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
