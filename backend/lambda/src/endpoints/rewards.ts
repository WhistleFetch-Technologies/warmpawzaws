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
import { select, insert, update, query } from '../database/rds-connection';

export function registerRewardsEndpoints(app: Hono) {
  /**
   * GET /customer/:customerId/rewards/points
   * Get customer points balance
   */
  app.get("/customer/:customerId/rewards/points", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Get or create loyalty profile
      let profile = await select('customer_loyalty_points', { customer_id: customerId });
      
      if (profile.length === 0) {
        const newProfile = await insert('customer_loyalty_points', {
          customer_id: customerId,
          total_points: 0,
          lifetime_points_earned: 0,
          lifetime_points_redeemed: 0,
        });
        profile = newProfile;
      }

      // Get tier information
      const tier = await query(
        `SELECT * FROM loyalty_tiers 
         WHERE min_points <= $1 
         ORDER BY min_points DESC 
         LIMIT 1`,
        [profile[0].total_points || 0]
      );

      return c.json({
        success: true,
        points: parseInt(profile[0]?.total_points || '0', 10),
        totalPoints: parseInt(profile[0]?.total_points || '0', 10),
        tier: tier.rows[0] || { name: 'Bronze', min_points: 0 },
        lifetimePointsEarned: parseInt(profile[0]?.lifetime_points_earned || '0', 10),
        lifetimePointsRedeemed: parseInt(profile[0]?.lifetime_points_redeemed || '0', 10),
      });
    } catch (error: any) {
      console.error('Error fetching points:', error);
      return c.json({ error: error.message }, 500);
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

      const history = await query(
        `SELECT 
          id,
          type,
          points,
          description,
          created_at as date,
          reference_type as source
         FROM loyalty_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [customerId, limit, offset]
      );

      return c.json({
        success: true,
        history: history.rows,
        count: history.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching points history:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/rewards/available
   * Get available rewards catalog
   */
  app.get("/customer/:customerId/rewards/available", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Get active rewards
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
         ORDER BY points_cost ASC`
      );

      return c.json({
        success: true,
        rewards: rewards.rows,
        catalog: rewards.rows,
        count: rewards.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching rewards catalog:', error);
      return c.json({ error: error.message }, 500);
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

      if (!points || !rewardId) {
        return c.json({ error: 'points and rewardId are required' }, 400);
      }

      // Get customer points
      const profile = await select('customer_loyalty_points', { customer_id: customerId });
      const currentPoints = parseInt(profile[0]?.total_points || '0', 10);

      if (currentPoints < points) {
        return c.json({ error: 'Insufficient points' }, 400);
      }

      // Get reward details
      const rewards = await query(
        `SELECT * FROM rewards_catalog WHERE id = $1 AND is_active = true`,
        [rewardId]
      );

      if (rewards.rows.length === 0) {
        return c.json({ error: 'Reward not found or inactive' }, 404);
      }

      const reward = rewards.rows[0];

      if (reward.points_cost > currentPoints) {
        return c.json({ error: 'Insufficient points for this reward' }, 400);
      }

      // Deduct points
      await query(
        `UPDATE customer_loyalty_points
         SET total_points = total_points - $1,
             lifetime_points_redeemed = lifetime_points_redeemed + $1
         WHERE customer_id = $2`,
        [reward.points_cost, customerId]
      );

      // Record transaction
      await insert('loyalty_transactions', {
        customer_id: customerId,
        type: 'redeemed',
        points: -reward.points_cost,
        description: `Redeemed: ${reward.name}`,
        reference_type: 'reward_redemption',
        reference_id: rewardId,
        created_at: new Date().toISOString(),
      });

      // Create redemption record
      await insert('reward_redemptions', {
        customer_id: customerId,
        reward_id: rewardId,
        points_used: reward.points_cost,
        redeemed_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Reward redeemed successfully',
        reward,
        remainingPoints: currentPoints - reward.points_cost,
      });
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /rewards/:rewardId
   * Get reward details
   */
  app.get("/rewards/:rewardId", async (c) => {
    try {
      const { rewardId } = c.req.param();

      const rewards = await query(
        `SELECT * FROM rewards_catalog WHERE id = $1`,
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

