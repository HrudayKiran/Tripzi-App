import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const { width } = Dimensions.get('window');

interface KycBlockingModalProps {
    visible: boolean;
    onClose: () => void;
    status: 'none' | 'pending' | 'verified' | 'rejected' | 'loading' | 'approved';
    action?: string;
}

/**
 * Modal that blocks non-KYC verified users from performing certain actions.
 * Shows a friendly message and CTA to navigate to KYC verification screen.
 */
export function KycBlockingModal({ visible, onClose, action = 'perform this action' }: KycBlockingModalProps) {
    const navigation = useNavigation();
    const { colors } = useTheme();

    const handleVerifyNow = () => {
        onClose();
        navigation.navigate('KYC' as never);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Animatable.View
                    animation="zoomIn"
                    duration={300}
                    style={[styles.modal, { backgroundColor: colors.card }]}
                >
                    {/* Icon */}
                    <LinearGradient
                        colors={['#8B5CF6', '#EC4899']}
                        style={styles.iconContainer}
                    >
                        <Ionicons name="shield-checkmark" size={40} color="#fff" />
                    </LinearGradient>

                    {/* Title */}
                    <Text style={[styles.title, { color: colors.text }]}>
                        KYC Verification Required
                    </Text>

                    {/* Message */}
                    <Text style={[styles.message, { color: colors.textSecondary }]}>
                        To {action}, you need to complete KYC verification first. This helps us maintain a safe and trusted community.
                    </Text>

                    {/* Benefits */}
                    <View style={[styles.benefitsContainer, { backgroundColor: colors.primaryLight || colors.background }]}>
                        <View style={styles.benefitRow}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={[styles.benefitText, { color: colors.text }]}>Get verified badge</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={[styles.benefitText, { color: colors.text }]}>Create & join trips</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={[styles.benefitText, { color: colors.text }]}>Build trust with travelers</Text>
                        </View>
                    </View>

                    {/* Primary Button */}
                    <TouchableOpacity onPress={handleVerifyNow} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#8B5CF6', '#EC4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.primaryButton}
                        >
                            <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                            <Text style={styles.primaryButtonText}>Verify Now</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Secondary Button */}
                    <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                        <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                            Maybe Later
                        </Text>
                    </TouchableOpacity>
                </Animatable.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    modal: {
        width: width - SPACING.xl * 2,
        maxWidth: 360,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    title: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    message: {
        fontSize: FONT_SIZE.sm,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.lg,
    },
    benefitsContainer: {
        width: '100%',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.lg,
        gap: SPACING.sm,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    benefitText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        minWidth: 200,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
    secondaryButton: {
        marginTop: SPACING.md,
        padding: SPACING.sm,
    },
    secondaryButtonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
});

export default KycBlockingModal;
