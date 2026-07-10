import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, ScrollView, Platform, Keyboard, TouchableWithoutFeedback, Alert, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import Icon from '../components/Icon';
import { NeumorphicBackButton } from '../components/NeumorphicIconButtons';
import { SPACING, BRAND, NEUTRAL, STATUS, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../styles';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().regex(PASSWORD_REGEX, { message: "Password must have uppercase, lowercase, number, and symbol." }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

const ChangePasswordScreen = () => {
    const { colors } = useTheme();
    const router = useRouter();
    
    const [loading, setLoading] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const showToast = (message: string) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
            Alert.alert('Change Password', message);
        }
    };

    const handleChangePassword = async () => {
        setErrors({});
        
        try {
            const result = changePasswordSchema.safeParse({
                currentPassword,
                newPassword,
                confirmPassword
            });

            if (!result.success) {
                const formattedErrors: Record<string, string> = {};
                result.error.issues.forEach((err) => {
                    if (err.path[0]) {
                        formattedErrors[String(err.path[0])] = err.message;
                    }
                });
                setErrors(formattedErrors);
                return;
            }

            setLoading(true);

            const { error } = await supabase.auth.updateUser({
                password: result.data.newPassword,
                currentPassword: result.data.currentPassword
            } as any);

            if (error) {
                setErrors({ submit: error.message });
            } else {
                showToast("Password updated successfully!");
                router.back();
            }
        } catch (error: any) {
            setErrors({ submit: error.message || 'An unexpected error occurred.' });
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (
        label: string, 
        value: string, 
        setValue: (val: string) => void, 
        fieldKey: string,
        showPassword: boolean,
        setShowPassword: (val: boolean) => void
    ) => (
        <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
            <View style={[
                styles.passwordInputContainer,
                { backgroundColor: colors.inputBackground, borderColor: errors[fieldKey] ? STATUS.error : colors.border }
            ]}>
                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={value}
                    onChangeText={(val) => {
                        setValue(val);
                        if (errors[fieldKey]) {
                            setErrors(prev => {
                                const updated = { ...prev };
                                delete updated[fieldKey];
                                return updated;
                            });
                        }
                    }}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                />
                <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <Icon name={showPassword ? "EyeSlash" : "Eye"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
            {errors[fieldKey] ? <Text style={[styles.errorText, { color: STATUS.error }]}>{errors[fieldKey]}</Text> : null}
        </View>
    );

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView 
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <NeumorphicBackButton onPress={() => router.back()} />
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Change Password</Text>
                        <View style={{ width: 45 }} />
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        
                        {errors.submit && (
                            <View style={[styles.submitError, { backgroundColor: `${STATUS.error}15`, borderColor: STATUS.error }]}>
                                <Text style={[styles.submitErrorText, { color: STATUS.error }]}>{errors.submit}</Text>
                            </View>
                        )}

                        {renderInput('Current Password', currentPassword, setCurrentPassword, 'currentPassword', showCurrentPassword, setShowCurrentPassword)}
                        {renderInput('New Password', newPassword, setNewPassword, 'newPassword', showNewPassword, setShowNewPassword)}
                        {renderInput('Confirm New Password', confirmPassword, setConfirmPassword, 'confirmPassword', showConfirmPassword, setShowConfirmPassword)}
                        
                        <View style={styles.hintsContainer}>
                            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                                • Minimum 6 characters
                            </Text>
                            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                                • At least one uppercase and lowercase letter
                            </Text>
                            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                                • At least one number and symbol (!@#$%)
                            </Text>
                        </View>

                        <TouchableOpacity 
                            style={styles.submitButton}
                            onPress={handleChangePassword}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={NEUTRAL.white} />
                            ) : (
                                <Text style={styles.submitButtonText}>Update Password</Text>
                            )}
                        </TouchableOpacity>

                    </ScrollView>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
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
    inputContainer: {
        marginBottom: SPACING.lg,
    },
    label: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.xs,
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        height: 50,
    },
    input: {
        flex: 1,
        height: '100%',
        paddingHorizontal: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    eyeIcon: {
        padding: SPACING.md,
    },
    errorText: {
        fontSize: FONT_SIZE.xs,
        marginTop: 4,
    },
    submitError: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
    },
    submitErrorText: {
        fontSize: FONT_SIZE.sm,
        textAlign: 'center',
    },
    hintsContainer: {
        marginTop: SPACING.sm,
        marginBottom: SPACING.xl,
    },
    hintText: {
        fontSize: FONT_SIZE.xs,
        marginBottom: 4,
    },
    submitButton: {
        backgroundColor: BRAND.primary,
        height: 55,
        borderRadius: BORDER_RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xxl * 2,
    },
    submitButtonText: {
        color: NEUTRAL.white,
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default ChangePasswordScreen;
