/**
 * Warmpawz Design System - Typography Tokens
 * Primary font: Baloo 2
 */
export const fontFamily = {
    sans: ['Baloo 2', 'system-ui', 'sans-serif'],
    mono: ['Fira Code', 'monospace'],
};
export const fontWeight = {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
};
export const fontSize = {
    xs: ['12px', { lineHeight: '16px' }],
    sm: ['14px', { lineHeight: '20px' }],
    base: ['16px', { lineHeight: '24px' }],
    lg: ['18px', { lineHeight: '28px' }],
    xl: ['20px', { lineHeight: '28px' }],
    '2xl': ['24px', { lineHeight: '32px' }],
    '3xl': ['30px', { lineHeight: '36px' }],
    '4xl': ['36px', { lineHeight: '40px' }],
    '5xl': ['48px', { lineHeight: '48px' }],
};
// Text style presets
export const textStyles = {
    // Headings
    h1: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.extrabold,
        fontSize: '36px',
        lineHeight: '40px',
    },
    h2: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.bold,
        fontSize: '30px',
        lineHeight: '36px',
    },
    h3: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.bold,
        fontSize: '24px',
        lineHeight: '32px',
    },
    h4: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.semibold,
        fontSize: '20px',
        lineHeight: '28px',
    },
    h5: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.semibold,
        fontSize: '18px',
        lineHeight: '28px',
    },
    h6: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.semibold,
        fontSize: '16px',
        lineHeight: '24px',
    },
    // Body
    bodyLarge: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.regular,
        fontSize: '18px',
        lineHeight: '28px',
    },
    body: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.regular,
        fontSize: '16px',
        lineHeight: '24px',
    },
    bodySmall: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.regular,
        fontSize: '14px',
        lineHeight: '20px',
    },
    // UI
    label: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.medium,
        fontSize: '14px',
        lineHeight: '20px',
    },
    caption: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.regular,
        fontSize: '12px',
        lineHeight: '16px',
    },
    button: {
        fontFamily: fontFamily.sans,
        fontWeight: fontWeight.semibold,
        fontSize: '16px',
        lineHeight: '24px',
    },
};
