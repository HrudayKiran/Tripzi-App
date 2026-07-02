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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
    message: 'Please select your gender.',
  }),
  email: z.string().trim().email({ message: "Invalid email address." }),
  password: z.string().regex(PASSWORD_REGEX, { message: "Password must have uppercase, lowercase, number, and symbol." }),
});

const forgotEmailSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address." }),
});

const forgotOtpSchema = z.object({
  otpCode: z
    .string()
    .trim()
    .min(1, { message: 'Verification code is required.' })
    .regex(/^\d{6}$/, { message: 'Enter the 6-digit code from your email.' }),
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
  const [activeEmail, setActiveEmail] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameOk, setUsernameOk] = useState(false);
  // Rate-limit: track last OTP submit time to prevent rapid re-submissions
  const lastOtpSubmitRef = React.useRef<number>(0);

  // React Hook Form setups
  const { control: loginControl, handleSubmit: handleLoginSubmit, reset: resetLogin, formState: { errors: loginErrors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const { control: signupControl, handleSubmit: handleSignupSubmit, reset: resetSignup, watch: watchSignup, setError: setSignupError, clearErrors: clearSignupErrors, formState: { errors: signupErrors } } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', username: '', gender: null as 'male' | 'female' | null, email: '', password: '' }
  });

  const { control: forgotEmailControl, handleSubmit: handleForgotEmailSubmit, reset: resetForgotEmail, formState: { errors: forgotEmailErrors } } = useForm({
    resolver: zodResolver(forgotEmailSchema),
    defaultValues: { email: '' }
  });

  const { control: otpControl, handleSubmit: handleOtpSubmit, reset: resetOtp, formState: { errors: otpErrors } } = useForm({
    resolver: zodResolver(forgotOtpSchema),
    defaultValues: { otpCode: '' }
  });

  const { control: forgotNewControl, handleSubmit: handleForgotNewSubmit, reset: resetForgotNew, formState: { errors: forgotNewErrors } } = useForm({
    resolver: zodResolver(forgotNewSchema),
    defaultValues: { newPassword: '', confirmPassword: '' }
  });

  useEffect(() => {
    const onBackPress = () => {
      if (mode === 'login' || mode === 'signup' || mode === 'forgot-email') {
        changeMode('landing');
        return true;
      } else if (mode === 'forgot-otp') {
        changeMode('forgot-email');
        return true;
      } else if (mode === 'signup-otp') {
        changeMode('signup');
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

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Success', message);
    }
  };

  const changeMode = (newMode: AuthMode) => {
    const isForgotMode = (m: AuthMode) => m.startsWith('forgot-');
    
    if (
      newMode === 'landing' || 
      mode === 'landing' || 
      (mode === 'login' && newMode === 'signup') || 
      (mode === 'signup' && newMode === 'login') ||
      (isForgotMode(mode) && !isForgotMode(newMode)) ||
      (!isForgotMode(mode) && newMode === 'forgot-email')
    ) {
      resetLogin();
      resetSignup();
      resetForgotEmail();
      resetOtp();
      resetForgotNew();
      setUsernameOk(false);
      setActiveEmail('');
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

  const watchUsername = watchSignup('username');

  // Debounced Username availability check during Sign-up
  useEffect(() => {
    if (mode !== 'signup') return;
    
    let active = true;
    let timeout: any;

    const run = async () => {
      const value = (watchUsername || '').trim().toLowerCase();
      if (!value) {
        clearSignupErrors('username');
        setUsernameOk(false);
        return;
      }

      if (!USERNAME_REGEX.test(value)) {
        setSignupError('username', { message: 'Use 3-20 chars: lowercase letters, numbers, underscore' });
        setUsernameOk(false);
        return;
      }

      setCheckingUsername(true);
      clearSignupErrors('username');
      setUsernameOk(false);
      try {
        // Use the public (unauthenticated) endpoint — no session exists during sign-up
        const response = await workersApi(
          `/public/check-username/${encodeURIComponent(value)}`,
          { method: 'GET', isPublic: true }
        );
        if (!active) return;
        if (response.available) {
          setUsernameOk(true);
        } else {
          setSignupError('username', { message: 'Username is already taken' });
          setUsernameOk(false);
        }
      } catch (error) {
        if (!active) return;
        setSignupError('username', { message: 'Could not validate username. Try again.' });
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
  }, [watchUsername, mode]);

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

      // 1. Check if user has explicitly completed profile before
      const isCompletedMetadata = user.user_metadata?.profile_completed === true;
      // 2. Check if the auth account was created in the last 15 seconds (brand new signup)
      const isNewSignup = Date.now() - new Date(user.created_at).getTime() < 15000;

      if (!isNewSignup && isCompletedMetadata) {
        // Safe path: Existing completed user
        supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id)
          .then(() => {});

        showToast('Welcome back! 🎉');
        router.replace('/(tabs)');
      } else {
        // Check database profile to handle existing users without metadata flag
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, username, gender')
          .eq('id', user.id)
          .maybeSingle();

        // If it's a new signup, or they don't have username/gender completed
        const isActuallyCompleted = profile && profile.name && profile.username && profile.gender;

        if (isActuallyCompleted && !isNewSignup) {
          // Sync metadata so we bypass query next time
          await supabase.auth.updateUser({ data: { profile_completed: true } });
          
          supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id)
            .then(() => {});

          showToast('Welcome back! 🎉');
          router.replace('/(tabs)');
        } else {
          // Route to complete-profile
          router.push({
            pathname: '/(auth)/complete-profile',
            params: {
              email: googleEmail,
              displayName: googleDisplayName,
              photoURL: googlePhotoURL,
            }
          });
        }
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
  const handleEmailLogin = async (data: any) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });

      if (error) throw error;

      const user = authData?.user;
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
  const handleEmailRegister = async (data: any) => {
    const valUsername = data.username.trim().toLowerCase();
    if (!usernameOk) {
      setSignupError('username', { message: 'Please choose a valid and available username.' });
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          data: {
            name: data.fullName.trim(),
            username: valUsername,
            gender: data.gender,
            profile_completed: true,
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
            email: data.email.trim(),
            name: data.fullName.trim(),
            username: valUsername,
            gender: data.gender,
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
        setActiveEmail(data.email.trim());
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
  const handleVerifySignupOtp = async (data: any) => {
    // Client-side rate limit: prevent submitting more than once every 5 seconds
    const now = Date.now();
    if (now - lastOtpSubmitRef.current < 5000) {
      Alert.alert('Please wait', 'Please wait a moment before trying again.');
      return;
    }
    lastOtpSubmitRef.current = now;

    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.verifyOtp({
        email: activeEmail,
        token: data.otpCode.trim(),
        type: 'signup',
      });
      if (error) throw error;
      
      const session = authData?.session;
      if (session) {
        showToast('Registration successful! 🎉');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Verification failed or session not established.');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Double-check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Send OTP Code
  const handleSendResetCode = async (data: any) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email.trim());
      if (error) throw error;
      setActiveEmail(data.email.trim());
      showToast('Reset code sent to your email!');
      changeMode('forgot-otp');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Verify OTP Code
  const handleVerifyResetCode = async (data: any) => {
    // Client-side rate limit: prevent submitting more than once every 5 seconds
    const now = Date.now();
    if (now - lastOtpSubmitRef.current < 5000) {
      Alert.alert('Please wait', 'Please wait a moment before trying again.');
      return;
    }
    lastOtpSubmitRef.current = now;

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: activeEmail,
        token: data.otpCode.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      
      showToast('Code verified! Enter new password.');
      changeMode('forgot-new');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Double-check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Save New Password
  const handleUpdatePassword = async (data: any) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });
      if (error) throw error;
      
      Alert.alert('Success', 'Your password has been reset successfully. Please log in with your new password.', [
        {
          text: 'OK',
          onPress: () => {
            resetLogin({ email: activeEmail, password: '' });
            resetSignup();
            resetForgotEmail();
            resetOtp();
            resetForgotNew();
            setUsernameOk(false);
            setActiveEmail('');
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
          <Controller
            control={loginControl}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, loginErrors.email && styles.inputError]}
                placeholder="email@example.com"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                onBlur={onBlur}
                onChangeText={(val) => onChange(val.trim())}
                value={value}
              />
            )}
          />
        </View>
        {loginErrors.email ? <Text style={styles.fieldErrorText}>{loginErrors.email.message}</Text> : null}
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
          <Controller
            control={loginControl}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, loginErrors.password && styles.inputError]}
                placeholder="Enter password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                returnKeyType="done"
                onSubmitEditing={handleLoginSubmit(handleEmailLogin)}
              />
            )}
          />
        </View>
        {loginErrors.password ? <Text style={styles.fieldErrorText}>{loginErrors.password.message}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleLoginSubmit(handleEmailLogin)}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color="#000000" />
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
          <Controller
            control={signupControl}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, signupErrors.fullName && styles.inputError]}
                placeholder="John Doe"
                placeholderTextColor="rgba(255,255,255,0.4)"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </View>
        {signupErrors.fullName ? <Text style={styles.fieldErrorText}>{signupErrors.fullName.message}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Username</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Hash" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <Controller
            control={signupControl}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, { paddingRight: 40 }, signupErrors.username && styles.inputError]}
                placeholder="username"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="none"
                onBlur={onBlur}
                onChangeText={(val) => onChange(val.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                value={value}
              />
            )}
          />
          {checkingUsername && (
            <ActivityIndicator size="small" color={NEUTRAL.white} style={styles.inputIconRight} />
          )}
          {!checkingUsername && usernameOk && (
            <Icon name="CheckCircle" size={20} color={STATUS.success} style={styles.inputIconRight} />
          )}
          {!checkingUsername && signupErrors.username ? (
            <Icon name="XCircle" size={20} color={STATUS.error} style={styles.inputIconRight} />
          ) : null}
        </View>
        {signupErrors.username ? (
          <Text style={styles.fieldErrorText}>{signupErrors.username.message}</Text>
        ) : usernameOk ? (
          <Text style={styles.fieldOkText}>Username is available</Text>
        ) : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Gender</Text>
        <Controller
          control={signupControl}
          name="gender"
          render={({ field: { onChange, value } }) => (
            <View style={[styles.genderRow, signupErrors.gender && styles.genderErrorBorder]}>
              <TouchableOpacity
                style={[styles.genderOption, value === 'male' && styles.genderSelected]}
                onPress={() => onChange('male')}
                activeOpacity={0.8}
              >
                <Text style={[styles.genderText, value === 'male' && styles.genderTextSelected]}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderOption, value === 'female' && styles.genderSelected]}
                onPress={() => onChange('female')}
                activeOpacity={0.8}
              >
                <Text style={[styles.genderText, value === 'female' && styles.genderTextSelected]}>Female</Text>
              </TouchableOpacity>
            </View>
          )}
        />
        {signupErrors.gender ? <Text style={styles.fieldErrorText}>{signupErrors.gender.message}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Envelope" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <Controller
            control={signupControl}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, signupErrors.email && styles.inputError]}
                placeholder="email@example.com"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                onBlur={onBlur}
                onChangeText={(val) => onChange(val.trim())}
                value={value}
              />
            )}
          />
        </View>
        {signupErrors.email ? <Text style={styles.fieldErrorText}>{signupErrors.email.message}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Lock" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <Controller
            control={signupControl}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, signupErrors.password && styles.inputError]}
                placeholder="Min 6 chars, upper, lower, number, symbol"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                returnKeyType="done"
                onSubmitEditing={handleSignupSubmit(handleEmailRegister)}
              />
            )}
          />
        </View>
        {signupErrors.password ? <Text style={styles.fieldErrorText}>{signupErrors.password.message}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSignupSubmit(handleEmailRegister)}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color="#000000" />
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
          <Controller
            control={forgotEmailControl}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, forgotEmailErrors.email && styles.inputError]}
                placeholder="email@example.com"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="done"
                onSubmitEditing={handleForgotEmailSubmit(handleSendResetCode)}
                onBlur={onBlur}
                onChangeText={(val) => onChange(val.trim())}
                value={value}
              />
            )}
          />
        </View>
        {forgotEmailErrors.email ? <Text style={styles.fieldErrorText}>{forgotEmailErrors.email.message}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleForgotEmailSubmit(handleSendResetCode)}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color="#000000" />
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
      <Text style={styles.formSubtitle}>Enter the verification code sent to {activeEmail}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Verification Code</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Key" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <Controller
            control={otpControl}
            name="otpCode"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, otpErrors.otpCode && styles.inputError]}
                placeholder="Enter 6-digit code"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="number-pad"
                autoCapitalize="none"
                maxLength={6}
                onBlur={onBlur}
                onChangeText={(val) => onChange(val.replace(/[^0-9]/g, ''))}
                value={value}
                returnKeyType="done"
                onSubmitEditing={handleOtpSubmit(handleVerifySignupOtp)}
              />
            )}
          />
        </View>
        {otpErrors.otpCode ? <Text style={styles.fieldErrorText}>{otpErrors.otpCode.message}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleOtpSubmit(handleVerifySignupOtp)}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.submitBtnText}>Verify & Login</Text>}
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
      <Text style={styles.formSubtitle}>Enter the 6-digit code sent to {activeEmail}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Verification Code</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Key" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <Controller
            control={otpControl}
            name="otpCode"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, otpErrors.otpCode && styles.inputError]}
                placeholder="Enter 6-digit code"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="number-pad"
                autoCapitalize="none"
                maxLength={6}
                onBlur={onBlur}
                onChangeText={(val) => onChange(val.replace(/[^0-9]/g, ''))}
                value={value}
                returnKeyType="done"
                onSubmitEditing={handleOtpSubmit(handleVerifyResetCode)}
              />
            )}
          />
        </View>
        {otpErrors.otpCode ? <Text style={styles.fieldErrorText}>{otpErrors.otpCode.message}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleOtpSubmit(handleVerifyResetCode)}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color="#000000" />
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
          <Controller
            control={forgotNewControl}
            name="newPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, forgotNewErrors.newPassword && styles.inputError]}
                placeholder="Min 6 chars, upper, lower, number, symbol"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </View>
        {forgotNewErrors.newPassword ? <Text style={styles.fieldErrorText}>{forgotNewErrors.newPassword.message}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <View style={styles.inputWrapper}>
          <Icon name="Lock" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIconLeft} />
          <Controller
            control={forgotNewControl}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.formInput, forgotNewErrors.confirmPassword && styles.inputError]}
                placeholder="Confirm new password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleForgotNewSubmit(handleUpdatePassword)}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </View>
        {forgotNewErrors.confirmPassword ? <Text style={styles.fieldErrorText}>{forgotNewErrors.confirmPassword.message}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleForgotNewSubmit(handleUpdatePassword)}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color="#000000" />
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
          {mode === 'landing' ? (
            <LinearGradient
              colors={[...BRAND.authGradient]}
              locations={[0, 0.4, 1]}
              style={styles.backgroundGradient}
            />
          ) : (
            <View style={[styles.backgroundGradient, { backgroundColor: '#000000' }]} />
          )}

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
                    accessibilityLabel="Continue with Google"
                    accessibilityRole="button"
                  >
                    <View style={styles.iconContainer}>
                      <Image
                        source={require('../../assets/google_logo.png')}
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
                    accessibilityLabel="Sign in with Email"
                    accessibilityRole="button"
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
                    accessibilityLabel="Create a new account"
                    accessibilityRole="button"
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
                    } else if (mode === 'signup-otp') {
                      changeMode('signup');
                    } else if (mode === 'forgot-email') {
                      changeMode('landing');
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
    backgroundColor: '#0F0F0F',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
    color: '#FFFFFF',
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
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#333333',
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 48,
    paddingRight: 16,
    color: NEUTRAL.white,
    fontSize: 16,
  },
  forgotPasswordLink: {
    color: '#FFFFFF',
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
    color: NEUTRAL.black,
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
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#333333',
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
    color: NEUTRAL.black,
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#FF3333',
    marginTop: 4,
    paddingLeft: 4,
  },
  fieldOkText: {
    fontSize: 12,
    color: '#22C55E',
    marginTop: 4,
    paddingLeft: 4,
  },
  inputError: {
    borderColor: '#FF3333',
  },
  genderErrorBorder: {
    borderColor: '#FF3333',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 2,
  },
});

export default StartScreen;
