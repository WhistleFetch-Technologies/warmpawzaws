/**
 * WARMPAWZ Design System - Typography
 * Using Baloo 2 font family
 */

export const typography = {
  fontFamily: {
    primary: "'Baloo 2', sans-serif",
    fallback: "system-ui, -apple-system, sans-serif",
  },
  
  fontWeight: {
    regular: 400,    // Body text
    medium: 500,      // Highlight text
    semiBold: 600,    // Subheading text
    bold: 700,        // Major heading
    extraBold: 800,   // Emphasis
  },
  
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  letterSpacing: {
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
  },
} as const;

export const textStyles = {
  // Body Text
  body: {
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.fontWeight.regular,
    fontSize: typography.fontSize.base,
    lineHeight: typography.lineHeight.normal,
  },
  
  // Highlight Text
  highlight: {
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.base,
    lineHeight: typography.lineHeight.normal,
  },
  
  // Subheading
  subheading: {
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.fontWeight.semiBold,
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.tight,
  },
  
  // Major Heading
  heading: {
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize['2xl'],
    lineHeight: typography.lineHeight.tight,
  },
  
  // Large Heading
  largeHeading: {
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize['3xl'],
    lineHeight: typography.lineHeight.tight,
  },
  
  // Emphasis
  emphasis: {
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.fontWeight.extraBold,
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.tight,
  },
} as const;

export type TypographyKey = keyof typeof typography;
export type TextStyleKey = keyof typeof textStyles;

