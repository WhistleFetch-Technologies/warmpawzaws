/**
 * Single idempotent capture finalizer for bookings and ecommerce orders.
 * All verify / webhook / reconcile / expiry success paths must call this.
 *
 * Captured payment → fulfill original entity OR refund. Never cancelled+paid.
 * A second capture on an already-fulfilled entity is auto-refunded.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/rds-connection';
import {
  acquireSlotOccupancyLock,
  evaluateSlotAvailability,
} from '../slot-occupancy';
import { notifyBookingCreated } from '../booking-notifications';
import { notifyShopOrderPaid } from '../shop-order-notifications';
import {
  notifyBookingCreatedIfNeeded,
  notifyShopOrderPaidIfNeeded,
} from '../notification-idempotency';
import { scheduleBookingStartOtpIfNeeded } from '../booking-start-otp';
import { triggerAutoShipment } from '../logistics/trigger-auto-shipment';
import { applyOrderCommissionAudit } from '../resolve-ecommerce-commission-rate';
import { writeEcommerceOrderSettlementLedgerRow } from '../write-ecommerce-order-settlement';
import {
  isHoldExpiryCancelReason,
  logPaymentSafety,
  type PaymentFinalizationSource,
} from './payment-attempt';
import { refundCapturedPaymentById } from './refund-captured-payment';
import { creditCustomerWalletForBookingRefund } from '../credit-customer-wallet';

export type FinalizeCapturedPaymentInput = {
  source: PaymentFinalizationSource;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paymentRowId?: string | null;
};

export type FinalizeCapturedPaymentResult = {
  outcome: 'fulfilled' | 'refunded' | 'duplicate_refunded' | 'already_final' | 'not_found';
  entityType?: 'booking' | 'shop_order' | 'event_registration';
  entityId?: string;
  paymentId?: string;
  previousEntityStatus?: string | null;
  newEntityStatus?: string | null;
};

async function bookingSlotAvailable(
  client: PoolClient,
  booking: {
    id: string;
    vendor_id: string;
    booking_date: string;
    booking_time: string;
    staff_id?: string | null;
    duration_minutes?: number | null;
    total_duration_minutes?: number | null;
  }
): Promise<boolean> {
  return evaluateSlotAvailability(client, {
    vendorId: String(booking.vendor_id),
    date: String(booking.booking_date),
    startTime: String(booking.booking_time),
    durationMinutes: Number(booking.total_duration_minutes || booking.duration_minutes || 30),
    staffId: booking.staff_id ? String(booking.staff_id) : null,
    excludeBookingId: booking.id,
  });
}

async function tryReserveOrderInventory(client: PoolClient, orderId: string): Promise<boolean> {
  const items = await client.query(
    `SELECT product_sku_id, quantity
     FROM order_items
     WHERE order_id = $1::uuid AND product_sku_id IS NOT NULL`,
    [orderId]
  );
  for (const row of items.rows) {
    const skuId = String(row.product_sku_id);
    const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
    if (!skuId || qty <= 0) continue;
    const upd = await client.query(
      `UPDATE product_skus
       SET stock = stock - $2, updated_at = NOW()
       WHERE id = $1 AND stock >= $2
       RETURNING product_id`,
      [skuId, qty]
    );
    if (upd.rows.length === 0) return false;
    const productId = upd.rows[0]?.product_id;
    if (productId) {
      await client.query(
        `UPDATE products p
         SET stock = COALESCE((
           SELECT SUM(stock) FROM product_skus WHERE product_id = p.id AND is_active = true
         ), 0),
         updated_at = NOW()
         WHERE id = $1 AND COALESCE(p.has_variations, false) = true`,
        [productId]
      );
    }
  }
  return true;
}

async function loadPaymentRow(
  client: PoolClient,
  input: FinalizeCapturedPaymentInput
): Promise<Record<string, unknown> | null> {
  if (input.paymentRowId) {
    const r = await client.query(`SELECT * FROM payments WHERE id = $1::uuid FOR UPDATE`, [input.paymentRowId]);
    return r.rows[0] || null;
  }
  if (input.razorpayPaymentId) {
    const r = await client.query(
      `SELECT * FROM payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
      [input.razorpayPaymentId]
    );
    if (r.rows[0]) return r.rows[0];
  }
  if (input.razorpayOrderId) {
    const r = await client.query(
      `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
      [input.razorpayOrderId]
    );
    return r.rows[0] || null;
  }
  return null;
}

export async function finalizeCapturedPayment(
  input: FinalizeCapturedPaymentInput
): Promise<FinalizeCapturedPaymentResult> {
  let notifyBookingId: string | null = null;
  let notifyShopOrderId: string | null = null;
  let notifyShopVendorId: string | null = null;
  let refundPaymentId: string | null = null;
  let refundReason:
    | 'duplicate_capture'
    | 'late_capture_slot_unavailable'
    | 'late_capture_inventory_unavailable'
    | 'unfulfillable_captured_payment'
    | null = null;
  let result: FinalizeCapturedPaymentResult = { outcome: 'not_found' };

  await withTransaction(async (client) => {
    const payment = await loadPaymentRow(client, input);
    if (!payment) {
      result = { outcome: 'not_found' };
      return;
    }
    const paymentId = String(payment.id);
    const rzPayId = input.razorpayPaymentId || payment.razorpay_payment_id;
    const prevPayStatus = String(payment.payment_status || '');

    await client.query(
      `UPDATE payments SET
         payment_status = CASE
           WHEN LOWER(COALESCE(payment_status, '')) IN ('refunded', 'partially_refunded') THEN payment_status
           ELSE 'completed'
         END,
         razorpay_payment_id = COALESCE(razorpay_payment_id, $2),
         razorpay_order_id = COALESCE(razorpay_order_id, $3),
         completed_at = COALESCE(completed_at, NOW()),
         updated_at = NOW()
       WHERE id = $1::uuid`,
      [paymentId, rzPayId || null, input.razorpayOrderId || payment.razorpay_order_id || null]
    );

    const payStatusNow = String(
      (await client.query(`SELECT payment_status FROM payments WHERE id = $1::uuid`, [paymentId])).rows[0]
        ?.payment_status || prevPayStatus
    );
    if (['refunded', 'partially_refunded'].includes(payStatusNow.toLowerCase())) {
      result = { outcome: 'already_final', paymentId };
      return;
    }

    const bookingId = payment.booking_id ? String(payment.booking_id) : null;
    const orderId = payment.order_id && !bookingId ? String(payment.order_id) : null;

    if (bookingId) {
      const locked = await client.query(
        `SELECT id, status, payment_status, cancellation_reason, cancelled_at, cancelled_by,
                vendor_id, customer_id, booking_date, booking_time, staff_id,
                duration_minutes, total_duration_minutes
         FROM bookings WHERE id = $1::uuid FOR UPDATE`,
        [bookingId]
      );
      if (!locked.rows[0]) {
        refundPaymentId = paymentId;
        refundReason = 'unfulfillable_captured_payment';
        result = { outcome: 'refunded', entityType: 'booking', entityId: bookingId, paymentId };
        return;
      }
      const b = locked.rows[0];
      const st = String(b.status || '');
      const ps = String(b.payment_status || '').toLowerCase();

      const otherCapture = await client.query(
        `SELECT id FROM payments
         WHERE booking_id = $1::uuid
           AND id <> $2::uuid
           AND LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid')
           AND razorpay_payment_id IS NOT NULL
         LIMIT 1`,
        [bookingId, paymentId]
      );
      if (otherCapture.rows.length > 0 && (ps === 'paid' || st === 'confirmed')) {
        refundPaymentId = paymentId;
        refundReason = 'duplicate_capture';
        result = {
          outcome: 'duplicate_refunded',
          entityType: 'booking',
          entityId: bookingId,
          paymentId,
          previousEntityStatus: st,
          newEntityStatus: st,
        };
        logPaymentSafety('duplicate_capture', {
          entity_id: bookingId,
          original_payment_id: otherCapture.rows[0].id,
          duplicate_payment_id: paymentId,
        });
        return;
      }

      if (st === 'confirmed' && ps === 'paid') {
        result = {
          outcome: 'already_final',
          entityType: 'booking',
          entityId: bookingId,
          paymentId,
          previousEntityStatus: st,
          newEntityStatus: st,
        };
        return;
      }

      const holdCancel = st === 'cancelled' && isHoldExpiryCancelReason(b.cancellation_reason);
      const pendingLike = st === 'pending_payment' || st === 'pending';
      if (!pendingLike && !holdCancel) {
        refundPaymentId = paymentId;
        refundReason = 'unfulfillable_captured_payment';
        result = {
          outcome: 'refunded',
          entityType: 'booking',
          entityId: bookingId,
          paymentId,
          previousEntityStatus: st,
        };
        return;
      }

      if (holdCancel) {
        await acquireSlotOccupancyLock(
          client,
          String(b.vendor_id),
          String(b.booking_date),
          b.staff_id ? String(b.staff_id) : null
        );
        const free = await bookingSlotAvailable(client, {
          id: bookingId,
          vendor_id: String(b.vendor_id),
          booking_date: String(b.booking_date),
          booking_time: String(b.booking_time),
          staff_id: b.staff_id,
          duration_minutes: b.duration_minutes,
          total_duration_minutes: b.total_duration_minutes,
        });
        if (!free) {
          refundPaymentId = paymentId;
          refundReason = 'late_capture_slot_unavailable';
          result = {
            outcome: 'refunded',
            entityType: 'booking',
            entityId: bookingId,
            paymentId,
            previousEntityStatus: st,
          };
          return;
        }
      }

      await client.query(
        `UPDATE bookings SET
           payment_status = 'paid',
           status = 'confirmed',
           cancellation_reason = NULL,
           cancelled_at = NULL,
           cancelled_by = NULL,
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [bookingId]
      );
      notifyBookingId = bookingId;
      result = {
        outcome: 'fulfilled',
        entityType: 'booking',
        entityId: bookingId,
        paymentId,
        previousEntityStatus: st,
        newEntityStatus: 'confirmed',
      };
      return;
    }

    if (orderId) {
      const locked = await client.query(
        `SELECT id, order_status, payment_status, cancellation_reason, vendor_id
         FROM orders WHERE id = $1::uuid FOR UPDATE`,
        [orderId]
      );
      if (!locked.rows[0]) {
        refundPaymentId = paymentId;
        refundReason = 'unfulfillable_captured_payment';
        result = { outcome: 'refunded', entityType: 'shop_order', entityId: orderId, paymentId };
        return;
      }
      const o = locked.rows[0];
      const st = String(o.order_status || '').toLowerCase();
      const ps = String(o.payment_status || '').toLowerCase();

      const otherCapture = await client.query(
        `SELECT id FROM payments
         WHERE order_id = $1::uuid AND booking_id IS NULL
           AND id <> $2::uuid
           AND LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid')
           AND razorpay_payment_id IS NOT NULL
         LIMIT 1`,
        [orderId, paymentId]
      );
      if (otherCapture.rows.length > 0 && (ps === 'paid' || ps === 'completed') && st !== 'cancelled') {
        refundPaymentId = paymentId;
        refundReason = 'duplicate_capture';
        result = {
          outcome: 'duplicate_refunded',
          entityType: 'shop_order',
          entityId: orderId,
          paymentId,
          previousEntityStatus: st,
          newEntityStatus: st,
        };
        logPaymentSafety('duplicate_capture', {
          entity_id: orderId,
          original_payment_id: otherCapture.rows[0].id,
          duplicate_payment_id: paymentId,
        });
        return;
      }

      if (ps === 'paid' && st !== 'cancelled') {
        result = {
          outcome: 'already_final',
          entityType: 'shop_order',
          entityId: orderId,
          paymentId,
          previousEntityStatus: st,
          newEntityStatus: st,
        };
        return;
      }

      const holdCancel = st === 'cancelled' && isHoldExpiryCancelReason(o.cancellation_reason);
      const pendingLike = st === 'pending_payment' || st === 'pending';
      if (!pendingLike && !holdCancel) {
        refundPaymentId = paymentId;
        refundReason = 'unfulfillable_captured_payment';
        result = {
          outcome: 'refunded',
          entityType: 'shop_order',
          entityId: orderId,
          paymentId,
          previousEntityStatus: st,
        };
        return;
      }

      if (holdCancel) {
        await client.query('SAVEPOINT inv_reserve');
        const reserved = await tryReserveOrderInventory(client, orderId);
        if (!reserved) {
          await client.query('ROLLBACK TO SAVEPOINT inv_reserve');
          refundPaymentId = paymentId;
          refundReason = 'late_capture_inventory_unavailable';
          result = {
            outcome: 'refunded',
            entityType: 'shop_order',
            entityId: orderId,
            paymentId,
            previousEntityStatus: st,
          };
          return;
        }
        await client.query('RELEASE SAVEPOINT inv_reserve');
      }

      await client.query(
        `UPDATE orders SET
           payment_status = 'paid',
           order_status = CASE
             WHEN order_status IN ('pending_payment', 'pending', 'cancelled') THEN 'pending'
             ELSE order_status
           END,
           payment_hold_expires_at = NULL,
           cancellation_reason = CASE WHEN order_status = 'cancelled' THEN NULL ELSE cancellation_reason END,
           cancelled_at = CASE WHEN order_status = 'cancelled' THEN NULL ELSE cancelled_at END,
           cancelled_by = CASE WHEN order_status = 'cancelled' THEN NULL ELSE cancelled_by END,
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [orderId]
      );
      notifyShopOrderId = orderId;
      notifyShopVendorId = o.vendor_id ? String(o.vendor_id) : null;
      result = {
        outcome: 'fulfilled',
        entityType: 'shop_order',
        entityId: orderId,
        paymentId,
        previousEntityStatus: st,
        newEntityStatus: 'pending',
      };
      return;
    }

    const eventRegistrationId = payment.event_registration_id
      ? String(payment.event_registration_id)
      : String(payment.payment_source || '') === 'event'
        ? String((payment.metadata as { event_registration_id?: string } | null)?.event_registration_id || '')
        : '';
    if (eventRegistrationId) {
      result = {
        outcome: 'fulfilled',
        entityType: 'event_registration' as FinalizeCapturedPaymentResult['entityType'],
        entityId: eventRegistrationId,
        paymentId,
        previousEntityStatus: String(payment.payment_status || ''),
        newEntityStatus: 'paid',
      };
      return;
    }

    result = { outcome: 'already_final', paymentId };
  });

  logPaymentSafety('finalization', {
    entity_type: result.entityType,
    entity_id: result.entityId,
    payment_id: result.paymentId,
    razorpay_payment_id: input.razorpayPaymentId,
    previous_status: result.previousEntityStatus,
    new_status: result.newEntityStatus,
    finalization_source: input.source,
    outcome: result.outcome,
  });

  if (result.outcome === 'fulfilled' || result.outcome === 'already_final') {
    if (
      (result.previousEntityStatus === 'cancelled' || result.previousEntityStatus === 'pending_payment') &&
      result.outcome === 'already_final'
    ) {
      logPaymentSafety('cancelled_plus_paid', {
        entity_id: result.entityId,
        payment_id: result.paymentId,
      });
    }
  }

  if (refundPaymentId && refundReason) {
    const refund = await refundCapturedPaymentById({
      paymentId: refundPaymentId,
      reason: refundReason,
      source: input.source,
    });
    logPaymentSafety('refund', {
      payment_id: refundPaymentId,
      refund_id: refund.refundId,
      reason: refundReason,
      source: input.source,
      status: refund.alreadyProcessed ? 'already_processed' : 'initiated',
    });
    await restoreWalletAfterUnfulfillableCapture({
      reason: refundReason,
      entityType: result.entityType,
      entityId: result.entityId,
    }).catch((e) => console.error('[PAYMENT-SAFETY] wallet restore after unfulfillable capture failed:', e));
  }

  if (notifyBookingId) {
    await notifyBookingCreated(notifyBookingId).catch((e) =>
      console.error('[PAYMENT-SAFETY] booking notify failed:', e)
    );
    scheduleBookingStartOtpIfNeeded(notifyBookingId, `[PAYMENT-FINALIZE:${input.source}]`);
  } else if (
    result.outcome === 'already_final' &&
    result.entityType === 'booking' &&
    result.entityId
  ) {
    await notifyBookingCreatedIfNeeded(String(result.entityId)).catch((e) =>
      console.error('[PAYMENT-SAFETY] booking notify (already_final) failed:', e)
    );
  }
  if (result.outcome === 'fulfilled' && result.entityType === 'event_registration' && result.paymentId) {
    const { fulfillEventRegistrationPayment } = await import(
      '../../endpoints/events/services/event-payment.service'
    );
    await fulfillEventRegistrationPayment(result.paymentId).catch((e) =>
      console.error('[PAYMENT-SAFETY] event registration fulfill failed:', e)
    );
  }

  if (notifyShopOrderId) {
    triggerAutoShipment(notifyShopOrderId, 'ecommerce').catch((e) =>
      console.error('[PAYMENT-SAFETY] shop auto-shipment failed:', e)
    );
    const writeSettlement = () =>
      writeEcommerceOrderSettlementLedgerRow(notifyShopOrderId!).catch((e) =>
        console.error('[PAYMENT-SAFETY] shop settlement failed:', e)
      );
    if (notifyShopVendorId) {
      void applyOrderCommissionAudit(notifyShopOrderId, notifyShopVendorId)
        .then(() => writeSettlement())
        .catch((e) => {
          console.warn('[PAYMENT-SAFETY] shop commission audit failed:', e);
          return writeSettlement();
        });
    } else {
      void writeSettlement();
    }
    await notifyShopOrderPaid(notifyShopOrderId).catch((e) =>
      console.error('[PAYMENT-SAFETY] shop notify failed:', e)
    );
  } else if (
    result.outcome === 'already_final' &&
    result.entityType === 'shop_order' &&
    result.entityId
  ) {
    await notifyShopOrderPaidIfNeeded(String(result.entityId)).catch((e) =>
      console.error('[PAYMENT-SAFETY] shop notify (already_final) failed:', e)
    );
  }

  return result;
}

async function restoreWalletAfterUnfulfillableCapture(params: {
  reason: string;
  entityType?: 'booking' | 'shop_order' | 'event_registration';
  entityId?: string;
}): Promise<void> {
  if (params.reason === 'duplicate_capture') return;
  if (!params.entityId) return;

  if (params.entityType === 'booking') {
    const booking = await query(
      `SELECT id, customer_id FROM bookings WHERE id = $1::uuid`,
      [params.entityId]
    );
    const customerId = booking.rows[0]?.customer_id ? String(booking.rows[0].customer_id) : '';
    if (!customerId) return;
    const debit = await query(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM wallet_transactions
       WHERE transaction_type = 'debit'
         AND (
           (reference_type = 'booking_payment' AND reference_id::text = $1)
           OR booking_id = $1::uuid
           OR description ILIKE $2
         )`,
      [params.entityId, `%${params.entityId}%`]
    );
    const credited = await query(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM wallet_transactions
       WHERE transaction_type = 'credit'
         AND COALESCE(reference_type, '') = 'booking_refund'
         AND (
           booking_id = $1::uuid
           OR reference_id::text = $1
           OR description ILIKE $2
         )`,
      [params.entityId, `%${params.entityId}%`]
    );
    const net =
      Math.round(
        ((parseFloat(String(debit.rows[0]?.total ?? '0')) || 0) -
          (parseFloat(String(credited.rows[0]?.total ?? '0')) || 0)) *
          100
      ) / 100;
    if (net <= 0.009) return;
    await creditCustomerWalletForBookingRefund({
      customerId,
      bookingId: params.entityId,
      refundAmount: net,
      refundPercentage: 100,
      label: 'booking',
    });
    return;
  }

  if (params.entityType === 'shop_order') {
    const order = await query(
      `SELECT id, customer_id, order_number, wallet_amount_applied
       FROM orders WHERE id = $1::uuid`,
      [params.entityId]
    );
    const row = order.rows[0];
    if (!row) return;
    const walletApplied = Math.round((parseFloat(String(row.wallet_amount_applied ?? 0)) || 0) * 100) / 100;
    const customerId = row.customer_id ? String(row.customer_id) : '';
    if (!customerId || walletApplied <= 0) return;
    await withTransaction(async (client) => {
      const dup = await client.query(
        `SELECT id FROM wallet_transactions
         WHERE customer_id = $1::uuid
           AND transaction_type = 'credit'
           AND COALESCE(reference_type, '') = 'order'
           AND reference_id::text = $2
         LIMIT 1`,
        [customerId, String(row.id)]
      );
      if (dup.rows.length > 0) return;
      await client.query(
        `INSERT INTO customer_wallets (customer_id, balance, currency, updated_at)
         VALUES ($1::uuid, 0, 'INR', NOW())
         ON CONFLICT (customer_id) DO NOTHING`,
        [customerId]
      );
      await client.query(
        `UPDATE customer_wallets
         SET balance = balance + $1::numeric, updated_at = NOW()
         WHERE customer_id = $2::uuid`,
        [walletApplied, customerId]
      );
      await client.query(
        `INSERT INTO wallet_transactions
           (customer_id, transaction_type, amount, description, reference_type, reference_id, created_at)
         VALUES ($1::uuid, 'credit', $2, $3, 'order', $4::uuid, NOW())
         ON CONFLICT DO NOTHING`,
        [
          customerId,
          walletApplied,
          `Restored from unfulfillable order ${row.order_number || row.id}`,
          String(row.id),
        ]
      );
    });
  }
}

export async function recordRazorpayWebhookEvent(eventId: string, eventType: string, paymentId?: string): Promise<void> {
  if (!eventId) return;
  await query(
    `INSERT INTO razorpay_webhook_events (event_id, event_type, payment_id, result)
     VALUES ($1, $2, $3, 'processed')
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType, paymentId || null]
  ).catch((e) => console.warn('[PAYMENT-SAFETY] webhook event insert skipped:', e?.message || e));
}
