import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const SignInScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const { colors } = useTheme();

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Success', message);
    }
  };

  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };

    if (field === 'email') {
      if (!value) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(value)) newErrors.email = 'Invalid email format';
      else delete newErrors.email;
    }

    if (field === 'password') {
      if (!value) newErrors.password = 'Password is required';
      else if (value.length < 6) newErrors.password = 'Min 6 characters';
      else delete newErrors.password;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    // Validate all fields
    setTouched({ email: true, password: true });
    const newErrors: { email?: string; password?: string } = {};

    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';

    if (!password) newErrors.password = 'Password is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      // Update lastLoginAt
      try {
        await firestore().collection('users').doc(userCredential.user.uid).update({
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) { }

      showToast('Login successful! 🎉');
      navigation.navigate('App');
    } catch (error: any) {
      // Error handled silently

      if (error?.code === 'auth/invalid-email' || error?.code === 'auth/user-not-found') {
        setErrors({ email: 'Email not found or invalid' });
      } else if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        setErrors({ password: 'Password is incorrect' });
      } else if (error?.code === 'auth/too-many-requests') {
        Alert.alert('Too Many Attempts', 'Please try again later.');
      } else if (error?.code === 'auth/network-request-failed') {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Sign In Failed', 'Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header with Back Button */}
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

        <Animatable.View animation="fadeInUp" duration={500} style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to continue your journey
          </Text>

          <View style={styles.form}>
            {/* Email Input */}
            <View>
              <Text style={[styles.label, { color: colors.text }]}>
                Email <Text style={styles.required}>*</Text>
              </Text>
              <View style={[
                styles.inputContainer,
                { backgroundColor: colors.inputBackground },
                errors.email && touched.email && { borderColor: '#EF4444', borderWidth: 1 }
              ]}>
                <Ionicons name="mail-outline" size={20} color={errors.email && touched.email ? '#EF4444' : colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (touched.email) validateField('email', text);
                  }}
                  onBlur={() => {
                    setTouched(prev => ({ ...prev, email: true }));
                    validateField('email', email);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {errors.email && touched.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Password Input */}
            <View>
              <Text style={[styles.label, { color: colors.text }]}>
                Password <Text style={styles.required}>*</Text>
              </Text>
              <View style={[
                styles.inputContainer,
                { backgroundColor: colors.inputBackground },
                errors.password && touched.password && { borderColor: '#EF4444', borderWidth: 1 }
              ]}>
                <Ionicons name="lock-closed-outline" size={20} color={errors.password && touched.password ? '#EF4444' : colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (touched.password) validateField('password', text);
                  }}
                  onBlur={() => {
                    setTouched(prev => ({ ...prev, password: true }));
                    validateField('password', password);
                  }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && touched.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.forgotPassword, { color: colors.primary }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInButton, { backgroundColor: colors.primary }]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('SignUp')}
                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
              >
                <Text style={[styles.signUpText, { color: colors.primary }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animatable.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  backButton: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: 'center', alignItems: 'center', marginLeft: -SPACING.sm },
  content: { flex: 1, paddingHorizontal: SPACING.xxl, justifyContent: 'center' },
  title: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZE.md, marginBottom: SPACING.xxxl },
  form: { gap: SPACING.md },
  label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm },
  required: { color: '#EF4444' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, gap: SPACING.md },
  input: { flex: 1, fontSize: FONT_SIZE.md, paddingVertical: SPACING.sm },
  eyeButton: { padding: SPACING.xs },
  errorText: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, marginLeft: SPACING.sm },
  forgotButton: { alignSelf: 'flex-end' },
  forgotPassword: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  signInButton: { paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.sm },
  signInButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: SPACING.lg },
  footerText: { fontSize: FONT_SIZE.sm },
  signUpText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
});

export default SignInScreen;
