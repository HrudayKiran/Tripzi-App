/**
 * Common reusable styles used across multiple screens.
 * Eliminates duplication of common layout patterns.
 */
import { StyleSheet } from 'react-native';
import { SPACING, BORDER_RADIUS, SHADOW } from './constants';
import { NEUTRAL, BRAND } from './colors';

export const COMMON = StyleSheet.create({
    // Layouts
    flex: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreen: {
        flex: 1,
    },

    // Containers
    screenContainer: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
    },
    card: {
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOW.sm,
    },

    // Separators
    separator: {
        height: 1,
        backgroundColor: NEUTRAL.gray100,
    },
    verticalSpacer: {
        height: SPACING.lg,
    },

    // Buttons
    primaryButton: {
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: NEUTRAL.white,
        fontSize: 16,
        fontWeight: '700',
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: NEUTRAL.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        maxHeight: '90%',
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: NEUTRAL.gray200,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: SPACING.lg,
    },

    // Chips/Tags
    chip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.full,
    },

    // Images
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },

    // Input
    input: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        fontSize: 16,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        height: 56,
    },

    // Empty states
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xxxl,
    },
});
