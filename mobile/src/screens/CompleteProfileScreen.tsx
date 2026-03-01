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
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const sanitizeUsername = (value: string): string => value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

const calculateAge = (dob: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
};

const CompleteProfileScreen = ({ navigation, route }) => {
    const { colors } = useTheme();
    const currentUser = auth().currentUser;
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [dob, setDob] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameOk, setUsernameOk] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const pendingIdToken = route?.params?.idToken || null;
    const pendingEmail = route?.params?.email || currentUser?.email || '';
    const pendingDisplayName = route?.params?.displayName || currentUser?.displayName || '';

    useEffect(() => {
        if (!currentUser && !pendingIdToken) {
            navigation.reset({ index: 0, routes: [{ name: 'Start' }] });
            return;
        }

        const defaultName = pendingDisplayName || '';
        const defaultUsername = sanitizeUsername(pendingEmail?.split('@')[0] || `user_${(currentUser?.uid || 'temp').slice(0, 5)}`);

        setFullName(defaultName);
        setUsername(defaultUsername);
    }, [currentUser, navigation, pendingDisplayName, pendingEmail, pendingIdToken]);

    useEffect(() => {
        let active = true;
        let timeout: any;

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
                const checkUsernameAvailability = functions().httpsCallable('checkUsernameAvailability');
                const result = await checkUsernameAvailability({
                    username: value,
                    excludeUid: currentUser?.uid || '',
                });
                const available = !!result?.data?.available;

                if (!active) return;

                if (available) {
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
    }, [username, currentUser?.uid]);

    const canSubmit = useMemo(() => {
        return !!fullName.trim() && !!gender && !!dob && usernameOk && !checkingUsername && !submitting;
    }, [fullName, gender, dob, usernameOk, checkingUsername, submitting]);

    const handleDateChange = (_event: any, selectedDate?: Date) => {
        if (Platform.OS !== 'ios') {
            setShowDatePicker(false);
        }
        if (selectedDate) {
            setDob(selectedDate);
        }
    };

    const resetToStart = async () => {
        try {
            await GoogleSignin.revokeAccess();
        } catch (e) { }
        try {
            await GoogleSignin.signOut();
        } catch (e) { }
        try {
            await auth().signOut();
        } catch (e) { }
        navigation.reset({ index: 0, routes: [{ name: 'Start' }] });
    };

    const handleSubmit = async () => {
        if (!fullName.trim()) {
            Alert.alert('Missing Field', 'Full name is required.');
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
        if (!dob) {
            Alert.alert('Missing Field', 'Please select your date of birth.');
            return;
        }

        // Requirement: check age on submit before creating Firebase Auth for new users.
        const age = calculateAge(dob);
        if (!currentUser && age < 18) {
            Alert.alert('Not Eligible', `You are not eligible to use Tripzi because your age is ${age}. You must be at least 18 years old.`);
            await resetToStart();
            return;
        }

        setSubmitting(true);
        try {
            let signedInUser = auth().currentUser;
            if (!signedInUser) {
                if (!pendingIdToken) {
                    throw new Error('Missing Google session. Please continue with Google again.');
                }
                const credential = auth.GoogleAuthProvider.credential(pendingIdToken);
                const userCredential = await auth().signInWithCredential(credential);
                signedInUser = userCredential.user;
            }

            const completeOnboarding = functions().httpsCallable('completeOnboarding');
            await completeOnboarding({
                name: fullName.trim(),
                username: sanitizeUsername(username.trim()),
                gender,
                dateOfBirth: dob.toISOString(),
                bio: bio.trim(),
            });

            navigation.reset({ index: 0, routes: [{ name: 'App' }] });
        } catch (error: any) {
            const code = error?.code || '';
            if (code.includes('failed-precondition')) {
                Alert.alert('Not Eligible', 'You are not eligible to use Tripzi because your age is under 18.');
                await resetToStart();
                return;
            }
            if (code.includes('already-exists')) {
                setUsernameError('Username is already taken');
                setUsernameOk(false);
            } else {
                Alert.alert('Error', error?.message || 'Failed to complete profile setup.');
            }
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
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.title, { color: colors.text }]}>Complete your profile</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Required to continue to Tripzi.</Text>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name *</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your full name"
                    placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Username *</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: usernameError ? '#EF4444' : colors.border }]}
                    value={username}
                    onChangeText={(value) => setUsername(sanitizeUsername(value))}
                    autoCapitalize="none"
                    maxLength={20}
                    placeholder="username"
                    placeholderTextColor={colors.textSecondary}
                />
                {checkingUsername ? (
                    <Text style={[styles.hintText, { color: colors.textSecondary }]}>Checking availability...</Text>
                ) : usernameError ? (
                    <Text style={styles.errorText}>{usernameError}</Text>
                ) : usernameOk ? (
                    <Text style={styles.okText}>Username available</Text>
                ) : null}

                <Text style={[styles.label, { color: colors.textSecondary }]}>Gender *</Text>
                <View style={styles.genderRow}>
                    <TouchableOpacity
                        style={[
                            styles.genderOption,
                            { borderColor: colors.border, backgroundColor: colors.inputBackground },
                            gender === 'male' && styles.genderSelected,
                        ]}
                        onPress={() => setGender('male')}
                    >
                        <Text style={[styles.genderText, gender === 'male' && styles.genderTextSelected]}>Male</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.genderOption,
                            { borderColor: colors.border, backgroundColor: colors.inputBackground },
                            gender === 'female' && styles.genderSelected,
                        ]}
                        onPress={() => setGender('female')}
                    >
                        <Text style={[styles.genderText, gender === 'female' && styles.genderTextSelected]}>Female</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Date of Birth *</Text>
                <TouchableOpacity
                    style={[styles.input, styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.dateText, { color: dob ? colors.text : colors.textSecondary }]}>
                        {dob ? dob.toLocaleDateString('en-IN') : 'Select your date of birth'}
                    </Text>
                </TouchableOpacity>

                {showDatePicker && (
                    <DateTimePicker
                        value={dob || new Date(2000, 0, 1)}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                        minimumDate={new Date(1920, 0, 1)}
                    />
                )}

                <Text style={[styles.label, { color: colors.textSecondary }]}>Bio (Optional)</Text>
                <TextInput
                    style={[styles.input, styles.bioInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell people about yourself..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    maxLength={150}
                />

                <TouchableOpacity disabled={!canSubmit} onPress={handleSubmit} style={styles.submitWrap}>
                    <LinearGradient
                        colors={canSubmit ? ['#9d74f7', '#EC4899'] : ['#9CA3AF', '#9CA3AF']}
                        style={styles.submitBtn}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitText}>Submit</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
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
    title: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
    },
    subtitle: {
        fontSize: FONT_SIZE.sm,
        marginTop: SPACING.xs,
        marginBottom: SPACING.lg,
    },
    label: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.md,
        marginBottom: SPACING.xs,
    },
    input: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    bioInput: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    hintText: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
    },
    errorText: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
        color: '#EF4444',
    },
    okText: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
        color: '#10B981',
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
        borderColor: '#7C3AED',
        backgroundColor: '#F5F3FF',
    },
    genderText: {
        fontSize: FONT_SIZE.md,
        color: '#374151',
        fontWeight: FONT_WEIGHT.medium,
    },
    genderTextSelected: {
        color: '#7C3AED',
        fontWeight: FONT_WEIGHT.bold,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    dateText: {
        fontSize: FONT_SIZE.md,
    },
    submitWrap: {
        marginTop: SPACING.xl,
        marginBottom: SPACING.xxxl,
    },
    submitBtn: {
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
    },
    submitText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default CompleteProfileScreen;
