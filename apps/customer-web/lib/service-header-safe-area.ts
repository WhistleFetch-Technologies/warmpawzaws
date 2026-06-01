import type { CSSProperties } from 'react';

/** True when running inside the Capacitor shell (Android / iOS APK). */
export function isCapacitorNativePlatform(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Matches Tailwind `max-sm` — phone-sized browser / PWA column. */
export function subscribeToNarrowMobileViewport(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const mq = window.matchMedia('(max-width: 640px)');
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

export function isNarrowMobileViewport(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.matchMedia('(max-width: 640px)').matches;
}

/**
 * Top padding for {@link ServiceDashboardHeader}.
 * - `compact` (payment summary): unchanged — do not alter Razorpay-adjacent flows.
 * - Capacitor: WebView is already inset below the status bar in MainActivity.
 * - Mobile browser: min 48px + theme-color so flat Android phones clear the system status bar.
 * - Desktop browser: normal safe-area padding only (no extra 48px strip).
 */
export function resolveServiceHeaderTopPad(
  compact: boolean,
  isCapacitorNative = isCapacitorNativePlatform(),
  isNarrowMobile = isNarrowMobileViewport(),
): CSSProperties {
  if (compact) {
    return { paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 8px))' };
  }
  if (isCapacitorNative) {
    return { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' };
  }
  if (isNarrowMobile) {
    return { paddingTop: 'max(48px, calc(env(safe-area-inset-top, 0px) + 0.75rem))' };
  }
  return { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' };
}
