/**
 * Vendor visibility for shop (orders) and meal (meal_orders) rows.
 * Vendors must not see unpaid online checkout drafts or abandoned payment holds.
 */

/** SQL fragment — alias `o` must be the orders table. */
export const SQL_SHOP_ORDER_VENDOR_VISIBLE = `
  (
    LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'completed')
    OR LOWER(COALESCE(o.payment_method, 'online')) IN ('cod', 'cash_on_delivery')
  )
`;

/** SQL fragment — alias `mo` must be the meal_orders table. */
export const SQL_MEAL_ORDER_VENDOR_VISIBLE = `
  LOWER(COALESCE(mo.payment_status, '')) IN ('paid', 'completed', 'refunded')
`;

const SHOP_COD_METHODS = new Set(['cod', 'cash_on_delivery']);
const SHOP_PAID_STATUSES = new Set(['paid', 'completed']);
const MEAL_VENDOR_VISIBLE_PAYMENT = new Set(['paid', 'completed', 'refunded']);

/** Payment-abandon reasons — vendor was never notified; skip vendor cancel alerts. */
export const PAYMENT_ABANDON_CANCELLATION_REASONS = new Set([
  'payment_window_expired',
  'razorpay_payment_failed',
  'payment_signature_invalid',
]);

export function isShopOrderVendorVisible(row: {
  payment_status?: string | null;
  payment_method?: string | null;
}): boolean {
  const ps = String(row.payment_status || '').toLowerCase();
  if (SHOP_PAID_STATUSES.has(ps)) return true;
  const pm = String(row.payment_method || 'online').toLowerCase();
  return SHOP_COD_METHODS.has(pm);
}

export function isMealOrderVendorVisible(row: {
  payment_status?: string | null;
}): boolean {
  const ps = String(row.payment_status || '').toLowerCase();
  return MEAL_VENDOR_VISIBLE_PAYMENT.has(ps);
}

export function isPaymentAbandonCancellationReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return PAYMENT_ABANDON_CANCELLATION_REASONS.has(String(reason).trim());
}
