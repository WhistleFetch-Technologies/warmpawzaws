import type { PromoVcfConfig, SpendChannel } from './types';

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
  return {
    letter: letter as 'V' | 'C' | 'F',
    vendorId: row.vendorId ? String(row.vendorId) : undefined,
    categoryId: row.categoryId ? String(row.categoryId) : undefined,
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
    if (!vcf.vendorId || !payment.vendorId || vcf.vendorId !== String(payment.vendorId)) return false;
  }
  if (vcf.letter === 'C') {
    if (payment.channel === 'ecommerce' && vcf.ecommerceCategoryId) {
      if (vcf.ecommerceCategoryId !== String(payment.ecommerceCategoryId || '')) return false;
    } else if (!vcf.categoryId || !payment.categoryId || vcf.categoryId !== String(payment.categoryId)) {
      return false;
    }
  }
  return true;
}
