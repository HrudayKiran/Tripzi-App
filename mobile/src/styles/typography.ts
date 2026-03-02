/**
 * Global typography presets for the Tripzi app.
 * Use these as base styles with spread operator, e.g. { ...TYPOGRAPHY.heading1 }
 */
import { StyleSheet, TextStyle } from 'react-native';
import { FONT_SIZE, FONT_WEIGHT } from './constants';

export const TYPOGRAPHY = StyleSheet.create({
    // Headings
    heading1: {
        fontSize: FONT_SIZE.title,
        fontWeight: FONT_WEIGHT.bold,
    } as TextStyle,
    heading2: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
    } as TextStyle,
    heading3: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.semibold,
    } as TextStyle,

    // Body text
    body: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.regular,
    } as TextStyle,
    bodySmall: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.regular,
    } as TextStyle,

    // Labels & captions
    label: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    } as TextStyle,
    caption: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.regular,
    } as TextStyle,

    // Buttons
    buttonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    } as TextStyle,
    buttonTextSmall: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    } as TextStyle,
});
