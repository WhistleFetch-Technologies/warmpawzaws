import { describe, expect, it } from '@jest/globals';
import {
  isMealOrderVendorVisible,
  isPaymentAbandonCancellationReason,
  isShopOrderVendorVisible,
} from '../shop-vendor-visibility';

describe('shop-vendor-visibility', () => {
  describe('isShopOrderVendorVisible', () => {
    it('shows paid and completed online orders', () => {
      expect(isShopOrderVendorVisible({ payment_status: 'paid', payment_method: 'online' })).toBe(true);
      expect(isShopOrderVendorVisible({ payment_status: 'completed', payment_method: 'razorpay' })).toBe(true);
    });

    it('shows COD while unpaid', () => {
      expect(isShopOrderVendorVisible({ payment_status: 'pending', payment_method: 'cod' })).toBe(true);
      expect(isShopOrderVendorVisible({ payment_status: 'pending', payment_method: 'cash_on_delivery' })).toBe(true);
    });

    it('hides unpaid online drafts and abandoned checkouts', () => {
      expect(isShopOrderVendorVisible({ payment_status: 'pending', payment_method: 'online' })).toBe(false);
      expect(isShopOrderVendorVisible({ payment_status: 'expired', payment_method: 'online' })).toBe(false);
      expect(isShopOrderVendorVisible({ payment_status: 'failed', payment_method: 'online' })).toBe(false);
    });
  });

  describe('isMealOrderVendorVisible', () => {
    it('shows captured payment including refunded', () => {
      expect(isMealOrderVendorVisible({ payment_status: 'paid' })).toBe(true);
      expect(isMealOrderVendorVisible({ payment_status: 'completed' })).toBe(true);
      expect(isMealOrderVendorVisible({ payment_status: 'refunded' })).toBe(true);
    });

    it('hides unpaid and expired holds', () => {
      expect(isMealOrderVendorVisible({ payment_status: 'pending' })).toBe(false);
      expect(isMealOrderVendorVisible({ payment_status: 'expired' })).toBe(false);
      expect(isMealOrderVendorVisible({ payment_status: 'failed' })).toBe(false);
    });
  });

  describe('isPaymentAbandonCancellationReason', () => {
    it('recognizes payment-abandon reasons', () => {
      expect(isPaymentAbandonCancellationReason('payment_window_expired')).toBe(true);
      expect(isPaymentAbandonCancellationReason('razorpay_payment_failed')).toBe(true);
      expect(isPaymentAbandonCancellationReason('Customer request')).toBe(false);
    });
  });
});
