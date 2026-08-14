'use client';

import { useEffect } from 'react';

/**
 * Locks document scroll while a modal/overlay is open (iOS-safe fixed-body pattern).
 * Restores scroll position on cleanup.
 */
export function useLockBodyScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [enabled]);
}
