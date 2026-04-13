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
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

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

      // Peers: `referral_redemptions`. Customer→vendor WARM: same `referrals` row gets `referred_vendor_id`
      // (no redemption row) — count that as one additional use when linked.
      const totalReferrals = await query(
        `SELECT COALESCE(SUM(peer_cnt + vendor_slot), 0)::int AS count
         FROM (
           SELECT
             r.id,
             (SELECT COUNT(*)::int FROM referral_redemptions rr WHERE rr.referral_id = r.id) AS peer_cnt,
             CASE WHEN r.referred_vendor_id IS NOT NULL THEN 1 ELSE 0 END AS vendor_slot
           FROM referrals r
           WHERE r.referrer_id = $1
         ) t`,
        [customerId]
      );

      const completedReferrals = await query(
        `SELECT COUNT(DISTINCT rr.referred_id)::bigint AS count
         FROM referral_redemptions rr
         INNER JOIN referrals r ON r.id = rr.referral_id
         INNER JOIN bookings b ON b.customer_id = rr.referred_id
         WHERE r.referrer_id = $1`,
        [customerId]
      );

      const pendingReferrals = await query(
        `SELECT COUNT(*)::int AS count
         FROM referral_redemptions rr
         INNER JOIN referrals r ON r.id = rr.referral_id
         WHERE r.referrer_id = $1
         AND NOT EXISTS (SELECT 1 FROM bookings WHERE customer_id = rr.referred_id)`,
        [customerId]
      );

      const earnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0)::bigint AS total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = $1
         AND lt.transaction_type = 'earned'
         AND (
           (lt.reference_type = 'referral' AND EXISTS (
             SELECT 1 FROM referrals r WHERE r.id = lt.reference_id::uuid AND r.referrer_id = $1))
           OR (lt.reference_type = 'customer_referral' AND EXISTS (
             SELECT 1 FROM referral_redemptions rr
             INNER JOIN referrals r ON r.id = rr.referral_id
             WHERE rr.id = lt.reference_id::uuid AND r.referrer_id = $1))
         )`,
        [customerId]
      );

      const monthlyReferrals = await query(
        `SELECT COUNT(*)::int AS count
         FROM referral_redemptions rr
         INNER JOIN referrals r ON r.id = rr.referral_id
         WHERE r.referrer_id = $1
         AND rr.created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [customerId]
      );

      const monthlyEarnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0)::bigint AS total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = $1
         AND lt.transaction_type = 'earned'
         AND lt.created_at >= DATE_TRUNC('month', CURRENT_DATE)
         AND (
           (lt.reference_type = 'referral' AND EXISTS (
             SELECT 1 FROM referrals r WHERE r.id = lt.reference_id::uuid AND r.referrer_id = $1))
           OR (lt.reference_type = 'customer_referral' AND EXISTS (
             SELECT 1 FROM referral_redemptions rr
             INNER JOIN referrals r ON r.id = rr.referral_id
             WHERE rr.id = lt.reference_id::uuid AND r.referrer_id = $1))
         )`,
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
        `SELECT * FROM (
           SELECT 
             rr.id AS redemption_id,
             r.id,
             r.referrer_id,
             r.referral_code,
             rr.referred_id,
             rr.created_at,
             c.first_name || ' ' || c.last_name AS referee_name,
             c.phone AS referee_phone,
             CASE 
               WHEN EXISTS(SELECT 1 FROM bookings WHERE customer_id = rr.referred_id) THEN 'completed'
               ELSE 'pending'
             END AS status,
             (SELECT COALESCE(SUM(lt.points), 0) 
              FROM loyalty_transactions lt 
              WHERE lt.customer_id = $1 
              AND (
                (lt.reference_type = 'referral' AND lt.reference_id = r.id)
                OR (lt.reference_type = 'customer_referral' AND lt.reference_id = rr.id)
              )) AS referrer_earnings
           FROM referral_redemptions rr
           INNER JOIN referrals r ON r.id = rr.referral_id
           LEFT JOIN customers c ON rr.referred_id = c.id
           WHERE r.referrer_id = $1
           UNION ALL
           SELECT 
             NULL::uuid AS redemption_id,
             r.id,
             r.referrer_id,
             r.referral_code,
             r.referred_id,
             r.created_at,
             c.first_name || ' ' || c.last_name AS referee_name,
             c.phone AS referee_phone,
             CASE 
               WHEN EXISTS(SELECT 1 FROM bookings WHERE customer_id = r.referred_id) THEN 'completed'
               WHEN r.referred_id IS NOT NULL THEN 'pending'
               ELSE 'expired'
             END AS status,
             (SELECT COALESCE(SUM(lt.points), 0) 
              FROM loyalty_transactions lt 
              WHERE lt.customer_id = $1 
              AND lt.reference_type = 'referral' 
              AND lt.reference_id = r.id) AS referrer_earnings
           FROM referrals r
           LEFT JOIN customers c ON r.referred_id = c.id
           WHERE r.referrer_id = $1
           AND r.referred_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM referral_redemptions rr2
             WHERE rr2.referral_id = r.id AND rr2.referred_id = r.referred_id
           )
         ) t
         ORDER BY t.created_at DESC NULLS LAST
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

      // Referral reward points: handled by action_sources → loyalty-events-consumer (not inline here).

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

  // ============================================================================
  // VENDOR REFERRAL ENDPOINTS
  // ============================================================================

  /**
   * GET /vendor/:vendorId/referral
   * Get or create referral code for vendor
   */
  app.get("/vendor/:vendorId/referral", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get existing referral code for this vendor (from any referral record)
      const referrals = await query(
        `SELECT referral_code, created_at
         FROM vendor_referrals 
         WHERE referrer_vendor_id = CAST($1 AS uuid)
         AND referral_code IS NOT NULL
         ORDER BY created_at DESC 
         LIMIT 1`,
        [vendorId]
      );

      let referralCode: string = '';

      if (referrals.rows.length > 0 && referrals.rows[0].referral_code) {
        referralCode = referrals.rows[0].referral_code;
      } else {
        // Generate new referral code
        const code = `VENDOR${vendorId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        
        // Create a referral record with a placeholder phone to store the code
        // We'll use a special placeholder that won't conflict with real referrals
        const placeholderPhone = `REFERRER_${vendorId}`;
        
        try {
          await insert('vendor_referrals', {
            referrer_vendor_id: vendorId,
            referred_phone: placeholderPhone,
            referral_code: code,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          referralCode = code;
        } catch (insertError: any) {
          // If insert fails (e.g., unique constraint), try to get existing code
          const existing = await query(
            `SELECT referral_code FROM vendor_referrals 
             WHERE referrer_vendor_id = CAST($1 AS uuid)
             AND referral_code IS NOT NULL
             LIMIT 1`,
            [vendorId]
          );
          if (existing.rows.length > 0) {
            referralCode = existing.rows[0].referral_code;
          } else {
            // Fallback: use the generated code even if insert failed
            referralCode = code;
            console.warn('[REFERRAL] Failed to insert referral code record, but using generated code:', code);
          }
        }
      }

      return c.json({
        success: true,
        referralCode,
      });
    } catch (error: any) {
      console.error('Error fetching vendor referral code:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/referral/stats
   * Get vendor referral statistics
   */
  app.get("/vendor/:vendorId/referral/stats", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get total referrals
      const totalReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = CAST($1 AS uuid)
         AND referred_vendor_id IS NOT NULL`,
        [vendorId]
      );

      // Get approved referrals (where points were awarded)
      const approvedReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = CAST($1 AS uuid)
         AND status = 'approved'`,
        [vendorId]
      );

      // Get pending referrals
      const pendingReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = CAST($1 AS uuid)
         AND status = 'applied'`,
        [vendorId]
      );

      // Get total earnings from referrals (from loyalty transactions)
      const earnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = CAST($1 AS uuid)
         AND lt.reference_type = 'vendor_referral'
         AND lt.transaction_type = 'earned'`,
        [vendorId]
      );

      // Get monthly stats
      const monthlyReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = CAST($1 AS uuid)
         AND referred_vendor_id IS NOT NULL
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [vendorId]
      );

      const monthlyEarnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = CAST($1 AS uuid)
         AND lt.reference_type = 'vendor_referral'
         AND lt.transaction_type = 'earned'
         AND lt.created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [vendorId]
      );

      return c.json({
        success: true,
        totalReferrals: parseInt(totalReferrals.rows[0]?.count || '0', 10),
        approvedReferrals: parseInt(approvedReferrals.rows[0]?.count || '0', 10),
        pendingReferrals: parseInt(pendingReferrals.rows[0]?.count || '0', 10),
        totalEarnings: parseInt(earnings.rows[0]?.total_earnings || '0', 10),
        monthlyReferrals: parseInt(monthlyReferrals.rows[0]?.count || '0', 10),
        monthlyEarnings: parseInt(monthlyEarnings.rows[0]?.total_earnings || '0', 10),
      });
    } catch (error: any) {
      console.error('Error fetching vendor referral stats:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/referral/list
   * Get vendor referral list
   */
  app.get("/vendor/:vendorId/referral/list", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '1000', 10); // Increased default limit to 1000

      console.log(`[REFERRALS] Fetching referral list for vendor: ${vendorId}`);

      const referrals = await query(
        `SELECT 
          vr.*,
          v.business_name as referred_vendor_name,
          v.phone as referred_vendor_phone,
          (SELECT c.full_name
           FROM customers c
           WHERE vr.referred_vendor_id IS NULL
             AND NULLIF(TRIM(vr.referred_phone), '') IS NOT NULL
             AND vr.referred_phone NOT LIKE 'REFERRER%'
             AND LENGTH(REGEXP_REPLACE(COALESCE(c.phone, ''), '[^0-9]', '', 'g')) >= 10
             AND RIGHT(REGEXP_REPLACE(COALESCE(c.phone, ''), '[^0-9]', '', 'g'), 10)
                 = RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(vr.referred_phone), ''), ''), '[^0-9]', '', 'g'), 10)
           ORDER BY c.updated_at DESC NULLS LAST
           LIMIT 1
          ) AS referred_customer_name,
          (SELECT COALESCE(SUM(lt.points), 0)
           FROM loyalty_transactions lt
           WHERE lt.transaction_type = 'earned'
             AND (
               (lt.reference_type = 'vendor_referral' AND lt.reference_id::text = vr.id::text)
               OR (
                 lt.reference_type = 'customer_referral'
                 AND NULLIF(TRIM(vr.referred_phone), '') IS NOT NULL
                 AND lt.reference_id::text IN (
                   SELECT cr.id::text
                   FROM customer_referrals cr
                   WHERE cr.referrer_vendor_id = CAST($1 AS uuid)
                     AND cr.referred_phone = NULLIF(TRIM(vr.referred_phone), '')
                 )
               )
             )
          ) AS points_earned
         FROM vendor_referrals vr
         LEFT JOIN vendors v ON vr.referred_vendor_id = v.id
         WHERE vr.referrer_vendor_id = CAST($1 AS uuid)
         ORDER BY vr.created_at DESC
         LIMIT $2`,
        [vendorId, limit]
      );

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total
         FROM vendor_referrals vr
         WHERE vr.referrer_vendor_id = CAST($1 AS uuid)`,
        [vendorId]
      );

      return c.json({
        success: true,
        referrals: referrals.rows,
        count: referrals.rows.length,
        total: parseInt(countResult.rows[0]?.total || '0', 10),
      });
    } catch (error: any) {
      console.error('Error fetching vendor referral list:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/referral/rewards
   * Get vendor referral rewards (points earned from referrals)
   */
  app.get("/vendor/:vendorId/referral/rewards", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Order rewards by referral's created_at DESC to match the referral list ordering
      // This ensures consistency between /referral/list and /referral/rewards endpoints
      // IMPORTANT: Only show rewards for approved referrals (pending/applied shouldn't have points yet)
      const rewards = await query(
        `SELECT 
          lt.*,
          vr.referral_code,
          vr.referred_vendor_id,
          vr.approved_at,
          vr.status as referral_status,
          vr.created_at as referral_created_at,
          v.business_name as referred_vendor_name
         FROM loyalty_transactions lt
         INNER JOIN vendor_referrals vr ON lt.reference_id::text = vr.id::text
         LEFT JOIN vendors v ON vr.referred_vendor_id = v.id
         WHERE lt.reference_type = 'vendor_referral'
         AND lt.transaction_type = 'earned'
         AND vr.referrer_vendor_id = CAST($1 AS uuid)
         AND vr.status = 'approved'
         ORDER BY vr.created_at DESC NULLS LAST, COALESCE(vr.approved_at, vr.created_at) DESC NULLS LAST, lt.created_at DESC
         LIMIT 50`,
        [vendorId]
      );

      return c.json({
        success: true,
        rewards: rewards.rows,
        count: rewards.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor referral rewards:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/referral/:referralId/diagnostic
   * Diagnostic endpoint to check referral and loyalty transaction state
   */
  app.get("/vendor/:vendorId/referral/:referralId/diagnostic", async (c) => {
    try {
      const { vendorId, referralId } = c.req.param();

      // Get referral details
      const referralResult = await query(
        `SELECT vr.*, v.business_name as referred_vendor_name, v.phone as referred_vendor_phone
         FROM vendor_referrals vr
         LEFT JOIN vendors v ON vr.referred_vendor_id = v.id
         WHERE vr.id = CAST($1 AS uuid)
         AND vr.referrer_vendor_id = CAST($2 AS uuid)`,
        [referralId, vendorId]
      );

      if (referralResult.rows.length === 0) {
        return c.json({ error: 'Referral not found' }, 404);
      }

      const referral = referralResult.rows[0];

      // Get loyalty transactions for this referral
      const transactionsResult = await query(
        `SELECT lt.*
         FROM loyalty_transactions lt
         WHERE lt.customer_id = CAST($1 AS uuid)
         AND lt.reference_type = 'vendor_referral'
         AND lt.reference_id = $2
         ORDER BY lt.created_at DESC`,
        [vendorId, referralId]
      );

      return c.json({
        success: true,
        referral: referral,
        loyaltyTransactions: transactionsResult.rows,
        transactionCount: transactionsResult.rows.length,
        totalPoints: transactionsResult.rows.reduce((sum: number, t: any) => sum + (parseInt(t.points) || 0), 0),
        analysis: {
          hasTransactions: transactionsResult.rows.length > 0,
          isApproved: referral.status === 'approved',
          hasVendorId: referral.referred_vendor_id !== null,
          shouldHavePoints: referral.status === 'approved' && transactionsResult.rows.length > 0,
          issue: referral.status !== 'approved' && transactionsResult.rows.length > 0 
            ? 'Points awarded for non-approved referral' 
            : referral.status === 'approved' && transactionsResult.rows.length === 0
            ? 'Approved referral missing points'
            : 'No issues detected'
        }
      });
    } catch (error: any) {
      console.error('Error in referral diagnostic:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/referral/send
   * Send referral code via SMS to a phone number
   */
  app.post("/vendor/:vendorId/referral/send", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { phone, message } = await c.req.json();

      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      // Get or create referral code
      const referrals = await query(
        `SELECT * FROM vendor_referrals 
         WHERE referrer_vendor_id = CAST($1 AS uuid)
         ORDER BY created_at DESC 
         LIMIT 1`,
        [vendorId]
      );

      let referralCode: string;
      if (referrals.rows.length > 0) {
        referralCode = referrals.rows[0].referral_code;
      } else {
        // Generate new referral code
        referralCode = `VENDOR${vendorId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        await insert('vendor_referrals', {
          referrer_vendor_id: vendorId,
          referred_phone: '',
          referral_code: referralCode,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Normalize phone
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

      // Create referral record for this phone (if not exists)
      const existing = await query(
        `SELECT * FROM vendor_referrals 
         WHERE referrer_vendor_id = CAST($1 AS uuid) AND referred_phone = $2 
         LIMIT 1`,
        [vendorId, normalizedPhone]
      );

      if (existing.rows.length === 0) {
        await insert('vendor_referrals', {
          referrer_vendor_id: vendorId,
          referred_phone: normalizedPhone,
          referral_code: referralCode,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Send SMS via SNS (if configured)
      try {
        const { publishToSNS } = require('../utils/aws-clients');
        const customMessage = message || `Join Warmpawz as a vendor! Use referral code ${referralCode} during registration to get started.`;
        
        await publishToSNS('vendor-notifications', {
          type: 'sms',
          phone: `+91${normalizedPhone}`,
          message: customMessage,
        }, {
          messageType: 'Transactional',
        });
        console.log(`✅ Vendor referral code sent to ${normalizedPhone}`);
      } catch (smsError: any) {
        console.error('Error sending referral SMS:', smsError);
        // Don't fail the request if SMS fails
      }

      return c.json({
        success: true,
        message: 'Referral code sent successfully',
        referralCode,
      });
    } catch (error: any) {
      console.error('Error sending vendor referral:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/referral/create-rule
   * Create vendor_refer_friend rule directly (for testing)
   */
  app.post("/vendor/:vendorId/referral/create-rule", async (c) => {
    try {
      // Ensure table exists first
      await query(`
        CREATE TABLE IF NOT EXISTS loyalty_action_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          action_name TEXT NOT NULL UNIQUE,
          action_category TEXT NOT NULL CHECK (action_category IN ('loyalty', 'referral_rewards')),
          user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'vendor', 'both')),
          points_type TEXT NOT NULL CHECK (points_type IN ('fixed', 'percentage', 'per_amount')),
          points_value NUMERIC(10, 2) NOT NULL,
          base_amount NUMERIC(10, 2),
          min_amount NUMERIC(10, 2),
          max_points_per_transaction INTEGER,
          frequency_type TEXT CHECK (frequency_type IN ('one_time', 'recurring', 'unlimited', 'monthly_limit', 'yearly_limit')),
          frequency_limit INTEGER,
          frequency_period TEXT CHECK (frequency_period IN ('day', 'week', 'month', 'year')),
          conditions JSONB DEFAULT '{}'::jsonb,
          multiplier_conditions JSONB DEFAULT '{}'::jsonb,
          is_active BOOLEAN DEFAULT true,
          priority INTEGER DEFAULT 100,
          description TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `).catch(() => {});

      // Insert or update the rule
      await query(`
        INSERT INTO loyalty_action_rules (
          action_name, action_category, user_type, points_type, points_value,
          base_amount, frequency_type, description, is_active, priority, notes
        ) VALUES (
          'vendor_refer_friend', 'referral_rewards', 'vendor', 'fixed', 200,
          NULL, 'recurring', 'Refer a friend who joins', true, 50, 'Friend must Onboard 1 End User and complete 1 booking'
        )
        ON CONFLICT (action_name) DO UPDATE SET
          points_value = 200,
          action_category = 'referral_rewards',
          user_type = 'vendor',
          points_type = 'fixed',
          frequency_type = 'recurring',
          description = 'Refer a friend who joins',
          is_active = true,
          priority = 50,
          updated_at = NOW()
      `);
      return c.json({ success: true, message: 'vendor_refer_friend rule created/updated' });
    } catch (error: any) {
      console.error('Error creating rule:', error);
      return c.json({ error: error.message, stack: error.stack }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/referral/retroactive-process
   * Retroactively process approved referrals that don't have points
   * This will award points for referrals that were approved before the loyalty rule existed
   */
  app.post("/vendor/:vendorId/referral/retroactive-process", async (c) => {
    return c.json({ error: 'Deprecated: points are awarded via action-source pipeline only.' }, 410);
  });

  /**
   * POST /vendor/:vendorId/referral/:referralId/process
   * Manually process a specific referral to award points
   */
  app.post("/vendor/:vendorId/referral/:referralId/process", async (c) => {
    return c.json({ error: 'Deprecated: points are awarded via action-source pipeline only.' }, 410);
  });

  /**
   * POST /vendor/:vendorId/referral/convert-loyalty-to-wallet
   * Retroactively convert existing loyalty transactions to wallet balance
   * This fixes referrals where points were awarded but wallet conversion failed
   */
  app.post("/vendor/:vendorId/referral/convert-loyalty-to-wallet", async (c) => {
    return c.json({ error: 'Deprecated: wallet conversion is handled by the consumer pipeline.' }, 410);
  });

  /**
   * GET /customer/:phone/referrals
   * Get referral data by phone number (for customer web app)
   * Returns referral code and stats in a single response
   */
  app.get("/customer/:phone/referrals", async (c) => {
    try {
      const { phone } = c.req.param();
      
      // Normalize phone number
      let normalizedPhone = phone.replace(/\s+/g, '').replace(/^0+/, '');
      if (!normalizedPhone.startsWith('+')) {
        if (normalizedPhone.length === 10) {
          normalizedPhone = '+91' + normalizedPhone;
        }
      }

      const digitsOnly = (p: string) => p.replace(/\D/g, '');
      const last10 =
        digitsOnly(normalizedPhone).length >= 10
          ? digitsOnly(normalizedPhone).slice(-10)
          : digitsOnly(phone).length >= 10
            ? digitsOnly(phone).slice(-10)
            : '';

      // Prefer one canonical row when the same mobile exists as `9326…` and `+919326…` (duplicate customers).
      // ORDER BY: completed profile first, then non-placeholder name, then most recently updated.
      const customerResult =
        last10.length >= 10
          ? await query(
              `SELECT id FROM customers
               WHERE LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) >= 10
                 AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
               ORDER BY
                 (profile_completed IS TRUE) DESC NULLS LAST,
                 (onboarding_status = 'COMPLETED') DESC NULLS LAST,
                 (LOWER(COALESCE(TRIM(full_name), '')) LIKE 'customer %') ASC,
                 updated_at DESC NULLS LAST
               LIMIT 1`,
              [last10]
            )
          : await query(
              `SELECT id FROM customers WHERE phone = $1 OR phone = $2 LIMIT 1`,
              [phone, normalizedPhone]
            );

      if (customerResult.rows.length === 0) {
        return c.json({ 
          error: 'Customer not found',
          stats: {
            total_referrals: 0,
            successful_referrals: 0,
            pending_referrals: 0,
            total_rewards: 0,
            referral_code: phone?.slice(-6).toUpperCase() || 'REF123',
          }
        }, 404);
      }

      const customerId = customerResult.rows[0].id;

      // Get or create referral code
      let referrals = await select('referrals', { referrer_id: customerId });
      
      if (referrals.length === 0) {
        const code = `WARM${customerId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const newReferral = await insert('referrals', {
          referrer_id: customerId,
          referral_code: code,
          created_at: new Date().toISOString(),
        });
        referrals = newReferral;
      }

      const referralCode = referrals[0].referral_code;

      const totalReferrals = await query(
        `SELECT COALESCE(SUM(peer_cnt + vendor_slot), 0)::int AS count
         FROM (
           SELECT
             r.id,
             (SELECT COUNT(*)::int FROM referral_redemptions rr WHERE rr.referral_id = r.id) AS peer_cnt,
             CASE WHEN r.referred_vendor_id IS NOT NULL THEN 1 ELSE 0 END AS vendor_slot
           FROM referrals r
           WHERE r.referrer_id = $1
         ) t`,
        [customerId]
      );

      const completedReferrals = await query(
        `SELECT COUNT(DISTINCT rr.referred_id)::bigint AS count
         FROM referral_redemptions rr
         INNER JOIN referrals r ON r.id = rr.referral_id
         INNER JOIN bookings b ON b.customer_id = rr.referred_id
         WHERE r.referrer_id = $1`,
        [customerId]
      );

      const pendingReferrals = await query(
        `SELECT COUNT(*)::int AS count
         FROM referral_redemptions rr
         INNER JOIN referrals r ON r.id = rr.referral_id
         WHERE r.referrer_id = $1
         AND NOT EXISTS (SELECT 1 FROM bookings WHERE customer_id = rr.referred_id)`,
        [customerId]
      );

      const earnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0)::bigint AS total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = $1
         AND lt.transaction_type = 'earned'
         AND (
           (lt.reference_type = 'customer_referral' AND EXISTS (
             SELECT 1 FROM referral_redemptions rr
             INNER JOIN referrals r ON r.id = rr.referral_id
             WHERE rr.id = lt.reference_id::uuid AND r.referrer_id = $1
             AND EXISTS (SELECT 1 FROM bookings WHERE customer_id = rr.referred_id)
           ))
           OR (lt.reference_type = 'referral' AND EXISTS (
             SELECT 1 FROM referrals r
             WHERE r.id = lt.reference_id::uuid AND r.referrer_id = $1
             AND EXISTS (
               SELECT 1 FROM referral_redemptions rr
               WHERE rr.referral_id = r.id
               AND EXISTS (SELECT 1 FROM bookings WHERE customer_id = rr.referred_id)
             )
           ))
         )`,
        [customerId]
      );

      let vendorsReferred = 0;
      try {
        const vr = await query(
          `SELECT COUNT(*)::int AS count FROM referrals WHERE referrer_id = $1 AND referred_vendor_id IS NOT NULL`,
          [customerId]
        );
        vendorsReferred = parseInt(String(vr.rows[0]?.count ?? '0'), 10);
      } catch {
        vendorsReferred = 0;
      }

      return c.json({
        success: true,
        stats: {
          referral_code: referralCode,
          total_referrals: parseInt(totalReferrals.rows[0]?.count || '0', 10),
          successful_referrals: parseInt(completedReferrals.rows[0]?.count || '0', 10),
          pending_referrals: parseInt(pendingReferrals.rows[0]?.count || '0', 10),
          total_rewards: parseInt(earnings.rows[0]?.total_earnings || '0', 10),
          vendors_referred: vendorsReferred,
        },
      });
    } catch (error: any) {
      console.error('Error fetching referral data by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/:customerId/referral/:referralId/process
   * Manually process a specific referral to award points (similar to vendor referrals)
   */
  app.post("/customer/:customerId/referral/:referralId/process", async (c) => {
    return c.json({ error: 'Deprecated: points are awarded via action-source pipeline only.' }, 410);
  });
}

