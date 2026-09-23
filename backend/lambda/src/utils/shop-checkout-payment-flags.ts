/**
 * Shop / pet shop checkout payment options.
 * Wallet matches customer-web CheckoutPaymentStep ECOM_WALLET_ENABLED.
 * COD stays off until product turns it back on.
 */

export const SHOP_CHECKOUT_WALLET_ENABLED = true;
export const SHOP_CHECKOUT_COD_ENABLED = false;

export function isShopCodPaymentMethod(paymentMethod: string | null | undefined): boolean {
  const pm = String(paymentMethod || 'online').toLowerCase();
  return pm === 'cod' || pm === 'cash_on_delivery';
}

export type ShopCheckoutPaymentGuardResult =
  | { ok: true }
  | { ok: false; status: 400; error: string };

export function assertShopCheckoutPaymentAllowed(params: {
  paymentMethod?: string | null;
  walletAmountApplied?: number | string | null;
}): ShopCheckoutPaymentGuardResult {
  if (!SHOP_CHECKOUT_COD_ENABLED && isShopCodPaymentMethod(params.paymentMethod)) {
    return {
      ok: false,
      status: 400,
      error: 'Cash on delivery is not available for shop orders. Please pay online.',
    };
  }

  const wallet = Math.max(0, parseFloat(String(params.walletAmountApplied ?? 0)) || 0);
  if (!SHOP_CHECKOUT_WALLET_ENABLED && wallet > 0.009) {
    return {
      ok: false,
      status: 400,
      error: 'Wallet payment is not available for shop orders at this time.',
    };
  }

  return { ok: true };
}
