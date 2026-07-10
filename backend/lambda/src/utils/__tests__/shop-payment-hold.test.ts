import { describe, expect, test } from '@jest/globals';
import {
  isShopOrderPaymentHoldActive,
  isShopOrderPaymentHoldExpired,
} from '../shop-payment-hold';

describe('shop payment hold helpers', () => {
  test('active for pending_payment within hold window', () => {
    const future = new Date(Date.now() + 120_000).toISOString();
    expect(
      isShopOrderPaymentHoldActive({
        order_status: 'pending_payment',
        payment_status: 'pending',
        payment_method: 'online',
        payment_hold_expires_at: future,
      })
    ).toBe(true);
  });

  test('expired after hold window', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(
      isShopOrderPaymentHoldExpired({
        order_status: 'pending_payment',
        payment_status: 'pending',
        payment_method: 'online',
        payment_hold_expires_at: past,
      })
    ).toBe(true);
  });

  test('COD orders are not in hold state', () => {
    const future = new Date(Date.now() + 120_000).toISOString();
    expect(
      isShopOrderPaymentHoldActive({
        order_status: 'pending_payment',
        payment_status: 'pending',
        payment_method: 'cod',
        payment_hold_expires_at: future,
      })
    ).toBe(false);
  });

  test('paid orders are not active hold', () => {
    const future = new Date(Date.now() + 120_000).toISOString();
    expect(
      isShopOrderPaymentHoldActive({
        order_status: 'pending',
        payment_status: 'paid',
        payment_method: 'online',
        payment_hold_expires_at: future,
      })
    ).toBe(false);
  });
});
