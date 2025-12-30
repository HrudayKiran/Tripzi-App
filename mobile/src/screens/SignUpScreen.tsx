import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

interface Errors {
  email?: string;
  fullName?: string;
  password?: string;
  confirmPassword?: string;
  phoneNumber?: string;
  terms?: string;
}

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
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const { colors } = useTheme();

  const validatePhoneNumber = (phone: string) => {
    // Indian phone number validation (10 digits)
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const handleFieldChange = useCallback((field: string, value: string) => {
    switch (field) {
      case 'email': setEmail(value); break;
      case 'fullName': setFullName(value); break;
      case 'phoneNumber': setPhoneNumber(value); break;
      case 'password': setPassword(value); break;
      case 'confirmPassword': setConfirmPassword(value); break;
    }
  }, []);

  const handleBlur = useCallback((field: string, value: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    const newErrors = { ...errors };
    switch (field) {
      case 'email':
        if (!value) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(value)) newErrors.email = 'Invalid email format';
        else delete newErrors.email;
        break;
      case 'fullName':
        if (!value) newErrors.fullName = 'Full name is required';
        else if (value.length < 2) newErrors.fullName = 'Name too short';
        else delete newErrors.fullName;
        break;
      case 'phoneNumber':
        if (value && !validatePhoneNumber(value)) newErrors.phoneNumber = 'Enter valid 10-digit number';
        else delete newErrors.phoneNumber;
        break;
      case 'password':
        if (!value) newErrors.password = 'Password is required';
        else if (value.length < 6) newErrors.password = 'Min 6 characters';
        else delete newErrors.password;
        break;
      case 'confirmPassword':
        if (!value) newErrors.confirmPassword = 'Confirm password is required';
        else if (value !== password) newErrors.confirmPassword = 'Passwords do not match';
        else delete newErrors.confirmPassword;
        break;
    }
    setErrors(newErrors);
  }, [errors, password]);

  const handleSignUp = async () => {
    const newErrors: Errors = {};

    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';

    if (!fullName) newErrors.fullName = 'Full name is required';

    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
      newErrors.phoneNumber = 'Enter valid 10-digit number';
    }

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Min 6 characters';

    if (!confirmPassword) newErrors.confirmPassword = 'Confirm password is required';
    else if (confirmPassword !== password) newErrors.confirmPassword = 'Passwords do not match';

    if (!agreedToTerms) newErrors.terms = 'Required';

    setErrors(newErrors);
    setTouched({ email: true, fullName: true, password: true, confirmPassword: true, phoneNumber: true });

    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      console.log('📝 Creating account...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;
      console.log('✅ Account created:', user.uid);

      console.log('📝 Updating profile...');
      await updateProfile(user, { displayName: fullName });
      console.log('✅ Profile updated');

      // Save to Firestore using React Native Firebase with timeout fallback
      console.log('📝 Saving to Firestore...');
      try {
        const firestorePromise = firestore().collection('users').doc(user.uid).set({
          displayName: fullName,
          email,
          phoneNumber: phoneNumber || null,
          phoneVerified: false,
          emailVerified: false,
          createdAt: firestore.FieldValue.serverTimestamp(),
          kycStatus: 'pending',
        });

        // Wait max 8 seconds for Firestore, then proceed anyway
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 8000)
        );

        await Promise.race([firestorePromise, timeoutPromise]);
        console.log('✅ User saved to Firestore');
      } catch (firestoreError: any) {
        console.log('⚠️ Firestore save issue:', firestoreError?.message || firestoreError);
        // Continue anyway - user is authenticated, Firestore will sync later
      }

      console.log('🚀 Navigating to App...');
      // Reset navigation stack and go to App
      navigation.reset({
        index: 0,
        routes: [{ name: 'App' }],
      });
    } catch (error: any) {
      console.log('❌ SignUp Error:', error?.code, error?.message);
      let errorMessage = 'Failed to create account';
      if (error?.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already registered';
      } else if (error?.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error?.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      Alert.alert('Sign Up Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    icon: string,
    placeholder: string,
    value: string,
    field: string,
    options?: {
      keyboardType?: 'default' | 'email-address' | 'phone-pad';
      secureTextEntry?: boolean;
      showToggle?: boolean;
      isSecure?: boolean;
      onToggle?: () => void;
    }
  ) => {
    const hasError = errors[field] && touched[field];
    return (
      <View>
        <View style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBackground,
            borderColor: hasError ? '#EF4444' : 'transparent',
            borderWidth: hasError ? 1 : 0
          }
        ]}>
          <Ionicons name={icon as any} size={20} color={hasError ? '#EF4444' : colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            value={value}
            onChangeText={(text) => handleFieldChange(field, text)}
            onBlur={() => handleBlur(field, value)}
            secureTextEntry={options?.secureTextEntry}
            keyboardType={options?.keyboardType || 'default'}
            autoCapitalize={options?.keyboardType === 'email-address' ? 'none' : 'words'}
            autoCorrect={false}
          />
          {options?.showToggle && (
            <TouchableOpacity onPress={options.onToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={options.isSecure ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {hasError && <Text style={styles.errorText}>{errors[field]}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
              Create Your Account
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Connect with thousands of travellers to explore the world, not alone
            </Text>

            {/* Form */}
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.text }]}>
                Email Address <Text style={styles.required}>*</Text>
              </Text>
              {renderInput('mail-outline', 'hello@example.com', email, 'email', { keyboardType: 'email-address' })}

              <Text style={[styles.label, { color: colors.text }]}>
                Full Name <Text style={styles.required}>*</Text>
              </Text>
              {renderInput('person-outline', 'Your full name', fullName, 'fullName')}

              <Text style={[styles.label, { color: colors.text }]}>
                Phone Number <Text style={[styles.optional, { color: colors.textSecondary }]}>(Optional)</Text>
              </Text>
              {renderInput('call-outline', '9876543210', phoneNumber, 'phoneNumber', { keyboardType: 'phone-pad' })}

              <Text style={[styles.label, { color: colors.text }]}>
                Password <Text style={styles.required}>*</Text>
              </Text>
              {renderInput('lock-closed-outline', 'Create a password', password, 'password', {
                secureTextEntry: !showPassword,
                showToggle: true,
                isSecure: !showPassword,
                onToggle: () => setShowPassword(!showPassword),
              })}

              <Text style={[styles.label, { color: colors.text }]}>
                Confirm Password <Text style={styles.required}>*</Text>
              </Text>
              {renderInput('lock-closed-outline', 'Confirm your password', confirmPassword, 'confirmPassword', {
                secureTextEntry: !showConfirmPassword,
                showToggle: true,
                isSecure: !showConfirmPassword,
                onToggle: () => setShowConfirmPassword(!showConfirmPassword),
              })}

              {/* Terms Checkbox */}
              <TouchableOpacity
                style={styles.termsContainer}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: errors.terms ? '#EF4444' : colors.primary, backgroundColor: agreedToTerms ? colors.primary : 'transparent' }
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
                  {' '}<Text style={styles.required}>*</Text>
                </Text>
              </TouchableOpacity>
              {errors.terms && <Text style={[styles.errorText, { marginTop: -SPACING.sm }]}>Please agree to terms</Text>}

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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  contentContainer: { paddingBottom: SPACING.xxxl },
  header: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  backButton: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: 'center', alignItems: 'center', marginLeft: -SPACING.sm },
  title: { fontSize: FONT_SIZE.xxxl, fontWeight: FONT_WEIGHT.bold, marginHorizontal: SPACING.xl, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZE.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.xl, lineHeight: 22 },
  form: { paddingHorizontal: SPACING.xl },
  label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm, marginTop: SPACING.md },
  required: { color: '#EF4444', fontSize: FONT_SIZE.sm },
  optional: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.regular },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, gap: SPACING.md },
  input: { flex: 1, fontSize: FONT_SIZE.md },
  errorText: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, marginLeft: SPACING.sm },
  termsContainer: { flexDirection: 'row', alignItems: 'flex-start', marginTop: SPACING.xl, gap: SPACING.md },
  checkbox: { width: 24, height: 24, borderRadius: BORDER_RADIUS.sm, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  termsText: { flex: 1, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  signUpButton: { paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.xl },
  signUpButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  signInContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  signInText: { fontSize: FONT_SIZE.sm },
  signInLink: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
});

export default SignUpScreen;
