/**
 * ============================================================================
 * REFERRAL ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles referral system:
 * - Get referral code
 * - Get referral stats
 * - Send invite
 * - Get referral history
 * - Claim rewards
 * 
 * Date: 2026-01-07
 * Phase 1: Mobile Improvements
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

export function registerReferralEndpoints(app: Hono) {
  /**
   * GET /customer/:customerId/referral
   * Get referral code for customer
   */
  app.get("/customer/:customerId/referral", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Get or create referral code
      let referrals = await select('referrals', { referrer_id: customerId });
      
      if (referrals.length === 0) {
        // Generate new referral code
        const code = `WARM${customerId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const newReferral = await insert('referrals', {
          referrer_id: customerId,
          referral_code: code,
          created_at: new Date().toISOString(),
        });
        referrals = newReferral;
      }

      return c.json({
        success: true,
        referralCode: referrals[0].referral_code,
      });
    } catch (error: any) {
      console.error('Error fetching referral code:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/referral/stats
   * Get referral statistics
   */
  app.get("/customer/:customerId/referral/stats", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Get total referrals
      const totalReferrals = await query(
        `SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1 AND referred_id IS NOT NULL`,
        [customerId]
      );

      // Get completed referrals (where referred customer made a booking)
      const completedReferrals = await query(
        `SELECT COUNT(DISTINCT r.referred_id) as count
         FROM referrals r
         INNER JOIN bookings b ON r.referred_id = b.customer_id
         WHERE r.referrer_id = $1 AND r.referred_id IS NOT NULL`,
        [customerId]
      );

      // Get pending referrals
      const pendingReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM referrals 
         WHERE referrer_id = $1 AND referred_id IS NOT NULL 
         AND NOT EXISTS (
           SELECT 1 FROM bookings WHERE customer_id = referrals.referred_id
         )`,
        [customerId]
      );

      // Get total earnings from referrals
      const earnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = $1 
         AND lt.reference_type = 'referral'
         AND lt.type = 'earned'`,
        [customerId]
      );

      // Get monthly stats
      const monthlyReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM referrals 
         WHERE referrer_id = $1 
         AND referred_id IS NOT NULL
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [customerId]
      );

      const monthlyEarnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = $1 
         AND lt.reference_type = 'referral'
         AND lt.type = 'earned'
         AND lt.created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [customerId]
      );

      return c.json({
        success: true,
        totalReferrals: parseInt(totalReferrals.rows[0]?.count || '0', 10),
        completedReferrals: parseInt(completedReferrals.rows[0]?.count || '0', 10),
        pendingReferrals: parseInt(pendingReferrals.rows[0]?.count || '0', 10),
        totalEarnings: parseInt(earnings.rows[0]?.total_earnings || '0', 10),
        monthlyReferrals: parseInt(monthlyReferrals.rows[0]?.count || '0', 10),
        monthlyEarnings: parseInt(monthlyEarnings.rows[0]?.total_earnings || '0', 10),
      });
    } catch (error: any) {
      console.error('Error fetching referral stats:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /referral/invite
   * Send referral invite
   */
  app.post("/referral/invite", async (c) => {
    try {
      const { customerId, email, phone, message } = await c.req.json();

      if (!customerId || (!email && !phone)) {
        return c.json({ error: 'customerId and either email or phone are required' }, 400);
      }

      // Get referral code
      const referrals = await select('referrals', { referrer_id: customerId });
      const referralCode = referrals.length > 0 ? referrals[0].referral_code : null;

      if (!referralCode) {
        return c.json({ error: 'Referral code not found' }, 404);
      }

      // Send email/SMS with referral code via SNS
      try {
        const { publishToSNS } = require('../utils/aws-clients');
        
        // Get customer details
        const customers = await select('customers', { id: customerId });
        if (customers.length > 0) {
          const customer = customers[0];
          const phone = customer.phone || customer.phone_number;
          const email = customer.email;
          
          // Send SMS via SNS
          if (phone) {
            await publishToSNS('customer-notifications', {
              type: 'sms',
              phone: phone,
              message: `🎉 Welcome to Warmpawz! Use referral code ${referralCode.code} to get ₹${referralCode.reward_amount} off your first booking. Share with friends to earn more rewards!`,
            }, {
              messageType: 'Transactional',
            });
          }
          
          // Send email via SNS (if email topic configured)
          if (email) {
            await publishToSNS('customer-notifications', {
              type: 'email',
              email: email,
              subject: 'Welcome to Warmpawz - Your Referral Code',
              body: `Hi ${customer.name || 'there'}!\n\nWelcome to Warmpawz! Your referral code is: ${referralCode.code}\n\nUse it to get ₹${referralCode.reward_amount} off your first booking. Share with friends to earn more rewards!\n\nHappy pet caring! 🐾`,
            }, {
              messageType: 'Transactional',
            });
          }
          
          console.log(`✅ Referral code sent to customer ${customerId}`);
        }
      } catch (error: any) {
        console.error('Error sending referral code:', error);
        // Don't fail the request if notification fails
      }

      return c.json({
        success: true,
        message: 'Invite sent successfully',
        referralCode,
      });
    } catch (error: any) {
      console.error('Error sending invite:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/referral/history
   * Get referral history
   */
  app.get("/customer/:customerId/referral/history", async (c) => {
    try {
      const { customerId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50', 10);

      const history = await query(
        `SELECT 
          r.*,
          c.first_name || ' ' || c.last_name as referee_name,
          c.phone as referee_phone,
          CASE 
            WHEN EXISTS(SELECT 1 FROM bookings WHERE customer_id = r.referred_id) THEN 'completed'
            WHEN r.referred_id IS NOT NULL THEN 'pending'
            ELSE 'expired'
          END as status,
          (SELECT COALESCE(SUM(lt.points), 0) 
           FROM loyalty_transactions lt 
           WHERE lt.customer_id = $1 
           AND lt.reference_type = 'referral' 
           AND lt.reference_id = r.id::text) as referrer_earnings
         FROM referrals r
         LEFT JOIN customers c ON r.referred_id = c.id
         WHERE r.referrer_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2`,
        [customerId, limit]
      );

      return c.json({
        success: true,
        history: history.rows,
        count: history.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching referral history:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/:customerId/referral/claim
   * Claim referral reward
   */
  app.post("/customer/:customerId/referral/claim", async (c) => {
    try {
      const { customerId } = c.req.param();
      const { rewardId } = await c.req.json();

      if (!rewardId) {
        return c.json({ error: 'rewardId is required' }, 400);
      }

      // Get reward details
      const rewards = await select('referral_rewards', { id: rewardId });
      if (rewards.length === 0) {
        return c.json({ error: 'Reward not found' }, 404);
      }

      const reward = rewards[0];

      // Check if already claimed
      const claimed = await query(
        `SELECT * FROM referral_reward_claims 
         WHERE customer_id = $1 AND reward_id = $2`,
        [customerId, rewardId]
      );

      if (claimed.rows.length > 0) {
        return c.json({ error: 'Reward already claimed' }, 400);
      }

      // Claim reward
      await insert('referral_reward_claims', {
        customer_id: customerId,
        reward_id: rewardId,
        claimed_at: new Date().toISOString(),
      });

      // Award points if applicable
      if (reward.points_awarded) {
        await query(
          `UPDATE customer_loyalty_points
           SET total_points = total_points + $1,
               lifetime_points_earned = lifetime_points_earned + $1
           WHERE customer_id = $2`,
          [reward.points_awarded, customerId]
        );
      }

      return c.json({
        success: true,
        message: 'Reward claimed successfully',
        reward,
      });
    } catch (error: any) {
      console.error('Error claiming reward:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

