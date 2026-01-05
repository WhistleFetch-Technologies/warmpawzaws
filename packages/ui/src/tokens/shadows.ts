/**
 * Warmpawz Design System - Shadow Tokens
 */

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  
  // Brand shadows
  primary: '0 4px 14px 0 rgba(255, 140, 66, 0.3)',
  primaryHover: '0 6px 20px 0 rgba(255, 140, 66, 0.4)',
  card: '0 4px 12px 0 rgba(0, 0, 0, 0.08)',
  cardHover: '0 8px 24px 0 rgba(0, 0, 0, 0.12)',
} as const;

export type Shadows = typeof shadows;

