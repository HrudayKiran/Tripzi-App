import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const AgeVerificationScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<{ dob?: string }>({});

    const calculateAge = (dob: Date): number => {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    };

    const formatDate = (date: Date): string => {
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setDateOfBirth(selectedDate);
            setErrors({});
        }
    };

    const handleVerifyAge = async () => {
        if (!dateOfBirth) {
            setErrors({ dob: 'Please select your date of birth' });
            return;
        }

        const age = calculateAge(dateOfBirth);
        if (age < 18) {
            setErrors({ dob: 'You must be at least 18 years old to use Tripzi' });
            return;
        }

        setSubmitting(true);
        const currentUser = auth().currentUser;

        try {
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            const verifyAge = functions().httpsCallable('verifyMyAge');
            await verifyAge({
                dateOfBirth: dateOfBirth.toISOString(),
            });

            setSubmitting(false);
            Alert.alert(
                '🎉 Age Verified!',
                'You now have full access to create and join trips!',
                [{ text: 'Continue', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            
            setSubmitting(false);
            Alert.alert('Error', 'Failed to verify age. Please try again.');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card }]}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Age Verification</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Info Card */}
                <Animatable.View animation="fadeInUp" style={[styles.infoCard, { backgroundColor: colors.card }]}>
                    <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.iconGradient}>
                        <Ionicons name="shield-checkmark" size={28} color="#fff" />
                    </LinearGradient>
                    <Text style={[styles.infoTitle, { color: colors.text }]}>Confirm Your Age</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        For your safety and others, we need to verify that you're 18 or older. Verified users get a badge and can create & join trips.
                    </Text>
                </Animatable.View>

                {/* Form */}
                <Animatable.View animation="fadeInUp" delay={100} style={styles.section}>
                    {/* Date of Birth */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>
                            Date of Birth <Text style={styles.required}>*</Text>
                        </Text>
                        <TouchableOpacity
                            style={[
                                styles.datePickerButton,
                                { backgroundColor: colors.inputBackground, borderColor: errors.dob ? '#EF4444' : colors.border }
                            ]}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.dateText, { color: dateOfBirth ? colors.text : colors.textSecondary }]}>
                                {dateOfBirth ? formatDate(dateOfBirth) : 'Select your date of birth'}
                            </Text>
                        </TouchableOpacity>
                        {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
                        {dateOfBirth && calculateAge(dateOfBirth) >= 18 && (
                            <View style={styles.ageVerifiedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={styles.ageVerifiedText}>You're {calculateAge(dateOfBirth)} years old ✓</Text>
                            </View>
                        )}
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={dateOfBirth || new Date(2000, 0, 1)}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={handleDateChange}
                            maximumDate={new Date()}
                            minimumDate={new Date(1920, 0, 1)}
                        />
                    )}

                    {/* Submit Button */}
                    <TouchableOpacity onPress={handleVerifyAge} disabled={submitting} style={styles.submitContainer}>
                        <LinearGradient
                            colors={submitting ? ['#9CA3AF', '#9CA3AF'] : ['#8B5CF6', '#EC4899']}
                            style={styles.submitButton}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                    <Text style={styles.submitButtonText}>Verify My Age</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Note */}
                    <View style={[styles.noteCard, { backgroundColor: colors.card }]}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                            Your date of birth is securely stored and used only for age verification purposes.
                        </Text>
                    </View>
                </Animatable.View>

                <View style={{ height: SPACING.xxxl }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    infoCard: { margin: SPACING.lg, padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl, alignItems: 'center' },
    iconGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
    infoTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
    infoText: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 22 },
    section: { paddingHorizontal: SPACING.lg },
    inputGroup: { marginTop: SPACING.lg },
    label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm },
    required: { color: '#EF4444' },
    errorText: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
    datePickerButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    dateText: { flex: 1, fontSize: FONT_SIZE.md },
    ageVerifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
    ageVerifiedText: { color: '#10B981', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    submitContainer: { marginTop: SPACING.xl },
    submitButton: { flexDirection: 'row', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
    submitButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.lg },
    noteText: { flex: 1, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});

export default AgeVerificationScreen;
