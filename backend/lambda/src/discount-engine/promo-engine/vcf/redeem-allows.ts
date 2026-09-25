import type { PromoVcfConfig, SpendChannel } from './types';

function uniqIds(ids: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Resolve vendor id list from singular + array (back-compat). */
export function resolveRedeemVendorIds(
  redeem: Pick<NonNullable<PromoVcfConfig['redeem']>, 'vendorId' | 'vendorIds'> | null | undefined
): string[] {
  if (!redeem) return [];
  return uniqIds([...(Array.isArray(redeem.vendorIds) ? redeem.vendorIds : []), redeem.vendorId]);
}

/** Resolve category id list from singular + array (back-compat). */
export function resolveRedeemCategoryIds(
  redeem: Pick<NonNullable<PromoVcfConfig['redeem']>, 'categoryId' | 'categoryIds'> | null | undefined
): string[] {
  if (!redeem) return [];
  return uniqIds([
    ...(Array.isArray(redeem.categoryIds) ? redeem.categoryIds : []),
    redeem.categoryId,
  ]);
}

function parseStringIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = uniqIds(raw.map((x) => String(x)));
  return ids.length ? ids : undefined;
}

function parseRedeem(raw: unknown): PromoVcfConfig['redeem'] | null {
  if (raw == null) return null;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const row = parsed as Record<string, unknown>;
  const letter = String(row.letter || '').toUpperCase();
  if (letter !== 'V' && letter !== 'C' && letter !== 'F') return null;
  const channels = Array.isArray(row.channels) ? row.channels.map((c) => String(c)) : [];
  const vendorIds = parseStringIds(row.vendorIds);
  const categoryIds = parseStringIds(row.categoryIds);
  const vendorId = row.vendorId ? String(row.vendorId) : vendorIds?.[0];
  const categoryId = row.categoryId ? String(row.categoryId) : categoryIds?.[0];
  return {
    letter: letter as 'V' | 'C' | 'F',
    vendorId,
    vendorIds: vendorIds || (vendorId ? [vendorId] : undefined),
    categoryId,
    categoryIds: categoryIds || (categoryId ? [categoryId] : undefined),
    ecommerceCategoryId: row.ecommerceCategoryId ? String(row.ecommerceCategoryId) : undefined,
    channels: channels as SpendChannel[],
  };
}

function normalizeCategory(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '');
}

function legacyServicesAllow(redeemScope: unknown, category: string): boolean {
  if (!category) return true;
  let parsed: unknown = redeemScope;
  if (typeof redeemScope === 'string') {
    try {
      parsed = JSON.parse(redeemScope);
    } catch {
      return true;
    }
  }
  const services = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { services?: unknown }).services)
      ? (parsed as { services: unknown[] }).services
      : [];
  if (!services.length) return true;
  const set = new Set(services.map((s) => normalizeCategory(String(s))));
  return set.has(category);
}

export type RedeemPayment = {
  vendorId?: string | null;
  categoryId?: string | null;
  channel?: SpendChannel | null;
  ecommerceCategoryId?: string | null;
  /** Legacy category string for rows written before V/C/F */
  serviceCategory?: string | null;
};

/**
 * Letter + spend channel for V/C/F credits.
 * Letter V/C accept singular or multi id lists (OR membership).
 * Rows with a category string and no letter keep today’s category check.
 */
export function redeemAllows(redeemScope: unknown, payment: RedeemPayment): boolean {
  const vcf = parseRedeem(redeemScope);
  if (!vcf) {
    return legacyServicesAllow(redeemScope, normalizeCategory(payment.serviceCategory));
  }
  if (vcf.channels?.length) {
    const channel = payment.channel || null;
    if (!channel || !vcf.channels.includes(channel)) return false;
  }
  if (vcf.letter === 'V') {
    const allowed = resolveRedeemVendorIds(vcf);
    if (!allowed.length || !payment.vendorId || !allowed.includes(String(payment.vendorId))) {
      return false;
    }
  }
  if (vcf.letter === 'C') {
    if (payment.channel === 'ecommerce' && vcf.ecommerceCategoryId) {
      if (vcf.ecommerceCategoryId !== String(payment.ecommerceCategoryId || '')) return false;
    } else {
      const allowed = resolveRedeemCategoryIds(vcf);
      if (!allowed.length || !payment.categoryId || !allowed.includes(String(payment.categoryId))) {
        return false;
      }
    }
  }
  return true;
}
