import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';

import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, BRAND, STATUS, NEUTRAL, CATEGORY, ICONS } from '../styles';

import { supabase } from '../lib/supabase';
import { workersApi } from '../lib/workersApi';
import {
    getNotificationPermissionStatus,
    requestNotificationPermission,
    syncNotificationPreference,
} from '../utils/notificationPermissions';
import { resetDatabase, database } from '../database';



const SettingsScreen = ({ navigation }) => {
    const { colors, isDarkMode, themeMode, setThemeMode } = useTheme();

    const [pushEnabled, setPushEnabled] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
    const [currentUser, setCurrentUser] = React.useState<any>(null);


    React.useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
    }, []);

    const loadSettings = useCallback(async () => {
        if (!currentUser) return;

        setLoadingSettings(true);
        try {
            const permissionStatus = await getNotificationPermissionStatus();
            const isGranted = permissionStatus === 'granted';
            setNotificationPermissionGranted(isGranted);

            // 1. Try WatermelonDB first (instant)
            try {
                const localProfile = await database.get('profiles').find(currentUser.id);
                if (localProfile) {
                    const lp = localProfile as any;
                    const isEnabled = lp._raw.push_notifications_enabled === true && isGranted;
                    setPushEnabled(isEnabled);
                    setLoadingSettings(false);
                }
            } catch {
                // Not in local DB, fall through
            }

            // 2. Verify with Supabase (background)
            const { data: profile } = await supabase
                .from('profiles')
                .select('push_notifications_enabled')
                .eq('id', currentUser.id)
                .maybeSingle();

            if (profile) {
                const isEnabled = profile.push_notifications_enabled === true && isGranted;
                setPushEnabled(isEnabled);
            } else {
                setPushEnabled(false);
            }
        } catch (error) {
            setPushEnabled(false);
        } finally {
            setLoadingSettings(false);
        }
    }, [currentUser]);

    // Refresh settings when screen comes into focus (captures OS-level permission changes)
    useFocusEffect(
        useCallback(() => {
            loadSettings();
        }, [loadSettings])
    );

    const handlePushToggle = async (value: boolean) => {
        if (!currentUser) return;
        try {
            let permissionStatus = await getNotificationPermissionStatus();

            if (value && permissionStatus !== 'granted') {
                permissionStatus = await requestNotificationPermission();
            }

            const enabled = value && permissionStatus === 'granted';
            setNotificationPermissionGranted(permissionStatus === 'granted');
            setPushEnabled(enabled);

            // Write to WatermelonDB immediately
            try {
                const localProfile = await database.get('profiles').find(currentUser.id);
                await database.write(async () => {
                    await (localProfile as any).update((p: any) => {
                        p._raw.push_notifications_enabled = enabled;
                        p._raw.updated_at = Date.now();
                    });
                });
            } catch {
                // Local DB record may not exist yet
            }

            // Sync to Supabase in background
            syncNotificationPreference(currentUser.id, permissionStatus, enabled).catch(() => {});

            if (value && permissionStatus !== 'granted') {
                setPushEnabled(false);
                Alert.alert(
                    'Permission Required',
                    'Please enable notifications in your phone settings to use this feature.'
                );
            }
        } catch (error) {
            // Error updating settings
        }
    };





    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name={ICONS.back} size={28} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Notifications Section */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={0}>
                        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Push Notifications</Text>
                                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                        Receive updates about trips and messages
                                    </Text>
                                </View>
                                <Switch
                                    value={pushEnabled}
                                    onValueChange={handlePushToggle}
                                    trackColor={{ false: NEUTRAL.gray200, true: STATUS.success }}
                                    thumbColor={NEUTRAL.white}
                                    disabled={loadingSettings}
                                />
                            </View>
                        </View>

                    </Animatable.View>

                    {/* Appearance Section */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={100}>
                        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>

                            <View style={styles.themeSelector}>
                                <TouchableOpacity
                                    style={[
                                        styles.themeOption,
                                        { backgroundColor: colors.inputBackground },
                                        themeMode === 'light' && [styles.themeOptionActive, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]
                                    ]}
                                    onPress={() => setThemeMode('light')}
                                >
                                    <Ionicons name="sunny-outline" size={20} color={themeMode === 'light' ? colors.primary : colors.textSecondary} />
                                    <Text style={[styles.themeText, { color: themeMode === 'light' ? colors.primary : colors.textSecondary }]}>Light</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.themeOption,
                                        { backgroundColor: colors.inputBackground },
                                        themeMode === 'dark' && [styles.themeOptionActive, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]
                                    ]}
                                    onPress={() => setThemeMode('dark')}
                                >
                                    <Ionicons name="moon-outline" size={20} color={themeMode === 'dark' ? colors.primary : colors.textSecondary} />
                                    <Text style={[styles.themeText, { color: themeMode === 'dark' ? colors.primary : colors.textSecondary }]}>Dark</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.themeOption,
                                        { backgroundColor: colors.inputBackground },
                                        themeMode === 'system' && [styles.themeOptionActive, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]
                                    ]}
                                    onPress={() => setThemeMode('system')}
                                >
                                    <Ionicons name="contrast-outline" size={20} color={themeMode === 'system' ? colors.primary : colors.textSecondary} />
                                    <Text style={[styles.themeText, { color: themeMode === 'system' ? colors.primary : colors.textSecondary }]}>System</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animatable.View>

                    {/* Account Section */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={150}>
                        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <TouchableOpacity
                                style={styles.dangerRow}
                                onPress={() => navigation.navigate('DeleteAccount')}
                                activeOpacity={0.7}
                            >


                                <View style={styles.settingInfo}>
                                    <Text style={[styles.dangerText, styles.sectionTitle, { color: STATUS.errorDark }]}>Delete Account</Text>
                                    <Text style={[styles.settingDescription, { color: STATUS.error }]}>
                                        Permanently remove your account and data
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={STATUS.error} />
                            </TouchableOpacity>
                        </View>
                    </Animatable.View>
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
        paddingVertical: SPACING.sm,
    },
    backButton: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
    },
    placeholder: {
        width: TOUCH_TARGET.min,
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
