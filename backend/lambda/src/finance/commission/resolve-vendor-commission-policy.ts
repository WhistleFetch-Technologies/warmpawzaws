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

/**
 * Single authoritative commission policy for a vendor.
 * Priority: active subscription → assigned tier → default tier → constant fallback.
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

  try {
    const subRes = await query(
      `SELECT vt.id::text AS tier_id, vt.tier_name, vt.display_name, vt.tier_level,
              vt.commission_rate, vts.expires_at
       FROM vendor_tier_subscriptions vts
       JOIN vendor_tiers vt ON vt.id = vts.tier_id
       WHERE vts.vendor_id = $1::uuid
         AND vts.status = 'active'
         AND vts.expires_at > NOW()
       ORDER BY vts.created_at DESC
       LIMIT 1`,
      [vendorId]
    );

    const subRow = subRes.rows?.[0] as TierRow & { expires_at?: string } | undefined;
    if (subRow) {
      const rate = parseRate(subRow.commission_rate) ?? DEFAULT_COMMISSION_RATE;
      return {
        vendorId,
        commissionRate: rate,
        tier: {
          id: subRow.id ?? null,
          name: subRow.tier_name ? String(subRow.tier_name) : null,
          displayName: subRow.display_name ? String(subRow.display_name) : null,
          tierLevel: subRow.tier_level != null ? Number(subRow.tier_level) : null,
        },
        subscription: {
          active: true,
          tierId: subRow.id ?? null,
          tierName: subRow.tier_name ? String(subRow.tier_name) : null,
          expiresAt: subRow.expires_at ? String(subRow.expires_at) : null,
        },
        tierSource: 'subscription',
        subscriptionSource: 'active_subscription',
        fallbackSource: null,
      };
    }

    const tierRes = await query(
      `SELECT vt.id::text, vt.tier_name, vt.display_name, vt.tier_level, vt.commission_rate
       FROM vendors v
       LEFT JOIN vendor_tiers vt ON vt.is_active = true
         AND TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name))
       WHERE v.id = $1::uuid
       LIMIT 1`,
      [vendorId]
    );

    const tierRow = tierRes.rows?.[0] as TierRow | undefined;
    if (tierRow?.commission_rate != null) {
      const rate = parseRate(tierRow.commission_rate) ?? DEFAULT_COMMISSION_RATE;
      return {
        vendorId,
        commissionRate: rate,
        tier: {
          id: tierRow.id ?? null,
          name: tierRow.tier_name ? String(tierRow.tier_name) : null,
          displayName: tierRow.display_name ? String(tierRow.display_name) : null,
          tierLevel: tierRow.tier_level != null ? Number(tierRow.tier_level) : null,
        },
        subscription: { active: false, tierId: null, tierName: null, expiresAt: null },
        tierSource: 'vendor_tier',
        subscriptionSource: 'none',
        fallbackSource: null,
      };
    }

    const defaultTier = await loadDefaultTier();
    if (defaultTier) {
      const rate = parseRate(defaultTier.commission_rate) ?? DEFAULT_COMMISSION_RATE;
      return {
        vendorId,
        commissionRate: rate,
        tier: {
          id: defaultTier.id ?? null,
          name: defaultTier.tier_name ? String(defaultTier.tier_name) : null,
          displayName: defaultTier.display_name ? String(defaultTier.display_name) : null,
          tierLevel: defaultTier.tier_level != null ? Number(defaultTier.tier_level) : null,
        },
        subscription: { active: false, tierId: null, tierName: null, expiresAt: null },
        tierSource: 'default_tier',
        subscriptionSource: 'none',
        fallbackSource: null,
      };
    }

    return empty;
  } catch (error) {
    console.error('[resolveVendorCommissionPolicy] error:', error);
    return empty;
  }
}
