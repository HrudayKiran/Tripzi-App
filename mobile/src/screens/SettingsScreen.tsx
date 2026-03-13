import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';

import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, BRAND, STATUS, NEUTRAL, CATEGORY, ICONS } from '../styles';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import {
    getNotificationPermissionStatus,
    requestNotificationPermission,
    syncNotificationPreference,
} from '../utils/notificationPermissions';

const DELETE_REASONS = [
    'I have privacy concerns',
    'I found a better app',
    'I don\'t use it anymore',
    'Too many notifications',
    'App is not working properly',
    'Other',
];

const SettingsScreen = ({ navigation }) => {
    const { colors, isDarkMode, toggleTheme } = useTheme();
    const [pushEnabled, setPushEnabled] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
    const currentUser = auth().currentUser;

    // Load initial setting
    React.useEffect(() => {
        if (!currentUser) return;
        const loadSettings = async () => {
            try {
                const permissionStatus = await getNotificationPermissionStatus();
                setNotificationPermissionGranted(permissionStatus === 'granted');

                const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
                if (userDoc.exists) {
                    const isEnabled = userDoc.data()?.pushNotificationsEnabled === true && permissionStatus === 'granted';
                    setPushEnabled(isEnabled);
                }
            } catch (error) {
                // Silently fail
            }
        };
        loadSettings();
    }, [currentUser]);

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

            await syncNotificationPreference(currentUser.uid, permissionStatus, enabled);

            if (!enabled && permissionStatus !== 'granted') {
                Alert.alert(
                    'Notifications Disabled',
                    'Enable notifications in system settings to receive Tripzi notifications.'
                );
            }
        } catch (error) {
            // Error updating settings
        }
    };

    const handleEnableNotifications = async () => {
        if (!currentUser) return;
        try {
            const permissionStatus = await requestNotificationPermission();
            const enabled = permissionStatus === 'granted';
            setNotificationPermissionGranted(enabled);
            setPushEnabled(enabled);
            await syncNotificationPreference(currentUser.uid, permissionStatus, enabled);

            if (!enabled) {
                Alert.alert(
                    'Notifications Disabled',
                    'Allow notifications in your device settings to receive Tripzi alerts.'
                );
            }
        } catch (error) {
            Alert.alert('Error', 'Could not update notification permission right now.');
        }
    };

    const handleDeleteAccount = () => {
        setDeleteReason('');
        setCustomReason('');
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        const reason = deleteReason === 'Other' ? customReason.trim() : deleteReason;
        if (!reason) {
            Alert.alert('Required', 'Please select or type a reason for deleting your account.');
            return;
        }

        Alert.alert(
            "Final Confirmation",
            "This will permanently delete your profile, trips, photos, chats, and messages. This action CANNOT be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Forever",
                    style: "destructive",
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            const deleteMyAccount = functions().httpsCallable('deleteMyAccount');
                            await deleteMyAccount({ reason });
                            // Sign out locally
                            try { await auth().signOut(); } catch (e) { }
                            setShowDeleteModal(false);
                            // Navigate to auth screen
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Start' }],
                            });
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Could not delete account. Please try again later.");
                        } finally {
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
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
                    {/* Push Notifications */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={0}>
                        <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.iconBox, { backgroundColor: CATEGORY.purple }]}>
                                <Ionicons name={ICONS.notifications} size={24} color={BRAND.primary} />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>Push Notifications</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    {notificationPermissionGranted
                                        ? 'Receive notifications about new trips and messages'
                                        : 'Enable device notification permission to receive Tripzi notifications'}
                                </Text>
                            </View>
                            <Switch
                                value={pushEnabled}
                                onValueChange={handlePushToggle}
                                trackColor={{ false: NEUTRAL.gray200, true: STATUS.success }}
                                thumbColor={NEUTRAL.white}
                                disabled={!notificationPermissionGranted}
                            />
                        </View>
                        {!notificationPermissionGranted && (
                            <TouchableOpacity
                                style={[styles.enablePermissionButton, { borderColor: colors.primary }]}
                                onPress={handleEnableNotifications}
                                activeOpacity={0.75}
                            >
                                <Text style={[styles.enablePermissionText, { color: colors.primary }]}>
                                    Allow Notifications
                                </Text>
                            </TouchableOpacity>
                        )}
                    </Animatable.View>

                    {/* Dark Mode */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={100}>
                        <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                                <Ionicons name={ICONS.moon} size={24} color={STATUS.warning} />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    Toggle between light and dark theme
                                </Text>
                            </View>
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: NEUTRAL.gray200, true: STATUS.success }}
                                thumbColor={NEUTRAL.white}
                            />
                        </View>
                    </Animatable.View>

                    {/* Delete Account */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={150}>
                        <TouchableOpacity
                            style={[styles.settingCard, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                            onPress={handleDeleteAccount}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                                <Ionicons name={ICONS.delete} size={24} color={STATUS.errorDark} />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: STATUS.errorDark }]}>Delete Account</Text>
                                <Text style={[styles.settingDescription, { color: STATUS.error }]}>
                                    Permanently remove your account and data
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </Animatable.View>
                </ScrollView>
            </View>

            {/* Delete Reason Modal */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => !deleting && setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Why are you leaving?</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                            Help us improve by telling us why you want to delete your account.
                        </Text>

                        <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
                            {DELETE_REASONS.map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    style={[
                                        styles.reasonOption,
                                        { borderColor: colors.border, backgroundColor: colors.inputBackground },
                                        deleteReason === reason && styles.reasonSelected,
                                    ]}
                                    onPress={() => setDeleteReason(reason)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[
                                        styles.radioCircle,
                                        { borderColor: deleteReason === reason ? STATUS.errorDark : colors.border },
                                    ]}>
                                        {deleteReason === reason && <View style={styles.radioFill} />}
                                    </View>
                                    <Text style={[styles.reasonText, { color: colors.text }]}>{reason}</Text>
                                </TouchableOpacity>
                            ))}

                            {deleteReason === 'Other' && (
                                <TextInput
                                    style={[styles.reasonInput, {
                                        backgroundColor: colors.inputBackground,
                                        color: colors.text,
                                        borderColor: colors.border,
                                    }]}
                                    value={customReason}
                                    onChangeText={setCustomReason}
                                    placeholder="Please tell us more..."
                                    placeholderTextColor={colors.textSecondary}
                                    multiline
                                    maxLength={200}
                                />
                            )}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalCancelBtn, { borderColor: colors.border }]}
                                onPress={() => setShowDeleteModal(false)}
                                disabled={deleting}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalDeleteBtn]}
                                onPress={confirmDelete}
                                disabled={deleting || !deleteReason}
                            >
                                {deleting ? (
                                    <ActivityIndicator color={NEUTRAL.white} size="small" />
                                ) : (
                                    <Text style={[styles.modalBtnText, { color: NEUTRAL.white }]}>Delete Account</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
});

export default SettingsScreen;
