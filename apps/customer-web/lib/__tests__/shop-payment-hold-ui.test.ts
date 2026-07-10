import { describe, expect, test } from '@jest/globals';
import {
  isShopOrderAwaitingPayment,
  isShopOrderPaymentHoldActive,
  isShopOrderPaymentHoldExpired,
  isShopOrderPaymentHoldVisible,
} from '../payment-hold-ui';

describe('shop order payment hold UI helpers', () => {
  const future = new Date(Date.now() + 120_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();

  test('awaiting payment for pending_payment online unpaid', () => {
    expect(
      isShopOrderAwaitingPayment({
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentMethod: 'online',
      })
    ).toBe(true);
  });

  test('not awaiting for COD', () => {
    expect(
      isShopOrderAwaitingPayment({
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentMethod: 'cod',
      })
    ).toBe(false);
  });

  test('hold visible when active or expired', () => {
    expect(
      isShopOrderPaymentHoldVisible({
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentHoldExpiresAt: future,
      })
    ).toBe(true);
    expect(
      isShopOrderPaymentHoldVisible({
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentHoldExpiresAt: past,
      })
    ).toBe(true);
  });

  test('hold not visible when paid', () => {
    expect(
      isShopOrderPaymentHoldVisible({
        status: 'pending',
        paymentStatus: 'paid',
        paymentHoldExpiresAt: future,
      })
    ).toBe(false);
  });

  test('active hold within window', () => {
    expect(
      isShopOrderPaymentHoldActive({
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentHoldExpiresAt: future,
      })
    ).toBe(true);
  });

  test('expired hold after window', () => {
    expect(
      isShopOrderPaymentHoldExpired({
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentHoldExpiresAt: past,
      })
    ).toBe(true);
  });
});
