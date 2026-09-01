/**
 * Sync OS home-screen app icon badge from inbox unread count via FCM/APNs.
 * Clears stuck iOS badges after mark-as-read without a native app rebuild.
 */

import { query } from '../database/rds-connection';
import { loadFreshActiveFcmTokens } from './device-token-hygiene';
import { sendAppIconBadgeSync } from './firebase-client';

export async function countUnreadNotifications(
  recipientId: string,
  recipientType: string
): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM notifications
     WHERE recipient_id = $1
       AND recipient_type = $2
       AND is_read = false`,
    [recipientId, recipientType]
  );
  return Number(result.rows?.[0]?.count || 0);
}

/**
 * Push current unread count as APNs badge (0 clears the home-screen icon).
 * Best-effort — never throws to callers.
 */
export async function syncRecipientAppIconBadge(
  recipientId: string,
  recipientType: string
): Promise<{ unread: number; successCount: number; failureCount: number }> {
  try {
    if (!recipientId || !recipientType) {
      return { unread: 0, successCount: 0, failureCount: 0 };
    }
    const unread = await countUnreadNotifications(recipientId, recipientType);
    const tokens = await loadFreshActiveFcmTokens(recipientId, recipientType);
    if (tokens.length === 0) {
      return { unread, successCount: 0, failureCount: 0 };
    }
    const result = await sendAppIconBadgeSync(tokens, unread);
    return { unread, ...result };
  } catch (err) {
    console.warn(
      '[app-icon-badge-sync] failed:',
      err instanceof Error ? err.message : err
    );
    return { unread: 0, successCount: 0, failureCount: 0 };
  }
}

/** Fire-and-forget wrapper for HTTP handlers. */
export function scheduleRecipientAppIconBadgeSync(
  recipientId: string,
  recipientType: string
): void {
  void syncRecipientAppIconBadge(recipientId, recipientType);
}
