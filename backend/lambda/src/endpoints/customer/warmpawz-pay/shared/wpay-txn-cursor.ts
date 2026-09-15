export type WpayTxnCursor = {
  paidAt: string;
  paymentId: string;
};

/** Normalize node-pg Date / ISO / Date#toString() into an ISO timestamptz. */
export function toWpayTxnCursorTimestamp(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function encodeWpayTxnCursor(paidAt: unknown, paymentId: string): string | null {
  const ts = toWpayTxnCursorTimestamp(paidAt);
  const id = String(paymentId ?? '').trim();
  if (!ts || !id) return null;
  return `${ts}|${id}`;
}

export function decodeWpayTxnCursor(cursor: string): WpayTxnCursor | null {
  const raw = String(cursor ?? '').trim();
  const idx = raw.lastIndexOf('|');
  if (idx <= 0) return null;
  const paidAt = toWpayTxnCursorTimestamp(raw.slice(0, idx));
  const paymentId = raw.slice(idx + 1).trim();
  if (!paidAt || !paymentId) return null;
  return { paidAt, paymentId };
}
