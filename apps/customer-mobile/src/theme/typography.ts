/**
 * Typography System - Warmpawz Mobile App
 * Uses Inter font family matching web app
 */

import { Platform } from 'react-native';

// Font Family Configuration
export const FontFamily = {
  regular: Platform.select({
    ios: 'Inter-Regular',
    android: 'Inter-Regular',
    default: 'Inter',
  }),
  medium: Platform.select({
    ios: 'Inter-Medium',
    android: 'Inter-Medium',
    default: 'Inter',
  }),
  semibold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter-SemiBold',
    default: 'Inter',
  }),
  bold: Platform.select({
    ios: 'Inter-Bold',
    android: 'Inter-Bold',
    default: 'Inter',
  }),
};

// Typography Styles
export const Typography = {
  // Headings
  h1: {
    fontSize: 32,
    fontFamily: FontFamily.bold,
    lineHeight: 40,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 24,
    fontFamily: FontFamily.semibold,
    lineHeight: 32,
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: 20,
    fontFamily: FontFamily.semibold,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  h4: {
    fontSize: 18,
    fontFamily: FontFamily.semibold,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  
  // Body Text
  body: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  bodyTiny: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  
  // Button Text
  button: {
    fontSize: 16,
    fontFamily: FontFamily.semibold,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  buttonSmall: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  
  // Caption
  caption: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
};

