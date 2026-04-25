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

/** Android WebView often lacks a working HTML file chooser; use @capacitor/camera for these accepts. */
export function isAndroidCapacitorNative(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/**
 * True when `accept` only allows images (e.g. `image/*`, `image/png`, or `.jpg`).
 * Wildcard "any" MIME and empty accept are false so we do not route generic file pickers to the camera flow.
 */
export function isImageOnlyFileAccept(accept: string | undefined): boolean {
  if (!accept?.trim()) {
    return false;
  }
  const parts = accept
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) {
    return false;
  }
  for (const p of parts) {
    if (p === '*/*' || p === '*') {
      return false;
    }
    if (p === 'image/*' || p.startsWith('image/')) {
      continue;
    }
    if (/^\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/.test(p)) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Use Capawesome only when the native FilePicker module is actually linked.
 * Otherwise `pickFiles()` throws UNIMPLEMENTED; programmatic file input activation fails on Android WebView.
 */
export function shouldUseCapawesomeFilePicker(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FilePicker');
  } catch {
    return false;
  }
}

/** For Android WebView: HTML file input is unreliable; `@capacitor/camera` can still be linked. */
export function isCapacitorCameraPluginAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Camera');
  } catch {
    return false;
  }
}
