import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import NotificationService from '../utils/notificationService';

interface ReportTripModalProps {
    visible: boolean;
    trip: any;
    onClose: () => void;
}

const REPORT_TYPES = [
    { id: 'cancellation', label: 'Last-minute Cancellation' },
    { id: 'fraud', label: 'Fraudulent Trip/Scam' },
    { id: 'safety', label: 'Safety Concern' },
    { id: 'inappropriate', label: 'Inappropriate Content' },
    { id: 'other', label: 'Other' }
];

const ReportTripModal: React.FC<ReportTripModalProps> = ({ visible, trip, onClose }) => {
    const { colors } = useTheme();
    const [reportType, setReportType] = useState('cancellation');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Error', 'Please describe the issue');
            return;
        }

        setSubmitting(true);
        try {
            const reportRef = await firestore().collection('reports').add({
                tripId: trip?.id,
                tripTitle: trip?.title || 'Untitled Trip',
                reporterId: auth().currentUser?.uid,
                reportedUserId: trip?.userId,
                type: reportType,
                description: description.trim(),
                evidence: [],
                status: 'pending',
                assignedAdmin: null,
                createdAt: firestore.FieldValue.serverTimestamp(),
                resolvedAt: null,
                resolution: null
            });

            // Notify Admins
            await NotificationService.onReportSubmitted(
                auth().currentUser?.uid || '',
                reportType,
                reportRef.id,
                trip?.title || 'Trip'
            );

            Alert.alert('Report Submitted', 'We will review this within 24 hours.');
            onClose();
            setDescription('');
            setReportType('cancellation');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to submit report');
        } finally {
            setSubmitting(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>

                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>Report Trip</Text>
                            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                {trip?.title}
                            </Text>
                        </View>

                        <View style={styles.typesContainer}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Reason for report</Text>
                            <View style={styles.typesGrid}>
                                {REPORT_TYPES.map(type => (
                                    <TouchableOpacity
                                        key={type.id}
                                        onPress={() => setReportType(type.id)}
                                        style={[
                                            styles.typeOption,
                                            {
                                                borderColor: reportType === type.id ? colors.primary : colors.border,
                                                backgroundColor: reportType === type.id ? colors.primary + '20' : 'transparent'
                                            }
                                        ]}
                                    >
                                        <Text style={[
                                            styles.typeText,
                                            { color: reportType === type.id ? colors.primary : colors.textSecondary }
                                        ]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
                            <TextInput
                                style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                                placeholder="Please describe the issue in detail..."
                                placeholderTextColor={colors.textSecondary}
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.actionRow}>
                            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={submitting}
                                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Submit Report</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        maxHeight: '80%',
    },
    header: {
        marginBottom: SPACING.lg,
        alignItems: 'center',
    },
    title: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
    },
    subtitle: {
        fontSize: FONT_SIZE.sm,
        marginTop: SPACING.xs,
    },
    sectionTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.sm,
    },
    typesContainer: {
        marginBottom: SPACING.lg,
    },
    typesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    typeOption: {
        borderWidth: 1,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.xs,
    },
    typeText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
    inputContainer: {
        marginBottom: SPACING.xl,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        height: 100,
        fontSize: FONT_SIZE.md,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
    },
    cancelButton: {
        padding: SPACING.md,
    },
    submitButton: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.full,
        minWidth: 120,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#FFF',
        fontWeight: FONT_WEIGHT.bold,
        fontSize: FONT_SIZE.md,
    },
});

export default ReportTripModal;
