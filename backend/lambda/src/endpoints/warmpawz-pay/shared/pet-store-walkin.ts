export const PET_STORE_WALKIN_ROLE = 'pet_store_walkin';

export const WPAY_BILL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function isPetStoreWalkinRole(roleName?: string | null): boolean {
  return String(roleName || '').trim().toLowerCase() === PET_STORE_WALKIN_ROLE;
}

export function readBillImageKey(breakup: Record<string, unknown> | null | undefined): string | null {
  if (!breakup) return null;
  const key = String(breakup.billImageKey ?? '').trim();
  return key || null;
}

export function readBillVerifiedAt(breakup: Record<string, unknown> | null | undefined): string | null {
  if (!breakup) return null;
  const at = String(breakup.billVerifiedAt ?? '').trim();
  return at || null;
}

export const WPAY_BILL_EXTRACT_MAX_ITEMS = 80;

export type WpayBillExtractStatus = 'pending' | 'ok' | 'failed';

export type WpayBillLineItem = {
  name: string;
  quantity: number;
  lineTotal: number;
};

export type WpayBillExtract = {
  status: WpayBillExtractStatus;
  quotedAmount?: number;
  extractedSum?: number;
  lineItems?: WpayBillLineItem[];
  extractedAt?: string;
  model?: string;
  error?: string;
};

export function roundBillMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** GST / service / round-off are not stored. Product rows only. */
export function isNonProductBillLine(name: string): boolean {
  const n = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!n) return true;
  if (/^(cgst|sgst|igst|gst|vat|cess|tax|subtotal|sub total|grand total)\b/.test(n)) {
    return true;
  }
  if (/\b(cgst|sgst|igst|gstin)\b/.test(n)) return true;
  if (/\bservice charge\b/.test(n) || /\bround\s*off\b/.test(n)) return true;
  return n === 'gst' || n === 'tax' || n === 'total';
}

export function sanitizeBillLineItems(raw: unknown): WpayBillLineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: WpayBillLineItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? '').trim();
    if (!name || isNonProductBillLine(name)) continue;
    const quantity = Number(rec.quantity);
    const lineTotal = Number(rec.lineTotal ?? rec.line_total);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (!Number.isFinite(lineTotal)) continue;
    items.push({
      name: name.slice(0, 200),
      quantity: roundBillMoney(quantity),
      lineTotal: roundBillMoney(lineTotal),
    });
    if (items.length >= WPAY_BILL_EXTRACT_MAX_ITEMS) break;
  }
  return items;
}

export function parseModelBillJson(raw: string): { quotedTotal?: number; items: unknown[] } {
  const text = String(raw || '').trim();
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(unfenced) as Record<string, unknown>;
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const quotedTotal = Number(parsed.quotedTotal ?? parsed.quotedAmount);
  return {
    quotedTotal: Number.isFinite(quotedTotal) ? quotedTotal : undefined,
    items,
  };
}

export function toPersistedBillExtract(opts: {
  status: WpayBillExtractStatus;
  quotedAmount?: number;
  lineItems?: WpayBillLineItem[];
  extractedAt?: string;
  model?: string;
  error?: string;
}): WpayBillExtract {
  const lineItems = opts.lineItems ?? [];
  const extractedSum = roundBillMoney(lineItems.reduce((sum, row) => sum + row.lineTotal, 0));
  const payload: WpayBillExtract = {
    status: opts.status,
    extractedAt: opts.extractedAt || new Date().toISOString(),
  };
  if (opts.quotedAmount != null && Number.isFinite(opts.quotedAmount)) {
    payload.quotedAmount = roundBillMoney(opts.quotedAmount);
  }
  if (opts.status === 'ok') {
    payload.lineItems = lineItems;
    payload.extractedSum = extractedSum;
  }
  if (opts.model) payload.model = opts.model;
  if (opts.error) payload.error = opts.error.slice(0, 300);
  return payload;
}

export function readBillExtract(breakup: Record<string, unknown> | null | undefined): WpayBillExtract | null {
  if (!breakup || typeof breakup.billExtract !== 'object' || !breakup.billExtract) return null;
  const raw = breakup.billExtract as Record<string, unknown>;
  const statusRaw = String(raw.status || '').trim();
  const status: WpayBillExtractStatus =
    statusRaw === 'ok' || statusRaw === 'failed' || statusRaw === 'pending' ? statusRaw : 'pending';
  const lineItems = status === 'ok' ? sanitizeBillLineItems(raw.lineItems) : [];
  return toPersistedBillExtract({
    status,
    quotedAmount: Number(raw.quotedAmount),
    lineItems,
    extractedAt: raw.extractedAt ? String(raw.extractedAt) : undefined,
    model: raw.model ? String(raw.model) : undefined,
    error: raw.error ? String(raw.error) : undefined,
  });
}
