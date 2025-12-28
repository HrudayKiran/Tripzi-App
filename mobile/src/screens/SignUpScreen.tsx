import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { colors } = useTheme();

  const handleSignUp = async () => {
    if (!agreedToTerms) {
      Alert.alert('Error', 'Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (!email || !fullName || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;

      await updateProfile(user, { displayName: fullName });

      await setDoc(doc(db, 'users', user.uid), {
        displayName: fullName,
        email,
        phoneNumber: phoneNumber || null,
        createdAt: serverTimestamp(),
        kycStatus: 'pending',
      });

      navigation.navigate('App');
    } catch (error: any) {
      let errorMessage = 'Failed to create account';
      if (error?.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already registered';
      } else if (error?.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error?.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      }
      Alert.alert('Sign Up Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ icon, placeholder, value, onChangeText, secureTextEntry = false, keyboardType = 'default', showToggle = false, isSecure = false, onToggle = () => { } }) => (
    <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={isSecure ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Animatable.View animation="fadeInUp" duration={500}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            Create your{'\n'}
            <Text style={{ color: colors.primary }}>account</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Connect with thousands of solo travelers exploring the world together.
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
            <InputField
              icon="mail-outline"
              placeholder="hello@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />

            <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
            <InputField
              icon="person-outline"
              placeholder="Your full name"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={[styles.label, { color: colors.text }]}>Phone Number (Optional)</Text>
            <InputField
              icon="call-outline"
              placeholder="+91 XXXXX XXXXX"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />

            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <InputField
              icon="lock-closed-outline"
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              showToggle
              isSecure={!showPassword}
              onToggle={() => setShowPassword(!showPassword)}
            />

            <Text style={[styles.label, { color: colors.text }]}>Confirm Password</Text>
            <InputField
              icon="lock-closed-outline"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              showToggle
              isSecure={!showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            />

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                { borderColor: colors.primary, backgroundColor: agreedToTerms ? colors.primary : 'transparent' }
              ]}>
                {agreedToTerms && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                I agree to the{' '}
                <Text style={{ color: colors.primary }} onPress={() => navigation.navigate('Terms')}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={{ color: colors.primary }} onPress={() => navigation.navigate('PrivacyPolicy')}>
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signUpButton, { backgroundColor: colors.primary }]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signUpButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={[styles.signInText, { color: colors.textSecondary }]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('SignIn')}
                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
              >
                <Text style={[styles.signInLink, { color: colors.primary }]}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animatable.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: SPACING.xxxl,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 22,
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.xxl,
  },
  form: {
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: SPACING.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    paddingVertical: SPACING.sm,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
  signUpButton: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  signInText: {
    fontSize: FONT_SIZE.sm,
  },
  signInLink: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
});

export default SignUpScreen;
