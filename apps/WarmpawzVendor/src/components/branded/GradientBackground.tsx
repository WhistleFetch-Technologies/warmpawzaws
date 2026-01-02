/**
 * Gradient Background Component
 * Orange gradient background matching reference design
 * Enhanced with smoother gradients and animations
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../../theme/colors';
import { AnimatedView } from './AnimatedView';

interface GradientBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  variant?: 'orange' | 'peach';
  animated?: boolean;
}

export function GradientBackground({ 
  children, 
  style, 
  variant = 'orange',
  animated = true,
}: GradientBackgroundProps) {
  const gradientColors = variant === 'orange' 
    ? [colors.orangeGradientStart, colors.orangeGradientMid || colors.orangeGradientStart, colors.orangeGradientEnd]
    : [colors.peachHeader, colors.peachHeaderLight];

  const gradient = (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.gradient, style]}
    >
      {children}
    </LinearGradient>
  );

  if (animated) {
    return (
      <AnimatedView animation="fade" duration={400}>
        {gradient}
      </AnimatedView>
    );
  }

  return gradient;
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});

