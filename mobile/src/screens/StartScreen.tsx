import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ToastAndroid, Platform, Dimensions } from 'react-native';
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

  const handleGoogleAuth = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try { await GoogleSignin.signOut(); } catch (e) { }

      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any)?.data?.idToken || (signInResult as any)?.idToken;

      if (!idToken) throw new Error('No idToken received');

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);

      // Simple user sync logic (simplified for UI focus)
      const userDoc = await firestore().collection('users').doc(userCredential.user.uid).get();
      if (!userDoc.exists) {
        const { uid, email, displayName, photoURL } = userCredential.user;
        const username = email ? email.split('@')[0] : `user_${uid.substring(0, 5)}`;
        await firestore().collection('users').doc(uid).set({
          userId: uid, email, displayName, photoURL, username,
          createdAt: firestore.FieldValue.serverTimestamp(),
          role: 'user', kycStatus: 'none', followers: [], following: [],
        });
      }

      // Explicit navigation to ensure UI update
      navigation.reset({ index: 0, routes: [{ name: 'App' }] });
    } catch (error: any) {
      if (error?.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google Sign-In Failed', error.message);
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
            {/* Email Sign In */}
            <TouchableOpacity
              style={styles.glassButtonPrimary}
              onPress={() => navigation.navigate('SignIn')}
              activeOpacity={0.8}
            >
              <Ionicons name="mail" size={20} color="#6d28d9" style={{ opacity: 0.9 }} />
              <Text style={styles.primaryButtonText}>Sign In with Email</Text>
            </TouchableOpacity>

            {/* Google Sign In */}
            <TouchableOpacity
              style={styles.glassButtonSecondary}
              onPress={handleGoogleAuth}
              activeOpacity={0.8}
            >
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleG}>G</Text>
              </View>
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Create Account */}
            <TouchableOpacity
              style={styles.glassButtonOutline}
              onPress={() => navigation.navigate('SignUp')}
              activeOpacity={0.7}
            >
              <Text style={styles.outlineButtonText}>Create New Account</Text>
            </TouchableOpacity>

            {/* Terms Links */}
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
});

export default StartScreen;
