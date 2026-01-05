/**
 * Warmpawz Design System - Color Tokens
 * Based on Figma design specifications
 * Synced from: Warmpawz Ecosystem Development/src/design-system/tokens.json
 */

export const colors = {
  // Primary Brand Colors
  primary: {
    DEFAULT: '#FF8C42',
    light: '#FFA366',
    dark: '#FF6B35',
    50: '#FFF5EE',
    100: '#FFE8D6',
    500: '#FF8C42',
    600: '#FF6B35',
    700: '#E55A2B',
  },

  // Secondary Brand - Pink
  pink: {
    DEFAULT: '#FF6B9D',
    light: '#FFD1E3',
    50: '#FFF0F6',
    500: '#FF6B9D',
    600: '#E91E63',
  },

  // Neutral - Grays
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Black & White
  black: '#000000',
  white: '#FFFFFF',

  // Service-Specific Colors (from source tokens.json)
  service: {
    veterinary: '#26C6DA',   // Teal - Medical, clinical feel
    grooming: '#FF6B9D',     // Pink - Care, pampering
    training: '#9B59B6',     // Purple - Education, growth
    boarding: '#FF8C42',     // Orange - Home, comfort
    walking: '#4CAF50',      // Green - Outdoor, active
    nutrition: '#FFC857',    // Yellow - Food, health
    pharmacy: '#2196F3',     // Blue - Medical, prescriptions
    adoption: '#E91E63',     // Deep Pink - Love, connection
    insurance: '#673AB7',    // Deep Purple - Protection, security
  },

  // Accent - Blue
  blue: {
    DEFAULT: '#2196F3',
    light: '#D9EBFF',
    50: '#EEF2FF',
    500: '#2196F3',
    600: '#1976D2',
  },

  // Accent - Green
  green: {
    DEFAULT: '#4CAF50',
    light: '#EDFFEE',
    50: '#EDFFEE',
    500: '#4CAF50',
    600: '#388E3C',
  },

  // Accent - Purple
  purple: {
    DEFAULT: '#9B59B6',
    light: '#F3EAFF',
    50: '#F3EAFF',
    500: '#9B59B6',
    600: '#673AB7',
  },

  // Accent - Teal
  teal: {
    DEFAULT: '#26C6DA',
    light: '#E0F7FA',
    50: '#E0F7FA',
    500: '#26C6DA',
    600: '#00ACC1',
  },

  // Semantic
  success: '#4CAF50',
  error: '#EF4444',
  warning: '#FFC857',
  info: '#2196F3',

  // Background
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
  },

  // Text
  text: {
    primary: '#000000',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
  },

  // Border
  border: {
    light: '#E5E7EB',
    DEFAULT: '#D1D5DB',
    dark: '#9CA3AF',
  },
} as const;

// CSS Variables for use in Tailwind
export const cssVariables = {
  '--color-primary': colors.primary.DEFAULT,
  '--color-primary-light': colors.primary.light,
  '--color-primary-dark': colors.primary.dark,
  '--color-black': colors.black,
  '--color-white': colors.white,
  '--color-blue': colors.blue.DEFAULT,
  '--color-blue-light': colors.blue.light,
  '--color-green': colors.green.DEFAULT,
  '--color-green-light': colors.green.light,
  '--color-purple': colors.purple.DEFAULT,
  '--color-purple-light': colors.purple.light,
  '--color-success': colors.success,
  '--color-error': colors.error,
  '--color-warning': colors.warning,
  '--color-info': colors.info,
} as const;

export type Colors = typeof colors;

