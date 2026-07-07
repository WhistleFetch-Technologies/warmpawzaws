/**
 * ============================================================================
 * REWARDS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles rewards and loyalty points:
 * - Get points balance
 * - Get points history
 * - Get available rewards
 * - Redeem points
 * - Get reward details
 * 
 * Date: 2026-01-07
 * Phase 1: Mobile Improvements
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, withTransaction } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { fixRewardCatalogTextFields } from '../utils/fix-rupee-mojibake';
import { isValidUUID } from '../types/entities';
import { isHiddenLegacyCatalogReward } from '../lib/hidden-rewards-catalog';
import {
  isValidIndianMobile,
  loadCustomerContact,
  sendRewardCouponSmsAfterRedeem,
} from '../lib/reward-coupon-sms';

function normalizeCatalogRow(row: Record<string, any>): Record<string, any> {
  return fixRewardCatalogTextFields(row);
}

/** Customer catalog — never expose admin redemption URL before redeem. */
function mapCustomerCatalogReward(row: Record<string, any>): Record<string, any> {
  const r = normalizeCatalogRow(row);
  const shared = String(r.redemption_link ?? '').trim();
  const poolAvailable = parseInt(String(r.links_available ?? '0'), 10) || 0;
  const isExternal = String(r.type ?? '') === 'external_link';
  const { redemption_link: _omit, links_available: _pool, ...rest } = r;
  return {
    ...rest,
    has_redemption_link: isExternal || shared.length > 0,
    available_stock: isExternal ? poolAvailable : undefined,
    has_shared_link_fallback: shared.length > 0,
    in_stock: !isExternal || poolAvailable > 0 || shared.length > 0,
  };
}

function mapAdminCatalogReward(row: Record<string, any>): Record<string, any> {
  return normalizeCatalogRow(row);
}

function isExternalLinkCatalogReward(row: Record<string, any>): boolean {
  return String(row.type ?? '') === 'external_link';
}

function sharedCatalogLink(row: Record<string, any>): string {
  return String(row.redemption_link ?? '').trim();
}

async function countAvailablePoolLinks(rewardId: string): Promise<number> {
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS c
       FROM reward_catalog_links
       WHERE reward_id = $1::uuid AND status = 'available'`,
      [rewardId]
    );
    return parseInt(String(r.rows[0]?.c ?? '0'), 10) || 0;
  } catch {
    return 0;
  }
}

function parseBulkLinkUrls(body: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const rawList = body.links;
  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      const s = String(item ?? '').trim();
      if (s) urls.push(s);
    }
  }
  const rawText = body.linksText ?? body.links_text;
  if (rawText != null) {
    for (const line of String(rawText).split(/\r?\n/)) {
      const s = line.trim();
      if (s) urls.push(s);
    }
  }
  return [...new Set(urls)];
}

async function attachAdminLinkPoolCounts(rows: Record<string, any>[]): Promise<Record<string, any>[]> {
  if (!rows.length) return [];
  try {
    const ids = rows.map((r) => r.id);
    const stats = await query(
      `SELECT reward_id,
              COUNT(*) FILTER (WHERE status = 'available')::int AS links_available,
              COUNT(*) FILTER (WHERE status = 'assigned')::int AS links_assigned
       FROM reward_catalog_links
       WHERE reward_id = ANY($1::uuid[])
       GROUP BY reward_id`,
      [ids]
    );
    const byReward = new Map(
      stats.rows.map((s: any) => [
        String(s.reward_id),
        {
          links_available: Number(s.links_available ?? 0),
          links_assigned: Number(s.links_assigned ?? 0),
        },
      ])
    );
    return rows.map((r) => {
      const pool = byReward.get(String(r.id)) ?? { links_available: 0, links_assigned: 0 };
      return { ...mapAdminCatalogReward(r), ...pool };
    });
  } catch {
    return rows.map((r) => ({
      ...mapAdminCatalogReward(r),
      links_available: 0,
      links_assigned: 0,
    }));
  }
}

/** Claim next unique URL from pool inside an open transaction. */
async function claimUniqueRewardLink(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  rewardId: string,
  customerId: string
): Promise<{ linkUrl: string; poolLinkId: string } | null> {
  try {
    const claimed = await client.query(
      `UPDATE reward_catalog_links
       SET status = 'assigned',
           customer_id = $1::uuid,
           assigned_at = NOW()
       WHERE id = (
         SELECT id FROM reward_catalog_links
         WHERE reward_id = $2::uuid AND status = 'available'
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, link_url`,
      [customerId, rewardId]
    );
    if (claimed.rows.length) {
      return {
        poolLinkId: String(claimed.rows[0].id),
        linkUrl: String(claimed.rows[0].link_url),
      };
    }
  } catch (err: any) {
    console.warn('[rewards] claimUniqueRewardLink skipped:', err?.message);
  }
  return null;
}

function parsePositiveInt(value: unknown, fallback?: number): number | null {
  const n = parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback ?? null;
  return n;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** When `customer_loyalty_points` counters are NULL/stale, derive lifetime stats from the ledger. */
async function loyaltyLedgerLifetimeTotals(
  customerId: string
): Promise<{ earned: number; redeemed: number }> {
  try {
    const q = await query(
      `SELECT
        COALESCE(SUM(CASE
          WHEN LOWER(TRIM(COALESCE(transaction_type::text, ''))) IN (
            'earned', 'bonus', 'adjustment', 'award', 'accrual'
          )
          THEN ABS(COALESCE(points, 0)::numeric)::bigint
          ELSE 0::bigint
        END), 0)::text AS earned_sum,
        COALESCE(SUM(CASE
          WHEN LOWER(TRIM(COALESCE(transaction_type::text, ''))) IN (
            'redeemed', 'redeem', 'spent', 'redemption'
          )
          OR LOWER(TRIM(COALESCE(reference_type::text, ''))) IN (
            'reward_redemption', 'loyalty_redeem', 'loyalty_redeem_wallet'
          )
          OR COALESCE(points, 0) < 0
          THEN ABS(COALESCE(points, 0)::numeric)::bigint
          ELSE 0::bigint
        END), 0)::text AS redeemed_sum
       FROM loyalty_transactions
       WHERE customer_id = $1::uuid`,
      [customerId]
    );
    return {
      earned: parseInt(String(q.rows[0]?.earned_sum ?? '0'), 10) || 0,
      redeemed: parseInt(String(q.rows[0]?.redeemed_sum ?? '0'), 10) || 0,
    };
  } catch {
    return { earned: 0, redeemed: 0 };
  }
}

/** Catalog redemptions (table may be absent on older DBs). */
async function rewardCatalogRedemptionsPointsSum(customerId: string): Promise<number> {
  try {
    const r = await query(
      `SELECT COALESCE(SUM(COALESCE(points_used, 0)), 0)::text AS s
       FROM reward_redemptions
       WHERE customer_id = $1::uuid`,
      [customerId]
    );
    return parseInt(String(r.rows[0]?.s ?? '0'), 10) || 0;
  } catch {
    return 0;
  }
}

async function computeDisplayedLifetimeStats(
  customerId: string,
  profileRow: Record<string, any> | undefined
): Promise<{ earned: number; redeemed: number }> {
  const p = profileRow || {};
  const ledger = await loyaltyLedgerLifetimeTotals(customerId);
  const catalogRedeemed = await rewardCatalogRedemptionsPointsSum(customerId);
  const storedEarned = parseInt(
    String(p.lifetime_points_earned ?? p.lifetimePointsEarned ?? '0'),
    10
  );
  const storedRedeemed = parseInt(
    String(p.lifetime_points_redeemed ?? p.lifetimePointsRedeemed ?? '0'),
    10
  );
  return {
    earned: Math.max(Number.isFinite(storedEarned) ? storedEarned : 0, ledger.earned),
    redeemed: Math.max(
      Number.isFinite(storedRedeemed) ? storedRedeemed : 0,
      ledger.redeemed,
      catalogRedeemed
    ),
  };
}

export function registerRewardsEndpoints(app: Hono) {
  /**
   * GET /customer/:customerId/rewards/points
   * Get customer points balance
   */
  app.get("/customer/:customerId/rewards/points", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Process any overdue ecommerce loyalty pending awards before reading the balance.
      // Non-blocking: a failure here must not prevent the balance from being returned.
      await import('../utils/ecommerce-loyalty')
        .then(({ processCustomerDuePendingAwards }) => processCustomerDuePendingAwards(customerId))
        .catch((e) => console.warn('[REWARDS] processCustomerDuePendingAwards failed:', e?.message));

      // Graceful handling if tables don't exist or have issues
      let profile: any[] = [];
      try {
        profile = await select('customer_loyalty_points', { customer_id: customerId });
        
        if (profile.length === 0) {
          // Try to create, but don't fail if table doesn't exist
          try {
            const newProfile = await insert('customer_loyalty_points', {
              customer_id: customerId,
              total_points: 0,
              lifetime_points_earned: 0,
              lifetime_points_redeemed: 0,
            });
            profile = newProfile;
          } catch (insertError) {
            console.log('Could not create loyalty profile:', insertError);
          }
        }
      } catch (selectError) {
        console.log('Loyalty points table not available:', selectError);
      }

      // Get tier information with fallback
      let tier = { name: 'Bronze', min_points: 0, multiplier: 1 };
      try {
        const tierResult = await query(
          `SELECT * FROM loyalty_tiers 
           WHERE min_points <= $1 
           ORDER BY min_points DESC 
           LIMIT 1`,
          [profile[0]?.total_points || 0]
        );
        if (tierResult.rows.length > 0) {
          tier = tierResult.rows[0];
        }
      } catch (tierError) {
        console.log('Loyalty tiers table not available:', tierError);
      }

      // Get next tier (if any)
      let nextTier: any = null;
      try {
        const nextTierResult = await query(
          `SELECT * FROM loyalty_tiers 
           WHERE min_points > $1 
           ORDER BY min_points ASC 
           LIMIT 1`,
          [profile[0]?.total_points || 0]
        );
        if (nextTierResult.rows.length > 0) {
          nextTier = nextTierResult.rows[0];
        }
      } catch (nextTierError) {
        console.log('Next loyalty tier lookup failed:', nextTierError);
      }

      const currentPoints = parseInt(profile[0]?.total_points || '0', 10);
      const pointsToNextTier = nextTier?.min_points ? Math.max(0, parseInt(nextTier.min_points, 10) - currentPoints) : 0;
      const tierName = (tier as any)?.name || 'Bronze';
      const nextTierName = nextTier?.name || null;

      // Get referral-related points
      let referralPointsEarned = 0;
      let pendingReferralPoints = 0;
      try {
        // Points already earned from referrals
        const earnedResult = await query(
          `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
           FROM loyalty_transactions lt
           WHERE lt.customer_id = $1 
           AND lt.reference_type = 'referral'
           AND lt.transaction_type = 'earned'`,
          [customerId]
        );
        referralPointsEarned = parseInt(earnedResult.rows[0]?.total_earnings || '0', 10);

        // Potential points from pending referrals (where referred customer hasn't made booking yet)
        // Check loyalty rules for refer_friend action to get points per referral
        const ruleResult = await query(
          `SELECT points FROM loyalty_rules WHERE action_name = 'refer_friend' AND is_active = true LIMIT 1`
        );
        const pointsPerReferral = ruleResult.rows.length > 0 ? parseInt(ruleResult.rows[0]?.points || '0', 10) : 0;
        
        const pendingResult = await query(
          `SELECT COUNT(*)::int AS count
           FROM referral_redemptions rr
           INNER JOIN referrals r ON r.id = rr.referral_id
           WHERE r.referrer_id = $1
           AND NOT EXISTS (SELECT 1 FROM bookings WHERE customer_id = rr.referred_id)
           AND NOT EXISTS (
             SELECT 1 FROM loyalty_transactions lt
             WHERE lt.customer_id = $1
             AND (
               (lt.reference_type = 'customer_referral' AND lt.reference_id = rr.id)
               OR (lt.reference_type = 'referral' AND lt.reference_id = r.id)
             )
           )`,
          [customerId]
        );
        const pendingCount = parseInt(pendingResult.rows[0]?.count || '0', 10);
        pendingReferralPoints = pendingCount * pointsPerReferral;
      } catch (refError) {
        console.log('Error calculating referral points:', refError);
      }

      const lifetime = await computeDisplayedLifetimeStats(customerId, profile[0]);

      return c.json({
        success: true,
        points: currentPoints,
        totalPoints: currentPoints,
        tier: tier,
        tierName,
        tierKey: String(tierName || 'bronze').toLowerCase(),
        currentTierMinPoints: parseInt((tier as any)?.min_points || '0', 10),
        nextTier: nextTierName,
        nextTierMinPoints: nextTier?.min_points ? parseInt(nextTier.min_points, 10) : null,
        pointsToNextTier,
        lifetimePointsEarned: lifetime.earned,
        lifetimePointsRedeemed: lifetime.redeemed,
        referralPointsEarned,
        pendingReferralPoints,
        totalPotentialPoints: currentPoints + pendingReferralPoints,
      });
    } catch (error: any) {
      console.error('Error fetching points:', error);
      // Return graceful fallback instead of 500
      return c.json({
        success: true,
        points: 0,
        totalPoints: 0,
        tier: { name: 'Bronze', min_points: 0, multiplier: 1 },
        tierName: 'Bronze',
        tierKey: 'bronze',
        currentTierMinPoints: 0,
        nextTier: null,
        nextTierMinPoints: null,
        pointsToNextTier: 0,
        lifetimePointsEarned: 0,
        lifetimePointsRedeemed: 0,
        referralPointsEarned: 0,
        pendingReferralPoints: 0,
        totalPotentialPoints: 0,
        message: 'Loyalty program initializing'
      });
    }
  });

  /**
   * GET /customer/:phone/rewards/points
   * Get customer points balance by phone number
   */
  app.get("/customer/:phone/rewards/points", async (c) => {
    try {
      const { phone } = c.req.param();
      
      // Normalize phone number
      let normalizedPhone = phone.replace(/\s+/g, '').replace(/^0+/, '');
      if (!normalizedPhone.startsWith('+')) {
        if (normalizedPhone.length === 10) {
          normalizedPhone = '+91' + normalizedPhone;
        }
      }

      // Look up customer by phone
      const customerResult = await query(
        `SELECT id FROM customers WHERE phone = $1 OR phone = $2 LIMIT 1`,
        [phone, normalizedPhone]
      );

      if (customerResult.rows.length === 0) {
        return c.json({ 
          error: 'Customer not found',
          points: 0,
          totalPoints: 0,
          referralPointsEarned: 0,
          pendingReferralPoints: 0,
        }, 404);
      }

      const customerId = customerResult.rows[0].id;

      // Get points profile
      let profile: any[] = [];
      try {
        profile = await select('customer_loyalty_points', { customer_id: customerId });
        
        if (profile.length === 0) {
          try {
            const newProfile = await insert('customer_loyalty_points', {
              customer_id: customerId,
              total_points: 0,
              lifetime_points_earned: 0,
              lifetime_points_redeemed: 0,
            });
            profile = newProfile;
          } catch (insertError) {
            console.log('Could not create loyalty profile:', insertError);
          }
        }
      } catch (selectError) {
        console.log('Loyalty points table not available:', selectError);
      }

      const currentPoints = parseInt(profile[0]?.total_points || '0', 10);

      // Get referral-related points
      let referralPointsEarned = 0;
      let pendingReferralPoints = 0;
      try {
        // Points already earned from referrals
        const earnedResult = await query(
          `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
           FROM loyalty_transactions lt
           WHERE lt.customer_id = $1 
           AND lt.reference_type = 'referral'
           AND lt.transaction_type = 'earned'`,
          [customerId]
        );
        referralPointsEarned = parseInt(earnedResult.rows[0]?.total_earnings || '0', 10);

        // Potential points from pending referrals
        const ruleResult = await query(
          `SELECT points FROM loyalty_rules WHERE action_name = 'refer_friend' AND is_active = true LIMIT 1`
        );
        const pointsPerReferral = ruleResult.rows.length > 0 ? parseInt(ruleResult.rows[0]?.points || '0', 10) : 0;
        
        const pendingResult = await query(
          `SELECT COUNT(*)::int AS count
           FROM referral_redemptions rr
           INNER JOIN referrals r ON r.id = rr.referral_id
           WHERE r.referrer_id = $1
           AND NOT EXISTS (SELECT 1 FROM bookings WHERE customer_id = rr.referred_id)
           AND NOT EXISTS (
             SELECT 1 FROM loyalty_transactions lt
             WHERE lt.customer_id = $1
             AND (
               (lt.reference_type = 'customer_referral' AND lt.reference_id = rr.id)
               OR (lt.reference_type = 'referral' AND lt.reference_id = r.id)
             )
           )`,
          [customerId]
        );
        const pendingCount = parseInt(pendingResult.rows[0]?.count || '0', 10);
        pendingReferralPoints = pendingCount * pointsPerReferral;
      } catch (refError) {
        console.log('Error calculating referral points:', refError);
      }

      const lifetimePhone = await computeDisplayedLifetimeStats(customerId, profile[0]);

      return c.json({
        success: true,
        points: currentPoints,
        totalPoints: currentPoints,
        lifetimePointsEarned: lifetimePhone.earned,
        lifetimePointsRedeemed: lifetimePhone.redeemed,
        referralPointsEarned,
        pendingReferralPoints,
        totalPotentialPoints: currentPoints + pendingReferralPoints,
      });
    } catch (error: any) {
      console.error('Error fetching points by phone:', error);
      return c.json({ 
        error: error.message,
        points: 0,
        totalPoints: 0,
        referralPointsEarned: 0,
        pendingReferralPoints: 0,
      }, 500);
    }
  });

  /**
   * GET /customer/:customerId/rewards/history
   * Get points transaction history
   */
  app.get("/customer/:customerId/rewards/history", async (c) => {
    try {
      const { customerId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let historyRows: any[] = [];
      try {
        const history = await query(
          `SELECT 
            id,
            transaction_type AS type,
            points,
            description,
            created_at AS date,
            reference_type AS source
           FROM loyalty_transactions
           WHERE customer_id = $1::uuid
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [customerId, limit, offset]
        );
        historyRows = history.rows;
      } catch (dbError) {
        console.log('Loyalty transactions table not available:', dbError);
      }

      return c.json({
        success: true,
        history: historyRows,
        count: historyRows.length,
      });
    } catch (error: any) {
      console.error('Error fetching points history:', error);
      return c.json({
        success: true,
        history: [],
        count: 0,
        message: 'No rewards history yet'
      });
    }
  });

  /**
   * GET /customer/:customerId/rewards/available
   * Get available rewards catalog
   */
  app.get("/customer/:customerId/rewards/available", async (c) => {
    try {
      const { customerId } = c.req.param();
      if (!isValidUUID(String(customerId))) {
        return c.json({ success: false, error: 'Invalid customer id' }, 400);
      }

      const rewards = await query(
        `SELECT 
            rc.id,
            rc.name,
            rc.description,
            rc.points_cost,
            rc.cash_value,
            rc.type,
            rc.image_url,
            rc.redemption_link,
            COALESCE((
              SELECT COUNT(*)::int
              FROM reward_catalog_links l
              WHERE l.reward_id = rc.id AND l.status = 'available'
            ), 0) AS links_available
           FROM rewards_catalog rc
           WHERE rc.is_active = true
           ORDER BY rc.display_order ASC, rc.points_cost ASC`
      );

      const rows = (rewards.rows || [])
        .map((r) => mapCustomerCatalogReward(r))
        .filter((r) => !isHiddenLegacyCatalogReward(String(r.id)))
        .filter((r) => {
          if (!isExternalLinkCatalogReward(r)) return true;
          const pool = parseInt(String(r.available_stock ?? 0), 10) || 0;
          return pool > 0 || Boolean(r.has_shared_link_fallback);
        });

      return c.json({
        success: true,
        rewards: rows,
        catalog: rows,
        count: rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching rewards catalog:', error);
      return c.json(
        { success: false, error: error?.message || 'Failed to load rewards catalog' },
        500
      );
    }
  });

  /**
   * POST /customer/:customerId/rewards/redeem
   * Redeem points for a reward
   */
  app.post("/customer/:customerId/rewards/redeem", async (c) => {
    try {
      const { customerId } = c.req.param();
      const { points, rewardId } = await c.req.json();

      if (!isValidUUID(String(customerId))) {
        return c.json({ error: 'Invalid customer id' }, 400);
      }
      if (rewardId == null || rewardId === '') {
        return c.json({ error: 'rewardId is required' }, 400);
      }
      if (!isValidUUID(String(rewardId))) {
        return c.json({ error: 'rewardId must be a valid catalog reward UUID' }, 400);
      }
      if (isHiddenLegacyCatalogReward(String(rewardId))) {
        return c.json({ error: 'This reward is not available' }, 404);
      }
      if (points == null || !Number.isFinite(Number(points)) || Number(points) < 1) {
        return c.json({ error: 'points must be a positive number' }, 400);
      }

      const rewards = await query(
        `SELECT * FROM rewards_catalog WHERE id = $1::uuid AND is_active = true`,
        [rewardId]
      );

      if (rewards.rows.length === 0) {
        return c.json({ error: 'Reward not found or inactive' }, 404);
      }

      const reward = normalizeCatalogRow(rewards.rows[0]);
      const cost = parseInt(String(reward.points_cost ?? points), 10);
      if (!Number.isFinite(cost) || cost < 1) {
        return c.json({ error: 'Invalid reward points_cost' }, 400);
      }
      const ptsReq = Math.round(Number(points));
      if (ptsReq !== cost) {
        return c.json({ error: 'points does not match reward cost' }, 400);
      }

      const isExternalLink = isExternalLinkCatalogReward(reward);
      const sharedLink = sharedCatalogLink(reward);
      if (isExternalLink) {
        const poolAvailable = await countAvailablePoolLinks(String(rewardId));
        if (poolAvailable === 0 && !sharedLink) {
          return c.json({ error: 'This reward is currently out of stock.' }, 409);
        }
      }

      const cashValue = isExternalLink
        ? 0
        : Math.round((parseFloat(String(reward.cash_value ?? 0)) || 0) * 100) / 100;

      const { remainingPoints, walletCredited, assignedLink, redemptionId } = await withTransaction(async (client) => {
        const cwCol = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'customer_wallets'`
        );
        const cwHas = new Set(cwCol.rows.map((r) => r.column_name));

        const prof = await client.query(
          `SELECT total_points FROM customer_loyalty_points WHERE customer_id = $1::uuid FOR UPDATE`,
          [customerId]
        );
        if (prof.rows.length === 0) {
          throw new Error('LOYALTY_PROFILE_NOT_FOUND');
        }
        const currentPoints = parseInt(String(prof.rows[0]?.total_points ?? '0'), 10);
        if (currentPoints < cost) {
          throw new Error('INSUFFICIENT_POINTS');
        }

        let customerLink: string | null = null;
        let poolLinkId: string | null = null;
        if (isExternalLink) {
          const claimed = await claimUniqueRewardLink(client, String(rewardId), customerId);
          if (claimed) {
            customerLink = claimed.linkUrl;
            poolLinkId = claimed.poolLinkId;
          } else if (sharedLink) {
            customerLink = sharedLink;
          } else {
            throw new Error('OUT_OF_STOCK');
          }
        }

        await client.query(
          `UPDATE customer_loyalty_points
           SET total_points = COALESCE(total_points, 0) - $1,
               lifetime_points_redeemed = COALESCE(lifetime_points_redeemed, 0) + $1,
               updated_at = NOW()
           WHERE customer_id = $2::uuid`,
          [cost, customerId]
        );

        const rewardRefUuid = isValidUUID(String(rewardId)) ? String(rewardId).trim() : null;
        await client.query(
          `INSERT INTO loyalty_transactions
             (customer_id, transaction_type, points, reference_type, reference_id, description)
           VALUES ($1::uuid, 'redeemed', $2, 'reward_redemption', $3::uuid, $4)`,
          [customerId, -cost, rewardRefUuid, `Redeemed: ${reward.name}`]
        );

        let redemptionRowId: string | null = null;
        try {
          const ins = await client.query(
            `INSERT INTO reward_redemptions (customer_id, reward_id, points_used, redeemed_at, status, coupon_code)
             VALUES ($1::uuid, $2, $3, NOW(), $4, $5)
             RETURNING id`,
            [
              customerId,
              rewardId,
              cost,
              isExternalLink ? 'active' : null,
              isExternalLink ? customerLink : null,
            ]
          );
          redemptionRowId = ins.rows[0]?.id ? String(ins.rows[0].id) : null;
        } catch (re: any) {
          console.warn('[rewards/redeem] reward_redemptions insert skipped:', re?.message);
        }

        if (poolLinkId && redemptionRowId) {
          try {
            await client.query(
              `UPDATE reward_catalog_links
               SET redemption_id = $1::uuid
               WHERE id = $2::uuid`,
              [redemptionRowId, poolLinkId]
            );
          } catch (pe: any) {
            console.warn('[rewards/redeem] pool link redemption_id update skipped:', pe?.message);
          }
        }

        let credited = 0;
        if (cashValue > 0.009) {
          const upsertCols = ['customer_id', 'balance'];
          const upsertVals: unknown[] = [customerId, 0];
          if (cwHas.has('currency')) {
            upsertCols.push('currency');
            upsertVals.push('INR');
          }
          const ph = upsertVals.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `INSERT INTO customer_wallets (${upsertCols.join(', ')})
             VALUES (${ph})
             ON CONFLICT (customer_id) DO NOTHING`,
            upsertVals as any[]
          );
          await client.query(
            `SELECT id FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
            [customerId]
          );
          const setBal = cwHas.has('updated_at')
            ? 'SET balance = balance + $1::numeric, updated_at = NOW()'
            : 'SET balance = balance + $1::numeric';
          const wup = await client.query(
            `UPDATE customer_wallets ${setBal}
             WHERE customer_id = $2::uuid RETURNING balance::text`,
            [cashValue, customerId]
          );
          const newBal = parseFloat(String(wup.rows[0]?.balance ?? '0')) || 0;
          const wdesc = `Reward wallet credit: ${reward.name} (${cost} pts → ₹${cashValue.toFixed(2)})`;
          try {
            await client.query(
              `INSERT INTO wallet_transactions (
                 customer_id, transaction_type, amount, balance_after, description, source
               ) VALUES ($1::uuid, 'credit', $2::numeric, $3::numeric, $4, 'loyalty_reward')`,
              [customerId, cashValue, newBal, wdesc]
            );
          } catch (we: any) {
            if (String(we?.message || '').includes('source') || String(we?.message || '').includes('column')) {
              await client.query(
                `INSERT INTO wallet_transactions (
                   customer_id, transaction_type, amount, balance_after, description
                 ) VALUES ($1::uuid, 'credit', $2::numeric, $3::numeric, $4)`,
                [customerId, cashValue, newBal, wdesc]
              );
            } else {
              throw we;
            }
          }
          await client.query('SAVEPOINT sp_redeem_cust_wallet_bal');
          try {
            await client.query(
              `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + $1::numeric WHERE id = $2::uuid`,
              [cashValue, customerId]
            );
            await client.query('RELEASE SAVEPOINT sp_redeem_cust_wallet_bal');
          } catch {
            await client.query('ROLLBACK TO SAVEPOINT sp_redeem_cust_wallet_bal');
          }
          credited = cashValue;
        }

        const after = await client.query(
          `SELECT total_points FROM customer_loyalty_points WHERE customer_id = $1::uuid`,
          [customerId]
        );
        return {
          remainingPoints: parseInt(String(after.rows[0]?.total_points ?? '0'), 10),
          walletCredited: credited,
          assignedLink: customerLink,
          redemptionId: redemptionRowId,
        };
      });

      const profAfter = await select('customer_loyalty_points', { customer_id: customerId });
      const lifetimeOut = await computeDisplayedLifetimeStats(customerId, profAfter[0]);

      const publicReward = mapCustomerCatalogReward(reward);

      let smsNotification:
        | { attempted: boolean; status: 'queued' | 'skipped'; reason?: string }
        | undefined;

      if (isExternalLink && assignedLink && redemptionId) {
        const contact = await loadCustomerContact(customerId);
        const canSms =
          Boolean(contact.phone) && isValidIndianMobile(String(contact.phone));
        smsNotification = canSms
          ? { attempted: true, status: 'queued' }
          : { attempted: false, status: 'skipped', reason: 'no_phone' };

        if (canSms) {
          void sendRewardCouponSmsAfterRedeem({
            customerId,
            redemptionId,
            rewardName: String(reward.name),
            link: assignedLink,
            phone: contact.phone,
            customerName: contact.name,
          }).catch((err) =>
            console.error('[rewards/redeem] coupon SMS failed:', err)
          );
        }
      }

      return c.json({
        success: true,
        message: isExternalLink
          ? smsNotification?.status === 'queued'
            ? 'Reward redeemed! Use your coupon link below — we are also sending it to your mobile.'
            : 'Reward redeemed! Use your unique coupon link below.'
          : walletCredited > 0
            ? `Reward redeemed. ₹${walletCredited.toFixed(2)} added to your wallet.`
            : 'Reward redeemed successfully',
        reward: publicReward,
        redemptionLink: isExternalLink ? assignedLink ?? undefined : undefined,
        remainingPoints,
        points: remainingPoints,
        totalPoints: remainingPoints,
        lifetimePointsEarned: lifetimeOut.earned,
        lifetimePointsRedeemed: lifetimeOut.redeemed,
        walletCredited,
        smsNotification,
      });
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      if (error?.message === 'INSUFFICIENT_POINTS') {
        return c.json({ error: 'Insufficient points' }, 400);
      }
      if (error?.message === 'OUT_OF_STOCK') {
        return c.json({ error: 'This reward is currently out of stock.' }, 409);
      }
      if (error?.message === 'LOYALTY_PROFILE_NOT_FOUND') {
        return c.json({ error: 'Loyalty profile not found' }, 404);
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/rewards/redeemed
   * Get redeemed rewards for a customer
   */
  app.get("/customer/:customerId/rewards/redeemed", async (c) => {
    try {
      const { customerId } = c.req.param();
      if (!isValidUUID(String(customerId))) {
        return c.json({ success: false, error: 'Invalid customer id' }, 400);
      }
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const result = await query(
        `SELECT 
             rr.id as redemption_id,
             rr.reward_id,
             rr.points_used,
             rr.redeemed_at,
             rr.status,
             rr.expires_at,
             rr.coupon_code,
             rc.name,
             rc.description,
             rc.points_cost,
             rc.type,
             rc.image_url,
             rc.validity_days
           FROM reward_redemptions rr
           LEFT JOIN rewards_catalog rc ON rc.id = rr.reward_id
           WHERE rr.customer_id = $1::uuid
           ORDER BY rr.redeemed_at DESC
           LIMIT $2 OFFSET $3`,
        [customerId, limit, offset]
      );
      const rows = (result.rows || []).map((r) => {
        const fixed = normalizeCatalogRow(r);
        const link = String(fixed.coupon_code ?? '').trim();
        return {
          ...fixed,
          redemption_link: link || undefined,
        };
      });

      return c.json({
        success: true,
        redemptions: rows,
        count: rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching redeemed rewards:', error);
      return c.json(
        { success: false, error: error?.message || 'Failed to load redemptions' },
        500
      );
    }
  });

  /**
   * GET /rewards/:rewardId
   * Get reward details
   */
  app.get("/rewards/:rewardId", async (c) => {
    try {
      const { rewardId } = c.req.param();
      if (!isValidUUID(String(rewardId))) {
        return c.json({ error: 'Invalid reward id' }, 400);
      }

      const rewards = await query(
        `SELECT * FROM rewards_catalog WHERE id = $1::uuid`,
        [rewardId]
      );

      if (rewards.rows.length === 0) {
        return c.json({ error: 'Reward not found' }, 404);
      }

      return c.json({
        success: true,
        reward: mapCustomerCatalogReward(rewards.rows[0]),
      });
    } catch (error: any) {
      console.error('Error fetching reward details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/rewards-catalog
   * List all catalog rewards (admin)
   */
  app.get('/admin/rewards-catalog', async (c) => {
    try {
      const result = await query(
        `SELECT *
         FROM rewards_catalog
         ORDER BY display_order ASC, points_cost ASC, created_at DESC`
      );
      const rewards = await attachAdminLinkPoolCounts(result.rows || []);
      return c.json({ success: true, rewards, count: rewards.length });
    } catch (error: any) {
      console.error('Error fetching admin rewards catalog:', error);
      return c.json({ success: false, error: error?.message || 'Failed to load catalog' }, 500);
    }
  });

  /**
   * POST /admin/rewards-catalog
   * Create catalog reward (admin)
   */
  app.post('/admin/rewards-catalog', async (c) => {
    try {
      const body = await c.req.json();
      const name = String(body.name ?? '').trim();
      const description = String(body.description ?? '').trim() || null;
      const pointsCost = parsePositiveInt(body.points_cost ?? body.pointsCost);
      const cashValue = parseFloat(String(body.cash_value ?? body.cashValue ?? 0)) || 0;
      const type = String(body.type ?? 'external_link').trim() || 'external_link';
      const redemptionLink = String(body.redemption_link ?? body.redemptionLink ?? '').trim() || null;
      const imageUrl = String(body.image_url ?? body.imageUrl ?? '').trim() || null;
      const displayOrder = parseInt(String(body.display_order ?? body.displayOrder ?? 0), 10) || 0;
      const validityDays =
        body.validity_days != null || body.validityDays != null
          ? parseInt(String(body.validity_days ?? body.validityDays), 10)
          : null;
      const isActive = body.is_active !== false && body.isActive !== false;

      if (!name) {
        return c.json({ success: false, error: 'name is required' }, 400);
      }
      if (!pointsCost) {
        return c.json({ success: false, error: 'points_cost must be a positive number' }, 400);
      }
      if (redemptionLink && !isValidHttpUrl(redemptionLink)) {
        return c.json({ success: false, error: 'redemption_link must be a valid http(s) URL' }, 400);
      }

      const inserted = await insert('rewards_catalog', {
        name,
        description,
        points_cost: pointsCost,
        cash_value: type === 'external_link' ? 0 : cashValue,
        type,
        redemption_link: redemptionLink,
        image_url: imageUrl,
        validity_days: Number.isFinite(validityDays as number) ? validityDays : null,
        is_active: isActive,
        display_order: displayOrder,
      });

      return c.json({
        success: true,
        reward: mapAdminCatalogReward(inserted[0]),
        message: 'Reward created successfully',
      });
    } catch (error: any) {
      console.error('Error creating catalog reward:', error);
      return c.json({ success: false, error: error?.message || 'Failed to create reward' }, 500);
    }
  });

  /**
   * PUT /admin/rewards-catalog/:id
   * Update catalog reward (admin)
   */
  app.put('/admin/rewards-catalog/:id', async (c) => {
    try {
      const { id } = c.req.param();
      if (!isValidUUID(String(id))) {
        return c.json({ success: false, error: 'Invalid reward id' }, 400);
      }

      const existing = await query(`SELECT * FROM rewards_catalog WHERE id = $1::uuid`, [id]);
      if (!existing.rows.length) {
        return c.json({ success: false, error: 'Reward not found' }, 404);
      }

      const body = await c.req.json();
      const current = existing.rows[0];
      const nextType = body.type != null ? String(body.type).trim() : String(current.type ?? '');
      const nextLinkRaw =
        body.redemption_link !== undefined || body.redemptionLink !== undefined
          ? String(body.redemption_link ?? body.redemptionLink ?? '').trim()
          : String(current.redemption_link ?? '').trim();
      const nextLink = nextLinkRaw || null;

      if (nextLink && !isValidHttpUrl(nextLink)) {
        return c.json({ success: false, error: 'redemption_link must be a valid http(s) URL' }, 400);
      }

      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (body.name != null) patch.name = String(body.name).trim();
      if (body.description !== undefined) patch.description = String(body.description ?? '').trim() || null;
      if (body.points_cost != null || body.pointsCost != null) {
        const pc = parsePositiveInt(body.points_cost ?? body.pointsCost);
        if (!pc) return c.json({ success: false, error: 'points_cost must be positive' }, 400);
        patch.points_cost = pc;
      }
      if (body.cash_value != null || body.cashValue != null) {
        patch.cash_value = parseFloat(String(body.cash_value ?? body.cashValue)) || 0;
      }
      if (body.type != null) patch.type = nextType;
      if (body.redemption_link !== undefined || body.redemptionLink !== undefined) {
        patch.redemption_link = nextLink;
      }
      if (body.image_url !== undefined || body.imageUrl !== undefined) {
        patch.image_url = String(body.image_url ?? body.imageUrl ?? '').trim() || null;
      }
      if (body.display_order != null || body.displayOrder != null) {
        patch.display_order = parseInt(String(body.display_order ?? body.displayOrder), 10) || 0;
      }
      if (body.validity_days !== undefined || body.validityDays !== undefined) {
        const vd = parseInt(String(body.validity_days ?? body.validityDays), 10);
        patch.validity_days = Number.isFinite(vd) ? vd : null;
      }
      if (body.is_active !== undefined || body.isActive !== undefined) {
        patch.is_active = body.is_active !== false && body.isActive !== false;
      }
      if (nextType === 'external_link') {
        patch.cash_value = 0;
      }

      const updated = await update('rewards_catalog', { id }, patch);
      if (!updated.length) {
        return c.json({ success: false, error: 'Reward not found or not updated' }, 404);
      }
      return c.json({
        success: true,
        reward: mapAdminCatalogReward(updated[0]),
        message: 'Reward updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating catalog reward:', error);
      return c.json({ success: false, error: error?.message || 'Failed to update reward' }, 500);
    }
  });

  /**
   * DELETE /admin/rewards-catalog/:id
   * Deactivate catalog reward (admin)
   */
  app.delete('/admin/rewards-catalog/:id', async (c) => {
    try {
      const { id } = c.req.param();
      if (!isValidUUID(String(id))) {
        return c.json({ success: false, error: 'Invalid reward id' }, 400);
      }

      const updated = await update(
        'rewards_catalog',
        { id },
        { is_active: false, updated_at: new Date() }
      );
      if (!updated.length) {
        return c.json({ success: false, error: 'Reward not found' }, 404);
      }

      return c.json({ success: true, message: 'Reward deactivated' });
    } catch (error: any) {
      console.error('Error deleting catalog reward:', error);
      return c.json({ success: false, error: error?.message || 'Failed to delete reward' }, 500);
    }
  });

  /**
   * GET /admin/rewards-catalog/:id/link-pool
   * Pool summary + recent links (admin)
   */
  app.get('/admin/rewards-catalog/:id/link-pool', async (c) => {
    try {
      const { id } = c.req.param();
      if (!isValidUUID(String(id))) {
        return c.json({ success: false, error: 'Invalid reward id' }, 400);
      }

      const summaryRes = await query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'available')::int AS available,
           COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned,
           COUNT(*)::int AS total
         FROM reward_catalog_links
         WHERE reward_id = $1::uuid`,
        [id]
      );
      const summary = summaryRes.rows[0] ?? { available: 0, assigned: 0, total: 0 };

      const recent = await query(
        `SELECT id, link_url, status, customer_id, assigned_at, created_at
         FROM reward_catalog_links
         WHERE reward_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT 100`,
        [id]
      );

      return c.json({
        success: true,
        summary: {
          available: Number(summary.available ?? 0),
          assigned: Number(summary.assigned ?? 0),
          total: Number(summary.total ?? 0),
        },
        links: recent.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching link pool:', error);
      return c.json({ success: false, error: error?.message || 'Failed to load link pool' }, 500);
    }
  });

  /**
   * POST /admin/rewards-catalog/:id/link-pool
   * Bulk add unique coupon URLs (one per customer redemption)
   */
  app.post('/admin/rewards-catalog/:id/link-pool', async (c) => {
    try {
      const { id } = c.req.param();
      if (!isValidUUID(String(id))) {
        return c.json({ success: false, error: 'Invalid reward id' }, 400);
      }

      const existing = await query(`SELECT id FROM rewards_catalog WHERE id = $1::uuid`, [id]);
      if (!existing.rows.length) {
        return c.json({ success: false, error: 'Reward not found' }, 404);
      }

      const body = await c.req.json();
      const urls = parseBulkLinkUrls(body);
      if (!urls.length) {
        return c.json({ success: false, error: 'Provide links (array) or linksText (one URL per line)' }, 400);
      }

      const invalid = urls.filter((u) => !isValidHttpUrl(u));
      if (invalid.length) {
        return c.json(
          { success: false, error: `Invalid URL(s): ${invalid.slice(0, 3).join(', ')}` },
          400
        );
      }

      let added = 0;
      let skipped = 0;
      for (const linkUrl of urls) {
        const ins = await query(
          `INSERT INTO reward_catalog_links (reward_id, link_url, status)
           VALUES ($1::uuid, $2, 'available')
           ON CONFLICT (reward_id, link_url) DO NOTHING
           RETURNING id`,
          [id, linkUrl]
        );
        if (ins.rows.length) added += 1;
        else skipped += 1;
      }

      const summaryRes = await query(
        `SELECT COUNT(*) FILTER (WHERE status = 'available')::int AS available,
                COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned
         FROM reward_catalog_links WHERE reward_id = $1::uuid`,
        [id]
      );

      return c.json({
        success: true,
        added,
        skipped,
        summary: {
          available: Number(summaryRes.rows[0]?.available ?? 0),
          assigned: Number(summaryRes.rows[0]?.assigned ?? 0),
        },
        message: `Added ${added} link(s)${skipped ? `, ${skipped} duplicate(s) skipped` : ''}`,
      });
    } catch (error: any) {
      console.error('Error adding link pool URLs:', error);
      return c.json({ success: false, error: error?.message || 'Failed to add links' }, 500);
    }
  });

  /**
   * DELETE /admin/rewards-catalog/:id/link-pool/:linkId
   * Remove an unused link from the pool
   */
  app.delete('/admin/rewards-catalog/:id/link-pool/:linkId', async (c) => {
    try {
      const { id, linkId } = c.req.param();
      if (!isValidUUID(String(id)) || !isValidUUID(String(linkId))) {
        return c.json({ success: false, error: 'Invalid id' }, 400);
      }

      const del = await query(
        `DELETE FROM reward_catalog_links
         WHERE id = $1::uuid AND reward_id = $2::uuid AND status = 'available'
         RETURNING id`,
        [linkId, id]
      );
      if (!del.rows.length) {
        return c.json(
          { success: false, error: 'Link not found or already assigned to a customer' },
          404
        );
      }

      return c.json({ success: true, message: 'Link removed from pool' });
    } catch (error: any) {
      console.error('Error deleting pool link:', error);
      return c.json({ success: false, error: error?.message || 'Failed to delete link' }, 500);
    }
  });
}
