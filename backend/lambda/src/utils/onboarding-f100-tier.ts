/**
 * F100 promotion: next N new vendor row creations (eligible onboarding) get vendors.tier = 'Tier F100',
 * then default tier (Basic from vendor_tiers). Tracked in platform_tier_onboarding.f100_auto_assign_slots_remaining.
 */
import { query } from '../database/rds-connection';

export const TIER_F100 = 'Tier F100';

function shouldSkipF100Onboarding(
  email?: string | null,
  businessName?: string | null
): boolean {
  const e = (email || '').trim().toLowerCase();
  const b = (businessName || '').trim();
  if (e) {
    if (e.startsWith('test@') || e.includes('@test.') || e.includes('+test@') || e.endsWith('@example.com')) {
      return true;
    }
  }
  if (b) {
    const bLower = b.toLowerCase();
    if (bLower === 'test' || bLower === 'test vendor' || bLower.startsWith('test_') || bLower.startsWith('test ')) {
      return true;
    }
    if (/^test[\s_-]/i.test(b) || /\btest\s*user\b/i.test(b)) {
      return true;
    }
  }
  return false;
}

async function fetchDefaultTierAndCommission(): Promise<{
  tier: string;
  commission_percentage: number;
}> {
  let tier = 'Basic';
  let commission = 15;
  try {
    const tierRes = await query(
      `SELECT tier_name, commission_rate
       FROM vendor_tiers
       WHERE is_active = true
         AND (is_default = true OR is_free_tier = true)
       ORDER BY is_default DESC NULLS LAST, tier_level ASC
       LIMIT 1`
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

    if (tierRes.rows?.[0]) {
      const r = tierRes.rows[0] as { tier_name?: string; commission_rate?: string | number };
      tier = (r.tier_name as string) || tier;
      const cr = parseFloat(String(r.commission_rate ?? '15'));
      if (!isNaN(cr)) commission = cr;
    } else {
      const fallback = await query(
        `SELECT tier_name, commission_rate
         FROM vendor_tiers
         WHERE is_active = true
         ORDER BY is_default DESC NULLS LAST, tier_level ASC
         LIMIT 1`
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
      if (fallback.rows?.[0]) {
        const r = fallback.rows[0] as { tier_name?: string; commission_rate?: string | number };
        tier = (r.tier_name as string) || tier;
        const cr = parseFloat(String(r.commission_rate ?? '15'));
        if (!isNaN(cr)) commission = cr;
      }
    }
  } catch {
    // keep fallbacks
  }
  return { tier, commission_percentage: commission };
}

/**
 * Resolves initial vendors.tier + commission_percentage for a new vendor record.
 * Uses atomic decrement for F100 slots; otherwise returns default (Basic) tier.
 */
export async function resolveNewVendorOnboardingTier(opts: {
  email?: string | null;
  businessName?: string | null;
}): Promise<{ tier: string; commission_percentage: number }> {
  const defaultResult = await fetchDefaultTierAndCommission();

  if (process.env.F100_ONBOARDING_ENABLED === 'false') {
    return defaultResult;
  }
  if (shouldSkipF100Onboarding(opts.email, opts.businessName)) {
    return defaultResult;
  }

  try {
    const dec = await query(
      `UPDATE platform_tier_onboarding
       SET f100_auto_assign_slots_remaining = f100_auto_assign_slots_remaining - 1
       WHERE id = 'default' AND f100_auto_assign_slots_remaining > 0
       RETURNING f100_auto_assign_slots_remaining`
    );
    if (!dec.rows || dec.rows.length === 0) {
      return defaultResult;
    }

    const f100 = await query(
      `SELECT commission_rate::float AS cr
       FROM vendor_tiers
       WHERE is_active = true AND tier_name = $1
       LIMIT 1`,
      [TIER_F100]
    );
    const cr = parseFloat(String(f100.rows?.[0]?.cr ?? '15'));
    return {
      tier: TIER_F100,
      commission_percentage: !isNaN(cr) ? cr : 15,
    };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (
      err?.code === '42P01' ||
      (typeof err?.message === 'string' && /platform_tier_onboarding|does not exist/i.test(err.message))
    ) {
      return defaultResult;
    }
    console.warn('[resolveNewVendorOnboardingTier]', err?.message || e);
    return defaultResult;
  }
}
