/**
 * Branded Card Component
 * White card with rounded top corners overlapping gradient section
 * Enhanced with animations and responsive design
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '../../theme/colors';
import { AnimatedView } from './AnimatedView';
import { moderateScale } from '../../utils/responsive';

interface BrandedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  animated?: boolean;
  delay?: number;
}

export function BrandedCard({ children, style, animated = true, delay = 200 }: BrandedCardProps) {
  const card = (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );

  if (animated) {
    return (
      <AnimatedView animation="slideUp" delay={delay} duration={400}>
        {card}
      </AnimatedView>
    );
  }

  return card;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    padding: moderateScale(spacing.lg),
    marginTop: -moderateScale(spacing.xl), // Overlap with gradient section
    marginHorizontal: moderateScale(spacing.md),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
});

