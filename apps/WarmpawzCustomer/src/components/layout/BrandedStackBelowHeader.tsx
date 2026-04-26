import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, BRAND_ORANGE_HEADER_BODY_CURVE_RADIUS } from '../../theme/colors';

/** Pulls the body sheet slightly over the orange bar so the curve reads on device. */
const CURVE_OVERLAP = 8;

export type BrandedStackBelowHeaderProps = {
  children: React.ReactNode;
  /** Fill behind the rounded top (match scroll / page background). */
  backgroundColor?: string;
};

/**
 * Use directly under a flat-bottom orange `styles.header` block: adds the same large top radii
 * as `OrangeBrandedScreenLayout` without forcing a full shell (multi-step / legacy routers).
 */
export function BrandedStackBelowHeader({
  children,
  backgroundColor = colors.white,
}: BrandedStackBelowHeaderProps) {
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor,
          borderTopLeftRadius: BRAND_ORANGE_HEADER_BODY_CURVE_RADIUS,
          borderTopRightRadius: BRAND_ORANGE_HEADER_BODY_CURVE_RADIUS,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    marginTop: -CURVE_OVERLAP,
    overflow: 'hidden',
  },
});
