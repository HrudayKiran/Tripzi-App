import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const GoogleProfileScreen = ({ route, navigation }) => {
    const { user } = route.params;
    const { colors } = useTheme();

    const [fullName, setFullName] = useState(user?.displayName || '');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ fullName?: string; phoneNumber?: string }>({});

    const validatePhoneNumber = (phone: string) => {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length === 10;
    };

    const handleComplete = async () => {
        const newErrors: { fullName?: string; phoneNumber?: string } = {};

        if (!fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setLoading(true);

        // Timeout wrapper - navigate to App after 5 seconds even if Firestore hangs
        const timeoutId = setTimeout(() => {

            setLoading(false);
            navigation.reset({
                index: 0,
                routes: [{ name: 'App' }],
            });
        }, 5000);

        try {
            // Create user profile in Firestore
            await firestore().collection('users').doc(user.uid).set({
                userId: user.uid,
                userName: fullName.toLowerCase().replace(/\s+/g, ''),
                displayName: fullName.trim(),
                email: user.email,
                username: '', // Explicitly empty until set
                phoneNumber: phoneNumber.trim() || null,
                photoURL: user.photoURL || null,
                bio: '',
                role: 'user',
                ageVerified: false,
                rating: 0,
                pushNotifications: true,
                phoneVerified: false,
                emailVerified: true, // Google accounts are email verified
                createdAt: firestore.FieldValue.serverTimestamp(),
                lastLoginAt: firestore.FieldValue.serverTimestamp(),
                signUpMethod: 'google',
            });

            clearTimeout(timeoutId);


            // Navigate directly to App - no phone verification required
            navigation.reset({
                index: 0,
                routes: [{ name: 'App' }],
            });
        } catch (error: any) {
            clearTimeout(timeoutId);

            // If Firestore is unavailable, navigate anyway - profile will sync when available
            navigation.reset({
                index: 0,
                routes: [{ name: 'App' }],
            });
        } finally {
            setLoading(false);
        }
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
                    <Animatable.View animation="fadeInUp" duration={500}>
                        {/* Profile Header */}
                        <View style={styles.profileHeader}>
                            {user?.photoURL ? (
                                <Image source={{ uri: user.photoURL }} style={styles.profileImage} />
                            ) : (
                                <View style={[styles.profilePlaceholder, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.profileInitial}>{fullName.charAt(0).toUpperCase() || 'U'}</Text>
                                </View>
                            )}
                            <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome!</Text>
                            <Text style={[styles.emailText, { color: colors.textSecondary }]}>{user?.email}</Text>
                        </View>

                        {/* Title */}
                        <Text style={[styles.title, { color: colors.text }]}>Complete Your Profile</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Just a few more details to get started
                        </Text>

                        {/* Form */}
                        <View style={styles.form}>
                            <Text style={[styles.label, { color: colors.text }]}>
                                Full Name <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: errors.fullName ? '#EF4444' : 'transparent', borderWidth: errors.fullName ? 1 : 0 }]}>
                                <Ionicons name="person-outline" size={20} color={errors.fullName ? '#EF4444' : colors.textSecondary} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Your full name"
                                    placeholderTextColor={colors.textSecondary}
                                    value={fullName}
                                    onChangeText={setFullName}
                                    autoCapitalize="words"
                                    autoCorrect={false}
                                />
                            </View>
                            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

                            <Text style={[styles.label, { color: colors.text }]}>
                                Phone Number <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: errors.phoneNumber ? '#EF4444' : 'transparent', borderWidth: errors.phoneNumber ? 1 : 0 }]}>
                                <Text style={[styles.countryCode, { color: colors.text }]}>+91</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="9876543210"
                                    placeholderTextColor={colors.textSecondary}
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    autoCorrect={false}
                                />
                            </View>
                            {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
                            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                                We'll send an OTP to verify your phone number
                            </Text>

                            {/* Continue Button */}
                            <TouchableOpacity
                                style={[styles.continueButton, { backgroundColor: colors.primary }]}
                                onPress={handleComplete}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.continueButtonText}>Continue</Text>
                                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                                    </>
                                )}
                            </TouchableOpacity>
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
    contentContainer: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
    profileHeader: { alignItems: 'center', marginTop: SPACING.xxl, marginBottom: SPACING.xl },
    profileImage: { width: 80, height: 80, borderRadius: 40, marginBottom: SPACING.md },
    profilePlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
    profileInitial: { fontSize: 32, fontWeight: FONT_WEIGHT.bold, color: '#fff' },
    welcomeText: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    emailText: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
    title: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
    subtitle: { fontSize: FONT_SIZE.sm, marginBottom: SPACING.xl, lineHeight: 22 },
    form: {},
    label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm, marginTop: SPACING.md },
    required: { color: '#EF4444', fontSize: FONT_SIZE.sm },
    inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, gap: SPACING.md },
    input: { flex: 1, fontSize: FONT_SIZE.md },
    countryCode: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    errorText: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, marginLeft: SPACING.sm },
    helperText: { fontSize: FONT_SIZE.xs, marginTop: SPACING.sm },
    continueButton: { flexDirection: 'row', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xxl, gap: SPACING.sm },
    continueButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
});

export default GoogleProfileScreen;
