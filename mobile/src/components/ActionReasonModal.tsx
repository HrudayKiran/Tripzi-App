import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, NEUTRAL, SPACING, STATUS } from '../styles';

type ActionReasonModalProps = {
    visible: boolean;
    title: string;
    subtitle: string;
    actionLabel: string;
    actionTone?: 'danger' | 'primary';
    reasons: string[];
    loading?: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void> | void;
};

const ActionReasonModal = ({
    visible,
    title,
    subtitle,
    actionLabel,
    actionTone = 'danger',
    reasons,
    loading = false,
    onClose,
    onSubmit,
}: ActionReasonModalProps) => {
    const { colors } = useTheme();
    const [selectedReason, setSelectedReason] = useState('');
    const [customReason, setCustomReason] = useState('');

    useEffect(() => {
        if (!visible) {
            setSelectedReason('');
            setCustomReason('');
        }
    }, [visible]);

    const finalReason = useMemo(() => {
        if (selectedReason === 'Other') {
            return customReason.trim();
        }
        return selectedReason.trim();
    }, [customReason, selectedReason]);

    const handleSubmit = async () => {
        if (!finalReason) return;
        await onSubmit(finalReason);
    };

    const actionBackground = actionTone === 'danger' ? STATUS.errorDark : colors.primary;
    const actionBorder = actionTone === 'danger' ? STATUS.errorDark : colors.primary;
    const selectedBackground = actionTone === 'danger' ? '#FEF2F2' : `${colors.primary}12`;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => !loading && onClose()}
        >
            <View style={styles.overlay}>
                <View style={[styles.content, { backgroundColor: colors.card }]}>
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

                    <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
                        {reasons.map((reason) => (
                            <TouchableOpacity
                                key={reason}
                                style={[
                                    styles.reasonOption,
                                    { borderColor: colors.border, backgroundColor: colors.inputBackground },
                                    selectedReason === reason && { borderColor: actionBorder, backgroundColor: selectedBackground },
                                ]}
                                activeOpacity={0.75}
                                disabled={loading}
                                onPress={() => setSelectedReason(reason)}
                            >
                                <View
                                    style={[
                                        styles.radioCircle,
                                        { borderColor: selectedReason === reason ? actionBorder : colors.border },
                                    ]}
                                >
                                    {selectedReason === reason ? <View style={[styles.radioFill, { backgroundColor: actionBorder }]} /> : null}
                                </View>
                                <Text style={[styles.reasonText, { color: colors.text }]}>{reason}</Text>
                            </TouchableOpacity>
                        ))}

                        {selectedReason === 'Other' ? (
                            <TextInput
                                style={[
                                    styles.reasonInput,
                                    {
                                        backgroundColor: colors.inputBackground,
                                        color: colors.text,
                                        borderColor: colors.border,
                                    },
                                ]}
                                value={customReason}
                                onChangeText={setCustomReason}
                                placeholder="Please tell us more..."
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                maxLength={240}
                                editable={!loading}
                            />
                        ) : null}
                    </ScrollView>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
                            onPress={onClose}
                            activeOpacity={0.75}
                            disabled={loading}
                        >
                            <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: actionBackground, opacity: finalReason ? 1 : 0.65 }]}
                            onPress={handleSubmit}
                            activeOpacity={0.8}
                            disabled={loading || !finalReason}
                        >
                            {loading ? (
                                <ActivityIndicator color={NEUTRAL.white} size="small" />
                            ) : (
                                <Text style={[styles.buttonText, { color: NEUTRAL.white }]}>{actionLabel}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    content: {
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        maxHeight: '80%',
    },
    title: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: FONT_SIZE.sm,
        lineHeight: 20,
        marginBottom: SPACING.lg,
    },
    reasonList: {
        maxHeight: 320,
    },
    reasonOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        marginBottom: SPACING.sm,
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
    },
    reasonText: {
        flex: 1,
        fontSize: FONT_SIZE.sm,
    },
    reasonInput: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        fontSize: FONT_SIZE.sm,
        minHeight: 88,
        textAlignVertical: 'top',
        marginBottom: SPACING.sm,
    },
    actions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.lg,
    },
    button: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
    },
    cancelButton: {
        borderWidth: 1,
    },
    buttonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
});

export default ActionReasonModal;
