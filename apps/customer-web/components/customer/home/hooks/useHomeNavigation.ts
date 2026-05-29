'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { customerPathToScreen } from '@/lib/promotion-navigation';

export type HomeNavigateData = Record<string, unknown> | undefined;
export type HomeNavigateFn = (dest: string, data?: HomeNavigateData) => void;

/**
 * Single entry for home CTAs: internal screens → onNavigate; paths → router;
 * http(s) / mailto / tel → window.
 *
 * Extracted verbatim from CustomerHomeComplete.handleNavigation — do not change behavior here.
 */
export function useHomeNavigation(onNavigate?: HomeNavigateFn): HomeNavigateFn {
  const router = useRouter();

  return useCallback(
    (dest: string, data?: HomeNavigateData) => {
      const d = (dest ?? '').trim();
      if (!d) return;
      if (/^https?:\/\//i.test(d) || d.startsWith('//')) {
        const url = d.startsWith('//') ? `https:${d}` : d;
        window.location.assign(url);
        return;
      }
      if (/^(mailto:|tel:)/i.test(d)) {
        window.location.href = d;
        return;
      }
      if (d.startsWith('/')) {
        const screenFromPath = customerPathToScreen(d);
        if (screenFromPath) {
          onNavigate?.(screenFromPath, data);
          return;
        }
        router.push(d);
        return;
      }
      onNavigate?.(d, data);
    },
    [onNavigate, router]
  );
}
