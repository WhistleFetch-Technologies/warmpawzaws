/**
 * Warmpawz Pay publication-tier commission (NOT Marketplace vendors.tier / subscription).
 * Source: warmpawz_pay_merchant_pricing.tier_id → vendor_tiers.commission_rate
 */
import { query } from '../../database/rds-connection';
import { DEFAULT_COMMISSION_RATE } from '../../lib/constants/commission';

export const WPAY_PUBLICATION_COMMISSION_SOURCE = 'wpay_publication_tier' as const;

export type WpayPublicationCommission = {
  vendorId: string;
  commissionRate: number;
  tierId: string | null;
  tierName: string | null;
  source: typeof WPAY_PUBLICATION_COMMISSION_SOURCE | 'fallback';
  found: boolean;
};

function parseRate(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

export async function resolveWpayPublicationCommission(
  vendorId: string
): Promise<WpayPublicationCommission> {
  const empty: WpayPublicationCommission = {
    vendorId,
    commissionRate: DEFAULT_COMMISSION_RATE,
    tierId: null,
    tierName: null,
    source: 'fallback',
    found: false,
  };
  if (!vendorId) return empty;

  try {
    const res = await query(
      `SELECT p.tier_id::text AS tier_id,
              vt.tier_name,
              vt.commission_rate
       FROM warmpawz_pay_merchant_pricing p
       INNER JOIN warmpawz_pay_vendor_catalog c ON c.vendor_id = p.vendor_id
       LEFT JOIN vendor_tiers vt ON vt.id = p.tier_id
       WHERE p.vendor_id = $1::uuid
         AND c.publish_status = 'published'
         AND p.status = 'active'
         AND p.effective_from <= NOW()
         AND (p.effective_until IS NULL OR p.effective_until >= NOW())
         AND p.tier_id IS NOT NULL
       ORDER BY p.updated_at DESC NULLS LAST
       LIMIT 1`,
      [vendorId]
    );
    const row = res.rows?.[0] as
      | { tier_id?: string; tier_name?: string; commission_rate?: unknown }
      | undefined;
    const rate = parseRate(row?.commission_rate);
    if (rate == null) return empty;
    return {
      vendorId,
      commissionRate: rate,
      tierId: row?.tier_id ? String(row.tier_id) : null,
      tierName: row?.tier_name ? String(row.tier_name) : null,
      source: WPAY_PUBLICATION_COMMISSION_SOURCE,
      found: true,
    };
  } catch (error) {
    console.warn('[resolveWpayPublicationCommission] lookup failed:', error);
    return empty;
  }
}

export async function isVendorWarmpawzPayPublished(vendorId: string): Promise<boolean> {
  if (!vendorId) return false;
  try {
    const res = await query(
      `SELECT 1
       FROM warmpawz_pay_vendor_catalog
       WHERE vendor_id = $1::uuid AND publish_status = 'published'
       LIMIT 1`,
      [vendorId]
    );
    return (res.rows?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
