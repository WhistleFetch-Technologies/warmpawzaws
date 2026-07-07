/**
 * Finance S2 — authoritative vendor commission policy (tier + subscription).
 * Discount Engine NEVER owns commission percentages.
 */
import { query } from '../../database/rds-connection';
import { DEFAULT_COMMISSION_RATE } from '../../lib/constants/commission';

export type CommissionTierSource = 'subscription' | 'vendor_tier' | 'default_tier' | 'fallback';
export type SubscriptionSource = 'active_subscription' | 'none';

export interface VendorCommissionPolicy {
  vendorId: string;
  commissionRate: number;
  tier: {
    id: string | null;
    name: string | null;
    displayName: string | null;
    tierLevel: number | null;
  };
  subscription: {
    active: boolean;
    tierId: string | null;
    tierName: string | null;
    expiresAt: string | null;
  };
  tierSource: CommissionTierSource;
  subscriptionSource: SubscriptionSource;
  fallbackSource: string | null;
}

type TierRow = {
  id?: string;
  tier_id?: string;
  tier_name?: string;
  display_name?: string;
  tier_level?: number;
  commission_rate?: unknown;
};

function parseRate(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

async function loadDefaultTier(): Promise<TierRow | null> {
  const res = await query(
    `SELECT id::text, tier_name, display_name, tier_level, commission_rate
     FROM vendor_tiers
     WHERE is_active = true
       AND (is_default = true OR LOWER(TRIM(tier_name)) = 'bronze')
     ORDER BY is_default DESC, tier_level ASC NULLS LAST
     LIMIT 1`
  ).catch(() => ({ rows: [] as TierRow[] }));
  return (res.rows?.[0] as TierRow) ?? null;
}

/** Active subscription tier — isolated so schema errors do not skip vendor-tier fallback. */
async function loadActiveSubscriptionTier(
  vendorId: string
): Promise<(TierRow & { end_date?: string }) | null> {
  try {
    const subRes = await query(
      `SELECT vt.id::text AS tier_id, vt.tier_name, vt.display_name, vt.tier_level,
              vt.commission_rate, vts.end_date
       FROM vendor_tier_subscriptions vts
       JOIN vendor_tiers vt ON vt.id = vts.tier_id
       WHERE vts.vendor_id = $1::uuid
         AND vts.status = 'active'
         AND (vts.end_date IS NULL OR vts.end_date > NOW())
       ORDER BY vts.created_at DESC
       LIMIT 1`,
      [vendorId]
    );
    return (subRes.rows?.[0] as TierRow & { end_date?: string }) ?? null;
  } catch (error) {
    console.warn('[resolveVendorCommissionPolicy] subscription lookup failed:', error);
    return null;
  }
}

async function loadVendorAssignedTier(vendorId: string): Promise<TierRow | null> {
  try {
    const tierRes = await query(
      `SELECT vt.id::text, vt.tier_name, vt.display_name, vt.tier_level, vt.commission_rate
       FROM vendors v
       LEFT JOIN vendor_tiers vt ON vt.is_active = true
         AND TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name))
       WHERE v.id = $1::uuid
       LIMIT 1`,
      [vendorId]
    );
    return (tierRes.rows?.[0] as TierRow) ?? null;
  } catch (error) {
    console.warn('[resolveVendorCommissionPolicy] vendor tier lookup failed:', error);
    return null;
  }
}

function policyFromTierRow(
  vendorId: string,
  tierRow: TierRow,
  tierSource: CommissionTierSource,
  subscription?: VendorCommissionPolicy['subscription']
): VendorCommissionPolicy {
  const rate = parseRate(tierRow.commission_rate) ?? DEFAULT_COMMISSION_RATE;
  const tierId = tierRow.id ?? tierRow.tier_id ?? null;
  return {
    vendorId,
    commissionRate: rate,
    tier: {
      id: tierId,
      name: tierRow.tier_name ? String(tierRow.tier_name) : null,
      displayName: tierRow.display_name ? String(tierRow.display_name) : null,
      tierLevel: tierRow.tier_level != null ? Number(tierRow.tier_level) : null,
    },
    subscription: subscription ?? {
      active: false,
      tierId: null,
      tierName: null,
      expiresAt: null,
    },
    tierSource,
    subscriptionSource: subscription?.active ? 'active_subscription' : 'none',
    fallbackSource: null,
  };
}

/**
 * Single authoritative commission policy for a vendor.
 * Priority: active subscription → assigned tier → default tier → constant fallback.
 * Each lookup step is isolated — one failed query must not bypass the remaining chain.
 */
export async function resolveVendorCommissionPolicy(
  vendorId: string
): Promise<VendorCommissionPolicy> {
  const empty: VendorCommissionPolicy = {
    vendorId,
    commissionRate: DEFAULT_COMMISSION_RATE,
    tier: { id: null, name: null, displayName: null, tierLevel: null },
    subscription: { active: false, tierId: null, tierName: null, expiresAt: null },
    tierSource: 'fallback',
    subscriptionSource: 'none',
    fallbackSource: `constants.DEFAULT_COMMISSION_RATE (${DEFAULT_COMMISSION_RATE})`,
  };

  if (!vendorId) return empty;

  const subRow = await loadActiveSubscriptionTier(vendorId);
  if (subRow?.commission_rate != null) {
    return policyFromTierRow(vendorId, subRow, 'subscription', {
      active: true,
      tierId: subRow.tier_id ?? subRow.id ?? null,
      tierName: subRow.tier_name ? String(subRow.tier_name) : null,
      expiresAt: subRow.end_date ? String(subRow.end_date) : null,
    });
  }

  const tierRow = await loadVendorAssignedTier(vendorId);
  if (tierRow?.commission_rate != null) {
    return policyFromTierRow(vendorId, tierRow, 'vendor_tier');
  }

  const defaultTier = await loadDefaultTier();
  if (defaultTier?.commission_rate != null) {
    return policyFromTierRow(vendorId, defaultTier, 'default_tier');
  }

  return empty;
}
