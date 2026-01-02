/**
 * Status Icon Component
 * Orange circular icon with status symbol matching reference design
 * Enhanced with animations and responsive sizing
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import { AnimatedView } from './AnimatedView';
import { moderateScale } from '../../utils/responsive';

interface StatusIconProps {
  icon: 'checkmark' | 'clock' | 'warning' | 'info' | 'error';
  size?: number;
  backgroundColor?: string;
  animated?: boolean;
  delay?: number;
}

export function StatusIcon({ 
  icon, 
  size = 80, 
  backgroundColor = colors.primary,
  animated = true,
  delay = 150,
}: StatusIconProps) {
  const iconMap = {
    checkmark: '✓',
    clock: '🕐',
    warning: '⚠',
    info: 'ℹ',
    error: '✕',
  };

  const responsiveSize = moderateScale(size);

  const iconContent = (
    <View style={[
      styles.iconCircle, 
      { 
        width: responsiveSize, 
        height: responsiveSize, 
        backgroundColor,
        borderRadius: responsiveSize / 2,
      }
    ]}>
      <Text style={[styles.iconText, { fontSize: responsiveSize * 0.4 }]}>
        {iconMap[icon]}
      </Text>
    </View>
  );

  if (animated) {
    return (
      <AnimatedView animation="spring" delay={delay} duration={500}>
        {iconContent}
      </AnimatedView>
    );
  }

  return iconContent;
}

const styles = StyleSheet.create({
  iconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(spacing.md),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

