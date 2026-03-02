import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, BRAND, STATUS, NEUTRAL } from '../styles';
import DefaultAvatar from '../components/DefaultAvatar';
import { pickAndUploadImage } from '../utils/imageUpload';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const sanitizeUsername = (value: string): string => value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

const formatGender = (gender?: string | null) => {
    if (!gender) return 'Not set';
    return `${gender.charAt(0).toUpperCase()}${gender.slice(1).toLowerCase()}`;
};

const EditProfileScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const currentUser = auth().currentUser;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameOk, setUsernameOk] = useState(false);

    useEffect(() => {
        if (!currentUser) {
            navigation.goBack();
            return;
        }

        const unsubscribe = firestore()
            .collection('users')
            .doc(currentUser.uid)
            .onSnapshot((doc) => {
                const data = doc.data() || {};
                const displayName = data.name || data.displayName || currentUser.displayName || '';
                setUser({ id: doc.id, ...data, displayName });
                setName(displayName);
                setUsername(data.username || '');
                setBio(data.bio || '');
                setProfileImage(data.photoURL || currentUser.photoURL || null);
                setLoading(false);
            }, () => {
                setLoading(false);
            });

        return () => unsubscribe();
    }, [currentUser, navigation]);

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
                const snapshot = await firestore()
                    .collection('public_users')
                    .where('username', '==', value)
                    .get();

                if (!active) return;

                const isTaken = snapshot.docs.some(doc => doc.id !== currentUser?.uid);
                if (isTaken) {
                    setUsernameError('Username is already taken');
                    setUsernameOk(false);
                } else {
                    setUsernameOk(true);
                }
            } catch {
                if (!active) return;
                setUsernameError('Could not validate username right now.');
                setUsernameOk(false);
            } finally {
                if (active) setCheckingUsername(false);
            }
        };

        timeout = setTimeout(run, 350);
        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [username, currentUser?.uid]);

    const canSave = useMemo(() => {
        return !loading && !saving && !!name.trim() && usernameOk && !checkingUsername;
    }, [loading, saving, name, usernameOk, checkingUsername]);

    const pickProfile = async () => {
        if (!currentUser) return;
        try {
            const result = await pickAndUploadImage({
                folder: 'profiles',
                userId: currentUser.uid,
                aspect: [1, 1],
                quality: 0.7,
                allowsEditing: true,
            });

            if (result.success && result.url) {
                setProfileImage(result.url);
            } else if (result.error && result.error !== 'Selection cancelled') {
                Alert.alert('Upload Failed', result.error);
            }
        } catch {
            Alert.alert('Error', 'Could not upload profile image.');
        }
    };

    const handleSave = async () => {
        if (!currentUser) return;
        if (!name.trim()) {
            Alert.alert('Missing Field', 'Name is required.');
            return;
        }
        if (!USERNAME_REGEX.test(sanitizeUsername(username.trim())) || !usernameOk) {
            Alert.alert('Invalid Username', 'Please choose an available username.');
            return;
        }

        setSaving(true);
        try {
            const sanitized = sanitizeUsername(username.trim());
            await firestore().collection('users').doc(currentUser.uid).set({
                name: name.trim(),
                username: sanitized,
                bio: bio.trim(),
                photoURL: profileImage || null,
                displayName: firestore.FieldValue.delete(),
                updatedAt: firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            try {
                await currentUser.updateProfile({
                    displayName: name.trim(),
                    photoURL: profileImage || undefined,
                });
            } catch (e) { }

            Alert.alert('Saved', 'Profile updated successfully.');
            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Could not save profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        style={[styles.headerBtn, { backgroundColor: colors.card }]}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
                    <View style={styles.headerBtn} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.avatarSection}>
                        <DefaultAvatar
                            uri={profileImage || user?.photoURL}
                            name={name || user?.displayName}
                            size={100}
                        />
                        <TouchableOpacity
                            style={[styles.changePhotoButton, { borderColor: colors.primary }]}
                            onPress={pickProfile}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Email ID</Text>
                    <TextInput
                        style={[styles.input, styles.readOnlyInput, { backgroundColor: colors.inputBackground, color: colors.textSecondary, borderColor: colors.border }]}
                        value={user?.email || currentUser?.email || ''}
                        editable={false}
                        selectTextOnFocus={false}
                    />

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Gender</Text>
                    <TextInput
                        style={[styles.input, styles.readOnlyInput, { backgroundColor: colors.inputBackground, color: colors.textSecondary, borderColor: colors.border }]}
                        value={formatGender(user?.gender)}
                        editable={false}
                        selectTextOnFocus={false}
                    />

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Age Verification</Text>
                    <TextInput
                        style={[styles.input, styles.readOnlyInput, { backgroundColor: colors.inputBackground, color: colors.textSecondary, borderColor: colors.border }]}
                        value={user?.ageVerified === true ? 'Verified' : 'Not verified'}
                        editable={false}
                        selectTextOnFocus={false}
                    />

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                        value={name}
                        onChangeText={setName}
                        placeholder="Your name"
                        placeholderTextColor={colors.textSecondary}
                    />

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Username *</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: usernameError ? STATUS.error : colors.border }]}
                        value={username}
                        onChangeText={(value) => setUsername(sanitizeUsername(value))}
                        placeholder="username"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        maxLength={20}
                    />
                    {checkingUsername ? (
                        <Text style={[styles.hintText, { color: colors.textSecondary }]}>Checking availability...</Text>
                    ) : usernameError ? (
                        <Text style={styles.errorText}>{usernameError}</Text>
                    ) : usernameOk ? (
                        <Text style={styles.okText}>Username available</Text>
                    ) : null}

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
                    <TextInput
                        style={[styles.input, styles.bioInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell people about yourself..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        maxLength={150}
                    />

                    <TouchableOpacity onPress={handleSave} disabled={!canSave} style={styles.saveWrap}>
                        <LinearGradient
                            colors={canSave ? [...BRAND.gradient] : ['#9CA3AF', '#9CA3AF']}
                            style={styles.saveButton}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveText}>Save Changes</Text>
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
    loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
    },
    headerBtn: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        borderRadius: TOUCH_TARGET.min / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold },
    content: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xxxl,
    },
    avatarSection: {
        alignItems: 'center',
        marginTop: SPACING.md,
        marginBottom: SPACING.lg,
    },
    changePhotoText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
    changePhotoButton: {
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    label: {
        fontSize: FONT_SIZE.xs,
        marginBottom: SPACING.xs,
        marginTop: SPACING.md,
    },
    input: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    readOnlyInput: {
        opacity: 0.9,
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
        color: STATUS.error,
    },
    okText: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
        color: STATUS.success,
    },
    saveWrap: {
        marginTop: SPACING.xl,
    },
    saveButton: {
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
    },
    saveText: {
        color: NEUTRAL.white,
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default EditProfileScreen;
