import React from 'react';
import { View, Platform, StatusBar, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme/colors';

export type ScreenShellEdge = 'top' | 'left' | 'right' | 'bottom';

/** Minimum top inset so back controls clear the status bar when the OS reports 0 (common on some Android setups). */
export const MIN_SCREEN_TOP_INSET = spacing.sm;

function androidStatusBarOverlap(): number {
  if (Platform.OS !== 'android') {
    return 0;
  }
  return StatusBar.currentHeight ?? 0;
}

const DEFAULT_EDGES: ScreenShellEdge[] = ['top', 'left', 'right', 'bottom'];

export function useScreenTopInset(): number {
  const { top } = useSafeAreaInsets();
  return Math.max(top, MIN_SCREEN_TOP_INSET, androidStatusBarOverlap());
}

export type ScreenShellProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Which edges receive inset padding. Defaults to all sides (parity with legacy RN SafeAreaView).
   * Omit `bottom` when the screen applies its own bottom inset (e.g. custom tab bar with paddingBottom).
   */
  edges?: ScreenShellEdge[];
};

/**
 * Full-screen wrapper using `useSafeAreaInsets()` from react-native-safe-area-context.
 * Top inset uses max(system top, MIN_SCREEN_TOP_INSET, Android status bar height) for reliable tap targets when insets are 0.
 */
export function ScreenShell({ children, style, edges = DEFAULT_EDGES }: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const set = new Set(edges);
  const paddingTop = set.has('top')
    ? Math.max(insets.top, MIN_SCREEN_TOP_INSET, androidStatusBarOverlap())
    : 0;
  const paddingLeft = set.has('left') ? insets.left : 0;
  const paddingRight = set.has('right') ? insets.right : 0;
  const paddingBottom = set.has('bottom') ? insets.bottom : 0;

  return (
    <View
      style={[
        { flex: 1 },
        style,
        // After consumer styles so `padding` shorthand on `style` cannot clobber safe-area padding.
        { paddingTop, paddingLeft, paddingRight, paddingBottom },
      ]}
    >
      {children}
    </View>
  );
}
