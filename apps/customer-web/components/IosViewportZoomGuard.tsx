'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

const ZOOM_THRESHOLD = 1.01;

function isIosCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

function getViewportMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="viewport"]');
}

/** Briefly toggles maximum-scale on the viewport meta to reset stuck iOS WKWebView zoom. */
function resetStuckViewportZoom(): void {
  const meta = getViewportMeta();
  if (!meta) return;

  const original = meta.getAttribute('content') ?? '';
  if (!original) return;

  const withMaxScale = original.includes('maximum-scale')
    ? original.replace(/maximum-scale=[^,]+/, 'maximum-scale=1')
    : `${original}, maximum-scale=1`;

  meta.setAttribute('content', withMaxScale);
  requestAnimationFrame(() => {
    meta.setAttribute('content', original);
  });
}

function isViewportZoomed(): boolean {
  const scale = window.visualViewport?.scale;
  return typeof scale === 'number' && scale > ZOOM_THRESHOLD;
}

/**
 * Safety net for Capacitor iOS: WKWebView can keep document zoom after keyboard
 * dismiss when a focused control had font-size < 16px. Resets on blur / viewport resize.
 */
export function IosViewportZoomGuard() {
  useEffect(() => {
    if (!isIosCapacitorNative()) return;

    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleResetIfZoomed = () => {
      if (!isViewportZoomed()) return;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (isViewportZoomed()) {
          resetStuckViewportZoom();
        }
      }, 100);
    };

    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return;
      }
      scheduleResetIfZoomed();
    };

    document.addEventListener('focusout', onFocusOut, true);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', scheduleResetIfZoomed);
    }

    return () => {
      clearTimeout(resetTimer);
      document.removeEventListener('focusout', onFocusOut, true);
      if (vv) {
        vv.removeEventListener('resize', scheduleResetIfZoomed);
      }
    };
  }, []);

  return null;
}
