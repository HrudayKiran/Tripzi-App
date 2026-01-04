import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import AppLogo from '../components/AppLogo';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { colors } = useTheme();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await auth().sendPasswordResetEmail(email);
      Alert.alert(
        'Email Sent! 📧',
        `A password reset link has been sent to ${email}.`,
        [{ text: 'OK', onPress: () => navigation.navigate('SignIn') }]
      );
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') Alert.alert('Error', 'No account found');
      else Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const isFocused = focusedField === 'email';

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#9d74f7', '#6d28d9']}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header Section */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Animatable.View animation="fadeInLeft" duration={800} style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Reset{'\n'}Password</Text>
            <Text style={styles.headerSubtitle}>Don't worry, it happens to the best of us.</Text>
          </Animatable.View>
        </View>

        {/* Bottom Sheet Content */}
        <Animatable.View
          animation="fadeInUpBig"
          duration={800}
          style={[styles.bottomSheet, { backgroundColor: colors.background }]}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.content}>

              {/* App Logo Display */}
              <View style={styles.logoContainer}>
                <AppLogo size={100} showDot={true} />
              </View>

              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
                <Animatable.View
                  transition={['borderColor']}
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: isFocused ? '#8B5CF6' : 'transparent',
                      borderWidth: 1.5,
                      transform: [{ scale: isFocused ? 1.02 : 1 }]
                    }
                  ]}
                >
                  <Ionicons name="mail-outline" size={20} color={isFocused ? '#8B5CF6' : colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="hello@example.com"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </Animatable.View>
              </View>

              {/* Send Button */}
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetPassword}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.resetButtonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              {/* Back to Login */}
              <TouchableOpacity
                style={styles.backLink}
                onPress={() => navigation.navigate('SignIn')}
              >
                <Text style={[styles.backText, { color: colors.textSecondary }]}>
                  Remember Password? <Text style={styles.linkHighlight}>Sign In</Text>
                </Text>
              </TouchableOpacity>

            </View>
          </KeyboardAvoidingView>
        </Animatable.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    height: '25%', // Slightly smaller header for this screen
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTextContainer: { gap: 8 },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 42,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    maxWidth: '80%',
  },
  bottomSheet: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  content: {
    gap: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  inputWrapper: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 12,
  },
  input: { flex: 1, fontSize: 16 },
  resetButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  backText: { fontSize: 14 },
  linkHighlight: {
    color: '#8B5CF6',
    fontWeight: '700',
  },
});

export default ForgotPasswordScreen;
