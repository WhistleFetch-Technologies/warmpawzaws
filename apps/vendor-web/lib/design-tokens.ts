/**
 * Design Tokens
 * Centralized design system tokens for consistent UI across vendor app
 */

export const COLORS = {
  // Primary Brand Colors
  primary: '#FF8C42',
  primaryHover: '#FF7A2E',
  primaryLight: '#FFF5F1',
  primaryDark: '#E6732A',
  
  // Semantic Colors
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  
  // Gray Scale
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
  
  // Text Colors
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
  },
  
  // Background Colors
  background: {
    default: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    accent: '#FFF5F1',
  },
  
  // Border Colors
  border: {
    default: '#E5E7EB',
    light: '#F3F4F6',
    medium: '#D1D5DB',
    dark: '#9CA3AF',
  },
} as const;

export const TYPOGRAPHY = {
  // Font Families
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['Monaco', 'Courier New', 'monospace'],
  },
  
  // Font Sizes
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  
  // Font Weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  // Line Heights
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

export const SPACING = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
} as const;

export const BORDER_RADIUS = {
  none: '0',
  sm: '0.5rem',   // 8px
  md: '0.75rem',  // 12px
  lg: '1rem',     // 16px
  xl: '1.5rem',   // 24px
  '2xl': '2rem',  // 32px
  full: '9999px',
  
  // Tailwind classes
  tailwind: {
    sm: 'rounded-xl',    // 12px
    md: 'rounded-2xl',   // 16px
    lg: 'rounded-3xl',   // 24px
    full: 'rounded-full',
  },
} as const;

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  
  // Brand-specific shadows
  primary: '0 4px 14px 0 rgba(255, 140, 66, 0.2)',
  primaryHover: '0 6px 20px 0 rgba(255, 140, 66, 0.3)',
} as const;

export const TRANSITIONS = {
  fast: '150ms ease-in-out',
  normal: '200ms ease-in-out',
  slow: '300ms ease-in-out',
} as const;

/**
 * Common component styles
 */
/**
 * CSS component classes from globals.css (@layer components).
 * Use these strings when composing className to stay DRY with the design system.
 */
export const VENDOR_LAYOUT_CLASSES = {
  pageShell: 'vendor-page-shell',
  appColumn: 'vendor-app-column',
  authColumn: 'vendor-auth-column',
  appColumnInner: 'vendor-app-column-inner',
  modalSheet: 'vendor-modal-sheet',
} as const;

export const COMPONENT_STYLES = {
  // Button styles
  button: {
    primary: 'bg-[#FF8C42] hover:bg-[#FF7A2E] text-white font-semibold rounded-2xl px-6 py-3 transition-all',
    secondary: 'bg-white border-2 border-[#FF8C42] text-[#FF8C42] font-semibold rounded-2xl px-6 py-3 hover:bg-orange-50 transition-all',
    ghost: 'bg-transparent text-gray-700 font-medium rounded-xl px-4 py-2 hover:bg-gray-100 transition-all',
  },
  
  // Input styles
  input: 'w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-800 focus:border-[#FF8C42] focus:ring-1 focus:ring-[#FF8C42] focus:outline-none transition-all placeholder:text-gray-400 bg-white',
  
  // Card styles
  card: 'bg-white rounded-2xl border border-gray-200 p-6 shadow-sm',
  cardHover: 'bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow',
  
  // Badge styles
  badge: {
    primary: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800',
    success: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800',
    error: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800',
    gray: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800',
  },
} as const;
