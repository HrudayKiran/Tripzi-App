import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const SignInScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { colors } = useTheme();

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Success', message);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setErrors({ email: !email ? 'Required' : undefined, password: !password ? 'Required' : undefined });
      return;
    }
    setLoading(true);
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      try {
        await firestore().collection('users').doc(userCredential.user.uid).update({
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) { }
      showToast('Welcome back! 🎉');
      navigation.reset({ index: 0, routes: [{ name: 'App' }] });
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (icon: any, placeholder: string, value: string, setValue: any, fieldName: string, isSecure = false, toggleSecure = undefined) => {
    const isFocused = focusedField === fieldName;
    const hasError = errors[fieldName as keyof typeof errors];

    return (
      <View style={styles.inputWrapper}>
        <Text style={[styles.label, { color: colors.text }]}>{fieldName === 'email' ? 'Email Address' : 'Password'}</Text>
        <Animatable.View
          transition={['borderColor']}
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.inputBackground,
              borderColor: hasError ? '#EF4444' : (isFocused ? '#8B5CF6' : 'transparent'),
              borderWidth: 1.5,
              transform: [{ scale: isFocused ? 1.02 : 1 }]
            }
          ]}
        >
          <Ionicons name={icon} size={20} color={isFocused ? '#8B5CF6' : colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            value={value}
            onChangeText={(text) => {
              setValue(text);
              if (errors[fieldName as keyof typeof errors]) setErrors(prev => ({ ...prev, [fieldName]: undefined }));
            }}
            onFocus={() => setFocusedField(fieldName)}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={isSecure}
            autoCapitalize="none"
          />
          {toggleSecure && (
            <TouchableOpacity onPress={toggleSecure}>
              <Ionicons name={isSecure ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </Animatable.View>
        {hasError && <Text style={styles.errorText}>{hasError}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
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
            <Text style={styles.headerTitle}>Welcome{'\n'}Back</Text>
            <Text style={styles.headerSubtitle}>Sign in to continue your journey</Text>
          </Animatable.View>
        </View>

        {/* Bottom Sheet Form */}
        <Animatable.View
          animation="fadeInUpBig"
          duration={800}
          style={[styles.bottomSheet, { backgroundColor: colors.background }]}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.formContent}>

              {renderInput('mail-outline', 'hello@example.com', email, setEmail, 'email')}
              {renderInput('lock-closed-outline', 'Enter password', password, setPassword, 'password', !showPassword, () => setShowPassword(!showPassword))}

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signInButton}
                onPress={handleSignIn}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInButtonText}>Sign In</Text>}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                  <Text style={styles.signUpLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>

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
    height: '30%',
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
    marginBottom: 24,
  },
  headerTextContainer: {
    gap: 8,
  },
  headerTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 48,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  bottomSheet: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  formContent: {
    gap: 20,
  },
  inputWrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginLeft: 4,
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: '#8B5CF6',
    fontWeight: '600',
    fontSize: 14,
  },
  signInButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  signUpLink: {
    color: '#8B5CF6',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default SignInScreen;
