/**
 * WARMPAWZ Design System - Color Palette
 * Based on brand guidelines
 */

export const colors = {
  // Primary Colors
  primary: {
    orange: '#FF8C42',
    blue: '#3348FF',
    green: '#00C30C',
    purple: '#9747FF',
  },
  
  // Neutral Colors
  neutral: {
    black: '#000000',
    white: '#FFFFFF',
  },
  
  // Light Variants
  light: {
    blue: '#D9EBFF',
    green: '#EDFFEE',
    purple: '#F3EAFF',
  },
  
  // Semantic Colors
  semantic: {
    success: '#00C30C',
    error: '#FF3B30',
    warning: '#FF8C42',
    info: '#3348FF',
  },
  
  // Background Colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F5F5',
    tertiary: '#EDEDED',
  },
  
  // Text Colors
  text: {
    primary: '#000000',
    secondary: '#666666',
    tertiary: '#999999',
    inverse: '#FFFFFF',
  },
  
  // Border Colors
  border: {
    default: '#E0E0E0',
    light: '#F0F0F0',
    dark: '#CCCCCC',
  },
  
  // State Colors
  state: {
    active: '#FF8C42',
    inactive: '#CCCCCC',
    hover: '#FF9D5C',
    disabled: '#E0E0E0',
  },
} as const;

export type ColorKey = keyof typeof colors;
export type ColorValue = typeof colors[ColorKey][string];

