import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  colors,
  spacing,
  typography,
  BRAND_ORANGE_HEADER_BODY_CURVE_RADIUS,
} from '../../theme/colors';
import { useScreenTopInset } from './ScreenShell';

/** Wide enough for short secondary actions (e.g. “Mark all read”) without clipping. */
const SIDE_SLOT_WIDTH = 108;

export type OrangeBrandedScreenLayoutProps = {
  /**
   * Centered title when using the default header row. Ignored if `customOrangeHeader` is set
   * (pass a short label anyway for stack headers / consistency).
   */
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  headerRight?: React.ReactNode;
  /** Rendered below the title row, still on the orange block (e.g. extra toolbar). */
  headerAccessory?: React.ReactNode;
  /**
   * Full orange header region (back, icon, stats, steppers). Replaces the default title row.
   * Top + horizontal safe-area padding are applied by the shell — do not wrap with ScreenShell top.
   */
  customOrangeHeader?: React.ReactNode;
  children: React.ReactNode;
  /** Must match the scroll/page fill behind the curve (avoids halos in rounded corners). */
  bodyBackgroundColor?: string;
  /**
   * When false, the curved body does not add bottom safe-area padding — use for `FlatList`
   * / `ScrollView` that already pad `contentContainerStyle`, or fixed footers that handle inset.
   * @default true
   */
  padBodyBottomInset?: boolean;
};

/**
 * Canonical orange branded shell: status-bar safe padding on the orange block only (orange may
 * extend edge-to-edge), then a body panel with large top-left / top-right radii over the orange.
 */
export function OrangeBrandedScreenLayout({
  title = '',
  subtitle,
  onBack,
  backLabel = '← Back',
  headerRight,
  headerAccessory,
  customOrangeHeader,
  children,
  bodyBackgroundColor = colors.background,
  padBodyBottomInset = true,
}: OrangeBrandedScreenLayoutProps) {
  const top = useScreenTopInset();
  const { bottom, left, right } = useSafeAreaInsets();
  const padL = Math.max(left, spacing.md);
  const padR = Math.max(right, spacing.md);
  const bodyBottomPad = padBodyBottomInset ? Math.max(bottom, spacing.sm) : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={[styles.orangeBlock, { paddingTop: top, paddingLeft: padL, paddingRight: padR }]}>
        {customOrangeHeader != null ? (
          customOrangeHeader
        ) : (
          <>
            <View style={styles.headerRow}>
              <View style={styles.sideSlot}>
                {onBack ? (
                  <TouchableOpacity
                    onPress={onBack}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.backText}>{backLabel}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.titleBlock}>
                <Text style={styles.titleText} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.subtitleText} numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.sideSlot, styles.sideSlotRight]}>{headerRight}</View>
            </View>
            {headerAccessory}
          </>
        )}
      </View>
      <View
        style={[
          styles.bodyPanel,
          {
            backgroundColor: bodyBackgroundColor,
            borderTopLeftRadius: BRAND_ORANGE_HEADER_BODY_CURVE_RADIUS,
            borderTopRightRadius: BRAND_ORANGE_HEADER_BODY_CURVE_RADIUS,
            paddingBottom: bodyBottomPad,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  orangeBlock: {
    backgroundColor: colors.primary,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sideSlot: {
    width: SIDE_SLOT_WIDTH,
    justifyContent: 'center',
    minHeight: 44,
  },
  sideSlotRight: {
    alignItems: 'flex-end',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  titleText: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
    textAlign: 'center',
    width: '100%',
  },
  subtitleText: {
    marginTop: spacing.xs / 2,
    fontSize: typography.fontSizes.sm,
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
    width: '100%',
  },
  backText: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
    fontWeight: typography.fontWeights.semibold,
  },
  bodyPanel: {
    flex: 1,
    overflow: 'hidden',
  },
});
