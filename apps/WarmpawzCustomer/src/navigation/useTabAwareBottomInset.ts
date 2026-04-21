import { useContext, useMemo } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/colors';

const BOTTOM_SCROLL_GAP = spacing.md;

export type TabAwareBottomInsetOptions = {
  /**
   * When true (default), includes `max(useSafeAreaInsets().bottom, spacing.sm)` in the result.
   * Set false when `ScreenShell` (or another parent) already applies bottom safe-area padding so you only need tab bar + gap.
   */
  includeDeviceSafeBottom?: boolean;
};

/**
 * Bottom padding for scroll footers / primary CTAs.
 *
 * Computes: optional device safe-bottom + `BottomTabBarHeightContext` (0 outside MainTabs) + gap.
 * Tab height comes from React Navigation and matches the rendered tab bar (including internal safe padding).
 */
export function useTabAwareBottomInset(options?: TabAwareBottomInsetOptions): number {
  const { includeDeviceSafeBottom = true } = options ?? {};
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

  return useMemo(() => {
    const safeBottom = includeDeviceSafeBottom ? Math.max(insets.bottom, spacing.sm) : 0;
    return safeBottom + tabBarHeight + BOTTOM_SCROLL_GAP;
  }, [includeDeviceSafeBottom, insets.bottom, tabBarHeight]);
}
