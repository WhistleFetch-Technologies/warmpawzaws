import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isActivePayablePaymentStatus,
  isCapturedPaymentStatus,
  isHoldExpiryCancelReason,
} from '../payment-attempt';
import { SQL_RECONFIRM_PAID_AFTER_HOLD_CANCEL } from '../../customer-booking-visibility';

const lambdaRoot = join(__dirname, '../../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('payment attempt helpers', () => {
  test('pending/processing are payable; completed/paid are captured', () => {
    expect(isActivePayablePaymentStatus('pending')).toBe(true);
    expect(isActivePayablePaymentStatus('processing')).toBe(true);
    expect(isActivePayablePaymentStatus('failed')).toBe(false);
    expect(isCapturedPaymentStatus('completed')).toBe(true);
    expect(isCapturedPaymentStatus('paid')).toBe(true);
    expect(isCapturedPaymentStatus('pending')).toBe(false);
  });

  test('hold-expiry reason is payment_window_expired only', () => {
    expect(isHoldExpiryCancelReason('payment_window_expired')).toBe(true);
    expect(isHoldExpiryCancelReason('customer_request')).toBe(false);
  });
});

describe('SQL_RECONFIRM no longer races payment_status in the same UPDATE', () => {
  test('CASE does not require old-row payment_status = paid', () => {
    expect(SQL_RECONFIRM_PAID_AFTER_HOLD_CANCEL).not.toMatch(
      /payment_status[\s\S]*IN \('paid', 'completed'\)/
    );
  });

  test('reconciliation no longer uses SQL_RECONFIRM for capture recovery', () => {
    const file = read('src/utils/payments/payment-reconciliation.ts');
    expect(file).toContain('finalizeCapturedPayment');
    expect(file).not.toContain('SQL_RECONFIRM_PAID_AFTER_HOLD_CANCEL');
  });
});

describe('single payment finalization path', () => {
  test('verify, webhook, create-order, expiry, and shop reconcile call finalizeCapturedPayment', () => {
    const razorpay = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    const enhanced = read('src/endpoints/payments-enhanced.ts');
    const expiry = read('src/utils/payment-hold.ts');
    const shop = read('src/utils/payments/shop-payment-reconciliation.ts');
    const ensure = read('src/utils/payments/ensure-payable-razorpay-order.ts');
    expect(razorpay).toContain("source: 'verify'");
    expect(razorpay).toContain("source: 'webhook'");
    expect(razorpay).toContain('ensurePayableRazorpayOrder');
    expect(enhanced).toContain('finalizeCapturedPayment');
    expect(expiry).toContain("source: 'expiry'");
    expect(shop).toContain('finalizeCapturedPayment');
    expect(ensure).toContain('finalizeCapturedPayment');
  });

  test('finalizer refunds duplicate capture and late unfulfillable capture', () => {
    const file = read('src/utils/payments/finalize-captured-payment.ts');
    expect(file).toContain("refundReason = 'duplicate_capture'");
    expect(file).toContain("refundReason = 'late_capture_slot_unavailable'");
    expect(file).toContain("refundReason = 'late_capture_inventory_unavailable'");
    expect(file).toContain('acquireSlotOccupancyLock');
    expect(file).toContain('evaluateSlotAvailability');
    expect(file).toContain('bookingSlotAvailable');
    expect(file).toContain('tryReserveOrderInventory');
    expect(file).toContain('SAVEPOINT inv_reserve');
    expect(file).toContain('cancellation_reason = NULL');
  });

  test('refunds use stable X-Refund-Idempotency per payment id', () => {
    const file = read('src/utils/payments/refund-captured-payment.ts');
    expect(file).toContain('wp-refund-${paymentId}');
    expect(file).toContain('idempotencyKey:');
    expect(file).toContain('SAVEPOINT refund_insert');
  });

  test('webhook events are persisted for replay dedupe', () => {
    const file = read('src/utils/payments/finalize-captured-payment.ts');
    expect(file).toContain('INSERT INTO razorpay_webhook_events');
    expect(file).toContain('ON CONFLICT (event_id) DO NOTHING');
  });

  test('already_final path triggers idempotent booking and shop notify helpers', () => {
    const file = read('src/utils/payments/finalize-captured-payment.ts');
    expect(file).toContain('notifyBookingCreatedIfNeeded');
    expect(file).toContain('notifyShopOrderPaidIfNeeded');
    expect(file).toContain("outcome === 'already_final'");
  });

  test('razorpay verify and webhook call post-payment lifecycle notify safety net', () => {
    const razorpay = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    const enhanced = read('src/endpoints/payments-enhanced.ts');
    expect(razorpay).toContain('ensurePostPaymentLifecycleNotifications');
    expect(enhanced).toContain('ensurePostPaymentLifecycleNotifications');
    expect(razorpay).toContain('notifyBookingCreatedIfNeeded');
  });
});

describe('payment order reuse', () => {
  test('ensurePayable reuses existing Razorpay order and uses receipt per payment row', () => {
    const file = read('src/utils/payments/ensure-payable-razorpay-order.ts');
    expect(file).toContain('FOR UPDATE');
    expect(file).toContain('reused_existing_order');
    expect(file).toContain('receiptForPayment');
    expect(file).toContain("status === 'paid'");
  });

  test('create-order handler delegates booking and ecommerce to ensurePayable', () => {
    const file = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    expect(file).toContain('ensurePayableRazorpayOrder');
    expect(file).toContain('reusedExistingOrder');
    expect(file).toContain('paidByCapture');
  });

  test('migration 1085 adds one-active-attempt and unique razorpay_order_id indexes', () => {
    const file = readFileSync(
      join(lambdaRoot, '../../db/migrations/1085_payment_attempt_safety.sql'),
      'utf8'
    );
    expect(file).toContain('idx_payments_one_active_per_booking');
    expect(file).toContain('idx_payments_one_active_per_shop_order');
    expect(file).toContain('idx_payments_razorpay_order_id_unique');
    expect(file).toContain('idx_refunds_one_active_per_payment');
    expect(file).toContain('CREATE TABLE IF NOT EXISTS razorpay_webhook_events');
    expect(file).toContain('superseded_active_attempt');
    expect(file).not.toContain('DELETE FROM payments');
  });

  test('refund unique index only covers in-flight pending/processing rows', () => {
    const file = readFileSync(
      join(lambdaRoot, '../../db/migrations/1085_payment_attempt_safety.sql'),
      'utf8'
    );
    expect(file).toContain("LOWER(COALESCE(refund_status, '')) IN ('pending', 'processing')");
    expect(file).not.toMatch(
      /idx_refunds_one_active_per_payment[\s\S]*NOT IN \('failed', 'rejected'\)/
    );
  });

  test('ensurePayable looks up Razorpay order by receipt after POST crash/duplicate', () => {
    const file = read('src/utils/payments/ensure-payable-razorpay-order.ts');
    expect(file).toContain('fetchRazorpayOrderByReceipt');
    expect(file).toContain('/orders?receipt=');
    expect(file).toContain('attachRazorpayOrderId');
  });

  test('unfulfillable Razorpay refund restores wallet; duplicate capture does not', () => {
    const file = read('src/utils/payments/finalize-captured-payment.ts');
    expect(file).toContain('restoreWalletAfterUnfulfillableCapture');
    expect(file).toContain("params.reason === 'duplicate_capture'");
    expect(file).toContain('creditCustomerWalletForBookingRefund');
  });
});

describe('expiry does not treat 5-minute hold as Razorpay invalidation', () => {
  test('booking expiry reconciles Razorpay before releasing the slot', () => {
    const file = read('src/utils/payment-hold.ts');
    expect(file).toContain("source: 'expiry'");
    expect(file).toContain('razorpay_order_id IS NOT NULL');
    expect(file).toContain('THEN payment_status');
  });

  test('payment.failed does not mark a still-payable attempt failed or cancel the booking', () => {
    const file = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    expect(file).not.toMatch(/payment_status = 'failed'[\s\S]{0,80}razorpay_payment_id = \$2 OR razorpay_order_id/);
    expect(file).not.toContain('[PAYMENT-FAILED] ✅ Booking cancelled and slot released');
  });
});

describe('frontend reuses resume Razorpay order', () => {
  test('UniversalPaymentPage uses resumeRazorpayOrderId instead of create-order', () => {
    const file = readFileSync(
      join(lambdaRoot, '../../apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx'),
      'utf8'
    );
    expect(file).toContain('resumeRazorpayOrderId && isPaymentResume');
    expect(file).toContain('Reusing resume Razorpay order');
    expect(file).toContain('paidByCapture');
  });

  test('shop resume can skip create-order when razorpayOrderId is provided', () => {
    const file = readFileSync(
      join(lambdaRoot, '../../apps/customer-web/lib/ecommerce/resume-shop-order-payment.ts'),
      'utf8'
    );
    expect(file).toContain('razorpayOrderId?: string | null');
    expect(file).toContain('if (razorpayOrderId && process.env.NEXT_PUBLIC_RAZORPAY_KEY)');
  });
});
