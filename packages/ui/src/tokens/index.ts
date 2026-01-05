/**
 * Warmpawz Design System - Token Exports
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';

// Re-export as namespace for convenience
import { colors, cssVariables } from './colors';
import { fontFamily, fontWeight, fontSize, textStyles } from './typography';
import { spacing, borderRadius, borderWidth } from './spacing';
import { shadows } from './shadows';

export const tokens = {
  colors,
  cssVariables,
  fontFamily,
  fontWeight,
  fontSize,
  textStyles,
  spacing,
  borderRadius,
  borderWidth,
  shadows,
} as const;

export default tokens;

