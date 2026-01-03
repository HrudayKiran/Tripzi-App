import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const PhoneVerificationScreen = ({ route, navigation }) => {
    const { phoneNumber, userId } = route.params;
    const { colors } = useTheme();

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(30);
    const [canResend, setCanResend] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [countdown]);

    // Simulate sending OTP on mount
    useEffect(() => {
        // In production, this would trigger Firebase Phone Auth
        // For now, we'll use a mock OTP: 123456

        Alert.alert('OTP Sent', `A verification code has been sent to +91 ${phoneNumber}\n\nFor testing, use: 123456`);
    }, []);

    const handleOtpChange = (value: string, index: number) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Move to next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const otpString = otp.join('');

        if (otpString.length !== 6) {
            Alert.alert('Invalid OTP', 'Please enter the complete 6-digit code');
            return;
        }

        setLoading(true);
        try {
            // Mock OTP verification - in production, use Firebase Phone Auth
            // For testing, accept 123456
            if (otpString === '123456') {
                // Update user profile as phone verified
                await firestore().collection('users').doc(userId).update({
                    phoneVerified: true,
                });

                Alert.alert(
                    'Verification Complete! 🎉',
                    'Your phone number has been verified successfully.',
                    [{ text: 'Continue', onPress: () => navigation.navigate('App') }]
                );
            } else {
                Alert.alert('Invalid OTP', 'The code you entered is incorrect. Please try again.');
                setOtp(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            }
        } catch (error: any) {
            // Verification error

            Alert.alert('Error', 'Failed to verify. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;

        setResending(true);
        try {
            // Mock resend - in production, trigger Firebase Phone Auth again
            await new Promise(resolve => setTimeout(resolve, 1000));

            setOtp(['', '', '', '', '', '']);
            setCountdown(30);
            setCanResend(false);
            inputRefs.current[0]?.focus();

            Alert.alert('OTP Resent', `A new code has been sent to +91 ${phoneNumber}\n\nFor testing, use: 123456`);
        } finally {
            setResending(false);
        }
    };

    const handleSkip = () => {
        Alert.alert(
            'Skip Verification?',
            'You can verify your phone number later from your profile settings.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Skip', onPress: () => navigation.navigate('App') }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={28} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSkip}>
                            <Text style={[styles.skipText, { color: colors.primary }]}>Skip</Text>
                        </TouchableOpacity>
                    </View>

                    <Animatable.View animation="fadeInUp" duration={500} style={styles.content}>
                        {/* Icon */}
                        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                            <Ionicons name="phone-portrait-outline" size={40} color={colors.primary} />
                        </View>

                        {/* Title */}
                        <Text style={[styles.title, { color: colors.text }]}>Verify Your Phone</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            We've sent a 6-digit code to{'\n'}
                            <Text style={{ color: colors.text, fontWeight: FONT_WEIGHT.semibold }}>+91 {phoneNumber}</Text>
                        </Text>

                        {/* OTP Input */}
                        <View style={styles.otpContainer}>
                            {otp.map((digit, index) => (
                                <TextInput
                                    key={index}
                                    ref={(ref) => { inputRefs.current[index] = ref; }}
                                    style={[
                                        styles.otpInput,
                                        {
                                            backgroundColor: colors.inputBackground,
                                            color: colors.text,
                                            borderColor: digit ? colors.primary : 'transparent',
                                            borderWidth: digit ? 2 : 0,
                                        }
                                    ]}
                                    value={digit}
                                    onChangeText={(value) => handleOtpChange(value, index)}
                                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    selectTextOnFocus
                                />
                            ))}
                        </View>

                        {/* Resend */}
                        <View style={styles.resendContainer}>
                            {canResend ? (
                                <TouchableOpacity onPress={handleResend} disabled={resending}>
                                    {resending ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Text style={[styles.resendText, { color: colors.primary }]}>Resend OTP</Text>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <Text style={[styles.countdownText, { color: colors.textSecondary }]}>
                                    Resend code in {countdown}s
                                </Text>
                            )}
                        </View>

                        {/* Verify Button */}
                        <TouchableOpacity
                            style={[styles.verifyButton, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
                            onPress={handleVerify}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.verifyButtonText}>Verify</Text>
                            )}
                        </TouchableOpacity>
                    </Animatable.View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
    backButton: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: 'center', alignItems: 'center', marginLeft: -SPACING.sm },
    skipText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    content: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxl },
    iconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: SPACING.xl },
    title: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', marginBottom: SPACING.md },
    subtitle: { fontSize: FONT_SIZE.md, textAlign: 'center', lineHeight: 24, marginBottom: SPACING.xxl },
    otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.xl },
    otpInput: { width: 50, height: 56, borderRadius: BORDER_RADIUS.md, textAlign: 'center', fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    resendContainer: { alignItems: 'center', marginBottom: SPACING.xxl },
    resendText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    countdownText: { fontSize: FONT_SIZE.sm },
    verifyButton: { paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
    verifyButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
});

export default PhoneVerificationScreen;
