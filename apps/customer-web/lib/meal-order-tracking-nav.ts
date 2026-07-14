'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { invokeMealShellTrack } from '@/lib/meal-shell-track-bridge';

/** Resume in-app meal tracking after Help & Support (shell). */
export const MEAL_TRACK_RESUME_ORDER_ID_KEY = 'warmpawz_meal_track_resume_order_id';
export const MEAL_TRACK_RESUME_BACK_SCREEN_KEY = 'warmpawz_meal_track_resume_back_screen';

export function resolveMealOrderRowId(order: {
  id?: string;
  order_id?: string;
  orderId?: string;
}): string {
  return String(order.id ?? order.order_id ?? order.orderId ?? '').trim();
}

export function rememberMealTrackSupportBack(orderId: string, backScreen: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(MEAL_TRACK_RESUME_ORDER_ID_KEY, orderId.trim());
    sessionStorage.setItem(MEAL_TRACK_RESUME_BACK_SCREEN_KEY, backScreen);
  } catch {
    /* ignore */
  }
}

export function consumeMealTrackSupportBack(): { orderId: string; backScreen: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const orderId = sessionStorage.getItem(MEAL_TRACK_RESUME_ORDER_ID_KEY)?.trim();
    const backScreen = sessionStorage.getItem(MEAL_TRACK_RESUME_BACK_SCREEN_KEY)?.trim();
    sessionStorage.removeItem(MEAL_TRACK_RESUME_ORDER_ID_KEY);
    sessionStorage.removeItem(MEAL_TRACK_RESUME_BACK_SCREEN_KEY);
    if (!orderId) return null;
    return { orderId, backScreen: backScreen || 'meal-plan-orders' };
  } catch {
    return null;
  }
}

/**
 * Open meal order tracking — in-app shell on `/`, otherwise client route `/track/:id`.
 */
export function navigateToMealOrderTracking(
  router: Pick<AppRouterInstance, 'push'>,
  orderId: string,
  options?: { backScreen?: string; phone?: string; from?: string },
): boolean {
  const id = orderId.trim();
  if (!id) return false;

  const backScreen = options?.backScreen ?? 'meal-plan-orders';
  if (typeof window !== 'undefined' && window.location.pathname === '/') {
    if (invokeMealShellTrack(id, backScreen)) return true;
  }

  const q = new URLSearchParams();
  q.set('orderId', id);
  q.set('from', options?.from ?? 'meal-plans');
  const phone = options?.phone?.trim();
  if (phone) q.set('phone', phone);
  // Static export only ships `/track/placeholder`; real id travels in query for S3/CloudFront.
  router.push(`/track/placeholder?${q.toString()}`);
  return true;
}
