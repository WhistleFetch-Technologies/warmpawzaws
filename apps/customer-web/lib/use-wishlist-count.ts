'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  readWishlistIds,
  WISHLIST_UPDATED_EVENT,
} from '@/lib/warmpawz-wishlist-local';

/** Format count for overlay badge; returns empty string when hidden (count <= 0). */
export function formatWishlistBadgeCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

export function readWishlistCount(): number {
  return readWishlistIds().length;
}

/** Live wishlist size from localStorage; updates on wishlist-updated and tab focus. */
export function useWishlistCount(): number {
  const [count, setCount] = useState(0);

  const sync = useCallback(() => {
    setCount(readWishlistCount());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    sync();
    window.addEventListener(WISHLIST_UPDATED_EVENT, sync);

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) sync();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, sync);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sync]);

  return count;
}
