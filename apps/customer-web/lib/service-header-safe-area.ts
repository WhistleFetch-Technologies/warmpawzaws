import type { CSSProperties } from 'react';

/** True when running inside the Capacitor shell (Android / iOS APK). */
export function isCapacitorNativePlatform(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Top padding for {@link ServiceDashboardHeader}.
 * - `compact` (payment summary): unchanged — do not alter Razorpay-adjacent flows.
 * - Capacitor: WebView is already inset below the status bar in MainActivity.
 * - Mobile browser: min 48px + theme-color so flat Android phones clear the system status bar.
 */
export function resolveServiceHeaderTopPad(
  compact: boolean,
  isCapacitorNative = isCapacitorNativePlatform(),
): CSSProperties {
  if (compact) {
    return { paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 8px))' };
  }
  if (isCapacitorNative) {
    return { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' };
  }
  return { paddingTop: 'max(48px, calc(env(safe-area-inset-top, 0px) + 0.75rem))' };
}

/** Fixed orange strip behind the system status bar (mobile browser only). */
export function shouldPaintBrowserStatusBarFill(isCapacitorNative = isCapacitorNativePlatform()): boolean {
  return !isCapacitorNative;
}
