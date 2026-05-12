import React, { useEffect, useMemo, useState, useRef } from 'react';
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
import * as ImagePicker from 'expo-image-picker';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { workersApi } from '../lib/workersApi';
import { LinearGradient } from 'expo-linear-gradient';
import { database } from '../database';


import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, BRAND, STATUS, NEUTRAL } from '../styles';
import DefaultAvatar from '../components/DefaultAvatar';
import { deleteProfileImageFromR2, pickAndUploadImage } from '../utils/imageUpload';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const sanitizeUsername = (value: string): string => value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

const formatGender = (gender?: string | null) => {
    if (!gender) return 'Not set';
    return `${gender.charAt(0).toUpperCase()}${gender.slice(1).toLowerCase()}`;
};

import { useRouter } from 'expo-router';

const EditProfileScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [profileImageObjectKey, setProfileImageObjectKey] = useState<string | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameOk, setUsernameOk] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {

        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.back();
                return;
            }
            setCurrentUser(user);

            // 1. Try WatermelonDB first (instant)
            try {
                const localProfile = await database.get('profiles').find(user.id);
                if (localProfile) {
                    const lp = (localProfile as any)._raw;
                    const displayName = lp.name || user.user_metadata?.full_name || '';
                    setUser({ id: user.id, ...lp, displayName, email: user.email });
                    setName(displayName);
                    setUsername(lp.username || '');
                    setBio(lp.bio || '');
                    setProfileImage(lp.photo_url || user.user_metadata?.avatar_url || null);
                    setLoading(false);
                }
            } catch {
                // Not in local DB, fall through
            }

            // 2. Fetch from Supabase (fresh data)
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (profile) {
                const displayName = profile.name || profile.display_name || user.user_metadata?.full_name || '';
                setUser({ id: user.id, ...profile, displayName, email: user.email });
                setName(displayName);
                setUsername(profile.username || '');
                setBio(profile.bio || '');
                setProfileImage(profile.photo_url || user.user_metadata?.avatar_url || null);
                setProfileImageObjectKey(profile.photo_object_key || null);
            }
            setLoading(false);
        };
        loadUser();
    }, []);

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

            if (value === user?.username) {
                setUsernameOk(true);
                setUsernameError('');
                return;
            }

            setCheckingUsername(true);
            setUsernameError('');
            setUsernameOk(false);
            try {
                const response = await workersApi(`/account/check-username/${value}`, { method: 'GET' });
                
                if (!active) return;

                if (response.available) {
                    setUsernameOk(true);
                } else {
                    setUsernameError('Username is already taken');
                    setUsernameOk(false);
                }
            } catch {
                if (!active) return;
                setUsernameError('Could not validate username right now.');
                setUsernameOk(false);
            } finally {
                if (active) setCheckingUsername(false);
            }

        };

        timeout = setTimeout(run, 150);
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
            // 1. Pick the image
            const hasPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (hasPermission.status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow access to your photos to upload images.');
                return;
            }

            const pickerResult = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (pickerResult.canceled || !pickerResult.assets[0]) {
                return;
            }

            const localUri = pickerResult.assets[0].uri;
            
            // 2. Show image immediately
            setProfileImage(localUri);

            // 3. Upload image
            const previousObjectKey = profileImageObjectKey || user?.photoObjectKey || null;
            const result = await pickAndUploadImage({
                folder: 'profiles',
                userId: currentUser.uid,
                aspect: [1, 1],
                quality: 0.7,
                allowsEditing: true,
                existingUri: localUri, // Use the picked URI
            });

            if (result.success && result.url && result.objectKey) {
                try {
                    await supabase.from('profiles').update({
                        photo_url: result.url,
                        photo_object_key: result.objectKey,
                    }).eq('id', currentUser.id);

                    try {
                        await supabase.auth.updateUser({
                            data: { avatar_url: result.url },
                        });
                    } catch (e) { }

                    if (previousObjectKey && previousObjectKey !== result.objectKey) {
                        await deleteProfileImageFromR2(previousObjectKey);
                    }

                    if (isMounted.current) {
                        setProfileImage(result.url); // Update with remote URL
                        setProfileImageObjectKey(result.objectKey);
                        setUser((prev: any) => ({ ...prev, photoURL: result.url, photoObjectKey: result.objectKey }));
                    }
                } catch {
                    await deleteProfileImageFromR2(result.objectKey);
                    Alert.alert('Error', 'Could not upload profile image.');
                }
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

        const sanitized = sanitizeUsername(username.trim());

        // 1. Write to WatermelonDB immediately (so local UI updates right away)
        try {
            const profilesCollection = database.get('profiles');
            let localProfile: any = null;
            
            try {
                localProfile = await profilesCollection.find(currentUser.id);
            } catch (e) {
                // Record not found in local DB
                localProfile = null;
            }
            
            await database.write(async () => {
                if (localProfile) {
                    await localProfile.update((profile: any) => {
                        profile.name = name.trim();
                        profile.username = sanitized;
                        profile.bio = bio.trim();
                        profile.photo_url = profileImage || null;
                        profile.updated_at = Date.now();
                    });
                } else {
                    // Create if not exists
                    await profilesCollection.create((profile: any) => {
                        profile._raw.id = currentUser.id;
                        profile.name = name.trim();
                        profile.username = sanitized;
                        profile.bio = bio.trim();
                        profile.photo_url = profileImage || null;
                        profile.push_notifications_enabled = false;
                        profile.save_to_gallery = false;
                        profile.updated_at = Date.now();
                    });
                }
            });
        } catch (dbError) {
            console.error('Failed to write to WatermelonDB:', dbError);
        }


        // 2. Fire and forget the remote updates (Supabase) in background
        supabase.from('profiles').update({
            name: name.trim(),
            username: sanitized,
            bio: bio.trim(),
            photo_url: profileImage || null,
            photo_object_key: profileImageObjectKey || null,
        }).eq('id', currentUser.id).then(({ error }) => {
            if (error) console.error('Failed to update Supabase profile:', error);
        });

        supabase.auth.updateUser({
            data: { full_name: name.trim(), avatar_url: profileImage || undefined },
        }).catch(e => console.error('Failed to update auth user:', e));

        // 3. Navigate back immediately
        router.back();

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
                        style={[styles.headerBtn]}
                        onPress={() => router.back()}
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
                        value={user?.age_verified === true ? 'Verified' : 'Not verified'}
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
