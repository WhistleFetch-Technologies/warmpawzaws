/**
 * POST /razorpay/create-order body for marketplace (shop) orders.
 * Must use type ecommerce_order + orderId — not bookingId.
 */
export type RazorpayEcommerceCreateOrderPayload = {
  type: 'ecommerce_order';
  orderId: string;
  amount: number;
  customerId: string;
};

export function buildRazorpayEcommerceCreateOrderPayload(
  orderId: string,
  amount: number,
  customerId: string | null | undefined
): RazorpayEcommerceCreateOrderPayload {
  const oid = String(orderId || '').trim();
  const cid = customerId != null ? String(customerId).trim() : '';
  if (!oid) {
    throw new Error('Order was not created');
  }
  if (!cid) {
    throw new Error('Please sign in again to complete payment');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid payment amount');
  }
  return {
    type: 'ecommerce_order',
    orderId: oid,
    amount,
    customerId: cid,
  };
}

/** Extract shop order UUID from /ecommerce/orders or legacy order create responses. */
export function extractEcommerceOrderIdFromResponse(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  const order = r.order as Record<string, unknown> | undefined;
  const data = r.data as Record<string, unknown> | undefined;
  const nestedOrder = data?.order as Record<string, unknown> | undefined;
  const candidates = [order?.id, r.orderId, r.id, data?.orderId, data?.id, nestedOrder?.id];
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c).trim();
  }
  return null;
}
