import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Modal, TextInput, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { NeumorphicToggleLeftButton, NeumorphicToggleRightButton, NeumorphicBackButton } from '../components/NeumorphicIconButtons';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { getBooleanPreference, PREFERENCE_KEYS } from '../utils/preferences';
import * as Haptics from 'expo-haptics';

import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, BRAND, STATUS, NEUTRAL, CATEGORY, ICONS } from '../styles';

import { supabase } from '../lib/supabase';
import { workersApi } from '../lib/workersApi';
import {
    getNotificationPermissionStatus,
    requestNotificationPermission,
    syncNotificationPreference,
} from '../utils/notificationPermissions';
import { resetDatabase, database } from '../database';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();
const PUSH_ENABLED_KEY = '@nxtvibes_push_notifications_enabled';

const SettingsScreen = () => {
    const router = useRouter();
    const { colors, isDarkMode, themeMode, setThemeMode } = useTheme();
    const queryClient = useQueryClient();

    const [pushEnabled, setPushEnabled] = useState(() => {
        return storage.getBoolean(PUSH_ENABLED_KEY) ?? false;
    });
    const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
    const [currentUser, setCurrentUser] = React.useState<any>(null);
    const initialLoadDone = React.useRef(false);

    useFocusEffect(
        useCallback(() => {
            const loadSettings = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                setCurrentUser(user);

                // 1. Fetch system permission status
                const permissionStatus = await getNotificationPermissionStatus();
                const isGranted = permissionStatus === 'granted';
                setNotificationPermissionGranted(isGranted);

                // If user explicitly denied in system settings (App Info), force disabled status
                if (permissionStatus === 'denied') {
                    setPushEnabled(false);
                    storage.set(PUSH_ENABLED_KEY, false);
                    initialLoadDone.current = true;
                    return;
                }

                // 2. Try WatermelonDB first (instant, local)
                let dbEnabled = false;
                try {
                    const localProfile = await database.get('profiles').find(user.id);
                    if (localProfile) {
                        dbEnabled = (localProfile as any).push_notifications_enabled === true;
                        // Avoid toggle flicker by keeping the state steady if it is already matching
                        setPushEnabled(dbEnabled);
                        storage.set(PUSH_ENABLED_KEY, dbEnabled);
                    }
                } catch (e) {
                    // Not found locally
                }

                // 3. Fetch from Supabase (fresh, remote)
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('push_notifications_enabled')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (data) {
                        dbEnabled = data.push_notifications_enabled === true;
                        setPushEnabled(dbEnabled);
                        storage.set(PUSH_ENABLED_KEY, dbEnabled);
                    }
                } catch (e) {
                    // Fail silently or use local state
                }
                
                initialLoadDone.current = true;
            };

            loadSettings();
        }, [])
    );

    const handlePushToggle = async (value: boolean) => {
        if (!currentUser) return;

        // OPTIMISTIC UPDATE: Update toggle state instantly in the UI with ZERO latency!
        setPushEnabled(value);
        storage.set(PUSH_ENABLED_KEY, value);

        try {
            let permissionStatus = await getNotificationPermissionStatus();

            if (value) {
                // User turned ON
                if (permissionStatus !== 'granted') {
                    permissionStatus = await requestNotificationPermission();
                }

                const isGranted = permissionStatus === 'granted';
                setNotificationPermissionGranted(isGranted);

                if (isGranted) {
                    // Update DB instantly in background
                    try {
                        const localProfile = await database.get('profiles').find(currentUser.id);
                        await database.write(async () => {
                            await (localProfile as any).update((p: any) => {
                                p.push_notifications_enabled = true;
                                p.updated_at = Date.now();
                            });
                        });
                    } catch {
                        try {
                            const profilesCollection = database.get('profiles');
                            await database.write(async () => {
                                await profilesCollection.create((p: any) => {
                                    p._raw.id = currentUser.id;
                                    p.push_notifications_enabled = true;
                                    p.updated_at = Date.now();
                                });
                            });
                        } catch (e) {}
                    }
                    await syncNotificationPreference(currentUser.id, 'granted', true);
                } else {
                    // Revert optimism instantly since they denied permissions!
                    setPushEnabled(false);
                    storage.set(PUSH_ENABLED_KEY, false);

                    Alert.alert(
                        'Permission Required',
                        'Please enable notifications in your phone settings to receive updates.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Open Settings', onPress: () => Linking.openSettings() }
                        ]
                    );
                }
            } else {
                // User turned OFF
                try {
                    const localProfile = await database.get('profiles').find(currentUser.id);
                    await database.write(async () => {
                        await (localProfile as any).update((p: any) => {
                            p.push_notifications_enabled = false;
                            p.updated_at = Date.now();
                        });
                    });
                } catch {}
                await syncNotificationPreference(currentUser.id, permissionStatus, false);
            }
        } catch (error) {
            console.error('Failed to update push settings:', error);
            // Revert state on actual error
            setPushEnabled(!value);
            storage.set(PUSH_ENABLED_KEY, !value);
            Alert.alert('Error', 'Failed to update notification settings.');
        }
    };





    const AnimatedSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: (v: boolean) => void }) => {
        const handlePress = async () => {
            onValueChange(!value);
            try {
                const hapticsEnabled = await getBooleanPreference(PREFERENCE_KEYS.hapticsEnabled, true);
                if (hapticsEnabled) {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
            } catch {
                // Ignore
            }
        };

        return (
            <MotiView
                animate={{
                    scale: value ? 1 : 1,
                }}
                transition={{ type: 'spring', damping: 12, stiffness: 150 }}
            >
                {value ? (
                    <NeumorphicToggleRightButton onPress={handlePress} size={46} iconSize={30} />
                ) : (
                    <NeumorphicToggleLeftButton onPress={handlePress} size={46} iconSize={30} />
                )}
            </MotiView>
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <NeumorphicBackButton onPress={() => router.back()} />
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                    <View style={{ width: 45 }} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Notifications Section */}
                    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Push Notifications</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    Receive updates about trips and messages
                                </Text>
                            </View>
                            <AnimatedSwitch
                                value={pushEnabled}
                                onValueChange={handlePushToggle}
                            />
                        </View>
                    </View>

                    {/* Appearance Section */}
                    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>

                        <View style={styles.themeSelector}>
                            <TouchableOpacity
                                style={[
                                    styles.themeOption,
                                    { backgroundColor: colors.inputBackground },
                                    themeMode === 'light' && [styles.themeOptionActive, { backgroundColor: colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000', borderColor: colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000' }]
                                ]}
                                onPress={() => setThemeMode('light')}
                            >
                                <Icon name="Sun" size={20} color={themeMode === 'light' ? (colors.background !== '#FFFFFF' ? '#000000' : '#FFFFFF') : colors.textSecondary} />
                                <Text style={[styles.themeText, { color: themeMode === 'light' ? (colors.background !== '#FFFFFF' ? '#000000' : '#FFFFFF') : colors.textSecondary }]}>Light</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.themeOption,
                                    { backgroundColor: colors.inputBackground },
                                    themeMode === 'dark' && [styles.themeOptionActive, { backgroundColor: colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000', borderColor: colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000' }]
                                ]}
                                onPress={() => setThemeMode('dark')}
                            >
                                <Icon name="Moon" size={20} color={themeMode === 'dark' ? (colors.background !== '#FFFFFF' ? '#000000' : '#FFFFFF') : colors.textSecondary} />
                                <Text style={[styles.themeText, { color: themeMode === 'dark' ? (colors.background !== '#FFFFFF' ? '#000000' : '#FFFFFF') : colors.textSecondary }]}>Dark</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.themeOption,
                                    { backgroundColor: colors.inputBackground },
                                    themeMode === 'system' && [styles.themeOptionActive, { backgroundColor: colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000', borderColor: colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000' }]
                                ]}
                                onPress={() => setThemeMode('system')}
                            >
                                <Icon name="CircleHalf" size={20} color={themeMode === 'system' ? (colors.background !== '#FFFFFF' ? '#000000' : '#FFFFFF') : colors.textSecondary} />
                                <Text style={[styles.themeText, { color: themeMode === 'system' ? (colors.background !== '#FFFFFF' ? '#000000' : '#FFFFFF') : colors.textSecondary }]}>System</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Haptics Section */}
                    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            onPress={() => router.push('/profile/haptics')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.settingInfo}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Haptics & Feedback</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    Customize vibration feedback for actions
                                </Text>
                            </View>
                            <Icon name="CaretRight" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Account Section */}
                    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TouchableOpacity
                            style={styles.dangerRow}
                            onPress={() => router.push('/profile/delete-account')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.settingInfo}>
                                <Text style={[styles.dangerText, styles.sectionTitle, { color: STATUS.errorDark }]}>Delete Account</Text>
                                <Text style={[styles.settingDescription, { color: STATUS.error }]}>
                                    Permanently remove your account and data
                                </Text>
                            </View>
                            <Icon name="CaretRight" size={20} color={STATUS.error} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>

            </View>


        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
    },
    settingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.lg,
        borderWidth: 1,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.lg,
    },
    settingInfo: {
        flex: 1,
    },
    settingTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.xs,
    },
    settingDescription: {
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
    },
    enablePermissionButton: {
        marginTop: SPACING.sm,
        marginLeft: 64,
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
    },
    enablePermissionText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
    // Delete Reason Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    modalContent: {
        width: '100%',
        maxHeight: '80%',
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.xs,
    },
    modalSubtitle: {
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
        marginBottom: SPACING.lg,
    },
    reasonList: {
        maxHeight: 300,
    },
    reasonOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        marginBottom: SPACING.sm,
    },
    reasonSelected: {
        borderColor: STATUS.errorDark,
        backgroundColor: '#FEF2F2',
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    radioFill: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: STATUS.errorDark,
    },
    reasonText: {
        fontSize: FONT_SIZE.sm,
        flex: 1,
    },
    reasonInput: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        fontSize: FONT_SIZE.sm,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: SPACING.sm,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: SPACING.md,
        marginTop: SPACING.lg,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelBtn: {
        borderWidth: 1,
    },
    modalDeleteBtn: {
        backgroundColor: STATUS.errorDark,
    },
    modalBtnText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
    sectionCard: {
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.lg,
        borderWidth: 1,
    },
    sectionTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.md,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.sm,
    },
    settingLabel: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.xs,
    },
    themeSelector: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    themeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    themeOptionActive: {
        borderWidth: 1,
    },
    themeText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
    dangerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.sm,
    },
    dangerText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.xs,
    },
    loadingText: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
    },
});


export default SettingsScreen;
