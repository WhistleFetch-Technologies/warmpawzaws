/**
 * Sync OS home-screen app icon badge via backend FCM/APNs (no native rebuild).
 * Clears stuck iOS badges when inbox unread is already 0.
 */

import { apiClient } from './api-client';

const SESSION_KEY = 'warmpawz_app_icon_badge_synced_v1';

export async function requestAppIconBadgeSync(opts: {
  userId?: string | null;
  phone?: string | null;
}): Promise<void> {
  const userId = typeof opts.userId === 'string' ? opts.userId.trim() : '';
  const digits = String(opts.phone || '').replace(/\D/g, '');
  if (!userId && digits.length < 10) return;

  try {
    if (userId) {
      await apiClient.post('/notifications/sync-app-badge', {
        userId,
        userType: 'customer',
      });
      return;
    }
    await apiClient.post('/notifications/sync-app-badge', {
      phone: digits.slice(-10),
    });
  } catch (err) {
    console.warn('[app-icon-badge] sync failed:', err);
  }
}

/** Once per browser/WebView session when unread is already 0 (fixes stuck icon after prior push). */
export function requestAppIconBadgeSyncOnceWhenClear(opts: {
  unreadCount: number;
  userId?: string | null;
  phone?: string | null;
}): void {
  if (opts.unreadCount > 0) return;
  if (typeof sessionStorage === 'undefined') {
    void requestAppIconBadgeSync(opts);
    return;
  }
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // ignore storage failures
  }
  void requestAppIconBadgeSync(opts);
}
