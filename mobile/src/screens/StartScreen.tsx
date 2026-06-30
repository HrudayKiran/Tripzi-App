import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ToastAndroid, Platform, Dimensions, ActivityIndicator, TextInput, KeyboardAvoidingView, ScrollView, Keyboard, TouchableWithoutFeedback, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BRAND, NEUTRAL, STATUS } from '../styles';
import AppLogo from '../components/AppLogo';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import { workersApi } from '../lib/workersApi';
import { useRouter } from 'expo-router';
import { z } from 'zod';

const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

// Zod Validation Schemas
const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, { message: "Full name must be at least 2 characters." }),
  username: z.string().trim().regex(USERNAME_REGEX, {
    message: "Username must be 3-20 characters (lowercase letters, numbers, and underscores only)."
  }),
  gender: z.enum(['male', 'female']).nullable().refine((val) => val !== null, {
    message: "Please select your gender."
  }),
  email: z.string().trim().email({ message: "Invalid email address." }),
  password: z.string().regex(PASSWORD_REGEX, { message: "Password must have uppercase, lowercase, number, and symbol." }),
});

const forgotEmailSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address." }),
});

const forgotOtpSchema = z.object({
  otpCode: z.string().trim().min(1, { message: "Verification code is required." }),
});

const forgotNewSchema = z.object({
  newPassword: z.string().regex(PASSWORD_REGEX, { message: "Password must have uppercase, lowercase, number, and symbol." }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type AuthMode = 'landing' | 'login' | 'signup' | 'signup-otp' | 'forgot-email' | 'forgot-otp' | 'forgot-new';

const StartScreen = () => {
  const { colors } = useTheme();
  const router = useRouter();
  
  // App States
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('landing');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const onBackPress = () => {
      if (mode === 'login' || mode === 'signup' || mode === 'forgot-email') {
        changeMode('landing');
        return true;
      } else if (mode === 'forgot-otp') {
        changeMode('forgot-email');
        return true;
      } else if (mode === 'signup-otp') {
        changeMode('login');
        return true;
      } else if (mode === 'forgot-new') {
        changeMode('forgot-otp');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [mode]);
  
  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Sign up fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameOk, setUsernameOk] = useState(false);

  // Forgot password fields
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Success', message);
    }
  };

  const changeMode = (newMode: AuthMode) => {
    setErrors({});
    
    // Clear fields if moving to/from landing, or switching between login and signup
    if (
      newMode === 'landing' || 
      mode === 'landing' || 
      (mode === 'login' && newMode === 'signup') || 
      (mode === 'signup' && newMode === 'login')
    ) {
      setEmail('');
      setPassword('');
      setFullName('');
      setUsername('');
      setGender(null);
      setUsernameOk(false);
      setResetEmail('');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    }
    
    setMode(newMode);
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

  // Debounced Username availability check during Sign-up
  useEffect(() => {
    if (mode !== 'signup') return;
    
    let active = true;
    let timeout: any;

    const run = async () => {
      const value = username.trim().toLowerCase();
      if (!value) {
        setErrors(prev => {
          const updated = { ...prev };
          delete updated.username;
          return updated;
        });
        setUsernameOk(false);
        return;
      }

      if (!USERNAME_REGEX.test(value)) {
        setErrors(prev => ({
          ...prev,
          username: 'Use 3-20 chars: lowercase letters, numbers, underscore'
        }));
        setUsernameOk(false);
        return;
      }

      setCheckingUsername(true);
      setErrors(prev => {
        const updated = { ...prev };
        delete updated.username;
        return updated;
      });
      setUsernameOk(false);
      try {
        const response = await workersApi(`/account/check-username/${value}`, { method: 'GET' });
        if (!active) return;
        if (response.available) {
          setUsernameOk(true);
        } else {
          setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
          setUsernameOk(false);
        }
      } catch (error) {
        if (!active) return;
        setErrors(prev => ({ ...prev, username: 'Could not validate username. Try again.' }));
        setUsernameOk(false);
      } finally {
        if (active) {
          setCheckingUsername(false);
        }
      }
    };

    timeout = setTimeout(run, 350);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [username, mode]);

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

  // Email & Password Login Handler
  const handleEmailLogin = async () => {
    setErrors({});
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (path !== undefined) newErrors[String(path)] = issue.message;
      });
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      const user = data?.user;
      if (!user) throw new Error('Failed to sign in.');

      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, username')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.name && profile.username) {
        supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id)
          .then(() => {});

        showToast('Welcome back! 🎉');
        router.replace('/(tabs)');
      } else {
        // Redirect to complete profile if they don't have one
        router.push({
          pathname: '/(auth)/complete-profile',
          params: {
            email: user.email,
            displayName: user.user_metadata?.full_name || '',
          }
        });
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Email & Password Sign Up Handler
  const handleEmailRegister = async () => {
    setErrors({});
    const valUsername = username.trim().toLowerCase();
    const result = signupSchema.safeParse({
      fullName,
      username: valUsername,
      gender,
      email,
      password
    });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (path !== undefined) newErrors[String(path)] = issue.message;
      });
      setErrors(newErrors);
      return;
    }
    if (!usernameOk) {
      setErrors(prev => ({ ...prev, username: 'Please choose a valid and available username.' }));
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: fullName.trim(),
            username: valUsername,
            gender: gender,
          }
        }
      });

      if (authError) throw authError;

      const user = authData?.user;
      if (!user) throw new Error('SignUp failed.');

      // Insert profile details (Database trigger handles this as well, but we do this for immediate local availability)
      try {
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: email.trim(),
            name: fullName.trim(),
            username: valUsername,
            gender: gender,
            last_login_at: new Date().toISOString(),
          });
      } catch (profileErr) {
        console.log('[StartScreen] Profile insert bypassed (likely handled by trigger):', profileErr);
      }

      const session = authData?.session;
      if (session) {
        showToast('Registration successful! 🎉');
        router.replace('/(tabs)');
      } else {
        showToast('Verification code sent to your email.');
        changeMode('signup-otp');
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong during sign up.');
    } finally {
      setLoading(false);
    }
  };

  // Sign up: Verify OTP Code
  const handleVerifySignupOtp = async () => {
    setErrors({});
    const result = forgotOtpSchema.safeParse({ otpCode });
    if (!result.success) {
      setErrors({ otpCode: result.error.issues[0].message });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'signup',
      });
      if (error) throw error;
      
      const session = data?.session;
      if (session) {
        showToast('Registration successful! 🎉');
        router.replace('/(tabs)');
      } else {
         Alert.alert('Error', 'Verification failed or session not established.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Verification failed. Double check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Send OTP Code
  const handleSendResetCode = async () => {
    setErrors({});
    const result = forgotEmailSchema.safeParse({ email: resetEmail });
    if (!result.success) {
      setErrors({ resetEmail: result.error.issues[0].message });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
      if (error) throw error;
      showToast('Reset code sent to your email!');
      changeMode('forgot-otp');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Verify OTP Code
  const handleVerifyResetCode = async () => {
    setErrors({});
    const result = forgotOtpSchema.safeParse({ otpCode });
    if (!result.success) {
      setErrors({ otpCode: result.error.issues[0].message });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: resetEmail.trim(),
        token: otpCode.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      
      showToast('Code verified! Enter new password.');
      changeMode('forgot-new');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Verification failed. Double check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Save New Password
  const handleUpdatePassword = async () => {
    setErrors({});
    const result = forgotNewSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (path !== undefined) newErrors[String(path)] = issue.message;
      });
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      
      Alert.alert('Success', 'Your password has been reset successfully. Please log in with your new password.', [
        {
          text: 'OK',
          onPress: () => {
            setEmail(resetEmail);
            setPassword('');
            setResetEmail('');
            setOtpCode('');
            setNewPassword('');
            setConfirmPassword('');
            changeMode('login');
          }
        }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const renderLoginForm = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.formContainer}
    >
      <Text style={styles.formTitle}>Welcome Back</Text>
      <Text style={styles.formSubtitle}>Sign in to continue planning your trip</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Envelope" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.email && styles.inputError]}
            placeholder="email@example.com"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        {errors.email ? <Text style={styles.fieldErrorText}>{errors.email}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.inputLabel}>Password</Text>
          <TouchableOpacity onPress={() => changeMode('forgot-email')}>
            <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputWrapper}>
          <Icon name="Lock" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.password && styles.inputError]}
            placeholder="Enter password"
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
        </View>
        {errors.password ? <Text style={styles.fieldErrorText}>{errors.password}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleEmailLogin}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color={BRAND.primary} />
        ) : (
          <Text style={styles.submitBtnText}>Log In</Text>
        )}
      </TouchableOpacity>

      <View style={styles.switchAuthRow}>
        <Text style={styles.switchAuthText}>New to NxtVibes? </Text>
        <TouchableOpacity onPress={() => changeMode('signup')}>
          <Text style={styles.switchAuthLink}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );

  const renderSignupForm = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.formContainer}
    >
      <Text style={styles.formTitle}>Create Account</Text>
      <Text style={styles.formSubtitle}>Join NxtVibes and start traveling</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Full Name</Text>
        <View style={styles.inputWrapper}>
          <Icon name="User" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.fullName && styles.inputError]}
            placeholder="John Doe"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>
        {errors.fullName ? <Text style={styles.fieldErrorText}>{errors.fullName}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Username</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Hash" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, { paddingRight: 40 }, errors.username && styles.inputError]}
            placeholder="username"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="none"
            value={username}
            onChangeText={(val) => setUsername(val.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          />
          {checkingUsername && (
            <ActivityIndicator size="small" color={NEUTRAL.white} style={styles.inputIconRight} />
          )}
          {!checkingUsername && usernameOk && (
            <Icon name="CheckCircle" size={20} color={STATUS.success} style={styles.inputIconRight} />
          )}
          {!checkingUsername && errors.username ? (
            <Icon name="XCircle" size={20} color={STATUS.error} style={styles.inputIconRight} />
          ) : null}
        </View>
        {errors.username ? (
          <Text style={styles.fieldErrorText}>{errors.username}</Text>
        ) : usernameOk ? (
          <Text style={styles.fieldOkText}>Username is available</Text>
        ) : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Gender</Text>
        <View style={[styles.genderRow, errors.gender && styles.genderErrorBorder]}>
          <TouchableOpacity
            style={[
              styles.genderOption,
              gender === 'male' && styles.genderSelected
            ]}
            onPress={() => setGender('male')}
            activeOpacity={0.8}
          >
            <Text style={[styles.genderText, gender === 'male' && styles.genderTextSelected]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.genderOption,
              gender === 'female' && styles.genderSelected
            ]}
            onPress={() => setGender('female')}
            activeOpacity={0.8}
          >
            <Text style={[styles.genderText, gender === 'female' && styles.genderTextSelected]}>Female</Text>
          </TouchableOpacity>
        </View>
        {errors.gender ? <Text style={styles.fieldErrorText}>{errors.gender}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Envelope" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.email && styles.inputError]}
            placeholder="email@example.com"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        {errors.email ? <Text style={styles.fieldErrorText}>{errors.email}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Lock" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.password && styles.inputError]}
            placeholder="At least 6 characters"
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
        </View>
        {errors.password ? <Text style={styles.fieldErrorText}>{errors.password}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleEmailRegister}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color={BRAND.primary} />
        ) : (
          <Text style={styles.submitBtnText}>Register</Text>
        )}
      </TouchableOpacity>

      <View style={styles.switchAuthRow}>
        <Text style={styles.switchAuthText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => changeMode('login')}>
          <Text style={styles.switchAuthLink}>Log In</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );

  const renderForgotEmailForm = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.formContainer}
    >
      <Text style={styles.formTitle}>Reset Password</Text>
      <Text style={styles.formSubtitle}>Enter your email to receive a password reset verification code</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Envelope" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.resetEmail && styles.inputError]}
            placeholder="email@example.com"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={resetEmail}
            onChangeText={setResetEmail}
          />
        </View>
        {errors.resetEmail ? <Text style={styles.fieldErrorText}>{errors.resetEmail}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSendResetCode}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color={BRAND.primary} />
        ) : (
          <Text style={styles.submitBtnText}>Send Reset Code</Text>
        )}
      </TouchableOpacity>
    </MotiView>
  );

  const renderSignupOtpForm = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.formContainer}
    >
      <Text style={styles.formTitle}>Confirm Your Email</Text>
      <Text style={styles.formSubtitle}>Enter the verification code sent to {email}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Verification Code</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Key" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.otpCode && styles.inputError]}
            placeholder="Enter 6-digit code"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            autoCapitalize="none"
            value={otpCode}
            onChangeText={(val) => {
              setOtpCode(val);
              if (errors.otpCode) setErrors(prev => ({ ...prev, otpCode: '' }));
            }}
          />
        </View>
        {errors.otpCode ? <Text style={styles.fieldErrorText}>{errors.otpCode}</Text> : null}
      </View>

      <TouchableOpacity 
        style={styles.submitBtn}
        onPress={handleVerifySignupOtp}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Verify & Login</Text>}
      </TouchableOpacity>
    </MotiView>
  );

  const renderForgotOtpForm = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.formContainer}
    >
      <Text style={styles.formTitle}>Verification Code</Text>
      <Text style={styles.formSubtitle}>Enter the verification code sent to {resetEmail}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Verification Code</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Key" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.otpCode && styles.inputError]}
            placeholder="Enter code"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            autoCapitalize="none"
            value={otpCode}
            onChangeText={setOtpCode}
          />
        </View>
      </View>
      {errors.otpCode ? <Text style={styles.fieldErrorText}>{errors.otpCode}</Text> : null}

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleVerifyResetCode}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color={BRAND.primary} />
        ) : (
          <Text style={styles.submitBtnText}>Verify Code</Text>
        )}
      </TouchableOpacity>
    </MotiView>
  );

  const renderForgotNewForm = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.formContainer}
    >
      <Text style={styles.formTitle}>New Password</Text>
      <Text style={styles.formSubtitle}>Set your new password to secure your account</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>New Password</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Lock" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.newPassword && styles.inputError]}
            placeholder="At least 6 characters"
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            autoCapitalize="none"
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>
        {errors.newPassword ? <Text style={styles.fieldErrorText}>{errors.newPassword}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Lock" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <TextInput
            style={[styles.formInput, errors.confirmPassword && styles.inputError]}
            placeholder="Confirm new password"
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>
        {errors.confirmPassword ? <Text style={styles.fieldErrorText}>{errors.confirmPassword}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleUpdatePassword}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color={BRAND.primary} />
        ) : (
          <Text style={styles.submitBtnText}>Update Password</Text>
        )}
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Fixed Background Gradient (never resizes or shifts when keyboard opens) */}
          <LinearGradient
            colors={[...BRAND.authGradient]}
            locations={[0, 0.4, 1]}
            style={styles.backgroundGradient}
          />

          <SafeAreaView style={styles.safeArea}>
            {mode === 'landing' ? (
              <View style={styles.content}>
                {/* Animated Logo Section */}
                <MotiView
                  from={{ opacity: 0, translateY: -20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 1000, delay: 300 }}
                  style={styles.logoSection}
                >
                  <AppLogo size={96} showDot={false} style={{ marginTop: 40 }} />
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

                  {/* Sign In with Email Button */}
                  <TouchableOpacity
                    style={styles.emailButton}
                    onPress={() => changeMode('login')}
                    activeOpacity={0.9}
                    disabled={loading}
                  >
                    <View style={styles.iconContainer}>
                      <Icon name="Envelope" size={22} color={NEUTRAL.white} />
                    </View>
                    <Text style={styles.emailButtonText}>Sign In with Email</Text>
                  </TouchableOpacity>

                  {/* Create Account Button */}
                  <TouchableOpacity
                    style={styles.signupButton}
                    onPress={() => changeMode('signup')}
                    activeOpacity={0.9}
                    disabled={loading}
                  >
                    <Text style={styles.signupButtonText}>Create an Account</Text>
                  </TouchableOpacity>

                  <Text style={styles.termsText}>
                    By continuing, you agree to our{' '}
                    <Text style={styles.linkText} onPress={() => router.push('/profile/terms')}>Terms</Text> and{' '}
                    <Text style={styles.linkText} onPress={() => router.push('/profile/privacy')}>Privacy Policy</Text>.
                  </Text>
                </MotiView>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Header Back Button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    if (mode === 'login' || mode === 'signup') {
                      changeMode('landing');
                    } else if (mode === 'forgot-email') {
                      changeMode('login');
                    } else if (mode === 'forgot-otp') {
                      changeMode('forgot-email');
                    } else if (mode === 'forgot-new') {
                      changeMode('forgot-otp');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Icon name="CaretLeft" size={24} color={NEUTRAL.white} />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                {mode === 'login' && renderLoginForm()}
                {mode === 'signup' && renderSignupForm()}
                {mode === 'forgot-email' && renderForgotEmailForm()}
                {mode === 'forgot-otp' && renderForgotOtpForm()}
                {mode === 'signup-otp' && renderSignupOtpForm()}
                {mode === 'forgot-new' && renderForgotNewForm()}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: screenWidth,
    height: screenHeight,
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
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 12,
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
    gap: 16
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEUTRAL.white,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
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
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  emailButtonText: {
    color: NEUTRAL.white,
    fontSize: 18,
    fontWeight: '600',
  },
  signupButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    width: '100%',
    maxWidth: 320,
  },
  signupButtonText: {
    color: NEUTRAL.white,
    fontSize: 16,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  termsText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 280,
    marginTop: 8,
  },
  linkText: {
    color: NEUTRAL.white,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 60,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 4,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: NEUTRAL.white,
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 20,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: NEUTRAL.white,
  },
  formSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -12,
    lineHeight: 20,
  },
  inputGroup: {
    gap: 8,
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  inputIconLeft: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  inputIconRight: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  formInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 48,
    paddingRight: 16,
    color: NEUTRAL.white,
    fontSize: 16,
  },
  forgotPasswordLink: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  submitBtn: {
    width: '100%',
    backgroundColor: NEUTRAL.white,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: NEUTRAL.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnText: {
    color: NEUTRAL.dark,
    fontSize: 18,
    fontWeight: '700',
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  switchAuthText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  switchAuthLink: {
    color: NEUTRAL.white,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  genderOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderSelected: {
    backgroundColor: NEUTRAL.white,
    borderColor: NEUTRAL.white,
  },
  genderText: {
    color: NEUTRAL.white,
    fontSize: 16,
    fontWeight: '600',
  },
  genderTextSelected: {
    color: NEUTRAL.dark,
  },
  fieldErrorText: {
    fontSize: 12,
    color: STATUS.error,
    marginTop: 4,
    paddingLeft: 4,
  },
  fieldOkText: {
    fontSize: 12,
    color: STATUS.success,
    marginTop: 4,
    paddingLeft: 4,
  },
  inputError: {
    borderColor: STATUS.error,
  },
  genderErrorBorder: {
    borderColor: STATUS.error,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 2,
  },
});

export default StartScreen;
