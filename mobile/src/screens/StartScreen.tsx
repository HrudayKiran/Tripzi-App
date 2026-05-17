import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ToastAndroid, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BRAND, NEUTRAL } from '../styles';
import AppLogo from '../components/AppLogo';
import { supabase } from '../lib/supabase';

import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const StartScreen = () => {
  const { colors } = useTheme();
  const router = useRouter();
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

      // If no idToken or email, user likely cancelled — just return silently
      if (!idToken || !googleEmail) {
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const user = authData?.user;
      if (!user) {
        throw new Error('Authentication failed. Please try again.');
      }

      // Check if user has a profile in Supabase
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, username')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.name && profile.username) {
        // Existing user with complete profile → Go to App
        // Fire-and-forget: update last login
        supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id)
          .then(() => {});

        showToast('Welcome back! 🎉');
        router.replace('/(tabs)');
      } else {
        // New user or incomplete profile → Go to profile completion
        router.push({
          pathname: '/(auth)/complete-profile',
          params: {
            email: googleEmail,
            displayName: googleDisplayName,
            photoURL: googlePhotoURL,
          }
        });
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
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 1000, delay: 300 }}
            style={styles.logoSection}
          >
            <AppLogo size={140} showGlow={true} />
            <View style={styles.textContainer}>
              <Text style={styles.appName}>NxtVibes</Text>
              <Text style={styles.tagline}>CONNECT. PLAN. TRAVEL.</Text>
            </View>
          </MotiView>

          {/* Login Button Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 1000, delay: 600 }}
            style={styles.buttonSection}
          >
            {/* Unified Google Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              activeOpacity={0.9}
              disabled={loading}
            >
              <View style={styles.iconContainer}>
                <Image
                  source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                  style={styles.googleLogo}
                  contentFit="contain"
                />
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.linkText} onPress={() => router.push('/profile/terms')}>Terms</Text> and{' '}
              <Text style={styles.linkText} onPress={() => router.push('/profile/privacy')}>Privacy Policy</Text>.
            </Text>
          </MotiView>
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
