/**
 * Theme tokens for the NxtVibes app.
 * Includes fonts and color palettes.
 */

export const FONTS = {
  primary: 'Inter',
  headings: 'Plus Jakarta Sans',
} as const;

export const COLORS = {
  brand: {
    primary: '#9d74f7',
    primaryDark: '#895af6',
    primaryDeep: '#6d28d9',
    gradientStart: '#9d74f7',
    gradientEnd: '#EC4899',
    gradient: ['#9d74f7', '#EC4899'] as const,
    authGradient: ['#9d74f7', '#895af6', '#6d28d9'] as const,
  },
  status: {
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningDark: '#B45309',
    error: '#EF4444',
    errorDark: '#DC2626',
    info: '#6366F1',
    infoLight: '#E0E7FF',
  },
  neutral: {
    white: '#FFFFFF',
    black: '#000000',
    dark: '#1f2937',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#e5e7eb',
    gray300: '#f0f0f0',
    gray400: '#A0A0A0',
    gray600: '#666666',
    overlay: 'rgba(0,0,0,0.5)',
    overlayLight: 'rgba(0,0,0,0.3)',
  },
  category: {
    purple: '#EDE9FE',
    cyan: '#06B6D4',
    amber: '#FBBF24',
    emerald: '#34D399',
    orange: '#FB923C',
    pink: '#F472B6',
  },
} as const;

export const theme = {
  fonts: FONTS,
  colors: COLORS,
} as const;

export default theme;
