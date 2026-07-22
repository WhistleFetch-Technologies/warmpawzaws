import { describe, expect, test } from '@jest/globals';
import {
  SHOP_CHECKOUT_COD_ENABLED,
  SHOP_CHECKOUT_WALLET_ENABLED,
  assertShopCheckoutPaymentAllowed,
  isShopCodPaymentMethod,
} from '../shop-checkout-payment-flags';

describe('shop-checkout-payment-flags', () => {
  test('COD and wallet are disabled by default', () => {
    expect(SHOP_CHECKOUT_COD_ENABLED).toBe(false);
    expect(SHOP_CHECKOUT_WALLET_ENABLED).toBe(false);
  });

  test('isShopCodPaymentMethod recognizes cod aliases', () => {
    expect(isShopCodPaymentMethod('cod')).toBe(true);
    expect(isShopCodPaymentMethod('cash_on_delivery')).toBe(true);
    expect(isShopCodPaymentMethod('online')).toBe(false);
  });

  test('assertShopCheckoutPaymentAllowed rejects COD when disabled', () => {
    const result = assertShopCheckoutPaymentAllowed({ paymentMethod: 'cod' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/cash on delivery/i);
    }
  });

  test('assertShopCheckoutPaymentAllowed rejects wallet when disabled', () => {
    const result = assertShopCheckoutPaymentAllowed({
      paymentMethod: 'online',
      walletAmountApplied: 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/wallet/i);
    }
  });

  test('assertShopCheckoutPaymentAllowed allows online-only checkout', () => {
    expect(
      assertShopCheckoutPaymentAllowed({ paymentMethod: 'online', walletAmountApplied: 0 })
    ).toEqual({ ok: true });
  });
});
