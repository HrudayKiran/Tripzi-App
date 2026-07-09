import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { NeumorphicBackButton } from '../components/NeumorphicIconButtons';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter } from 'expo-router';



import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, STATUS } from '../styles';
import { supabase, getProviderSync } from '../lib/supabase';

const SettingsScreen = () => {
    const router = useRouter();
    const { colors, themeMode, setThemeMode } = useTheme();
    const provider = getProviderSync();

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
                    {provider !== 'google' && (
                        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <TouchableOpacity
                                style={styles.settingRow}
                                onPress={() => router.push('/profile/change-password')}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingInfo}>
                                    <Text style={[styles.settingText, { color: colors.text }]}>Change Password</Text>
                                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                        Update your account password
                                    </Text>
                                </View>
                                <Icon name="CaretRight" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

                        <TouchableOpacity
                            style={styles.dangerRow}
                            onPress={() => router.push('/profile/delete-account')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.settingInfo}>
                                <Text style={[styles.dangerText, styles.sectionTitle, { color: STATUS.errorDark, marginBottom: SPACING.xs }]}>Delete Account</Text>
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
    settingInfo: {
        flex: 1,
    },
    settingDescription: {
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
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
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.sm,
    },
    settingText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.xs,
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
});

export default SettingsScreen;
