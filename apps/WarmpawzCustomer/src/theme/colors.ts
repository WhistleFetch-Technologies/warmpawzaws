/**
 * Design Theme Colors
 * Identical to web app design (#FF8C42 primary color)
 */

export const colors = {
  // Primary brand color
  primary: '#FF8C42',
  primaryLight: '#FFA366',
  primaryDark: '#FF6B35',
  /** Solid CTA fill — darker than `primary` so white label text meets WCAG AA (~4.5:1). */
  ctaBackground: '#B8440E',
  ctaBackgroundPressed: '#94360B',
  /** Disabled CTA — label uses dark text for readable contrast on pale tint. */
  ctaDisabledBackground: '#E5D0C6',
  ctaDisabledText: '#4A382F',
  
  // Secondary colors
  secondary: '#030213',
  secondaryLight: '#1a1a2e',
  
  // Background colors
  background: '#ffffff',
  white: '#ffffff',
  backgroundSecondary: '#f3f3f5',
  backgroundTertiary: '#ececf0',
  
  // Text colors
  text: '#030213',
  textSecondary: '#717182',
  textMuted: '#9ca3af',
  
  // Status colors
  success: '#10b981',
  error: '#d4183d',
  warning: '#f59e0b',
  info: '#3b82f6',
  
  // Border colors
  border: 'rgba(0, 0, 0, 0.1)',
  borderLight: 'rgba(0, 0, 0, 0.05)',
  
  // Card colors
  card: '#ffffff',
  cardForeground: '#030213',
  
  // Input colors
  input: 'transparent',
  inputBackground: '#f3f3f5',
  
  // Gradient colors
  gradientStart: '#FF8C42',
  gradientEnd: '#FF6B35',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

/**
 * Large top radii on the body sheet over the orange header — shared with `CustomerHomeScreen`
 * and `OrangeBrandedScreenLayout` for visual parity (28–36 logical px; use 32).
 */
export const BRAND_ORANGE_HEADER_BODY_CURVE_RADIUS = 32;

export const typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  } as const,
};

