/**
 * Idempotent notification helpers — ensure lifecycle alerts fire once while
 * still allowing push retry when inbox exists but tray delivery never succeeded.
 */

import { query } from '../database/rds-connection';

const DEDUPE_LOOKBACK_HOURS = 48;

/** True when no notification row exists for this dedupeKey within the lookback window. */
export async function shouldSendLifecycleNotification(params: {
  recipientId: string;
  recipientType: string;
  notificationType: string;
  dedupeKey: string;
}): Promise<boolean> {
  const existing = await findNotificationByDedupeKey(params);
  return !existing;
}

export async function findNotificationByDedupeKey(params: {
  recipientId: string;
  recipientType: string;
  notificationType: string;
  dedupeKey: string;
}): Promise<string | null> {
  const result = await query(
    `SELECT id FROM notifications
     WHERE recipient_id = $1::uuid
       AND recipient_type = $2
       AND notification_type = $3
       AND (data->>'dedupeKey') = $4
       AND created_at > NOW() - ($5::int || ' hours')::interval
     ORDER BY created_at DESC
     LIMIT 1`,
    [
      params.recipientId,
      params.recipientType,
      params.notificationType,
      params.dedupeKey,
      DEDUPE_LOOKBACK_HOURS,
    ]
  ).catch(() => ({ rows: [] }));

  return result.rows?.[0]?.id ? String(result.rows[0].id) : null;
}

/** True when push channel never reached sent/delivered for this notification. */
export async function pushDeliveryNeedsRetry(notificationId: string): Promise<boolean> {
  const result = await query(
    `SELECT status FROM notification_delivery_log
     WHERE notification_id = $1::uuid AND channel = 'push'
     ORDER BY attempt_number ASC
     LIMIT 1`,
    [notificationId]
  ).catch(() => ({ rows: [] }));

  if (!result.rows?.length) return true;
  const status = String(result.rows[0].status || '').toLowerCase();
  return status !== 'sent' && status !== 'delivered' && status !== 'opened';
}

/** Run notifyFn only when dedupe recipient row is absent (full dispatch). */
export async function notifyIfNotAlreadySent(params: {
  recipientId: string;
  recipientType: string;
  notificationType: string;
  dedupeKey: string;
  notifyFn: () => Promise<unknown>;
}): Promise<{ sent: boolean; skipped: boolean }> {
  const shouldSend = await shouldSendLifecycleNotification(params);
  if (!shouldSend) return { sent: false, skipped: true };
  await params.notifyFn();
  return { sent: true, skipped: false };
}

/** Booking created — vendor + customer dedupe keys. */
export async function notifyBookingCreatedIfNeeded(bookingId: string, requestId?: string): Promise<void> {
  const { notifyBookingCreated } = await import('./booking-notifications');
  const vendorKey = `booking-${bookingId}-created-vendor`;
  const customerKey = `booking-${bookingId}-created-customer`;

  const booking = await query(
    `SELECT vendor_id, customer_id FROM bookings WHERE id = $1::uuid LIMIT 1`,
    [bookingId]
  ).catch(() => ({ rows: [] }));

  const row = booking.rows[0] as { vendor_id?: string; customer_id?: string } | undefined;
  const vendorId = row?.vendor_id ? String(row.vendor_id) : '';
  const customerId = row?.customer_id ? String(row.customer_id) : '';

  let needFullNotify = false;
  if (vendorId) {
    const v = await shouldSendLifecycleNotification({
      recipientId: vendorId,
      recipientType: 'vendor',
      notificationType: 'new_booking',
      dedupeKey: vendorKey,
    });
    if (v) needFullNotify = true;
  }
  if (customerId) {
    const c = await shouldSendLifecycleNotification({
      recipientId: customerId,
      recipientType: 'customer',
      notificationType: 'booking_created',
      dedupeKey: customerKey,
    });
    if (c) needFullNotify = true;
  }

  if (needFullNotify) {
    await notifyBookingCreated(bookingId, requestId);
  }
}

/** Shop order paid — customer + vendor dedupe keys. */
export async function notifyShopOrderPaidIfNeeded(orderId: string): Promise<void> {
  const { notifyShopOrderPaid } = await import('./shop-order-notifications');

  const order = await query(
    `SELECT customer_id, vendor_id FROM orders WHERE id = $1::uuid LIMIT 1`,
    [orderId]
  ).catch(() => ({ rows: [] }));

  const row = order.rows[0] as { customer_id?: string; vendor_id?: string } | undefined;
  const customerId = row?.customer_id ? String(row.customer_id) : '';
  const vendorId = row?.vendor_id ? String(row.vendor_id) : '';

  let needFullNotify = false;
  if (customerId) {
    const c = await shouldSendLifecycleNotification({
      recipientId: customerId,
      recipientType: 'customer',
      notificationType: 'shop_order_confirmed',
      dedupeKey: `shop-order-${orderId}-paid-customer`,
    });
    if (c) needFullNotify = true;
  }
  if (vendorId) {
    const v = await shouldSendLifecycleNotification({
      recipientId: vendorId,
      recipientType: 'vendor',
      notificationType: 'vendor_shop_order_new',
      dedupeKey: `shop-order-${orderId}-paid-vendor`,
    });
    if (v) needFullNotify = true;
  }

  if (needFullNotify) {
    await notifyShopOrderPaid(orderId);
  }
}
