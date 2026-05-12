import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, BRAND, STATUS, NEUTRAL } from '../styles';
import { supabase } from '../lib/supabase';
import { workersApi } from '../lib/workersApi';
import { resetDatabase } from '../database';

const DELETE_REASONS = [
    'I have privacy concerns',
    'I found a better app',
    'I don\'t use it anymore',
    'Too many notifications',
    'App is not working properly',
    'Other',
];

import { useRouter } from 'expo-router';

const DeleteAccountScreen = () => {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const [deleteReason, setDeleteReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [deleting, setDeleting] = useState(false);

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
                            await workersApi('/account/delete', { body: { reason } });
                            // Sign out locally
                            await supabase.auth.signOut();
                            await resetDatabase();
                            router.replace('/(auth)/welcome');
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to delete account');
                        } finally {
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>Delete Account</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView 
                    style={styles.scrollView} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >

                    {/* Info Section */}
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 400 }}
                        style={styles.section}
                    >
                        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.warningHeader}>
                                <Ionicons name="warning" size={24} color={STATUS.errorDark} />
                                <Text style={[styles.warningTitle, { color: STATUS.errorDark }]}>Data Deletion & Retention</Text>
                            </View>
                            
                            <Text style={[styles.infoText, { color: colors.text }]}>
                                When you delete your account, the following data will be permanently removed:
                            </Text>
                            
                            <View style={styles.bulletList}>
                                <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>• Profile information (Name, Username, Bio, Photo)</Text>
                                <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>• Trips you have created or joined</Text>
                                <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>• Photos and media uploaded to trips</Text>
                                <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>• Chats and messages</Text>
                                <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>• AI chats and generated plans</Text>
                                <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>• Ratings, reviews, and feedback</Text>

                            </View>

                            <View style={styles.divider} />

                            <Text style={[styles.subTitle, { color: colors.text }]}>Retention Period</Text>
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                Your account data is deleted immediately from active use. However, a snapshot of your profile is retained in our secure backups for up to <Text style={{ fontWeight: 'bold' }}>30 days</Text> for safety, security, and legal compliance reasons before being purged.
                            </Text>
                        </View>
                    </MotiView>

                    {/* Reasons Section */}
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 400, delay: 100 }}
                        style={styles.section}
                    >
                        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.subTitle, { color: colors.text }]}>Why are you leaving?</Text>
                            <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: SPACING.md }]}>
                                Help us improve by telling us why you want to delete your account.
                            </Text>

                            {DELETE_REASONS.map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    style={[
                                        styles.reasonOption,
                                        { borderColor: colors.border, backgroundColor: colors.inputBackground },
                                        deleteReason === reason && [styles.reasonSelected, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' }],
                                    ]}
                                    onPress={() => setDeleteReason(reason)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[
                                        styles.radioCircle,
                                        { borderColor: deleteReason === reason ? STATUS.errorDark : colors.border },
                                    ]}>
                                        {deleteReason === reason && <View style={[styles.radioDot, { backgroundColor: STATUS.errorDark }]} />}
                                    </View>
                                    <Text style={[
                                        styles.reasonText,
                                        { color: deleteReason === reason ? STATUS.errorDark : colors.text }
                                    ]}>
                                        {reason}
                                    </Text>
                                </TouchableOpacity>
                            ))}

                            {deleteReason === 'Other' && (
                                <TextInput
                                    style={[
                                        styles.customInput,
                                        {
                                            borderColor: colors.border,
                                            backgroundColor: colors.inputBackground,
                                            color: colors.text,
                                        },
                                    ]}
                                    placeholder="Please specify your reason..."
                                    placeholderTextColor={colors.textSecondary}
                                    value={customReason}
                                    onChangeText={setCustomReason}
                                    multiline
                                    numberOfLines={3}
                                />
                            )}
                        </View>
                    </MotiView>

                    {/* Delete Button */}
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 400, delay: 200 }}
                        style={styles.section}
                    >
                        <TouchableOpacity
                            style={[
                                styles.deleteButton,
                                { backgroundColor: STATUS.errorDark },
                                (deleting || !deleteReason || (deleteReason === 'Other' && !customReason.trim())) && { opacity: 0.5 }
                            ]}
                            onPress={confirmDelete}
                            disabled={deleting || !deleteReason || (deleteReason === 'Other' && !customReason.trim())}
                            activeOpacity={0.8}
                        >

                            {deleting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.deleteButtonText}>Delete Account Forever</Text>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => router.back()}
                            disabled={deleting}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </MotiView>
                </ScrollView>
            </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};


const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.sm,
        paddingTop: 25,
    },
    backButton: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
    },
    placeholder: {
        width: TOUCH_TARGET.min,
    },
    scrollView: {
        flex: 1,
        padding: SPACING.md,
    },
    section: {
        marginBottom: SPACING.md,
    },
    card: {
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
    },
    warningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    warningTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
    infoText: {
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
    },
    bulletList: {
        marginVertical: SPACING.sm,
        paddingLeft: SPACING.xs,
    },
    bulletItem: {
        fontSize: FONT_SIZE.sm,
        marginBottom: 4,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
        marginVertical: SPACING.md,
    },
    subTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.xs,
    },
    reasonOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.xs,
        borderWidth: 1,
    },
    reasonSelected: {
        borderColor: STATUS.errorDark,
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.sm,
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    reasonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
    customInput: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginTop: SPACING.sm,
        fontSize: FONT_SIZE.sm,
        textAlignVertical: 'top',
    },
    deleteButton: {
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.sm,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
    cancelButton: {
        paddingVertical: SPACING.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
});

export default DeleteAccountScreen;
