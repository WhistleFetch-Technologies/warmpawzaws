/**
 * WarmPawz Logo Component
 * Displays the branded logo with paw print
 * Enhanced with animations and responsive sizing
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import { AnimatedView } from './AnimatedView';
import { moderateScale, responsiveFontSize } from '../../utils/responsive';

interface WarmPawzLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  animated?: boolean;
}

export function WarmPawzLogo({ size = 'medium', showText = true, animated = true }: WarmPawzLogoProps) {
  const sizeMap = {
    small: moderateScale(60),
    medium: moderateScale(100),
    large: moderateScale(150),
  };

  const logoSize = sizeMap[size];

  // Using enhanced emoji with better styling
  // Can be replaced with SVG when react-native-svg is properly configured
  const logoContent = (
    <View style={styles.container}>
      <View style={[styles.logoCircle, { width: logoSize, height: logoSize }]}>
        <Text style={[styles.logoEmoji, { fontSize: logoSize * 0.5 }]}>🐾</Text>
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.welcomeText, { fontSize: responsiveFontSize(16) }]}>Welcome to</Text>
          <Text style={[styles.brandText, { fontSize: responsiveFontSize(28) }]}>WARMPAWZ!</Text>
        </View>
      )}
    </View>
  );

  if (animated) {
    return (
      <AnimatedView animation="fade" delay={100} duration={500}>
        {logoContent}
      </AnimatedView>
    );
  }

  return logoContent;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    borderRadius: 9999,
    backgroundColor: colors.logoOrangeDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(spacing.md),
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoEmoji: {
    // Enhanced emoji styling
  },
  textContainer: {
    alignItems: 'center',
    marginTop: moderateScale(spacing.sm),
  },
  welcomeText: {
    color: colors.text,
    marginBottom: moderateScale(spacing.xs),
    fontWeight: '500',
  },
  brandText: {
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
});

