export const PET_STORE_WALKIN_ROLE = 'pet_store_walkin';

export const WPAY_BILL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function isPetStoreWalkinRole(roleName?: string | null): boolean {
  return String(roleName || '').trim().toLowerCase() === PET_STORE_WALKIN_ROLE;
}

/** Catalogue / payment gate: prefer require_bill; walk-in role is legacy fallback. */
export function requiresBillProof(opts: {
  readonly requireBill?: boolean | null;
  readonly roleName?: string | null;
}): boolean {
  if (opts.requireBill === true) return true;
  if (opts.requireBill === false) return false;
  return isPetStoreWalkinRole(opts.roleName);
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

export const WPAY_BILL_LINE_ITEMS_MAX = 100;
export const WPAY_BILL_LINE_ITEM_NAME_MAX = 200;

export type WpayBillLineItem = {
  readonly item: string;
  readonly quantity: number;
  readonly total: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Lenient read of stored JSONB — skips junk rows. */
export function parseBillLineItems(raw: unknown): WpayBillLineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: WpayBillLineItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const item = String(rec.item ?? '').trim().slice(0, WPAY_BILL_LINE_ITEM_NAME_MAX);
    const quantity = round2(Number(rec.quantity));
    const total = round2(Number(rec.total));
    if (!item) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (!Number.isFinite(total) || total < 0) continue;
    out.push({ item, quantity, total });
    if (out.length >= WPAY_BILL_LINE_ITEMS_MAX) break;
  }
  return out;
}
