import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';

import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

const SettingsScreen = ({ navigation }) => {
    const { colors, isDarkMode, toggleTheme } = useTheme();
    const [pushEnabled, setPushEnabled] = useState(true);
    const currentUser = auth().currentUser;

    // Load initial setting
    React.useEffect(() => {
        if (!currentUser) return;
        const loadSettings = async () => {
            try {
                const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
                if (userDoc.exists) {
                    // Default to true if not set
                    const isEnabled = userDoc.data()?.pushNotifications !== false;
                    setPushEnabled(isEnabled);
                }
            } catch (error) {

            }
        };
        loadSettings();
    }, [currentUser]);

    const handlePushToggle = async (value: boolean) => {
        setPushEnabled(value);
        if (!currentUser) return;
        try {
            await firestore().collection('users').doc(currentUser.uid).update({
                pushNotifications: value,
                pushToken: value ? firestore.FieldValue.delete() : firestore.FieldValue.delete() // Just deleting token on disable for now, or re-register logic could go here
            });
            // If enabling, we might want to re-trigger token registration logic in AppNavigator or similar
            if (value) {
                // In a real app, you would call your registerForPushNotificationsAsync() here
                // For now, we update the preference which the app check on startup
                await firestore().collection('users').doc(currentUser.uid).set({
                    pushNotifications: true
                }, { merge: true });
            } else {
                await firestore().collection('users').doc(currentUser.uid).update({
                    pushNotifications: false
                });
            }
        } catch (error) {
            // Error updating settings

        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "Are you sure? This will permanently delete your profile, trips, photos, and messages. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Use the callable Cloud Function (no reauthentication needed!)
                            // Region must match where the function is deployed (us-central1 for v1)
                            const deleteMyAccount = functions().httpsCallable('deleteMyAccount');

                            const result = await deleteMyAccount();


                            // Sign out locally after successful deletion
                            await auth().signOut();
                            Alert.alert("Account Deleted", "Your account has been successfully deleted.");
                        } catch (error: any) {

                            Alert.alert("Error", error.message || "Could not delete account. Please try again later.");
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
                        <Ionicons name="chevron-back" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Push Notifications */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={0}>
                        <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.iconBox, { backgroundColor: '#EDE9FE' }]}>
                                <Ionicons name="notifications" size={24} color="#8B5CF6" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>Push Notifications</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    Receive notifications about new trips and messages
                                </Text>
                            </View>
                            <Switch
                                value={pushEnabled}
                                onValueChange={handlePushToggle}
                                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                                thumbColor={'#fff'}
                            />
                        </View>
                    </Animatable.View>

                    {/* Native Push Info */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={50}>
                        <View style={[styles.infoCard, { backgroundColor: colors.inputBackground }]}>
                            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                Full push notification support is available in the iOS and Android app versions.
                            </Text>
                        </View>
                    </Animatable.View>

                    {/* Dark Mode */}
                    <Animatable.View animation="fadeInUp" duration={400} delay={100}>
                        <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                                <Ionicons name="moon" size={24} color="#F59E0B" />
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
                                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                                thumbColor={'#fff'}
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
                                <Ionicons name="trash-outline" size={24} color="#DC2626" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: '#DC2626' }]}>Delete Account</Text>
                                <Text style={[styles.settingDescription, { color: '#EF4444' }]}>
                                    Permanently remove your account and data
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#DC2626" />
                        </TouchableOpacity>
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
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.lg,
        gap: SPACING.md,
    },
    infoText: {
        flex: 1,
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
    },
});

export default SettingsScreen;
