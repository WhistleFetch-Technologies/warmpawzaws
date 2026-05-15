'use client';

import { useEffect } from 'react';

const ATTR = 'data-vendor-scroll-lock';

let lockCount = 0;

function applyAttr() {
  if (typeof document === 'undefined') return;
  if (lockCount > 0) {
    document.documentElement.setAttribute(ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(ATTR);
  }
}

/** Locks the vendor chrome scroll host (see globals.css) while overlays are open. Reference-counted. */
export function lockVendorChromeScroll(): void {
  lockCount += 1;
  applyAttr();
}

export function unlockVendorChromeScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  applyAttr();
}

/** Lock while `locked` is true; safe with Strict Mode double-mount. */
export function useVendorChromeScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    lockVendorChromeScroll();
    return () => {
      unlockVendorChromeScroll();
    };
  }, [locked]);
}
