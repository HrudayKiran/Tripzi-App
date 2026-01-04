import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { colors } = useTheme();

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      import('react-native').then(({ ToastAndroid }) => {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      });
    } else {
      Alert.alert('Success', message);
    }
  };

  const validatePhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const handleSignUp = async () => {
    const newErrors: Errors = {};
    if (!email) newErrors.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid format';
    if (!fullName) newErrors.fullName = 'Required';
    if (phoneNumber && !validatePhoneNumber(phoneNumber)) newErrors.phoneNumber = 'Invalid number';
    if (!password) newErrors.password = 'Required';
    else if (password.length < 6) newErrors.password = 'Min 6 chars';
    if (confirmPassword !== password) newErrors.confirmPassword = 'Mismatch';
    if (!agreedToTerms) newErrors.terms = 'Required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const { user } = userCredential;
      await user.updateProfile({ displayName: fullName });

      try {
        await firestore().collection('users').doc(user.uid).set({
          userId: user.uid, email, displayName: fullName,
          username: fullName.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 1000),
          phoneNumber: phoneNumber || null,
          role: 'user', kycStatus: 'pending', followers: [], following: [], rating: 0,
          createdAt: firestore.FieldValue.serverTimestamp(),
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) { console.error(e); }

      showToast('Account Created! 🎉');
      navigation.reset({ index: 0, routes: [{ name: 'App' }] });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') Alert.alert('Error', 'Email already used');
      else Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (icon: any, placeholder: string, value: string, setValue: any, fieldName: string, options: any = {}) => {
    const isFocused = focusedField === fieldName;
    const hasError = errors[fieldName as keyof Errors];

    return (
      <View style={styles.inputWrapper}>
        <Text style={[styles.label, { color: colors.text }]}>
          {fieldName === 'fullName' ? 'Full Name' :
            fieldName === 'phoneNumber' ? 'Phone (Optional)' :
              fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')}
        </Text>
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
            onChangeText={(text) => { setValue(text); if (errors[fieldName as keyof Errors]) setErrors(prev => ({ ...prev, [fieldName]: undefined })); }}
            onFocus={() => setFocusedField(fieldName)}
            onBlur={() => setFocusedField(null)}
            {...options}
          />
          {options.toggleSecure && (
            <TouchableOpacity onPress={options.toggleSecure}>
              <Ionicons name={options.secureTextEntry ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </Animatable.View>
        {hasError && <Text style={styles.errorText}>{hasError}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9d74f7', '#6d28d9']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton} onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Animatable.View animation="fadeInLeft" duration={800} style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Create{'\n'}Account</Text>
            <Text style={styles.headerSubtitle}>Join thousands of travelers</Text>
          </Animatable.View>
        </View>

        {/* Bottom Sheet */}
        <Animatable.View animation="fadeInUpBig" duration={800} style={[styles.bottomSheet, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>

              {renderInput('mail-outline', 'hello@example.com', email, setEmail, 'email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
              {renderInput('person-outline', 'Your Full Name', fullName, setFullName, 'fullName')}
              {renderInput('call-outline', '9876543210', phoneNumber, setPhoneNumber, 'phoneNumber', { keyboardType: 'phone-pad' })}

              {renderInput('lock-closed-outline', 'Create password', password, setPassword, 'password', {
                secureTextEntry: !showPassword, toggleSecure: () => setShowPassword(!showPassword)
              })}
              {renderInput('lock-closed-outline', 'Confirm password', confirmPassword, setConfirmPassword, 'confirmPassword', {
                secureTextEntry: !showConfirmPassword, toggleSecure: () => setShowConfirmPassword(!showConfirmPassword)
              })}

              {/* Terms */}
              <TouchableOpacity style={styles.termsContainer} onPress={() => setAgreedToTerms(!agreedToTerms)}>
                <View style={[styles.checkbox, { backgroundColor: agreedToTerms ? '#8B5CF6' : 'transparent', borderColor: errors.terms ? '#EF4444' : '#8B5CF6' }]}>
                  {agreedToTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.termsText}>I agree to the <Text style={styles.linkText}>Terms</Text> & <Text style={styles.linkText}>Privacy Policy</Text></Text>
              </TouchableOpacity>
              {errors.terms && <Text style={styles.errorText}>Please agree to terms</Text>}

              <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('SignIn')}><Text style={styles.linkText}>Sign In</Text></TouchableOpacity>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </Animatable.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { height: '25%', paddingHorizontal: 24, paddingTop: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  headerTextContainer: { gap: 4 },
  headerTitle: { fontSize: 36, fontWeight: '800', color: '#fff', lineHeight: 42 },
  headerSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  bottomSheet: { flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 32 },
  formContent: { gap: 16, paddingBottom: 40 },
  inputWrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, gap: 12 },
  input: { flex: 1, fontSize: 15 },
  errorText: { color: '#EF4444', fontSize: 11, marginLeft: 4 },
  termsContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  termsText: { fontSize: 13, color: '#666' },
  linkText: { color: '#8B5CF6', fontWeight: '700' },
  signUpButton: { backgroundColor: '#8B5CF6', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { fontSize: 14, color: '#666' },
});

export default SignUpScreen;
