/**
 * Post-payment finalization notify safety net (develop parity).
 */

import type { FinalizeCapturedPaymentResult } from './payments/finalize-captured-payment';
import {
  notifyBookingCreatedIfNeeded,
  notifyShopOrderPaidIfNeeded,
} from './notification-idempotency';

export async function ensurePostPaymentLifecycleNotifications(
  fin: FinalizeCapturedPaymentResult,
  requestId?: string
): Promise<void> {
  if (fin.outcome !== 'fulfilled' && fin.outcome !== 'already_final') return;
  if (!fin.entityId) return;

  if (fin.entityType === 'booking') {
    await notifyBookingCreatedIfNeeded(String(fin.entityId), requestId).catch((e) =>
      console.error('[PAYMENT-NOTIFY] booking lifecycle notify failed:', e)
    );
    return;
  }

  if (fin.entityType === 'shop_order') {
    await notifyShopOrderPaidIfNeeded(String(fin.entityId)).catch((e) =>
      console.error('[PAYMENT-NOTIFY] shop lifecycle notify failed:', e)
    );
  }
}
