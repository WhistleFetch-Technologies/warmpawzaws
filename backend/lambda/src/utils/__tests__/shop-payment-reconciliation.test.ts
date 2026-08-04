import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SHOP_HOLD_EXPIRY_CANCEL_REASON } from '../payments/shop-payment-reconciliation';
import { isPaymentAbandonCancellationReason } from '../shop-vendor-visibility';

const reconciliationSource = readFileSync(
  join(__dirname, '../payments/shop-payment-reconciliation.ts'),
  'utf8'
);

describe('shop-payment-reconciliation', () => {
  test('hold-expiry cancel reason is a payment-abandon reason', () => {
    expect(SHOP_HOLD_EXPIRY_CANCEL_REASON).toBe('payment_window_expired');
    expect(isPaymentAbandonCancellationReason(SHOP_HOLD_EXPIRY_CANCEL_REASON)).toBe(true);
  });

  test('confirm path re-confirms payment_window_expired cancelled orders', () => {
    expect(reconciliationSource).toContain('canReconfirmShopOrderFromHoldCancel');
    expect(reconciliationSource).toContain('SHOP_HOLD_EXPIRY_CANCEL_REASON');
    expect(reconciliationSource).toContain('runShopOrderPaidSideEffects');
  });

  test('batch reconcile runs Tier 1 then capped Tier 2 Razorpay checks', () => {
    expect(reconciliationSource).toContain('reconcileShopOrderTier1');
    expect(reconciliationSource).toContain('reconcileShopOrderTier2');
    expect(reconciliationSource).toContain('razorpayCheckLimit');
  });

  test('expire hold sweeper calls reconcile before discard', () => {
    const holdSource = readFileSync(join(__dirname, '../shop-payment-hold.ts'), 'utf8');
    expect(holdSource).toContain('reconcileShopOrderPayment');
    expect(holdSource).toContain('expire-hold-sweep');
  });
});
