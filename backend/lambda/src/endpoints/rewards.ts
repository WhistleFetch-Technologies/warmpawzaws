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
import { isValidUUID } from '../types/entities';

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
            id,
            name,
            description,
            points_cost,
            cash_value,
            type,
            image_url
           FROM rewards_catalog
           WHERE is_active = true
           ORDER BY display_order ASC, points_cost ASC`
      );

      return c.json({
        success: true,
        rewards: rewards.rows,
        catalog: rewards.rows,
        count: rewards.rows.length,
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

      const reward = rewards.rows[0];
      const cost = parseInt(String(reward.points_cost ?? points), 10);
      if (!Number.isFinite(cost) || cost < 1) {
        return c.json({ error: 'Invalid reward points_cost' }, 400);
      }
      const ptsReq = Math.round(Number(points));
      if (ptsReq !== cost) {
        return c.json({ error: 'points does not match reward cost' }, 400);
      }

      const cashValue = Math.round((parseFloat(String(reward.cash_value ?? 0)) || 0) * 100) / 100;

      const { remainingPoints, walletCredited } = await withTransaction(async (client) => {
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

        try {
          await client.query(
            `INSERT INTO reward_redemptions (customer_id, reward_id, points_used, redeemed_at)
             VALUES ($1::uuid, $2, $3, NOW())`,
            [customerId, rewardId, cost]
          );
        } catch (re: any) {
          console.warn('[rewards/redeem] reward_redemptions insert skipped:', re?.message);
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
        };
      });

      const profAfter = await select('customer_loyalty_points', { customer_id: customerId });
      const lifetimeOut = await computeDisplayedLifetimeStats(customerId, profAfter[0]);

      return c.json({
        success: true,
        message:
          walletCredited > 0
            ? `Reward redeemed. ₹${walletCredited.toFixed(2)} added to your wallet.`
            : 'Reward redeemed successfully',
        reward,
        remainingPoints,
        points: remainingPoints,
        totalPoints: remainingPoints,
        lifetimePointsEarned: lifetimeOut.earned,
        lifetimePointsRedeemed: lifetimeOut.redeemed,
        walletCredited,
      });
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      if (error?.message === 'INSUFFICIENT_POINTS') {
        return c.json({ error: 'Insufficient points' }, 400);
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
      const rows = result.rows || [];

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
        reward: rewards.rows[0],
      });
    } catch (error: any) {
      console.error('Error fetching reward details:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
