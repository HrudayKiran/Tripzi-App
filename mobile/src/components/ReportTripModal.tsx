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
    ScrollView,
    Image,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, NEUTRAL } from '../styles';

const MAX_SCREENSHOTS = 3;

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
    const [screenshots, setScreenshots] = useState<string[]>([]);

    const pickImage = async () => {
        if (screenshots.length >= MAX_SCREENSHOTS) {
            Alert.alert('Limit Reached', `You can upload up to ${MAX_SCREENSHOTS} screenshots.`);
            return;
        }
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant photo library permissions.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
        });
        if (!result.canceled && result.assets[0]) {
            setScreenshots((prev) => [...prev, result.assets[0].uri]);
        }
    };

    const removeImage = (index: number) => {
        setScreenshots((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Error', 'Please describe the issue');
            return;
        }

        setSubmitting(true);
        try {
            const currentUser = auth().currentUser;
            const selectedReason = REPORT_TYPES.find(t => t.id === reportType)?.label || reportType;

            await firestore().collection('reports').add({
                tripId: trip?.id,
                tripTitle: trip?.title || 'Untitled Trip',
                targetId: trip?.id,
                targetType: 'trip',
                reason: selectedReason,
                reporterId: currentUser?.uid,
                reporterEmail: currentUser?.email || '',
                reporterName: currentUser?.displayName || '',
                reportedUserId: trip?.userId,
                type: reportType,
                description: description.trim(),
                screenshotUris: screenshots,
                evidence: screenshots,
                status: 'pending',
                assignedAdmin: null,
                createdAt: firestore.FieldValue.serverTimestamp(),
                resolvedAt: null,
                resolution: null
            });

            Alert.alert(
                'Report Received ✅',
                'Thank you for reporting. Our team will review this within 24 hours. A confirmation has been sent to your email.'
            );
            onClose();
            setDescription('');
            setReportType('cancellation');
            setScreenshots([]);
        } catch (error) {
            Alert.alert('Error', 'Failed to submit report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        onClose();
        setDescription('');
        setReportType('cancellation');
        setScreenshots([]);
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                            <Ionicons name="close" size={26} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Report Trip</Text>
                        <View style={styles.headerBtn} />
                    </View>

                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Trip Info */}
                        <View style={[styles.tripInfo, { backgroundColor: colors.card }]}>
                            <Ionicons name="flag" size={22} color="#EF4444" />
                            <View style={{ flex: 1, marginLeft: SPACING.md }}>
                                <Text style={[styles.tripTitle, { color: colors.text }]} numberOfLines={1}>
                                    {trip?.title || 'Trip'}
                                </Text>
                                <Text style={[styles.tripSubtitle, { color: colors.textSecondary }]}>
                                    Reporting this trip for review
                                </Text>
                            </View>
                        </View>

                        {/* Reason */}
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
                                            backgroundColor: reportType === type.id ? colors.primary + '20' : colors.card
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

                        {/* Description */}
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
                        <TextInput
                            style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            placeholder="Please describe the issue in detail..."
                            placeholderTextColor={colors.textSecondary}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                        />

                        {/* Screenshots */}
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            Screenshots ({screenshots.length}/{MAX_SCREENSHOTS})
                        </Text>
                        <View style={styles.screenshotsRow}>
                            {screenshots.map((uri, index) => (
                                <View key={`${uri}-${index}`} style={styles.screenshotItem}>
                                    <Image source={{ uri }} style={styles.screenshotImage} />
                                    <TouchableOpacity
                                        style={styles.removeBtn}
                                        onPress={() => removeImage(index)}
                                    >
                                        <Ionicons name="close" size={14} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {screenshots.length < MAX_SCREENSHOTS && (
                                <TouchableOpacity
                                    style={[styles.addScreenshot, { borderColor: colors.border, backgroundColor: colors.card }]}
                                    onPress={pickImage}
                                >
                                    <Ionicons name="camera-outline" size={28} color={colors.primary} />
                                    <Text style={[styles.addText, { color: colors.textSecondary }]}>Add</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={{ height: SPACING.xxxl }} />
                    </ScrollView>

                    {/* Footer */}
                    <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={submitting}
                            style={[styles.submitButton, { backgroundColor: '#EF4444' }]}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="flag" size={18} color="#fff" />
                                    <Text style={styles.submitButtonText}>Submit Report</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
    },
    headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    content: { flex: 1, paddingHorizontal: SPACING.xl },
    tripInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        marginTop: SPACING.lg,
        marginBottom: SPACING.xl,
    },
    tripTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    tripSubtitle: { fontSize: FONT_SIZE.sm, marginTop: 2 },
    sectionTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.sm,
        marginTop: SPACING.lg,
    },
    typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    typeOption: {
        borderWidth: 1,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
    },
    typeText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    textInput: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        height: 120,
        fontSize: FONT_SIZE.md,
    },
    screenshotsRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    screenshotItem: { position: 'relative' },
    screenshotImage: { width: 90, height: 90, borderRadius: BORDER_RADIUS.md },
    removeBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addScreenshot: {
        width: 90,
        height: 90,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addText: { fontSize: FONT_SIZE.xs, marginTop: 2 },
    footer: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.lg,
        borderTopWidth: 1,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
    },
    submitButtonText: {
        color: '#FFF',
        fontWeight: FONT_WEIGHT.bold,
        fontSize: FONT_SIZE.md,
    },
});

export default ReportTripModal;
