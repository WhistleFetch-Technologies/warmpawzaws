/**
 * Reusable Card Component
 * Enterprise-grade card container
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const cardStyle = [
    styles.card,
    styles[`card_${variant}`],
    style,
  ];

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  card_default: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  card_elevated: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  card_outlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.border,
  },
});

