/**
 * Shared helpers for customer-web wallet Razorpay top-up (create-order + errors).
 */

export type RazorpayOrderPayload = {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
};

export function normalizeRazorpayCreateOrderResponse(raw: unknown): RazorpayOrderPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const pick = (o: Record<string, unknown>): RazorpayOrderPayload | null => {
    const orderId = o.orderId;
    const keyId = o.keyId;
    if (typeof orderId !== 'string' || typeof keyId !== 'string') return null;
    const amt = o.amount;
    const amount = typeof amt === 'number' ? amt : Number(amt);
    if (!Number.isFinite(amount)) return null;
    const currency = typeof o.currency === 'string' ? o.currency : 'INR';
    return { orderId, keyId, amount, currency };
  };
  const direct = pick(r);
  if (direct) return direct;
  const nested = (r.data ?? r.result) as Record<string, unknown> | undefined;
  if (nested && typeof nested === 'object') return pick(nested);
  return null;
}

function pickNestedError(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const er = payload.error;
  if (typeof er === 'string' && er.trim()) return er.trim();
  if (er && typeof er === 'object' && er !== null) {
    const o = er as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    if (typeof o.detail === 'string' && o.detail.trim()) return o.detail.trim();
  }
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim();
  return undefined;
}

export function formatWalletTopUpError(error: unknown): string {
  const e = error as {
    message?: string;
    responseData?: Record<string, unknown>;
    response?: Record<string, unknown>;
    rawResponse?: string;
  };
  const fromPayload = pickNestedError(e?.responseData) || pickNestedError(e?.response);
  if (fromPayload) return fromPayload;
  const raw = typeof e?.rawResponse === 'string' ? e.rawResponse.trim() : '';
  if (raw && raw.length < 500 && !raw.startsWith('<')) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      const inner = pickNestedError(j);
      if (inner) return inner;
    } catch {
      if (raw) return raw;
    }
  }
  const m = typeof e?.message === 'string' ? e.message.trim() : '';
  if (m && !/^HTTP \d{3}$/.test(m)) return m;
  return m || 'Failed to initiate top-up. Please try again.';
}

export async function fetchCustomerUuidByPhone(
  getJson: <T>(path: string) => Promise<T>,
  phone: string
): Promise<string | null> {
  const res = await getJson<{ customer?: { id?: string } }>(
    `/customer/by-phone?phone=${encodeURIComponent(phone)}`
  );
  const id = res?.customer?.id;
  return typeof id === 'string' && id ? id : null;
}
