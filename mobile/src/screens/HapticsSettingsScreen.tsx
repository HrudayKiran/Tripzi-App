import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { SPACING, BORDER_RADIUS, FONT_SIZE } from '../styles';
import { getBooleanPreference, setBooleanPreference, getStringPreference, setStringPreference, PREFERENCE_KEYS } from '../utils/preferences';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';

const HapticsSettingsScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();

    const [hapticsEnabled, setHapticsEnabled] = useState(true);
    const [intensity, setIntensity] = useState('medium'); // light, medium, heavy
    const [joinTripHaptics, setJoinTripHaptics] = useState(true);
    const [navHaptics, setNavHaptics] = useState(true);
    const [notifHaptics, setNotifHaptics] = useState(true);

    // Determine if we are in dark mode based on background color
    const isDark = colors.background !== '#FFFFFF' && colors.background !== '#ffffff';
    const activeColor = isDark ? '#FFFFFF' : '#000000';
    const activeTextColor = isDark ? '#000000' : '#FFFFFF';

    useEffect(() => {
        // Load preferences
        const loadPrefs = async () => {
            const enabled = await getBooleanPreference(PREFERENCE_KEYS.hapticsEnabled, true);
            const inst = await getStringPreference(PREFERENCE_KEYS.hapticsIntensity, 'medium');
            const join = await getBooleanPreference(PREFERENCE_KEYS.hapticsJoinTrip, true);
            const nav = await getBooleanPreference(PREFERENCE_KEYS.hapticsNav, true);
            const notif = await getBooleanPreference(PREFERENCE_KEYS.hapticsNotif, true);

            setHapticsEnabled(enabled);
            setIntensity(inst);
            setJoinTripHaptics(join);
            setNavHaptics(nav);
            setNotifHaptics(notif);
        };
        loadPrefs();
    }, []);

    const handleToggleMain = async (value: boolean) => {
        setHapticsEnabled(value);
        await setBooleanPreference(PREFERENCE_KEYS.hapticsEnabled, value);
        if (value) {
            triggerHaptic('medium');
        }
    };

    const handleSetIntensity = async (val: string) => {
        setIntensity(val);
        await setStringPreference(PREFERENCE_KEYS.hapticsIntensity, val);
        triggerHaptic(val);
    };

    const handleToggleJoin = async (value: boolean) => {
        setJoinTripHaptics(value);
        await setBooleanPreference(PREFERENCE_KEYS.hapticsJoinTrip, value);
        if (value) triggerHaptic(intensity);
    };

    const handleToggleNav = async (value: boolean) => {
        setNavHaptics(value);
        await setBooleanPreference(PREFERENCE_KEYS.hapticsNav, value);
        if (value) triggerHaptic(intensity);
    };

    const handleToggleNotif = async (value: boolean) => {
        setNotifHaptics(value);
        await setBooleanPreference(PREFERENCE_KEYS.hapticsNotif, value);
        if (value) triggerHaptic(intensity);
    };

    const triggerHaptic = (inst: string) => {
        if (!hapticsEnabled) return;
        
        if (Platform.OS === 'android') {
            switch (inst) {
                case 'light':
                    Vibration.vibrate(15);
                    break;
                case 'medium':
                    Vibration.vibrate(40);
                    break;
                case 'heavy':
                    Vibration.vibrate(80);
                    break;
                default:
                    Vibration.vibrate(40);
            }
        } else {
            switch (inst) {
                case 'light':
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    break;
                case 'medium':
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    break;
                case 'heavy':
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    break;
                default:
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
        }
    };

    const AnimatedSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: (v: boolean) => void }) => (
        <TouchableOpacity onPress={() => onValueChange(!value)} activeOpacity={0.8}>
            <MotiView
                animate={{
                    scale: value ? 1.1 : 1,
                }}
                transition={{ type: 'spring', damping: 12, stiffness: 150 }}
            >
                <Icon 
                    name={value ? "ToggleRight" : "ToggleLeft"} 
                    size={36} 
                    color={value ? activeColor : colors.textSecondary} 
                />
            </MotiView>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Icon name="CaretLeft" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Haptics & Feedback</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {/* Main Toggle */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={[styles.rowTitle, { color: colors.text }]}>Haptic Feedback</Text>
                            <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>Enable physical touch feedback</Text>
                        </View>
                        <AnimatedSwitch
                            value={hapticsEnabled}
                            onValueChange={handleToggleMain}
                        />
                    </View>
                </View>

                {hapticsEnabled && (
                    <>
                        {/* Intensity Selector */}
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>INTENSITY</Text>
                        <View style={[styles.section, { backgroundColor: colors.card }]}>
                            <View style={styles.intensityContainer}>
                                {['light', 'medium', 'heavy'].map((inst) => (
                                    <TouchableOpacity
                                        key={inst}
                                        style={[
                                            styles.intensityBtn,
                                            { backgroundColor: intensity === inst ? activeColor : colors.background },
                                            intensity === inst && { borderColor: activeColor }
                                        ]}
                                        onPress={() => handleSetIntensity(inst)}
                                    >
                                        <Text style={[
                                            styles.intensityBtnText,
                                            { color: intensity === inst ? activeTextColor : colors.text }
                                        ]}>
                                            {inst.charAt(0).toUpperCase() + inst.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Customization */}
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CUSTOMIZE ACTIONS</Text>
                        <View style={[styles.section, { backgroundColor: colors.card }]}>
                            {/* Join Trip */}
                            <View style={styles.row}>
                                <View style={styles.rowText}>
                                    <Text style={[styles.rowTitle, { color: colors.text }]}>Join Trip</Text>
                                    <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>Vibrate when joining a trip</Text>
                                </View>
                                <AnimatedSwitch
                                    value={joinTripHaptics}
                                    onValueChange={handleToggleJoin}
                                />
                            </View>

                            <View style={[styles.divider, { backgroundColor: colors.border }]} />

                            {/* Navigation */}
                            <View style={styles.row}>
                                <View style={styles.rowText}>
                                    <Text style={[styles.rowTitle, { color: colors.text }]}>Navigation</Text>
                                    <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>Vibrate when switching tabs or screens</Text>
                                </View>
                                <AnimatedSwitch
                                    value={navHaptics}
                                    onValueChange={handleToggleNav}
                                />
                            </View>

                            <View style={[styles.divider, { backgroundColor: colors.border }]} />

                            {/* Notifications */}
                            <View style={styles.row}>
                                <View style={styles.rowText}>
                                    <Text style={[styles.rowTitle, { color: colors.text }]}>Notifications</Text>
                                    <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>Vibrate when receiving a notification</Text>
                                </View>
                                <AnimatedSwitch
                                    value={notifHaptics}
                                    onValueChange={handleToggleNotif}
                                />
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1, padding: SPACING.md },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        height: 56,
    },
    backBtn: { padding: SPACING.xs },
    headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: SPACING.lg,
        marginBottom: SPACING.xs,
        marginLeft: SPACING.xs,
    },
    section: {
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.xs,
    },
    rowText: { flex: 1, marginRight: SPACING.md },
    rowTitle: { fontSize: 16, fontWeight: '600' },
    rowDesc: { fontSize: 13, marginTop: 2 },
    divider: { height: 1, marginVertical: SPACING.sm },
    intensityContainer: {
        flexDirection: 'row',
        gap: SPACING.sm,
        justifyContent: 'space-between',
    },
    intensityBtn: {
        flex: 1,
        height: 40,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    intensityBtnText: { fontSize: 14, fontWeight: '600' },
});

export default HapticsSettingsScreen;
