'use client';

import { Capacitor } from '@capacitor/core';

/** True when the bundle runs inside a Capacitor native shell (not a normal mobile browser / PWA tab). */
export function isCapacitorNativeApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
