import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const { width } = Dimensions.get('window');

export type ConfirmationType = 'warning' | 'danger' | 'success' | 'info';

interface ConfirmationModalProps {
    visible: boolean;
    title: string;
    message: string;
    type?: ConfirmationType;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    showCancel?: boolean;
}

const TYPE_CONFIG = {
    warning: {
        icon: 'warning-outline',
        colors: ['#F59E0B', '#EF4444'] as const,
        iconColor: '#F59E0B',
    },
    danger: {
        icon: 'trash-outline',
        colors: ['#EF4444', '#DC2626'] as const,
        iconColor: '#EF4444',
    },
    success: {
        icon: 'checkmark-circle-outline',
        colors: ['#10B981', '#059669'] as const,
        iconColor: '#10B981',
    },
    info: {
        icon: 'information-circle-outline',
        colors: ['#8B5CF6', '#6366F1'] as const,
        iconColor: '#8B5CF6',
    },
};

const ConfirmationModal = ({
    visible,
    title,
    message,
    type = 'warning',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    showCancel = true,
}: ConfirmationModalProps) => {
    const { colors } = useTheme();
    const config = TYPE_CONFIG[type];

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <Animatable.View
                    animation="zoomIn"
                    duration={300}
                    style={[styles.modal, { backgroundColor: colors.card }]}
                >
                    {/* Icon Circle */}
                    <LinearGradient
                        colors={config.colors}
                        style={styles.iconCircle}
                    >
                        <Ionicons name={config.icon as any} size={40} color="#fff" />
                    </LinearGradient>

                    {/* Content */}
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

                    {/* Buttons */}
                    <View style={styles.buttonRow}>
                        {showCancel && (
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
                                onPress={onCancel}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                                    {cancelText}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.button,
                                !showCancel && styles.fullWidthButton,
                            ]}
                            onPress={onConfirm}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={config.colors}
                                style={styles.confirmButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.confirmButtonText}>{confirmText}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </Animatable.View>
            </View>
        </Modal>
    );
};

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
        maxWidth: 400,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    iconCircle: {
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
        fontSize: FONT_SIZE.md,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xl,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        width: '100%',
    },
    button: {
        flex: 1,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
    },
    fullWidthButton: {
        flex: 1,
    },
    cancelButton: {
        borderWidth: 1.5,
        paddingVertical: SPACING.md,
    },
    cancelButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        textAlign: 'center',
    },
    confirmButtonGradient: {
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default ConfirmationModal;
