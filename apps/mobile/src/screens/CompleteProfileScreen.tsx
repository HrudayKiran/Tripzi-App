import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, STATUS } from '../styles';
import { supabase } from '../lib/supabase';
import { workersApi } from '../lib/workersApi';
import { database, resetDatabase } from '../database';
import Profile from '../database/models/Profile';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const FULL_NAME_MAX_LENGTH = 60;

const sanitizeUsername = (value: string): string =>
    value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

const sanitizeFullName = (value: string): string =>
    // Strip control characters, leading/trailing whitespace, cap at max length
    value.replace(/[\x00-\x1F\x7F]/g, '').slice(0, FULL_NAME_MAX_LENGTH);

const CompleteProfileScreen = () => {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const routeParams = useLocalSearchParams();
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameOk, setUsernameOk] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const pendingEmail = typeof routeParams?.email === 'string' ? routeParams.email : '';
    const pendingDisplayName = typeof routeParams?.displayName === 'string' ? routeParams.displayName : '';

    useEffect(() => {
        const defaultName = pendingDisplayName || '';
        const defaultUsername = sanitizeUsername(pendingEmail?.split('@')[0] || 'traveler');

        setFullName(defaultName);
        setUsername(defaultUsername);
    }, [pendingDisplayName, pendingEmail]);

    useEffect(() => {
        let active = true;
        let timeout: ReturnType<typeof setTimeout>;

        const run = async () => {
            const value = sanitizeUsername(username.trim());
            if (!value) {
                setUsernameError('Username is required');
                setUsernameOk(false);
                return;
            }

            if (!USERNAME_REGEX.test(value)) {
                setUsernameError('Use 3-20 chars: letters, numbers, underscore');
                setUsernameOk(false);
                return;
            }

            setCheckingUsername(true);
            setUsernameError('');
            setUsernameOk(false);
            try {
                // Check username availability via authenticated Worker endpoint
                const response = await workersApi(
                    `/account/check-username/${encodeURIComponent(value.toLowerCase().trim())}`,
                    { method: 'GET' }
                );

                if (!active) return;

                if (response.available) {
                    setUsernameOk(true);
                } else {
                    setUsernameError('Username is already taken');
                    setUsernameOk(false);
                }
            } catch (error) {
                if (!active) return;
                setUsernameError('Could not validate username. Try again.');
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
    }, [username]);

    const canSubmit = useMemo(() => {
        return !!fullName.trim() && !!gender && usernameOk && !checkingUsername && !submitting;
    }, [fullName, gender, usernameOk, checkingUsername, submitting]);

    const resetToStart = async () => {
        try { await GoogleSignin.revokeAccess(); } catch (e) { }
        try { await GoogleSignin.signOut(); } catch (e) { }
        try { await supabase.auth.signOut(); } catch (e) { }
        try { await resetDatabase(); } catch (e) { }
        router.replace('/(auth)/start');
    };

    const handleSubmit = async () => {
        if (!fullName.trim()) {
            Alert.alert('Missing Field', 'Full name is required.');
            return;
        }
        if (fullName.trim().length > FULL_NAME_MAX_LENGTH) {
            Alert.alert('Name Too Long', `Full name must be ${FULL_NAME_MAX_LENGTH} characters or less.`);
            return;
        }
        if (!USERNAME_REGEX.test(sanitizeUsername(username.trim())) || !usernameOk) {
            Alert.alert('Invalid Username', 'Please choose an available username.');
            return;
        }
        if (!gender) {
            Alert.alert('Missing Field', 'Please select gender.');
            return;
        }

        setSubmitting(true);
        try {
            // Get current Supabase session
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('Session expired. Please sign in again.');
            }

            const finalName = sanitizeFullName(fullName.trim());
            const finalUsername = sanitizeUsername(username.trim());

            // Create or update profile in Supabase
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    email: user.email || pendingEmail,
                    name: finalName,
                    username: finalUsername,
                    gender,
                    photo_url: user.user_metadata?.avatar_url || null,
                    last_login_at: new Date().toISOString(),
                });

            if (profileError) {
                if (profileError.message?.includes('profiles_username_key')) {
                    setUsernameError('Username is already taken');
                    setUsernameOk(false);
                    return;
                }
                throw new Error(profileError.message || 'Failed to create profile.');
            }

            // Sync user metadata to mark profile complete on the auth side
            await supabase.auth.updateUser({
                data: { profile_completed: true }
            });

            // Write to WatermelonDB — upsert: update if exists, create if not
            try {
                const existingRecords = await database.get<Profile>('profiles').query().fetch();
                const existingProfile = existingRecords.find(p => p.id === user.id);

                await database.write(async () => {
                    if (existingProfile) {
                        // Update existing record
                        await existingProfile.update((p: Profile) => {
                            p.name = finalName;
                            p.username = finalUsername;
                            p.photoUrl = user.user_metadata?.avatar_url || null;
                        });
                    } else {
                        // Create new record
                        await database.get<Profile>('profiles').create((p: Profile) => {
                            (p as any)._raw.id = user.id;
                            p.name = finalName;
                            p.username = finalUsername;
                            p.photoUrl = user.user_metadata?.avatar_url || null;
                            p.pushNotificationsEnabled = false;
                            p.saveToGallery = false;
                        });
                    }
                });
            } catch (dbError) {
                // Non-fatal: server has the data, local DB will sync on next pull
                console.error('[CompleteProfile] WatermelonDB write error:', dbError);
            }

            router.replace('/(tabs)');

        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to complete profile setup.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>Complete Profile</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Tell us a bit about yourself to get started.</Text>
                    </View>

                    <View style={styles.form}>
                        {/* Full Name */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                value={fullName}
                                onChangeText={(v) => setFullName(sanitizeFullName(v))}
                                placeholder="John Doe"
                                placeholderTextColor={colors.textSecondary}
                                maxLength={FULL_NAME_MAX_LENGTH}
                                autoComplete="name"
                                textContentType="name"
                                returnKeyType="next"
                            />
                        </View>

                        {/* Username */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
                            <View style={styles.usernameInputWrapper}>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: colors.inputBackground,
                                        color: colors.text,
                                        borderColor: usernameError ? STATUS.error : usernameOk ? STATUS.success : colors.border,
                                        flex: 1,
                                    }]}
                                    value={username}
                                    onChangeText={(value) => setUsername(sanitizeUsername(value))}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    maxLength={20}
                                    placeholder="username"
                                    placeholderTextColor={colors.textSecondary}
                                    returnKeyType="done"
                                />
                                {checkingUsername && (
                                    <ActivityIndicator size="small" color={colors.primary} style={styles.inputIcon} />
                                )}
                                {!checkingUsername && usernameOk && (
                                    <Icon name="CheckCircle" size={20} color={STATUS.success} style={styles.inputIcon} />
                                )}
                                {!checkingUsername && usernameError && (
                                    <Icon name="XCircle" size={20} color={STATUS.error} style={styles.inputIcon} />
                                )}
                            </View>
                            {usernameError ? (
                                <Text style={styles.errorText}>{usernameError}</Text>
                            ) : usernameOk ? (
                                <Text style={styles.okText}>Username is available</Text>
                            ) : null}
                        </View>

                        {/* Gender */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Gender</Text>
                            <View style={styles.genderRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.genderOption,
                                        { backgroundColor: colors.inputBackground, borderColor: colors.border },
                                        gender === 'male' && [styles.genderSelected, { borderColor: isDarkMode ? '#FFFFFF' : '#000000', backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }],
                                    ]}
                                    onPress={() => setGender('male')}
                                    accessibilityLabel="Select Male"
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: gender === 'male' }}
                                >
                                    <Text style={[styles.genderText, { color: gender === 'male' ? (isDarkMode ? '#000000' : '#FFFFFF') : colors.text }]}>Male</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.genderOption,
                                        { backgroundColor: colors.inputBackground, borderColor: colors.border },
                                        gender === 'female' && [styles.genderSelected, { borderColor: isDarkMode ? '#FFFFFF' : '#000000', backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }],
                                    ]}
                                    onPress={() => setGender('female')}
                                    accessibilityLabel="Select Female"
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: gender === 'female' }}
                                >
                                    <Text style={[styles.genderText, { color: gender === 'female' ? (isDarkMode ? '#000000' : '#FFFFFF') : colors.text }]}>Female</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Submit */}
                        <TouchableOpacity
                            disabled={!canSubmit}
                            onPress={handleSubmit}
                            accessibilityLabel="Continue to the app"
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !canSubmit }}
                            style={[
                                styles.submitBtn,
                                {
                                    backgroundColor: canSubmit
                                        ? (isDarkMode ? '#FFFFFF' : '#000000')
                                        : (isDarkMode ? '#1E1E1E' : '#E5E7EB'),
                                    borderColor: canSubmit
                                        ? (isDarkMode ? '#FFFFFF' : '#000000')
                                        : (isDarkMode ? '#2D2D2D' : '#D1D5DB'),
                                    borderWidth: 1,
                                }
                            ]}
                        >
                            <View style={styles.submitInner}>
                                {submitting ? (
                                    <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} />
                                ) : (
                                    <Text style={[
                                        styles.submitText,
                                        {
                                            color: canSubmit
                                                ? (isDarkMode ? '#000000' : '#FFFFFF')
                                                : (isDarkMode ? '#555555' : '#9CA3AF')
                                        }
                                    ]}>
                                        Continue
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );

};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    keyboardContainer: { flex: 1 },
    content: {
        padding: SPACING.xl,
    },
    header: {
        marginBottom: SPACING.xl,
    },
    title: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
    },
    subtitle: {
        fontSize: FONT_SIZE.sm,
        marginTop: SPACING.xs,
    },
    form: {
        gap: SPACING.lg,
    },
    inputGroup: {
        gap: SPACING.xs,
    },
    label: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
    },
    input: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    usernameInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputIcon: {
        position: 'absolute',
        right: SPACING.md,
    },
    errorText: {
        fontSize: FONT_SIZE.xs,
        color: STATUS.error,
        marginTop: SPACING.xs,
    },
    okText: {
        fontSize: FONT_SIZE.xs,
        color: STATUS.success,
        marginTop: SPACING.xs,
    },
    genderRow: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    genderOption: {
        flex: 1,
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    genderSelected: {
        borderWidth: 1,
    },
    genderText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
    submitBtn: {
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        marginTop: SPACING.md,
    },
    submitInner: {
        paddingVertical: SPACING.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
});


export default CompleteProfileScreen;
