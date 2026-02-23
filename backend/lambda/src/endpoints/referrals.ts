/**
 * ============================================================================
 * REFERRAL ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles customer-to-customer referral system:
 * - Get referral code
 * - Get referral stats
 * - Send invite via SMS
 * - Get referral history
 * - Claim rewards
 * 
 * Date: 2026-01-07 (original)
 * Updated: 2026-02-17 (migrated to customer_referrals table)
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { sendSMS } from '../utils/sms-service';
import { requireCustomer } from '../middleware/auth-middleware';

/**
 * Helper function to resolve customer ID from various identifiers
 * Tries multiple strategies to find the customer
 */
async function resolveCustomerIdFromAuth(userId: string): Promise<string | null> {
  console.log(`[REFERRALS] Resolving customer ID for userId: ${userId}`);
  
  // Strategy 1: Try direct customer ID lookup (only if valid UUID)
  if (isValidUUID(userId)) {
    try {
      const customersById = await query(
        `SELECT id FROM customers WHERE id = $1::uuid LIMIT 1`,
        [userId]
      );
      if (customersById.rows.length > 0) {
        console.log(`[REFERRALS] Found customer by ID: ${customersById.rows[0].id}`);
        return customersById.rows[0].id;
      }
    } catch (e: any) {
      console.log(`[REFERRALS] UUID lookup failed: ${e.message}`);
    }
  }
  
  // Strategy 2: Try phone number lookup (normalize first)
  const normalizedPhone = userId.replace(/\D/g, '');
  if (normalizedPhone.length >= 10) {
    const phone10 = normalizedPhone.slice(-10);
    
    // Try with 10-digit phone
    try {
      const customersByPhone10 = await query(
        `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
        [phone10]
      );
      if (customersByPhone10.rows.length > 0) {
        console.log(`[REFERRALS] Found customer by phone (10-digit): ${customersByPhone10.rows[0].id}`);
        return customersByPhone10.rows[0].id;
      }
    } catch (e: any) {
      console.log(`[REFERRALS] Phone 10-digit lookup failed: ${e.message}`);
    }
    
    // Try with +91 prefix
    try {
      const phoneWithPrefix = `+91${phone10}`;
      const customersByPrefix = await query(
        `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
        [phoneWithPrefix]
      );
      if (customersByPrefix.rows.length > 0) {
        console.log(`[REFERRALS] Found customer by phone (+91): ${customersByPrefix.rows[0].id}`);
        return customersByPrefix.rows[0].id;
      }
    } catch (e: any) {
      console.log(`[REFERRALS] Phone +91 lookup failed: ${e.message}`);
    }
  }
  
  // Strategy 3: Try customer_identity lookup by phone
  if (normalizedPhone.length >= 10) {
    const phone10 = normalizedPhone.slice(-10);
    try {
      const identities = await query(
        `SELECT customer_id FROM customer_identity WHERE phone = $1 AND customer_id IS NOT NULL LIMIT 1`,
        [phone10]
      );
      if (identities.rows.length > 0 && identities.rows[0].customer_id) {
        console.log(`[REFERRALS] Found customer via customer_identity: ${identities.rows[0].customer_id}`);
        return identities.rows[0].customer_id;
      }
    } catch (e: any) {
      console.log(`[REFERRALS] customer_identity lookup failed: ${e.message}`);
    }
  }
  
  console.error(`[REFERRALS] Could not resolve customer ID for userId: ${userId}`);
  return null;
}

export function registerReferralEndpoints(app: Hono) {
  // ============================================================================
  // NEW ENDPOINTS: /referrals/* (for frontend compatibility)
  // These endpoints use authenticated customer context
  // ============================================================================

  /**
   * GET /referrals/stats
   * Get referral statistics for authenticated customer
   */
  app.get("/referrals/stats", requireCustomer(), async (c) => {
    try {
      const userId = c.get('userId');
      const isUAT = c.get('isUAT') === true;
      const phoneHeader = c.req.header('x-phone') || c.req.header('X-Phone');
      
      console.log(`[REFERRALS] /stats endpoint called`);
      console.log(`[REFERRALS] userId: ${userId}`);
      console.log(`[REFERRALS] isUAT: ${isUAT}`);
      console.log(`[REFERRALS] phoneHeader: ${phoneHeader}`);
      
      if (!userId) {
        console.error(`[REFERRALS] No userId in context`);
        return c.json({ error: 'Authentication required' }, 401);
      }

      // In UAT mode, userId is "uat-customer-user", so we need to use phone header
      let identifierToUse = userId;
      if (isUAT && phoneHeader) {
        console.log(`[REFERRALS] UAT mode detected, using phone header: ${phoneHeader}`);
        identifierToUse = phoneHeader;
      } else if (userId.startsWith('uat-')) {
        // UAT mode but no phone header - try to extract from token or use default
        console.log(`[REFERRALS] UAT mode detected but no phone header, userId: ${userId}`);
        // For UAT mode, we might need to check if there's a way to get the phone
        // For now, return error asking for phone
        if (!phoneHeader) {
          return c.json({ 
            error: 'Phone number required for UAT mode. Please provide X-Phone header.',
            userId,
            isUAT: true
          }, 400);
        }
        identifierToUse = phoneHeader;
      }

      // Resolve customer ID using helper function
      const customerId = await resolveCustomerIdFromAuth(identifierToUse);

      if (!customerId) {
        console.error(`[REFERRALS] Customer not found for identifier: ${identifierToUse}`);
        return c.json({ 
          error: 'Customer not found. Please ensure you are logged in with a valid account.',
          debug: process.env.NODE_ENV === 'development' ? { 
            userId, 
            identifierToUse,
            isUAT,
            phoneHeader 
          } : undefined
        }, 404);
      }
      
      console.log(`[REFERRALS] Resolved customer ID: ${customerId}`);
      console.log(`[REFERRALS] Customer ID is valid UUID: ${isValidUUID(customerId)}`);
      console.log(`[REFERRALS] Customer ID type: ${typeof customerId}`);

      // Validate customerId is a valid UUID before using it
      if (!isValidUUID(customerId)) {
        console.error(`[REFERRALS] Invalid customer ID format: ${customerId}`);
        return c.json({ error: 'Invalid customer ID format. Please contact support.' }, 500);
      }

      // Ensure customerId is a string (UUID format)
      const customerIdStr = String(customerId);

      // Get referral code (cast to UUID)
      let referralCode: string;
      try {
        const referralCodeResult = await query(
          `SELECT referral_code FROM customer_referrals 
           WHERE referrer_customer_id = CAST($1 AS uuid) 
           ORDER BY created_at ASC 
           LIMIT 1`,
          [customerIdStr]
        );
        referralCode = referralCodeResult.rows[0]?.referral_code || 
          `CREF${customerIdStr.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      } catch (e: any) {
        console.error(`[REFERRALS] Error getting referral code: ${e.message}`);
        referralCode = `CREF${customerIdStr.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      }

      // Get total referrals (cast to UUID)
      let totalReferrals: any;
      try {
        totalReferrals = await query(
          `SELECT COUNT(*) as count FROM customer_referrals WHERE referrer_customer_id = $1::uuid`,
          [customerIdStr]
        );
      } catch (e: any) {
        console.error(`[REFERRALS] Error getting total referrals: ${e.message}, customerId: ${customerIdStr}`);
        throw e;
      }

      // Get successful referrals (approved)
      let successfulReferrals: any;
      try {
        successfulReferrals = await query(
          `SELECT COUNT(*) as count
           FROM customer_referrals
           WHERE referrer_customer_id = CAST($1 AS uuid) AND status = 'approved'`,
          [customerIdStr]
        );
      } catch (e: any) {
        console.error(`[REFERRALS] Error getting successful referrals: ${e.message}`);
        throw e;
      }

      // Get pending referrals
      let pendingReferrals: any;
      try {
        pendingReferrals = await query(
          `SELECT COUNT(*) as count 
           FROM customer_referrals 
           WHERE referrer_customer_id = CAST($1 AS uuid) AND status IN ('pending', 'applied')`,
          [customerIdStr]
        );
      } catch (e: any) {
        console.error(`[REFERRALS] Error getting pending referrals: ${e.message}`);
        throw e;
      }

      // Get total rewards earned (from wallet transactions)
      let walletRewards: any;
      try {
        walletRewards = await query(
          `SELECT COALESCE(SUM(wt.amount), 0) as total_rewards
           FROM wallet_transactions wt
           JOIN customer_wallets cw ON wt.wallet_id = cw.id
           WHERE cw.customer_id = CAST($1 AS uuid)
           AND wt.reference_type = 'customer_referral'
           AND wt.transaction_type = 'credit'`,
          [customerIdStr]
        );
      } catch (e: any) {
        console.error(`[REFERRALS] Error getting wallet rewards: ${e.message}, query: ${e.query || 'N/A'}`);
        throw e;
      }

      // Get pending rewards (from loyalty transactions not yet converted)
      let pendingRewards: any;
      try {
        pendingRewards = await query(
          `SELECT COALESCE(SUM(lt.points), 0) as pending_points
           FROM loyalty_transactions lt
           WHERE lt.customer_id = CAST($1 AS uuid) 
           AND lt.reference_type = 'customer_referral'
           AND lt.transaction_type = 'earned'
           AND NOT EXISTS (
             SELECT 1 FROM wallet_transactions wt
             JOIN customer_wallets cw ON wt.wallet_id = cw.id
             WHERE cw.customer_id = CAST($1 AS uuid)
             AND wt.reference_id = lt.id::text
           )`,
          [customerIdStr]
        );
      } catch (e: any) {
        console.error(`[REFERRALS] Error getting pending rewards: ${e.message}`);
        throw e;
      }

      // Generate referral link
      const referralLink = `${process.env.FRONTEND_URL || 'https://warmpawz.com'}/auth?ref=${referralCode}`;

      return c.json({
        success: true,
        stats: {
          referral_code: referralCode,
          referral_link: referralLink,
          total_referrals: parseInt(totalReferrals.rows[0]?.count || '0', 10),
          successful_signups: parseInt(successfulReferrals.rows[0]?.count || '0', 10),
          pending_signups: parseInt(pendingReferrals.rows[0]?.count || '0', 10),
          total_rewards_earned: parseFloat(walletRewards.rows[0]?.total_rewards || '0'),
          pending_rewards: parseFloat(pendingRewards.rows[0]?.pending_points || '0') / 100, // Convert points to rupees (assuming 100 points = 1 rupee)
        },
      });
    } catch (error: any) {
      console.error('Error fetching referral stats:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /referrals/list
   * Get referral list for authenticated customer
   */
  app.get("/referrals/list", requireCustomer(), async (c) => {
    try {
      const userId = c.get('userId');
      const isUAT = c.get('isUAT') === true;
      const phoneHeader = c.req.header('x-phone') || c.req.header('X-Phone');
      
      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // In UAT mode, use phone header if available
      let identifierToUse = userId;
      if ((isUAT || userId.startsWith('uat-')) && phoneHeader) {
        identifierToUse = phoneHeader;
      }

      // Resolve customer ID using helper function
      const customerId = await resolveCustomerIdFromAuth(identifierToUse);

      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Validate customerId is a valid UUID
      if (!isValidUUID(customerId)) {
        console.error(`[REFERRALS] Invalid customer ID format: ${customerId}`);
        return c.json({ error: 'Invalid customer ID format' }, 500);
      }

      // Ensure customerId is a string (UUID format)
      const customerIdStr = String(customerId);

      const limit = parseInt(c.req.query('limit') || '50', 10);

      const referrals = await query(
        `SELECT 
          cr.id,
          cr.referral_code,
          cr.referred_phone,
          cr.status,
          cr.applied_at,
          cr.approved_at,
          cr.created_at,
          c.id as referred_customer_id,
          c.full_name as referred_user_name,
          c.phone as referred_user_phone,
          (SELECT COALESCE(SUM(wt.amount), 0)
           FROM wallet_transactions wt
           JOIN customer_wallets cw ON wt.wallet_id = cw.id
           WHERE cw.customer_id = $1::uuid
           AND wt.reference_type = 'customer_referral'
           AND wt.reference_id = cr.id::text
           AND wt.transaction_type = 'credit') as reward_earned,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM wallet_transactions wt
              JOIN customer_wallets cw ON wt.wallet_id = cw.id
              WHERE cw.customer_id = CAST($1 AS uuid)
              AND wt.reference_type = 'customer_referral'
              AND wt.reference_id = cr.id::text
            ) THEN true
            ELSE false
          END as reward_paid
         FROM customer_referrals cr
         LEFT JOIN customers c ON cr.referred_customer_id = c.id
         WHERE cr.referrer_customer_id = $1::uuid
         ORDER BY cr.created_at DESC
         LIMIT $2`,
        [customerId, limit]
      );

      // Transform to match frontend expectations
      const referralsList = referrals.rows.map((r: any) => ({
        id: r.id,
        referred_user_id: r.referred_customer_id || null,
        referred_user_name: r.referred_user_name || 'Pending',
        referred_user_phone: r.referred_user_phone || r.referred_phone || 'N/A',
        status: r.status === 'approved' ? 'completed' : r.status === 'applied' ? 'pending' : 'pending',
        signup_date: r.applied_at || r.created_at,
        first_booking_date: r.approved_at || null,
        reward_earned: parseFloat(r.reward_earned || '0'),
        reward_paid: r.reward_paid || false,
        created_at: r.created_at,
      }));

      return c.json({
        success: true,
        referrals: referralsList,
      });
    } catch (error: any) {
      console.error('Error fetching referral list:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /referrals/rewards
   * Get reward history for authenticated customer
   */
  app.get("/referrals/rewards", requireCustomer(), async (c) => {
    try {
      const userId = c.get('userId');
      const isUAT = c.get('isUAT') === true;
      const phoneHeader = c.req.header('x-phone') || c.req.header('X-Phone');
      
      console.log(`[REFERRALS] /rewards endpoint called`);
      console.log(`[REFERRALS] userId: ${userId}, isUAT: ${isUAT}, phoneHeader: ${phoneHeader}`);
      
      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // In UAT mode, use phone header if available
      let identifierToUse = userId;
      if ((isUAT || userId.startsWith('uat-')) && phoneHeader) {
        console.log(`[REFERRALS] Using phone header for UAT mode: ${phoneHeader}`);
        identifierToUse = phoneHeader;
      }

      // Resolve customer ID using helper function
      const customerId = await resolveCustomerIdFromAuth(identifierToUse);

      if (!customerId) {
        console.error(`[REFERRALS] Customer not found for identifier: ${identifierToUse}`);
        return c.json({ error: 'Customer not found' }, 404);
      }
      
      // Validate customerId is a valid UUID
      if (!isValidUUID(customerId)) {
        console.error(`[REFERRALS] Invalid customer ID format: ${customerId}`);
        return c.json({ error: 'Invalid customer ID format' }, 500);
      }
      
      console.log(`[REFERRALS] Resolved customer ID: ${customerId}`);

      // Get wallet transactions for customer referrals
      const rewards = await query(
        `SELECT 
          wt.id,
          wt.reference_id as referral_id,
          wt.amount,
          wt.transaction_type,
          wt.description,
          wt.created_at as credited_at,
          CASE 
            WHEN wt.transaction_type = 'credit' THEN 'credited'
            ELSE 'pending'
          END as status,
          CASE
            WHEN wt.description LIKE '%signup%' OR wt.description LIKE '%registration%' THEN 'signup_bonus'
            WHEN wt.description LIKE '%booking%' THEN 'booking_bonus'
            ELSE 'referral_bonus'
          END as type
         FROM wallet_transactions wt
         JOIN customer_wallets cw ON wt.wallet_id = cw.id
         WHERE cw.customer_id = $1::uuid
         AND wt.reference_type = 'customer_referral'
         AND wt.transaction_type = 'credit'
         ORDER BY wt.created_at DESC
         LIMIT 100`,
        [customerId]
      );

      // Transform to match frontend expectations
      const rewardsList = rewards.rows.map((r: any) => ({
        id: r.id,
        referral_id: r.referral_id,
        amount: parseFloat(r.amount || '0'),
        type: r.type,
        status: r.status,
        credited_at: r.credited_at,
        expires_at: null, // Not implemented yet
      }));

      return c.json({
        success: true,
        rewards: rewardsList,
      });
    } catch (error: any) {
      console.error('Error fetching referral rewards:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // EXISTING ENDPOINTS: /customer/:customerId/referral/*
  // ============================================================================
  /**
   * GET /customer/:customerId/referral
   * Get or create referral code for customer
   */
  app.get("/customer/:customerId/referral", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Verify customer exists
      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Get or create referral code from customer_referrals
      let referrals = await query(
        `SELECT referral_code FROM customer_referrals 
         WHERE referrer_customer_id = $1::uuid 
         ORDER BY created_at ASC 
         LIMIT 1`,
        [customerId]
      );
      
      if (referrals.rows.length === 0) {
        // Generate new unique referral code
        let attempts = 0;
        let isUnique = false;
        let code: string = '';
        
        while (!isUnique && attempts < 10) {
          code = `CREF${customerId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          const checkUnique = await query(
            `SELECT id FROM customer_referrals WHERE referral_code = $1 LIMIT 1`,
            [code]
          );
          if (checkUnique.rows.length === 0) {
            isUnique = true;
          }
          attempts++;
        }
        
        if (!isUnique) {
          return c.json({ error: 'Failed to generate unique referral code. Please try again.' }, 500);
        }
        
        // Create referral record with status 'pending'
        const newReferral = await insert('customer_referrals', {
          referrer_customer_id: customerId,
          referral_code: code,
          referred_phone: '', // Will be set when code is sent
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        referrals = { rows: [{ referral_code: code }] };
      }

      return c.json({
        success: true,
        referralCode: referrals.rows[0].referral_code,
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
        `SELECT COUNT(*) as count FROM customer_referrals WHERE referrer_customer_id = $1::uuid`,
        [customerId]
      );

      // Get approved referrals (where referred customer completed first booking)
      const approvedReferrals = await query(
        `SELECT COUNT(*) as count
         FROM customer_referrals
         WHERE referrer_customer_id = $1::uuid AND status = 'approved'`,
        [customerId]
      );

      // Get pending referrals (code sent but not used)
      const pendingReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM customer_referrals 
         WHERE referrer_customer_id = $1::uuid AND status = 'pending'`,
        [customerId]
      );

      // Get applied referrals (code used but booking not completed)
      const appliedReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM customer_referrals 
         WHERE referrer_customer_id = $1::uuid AND status = 'applied'`,
        [customerId]
      );

      // Get total earnings from customer referrals
      const earnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = $1::uuid 
         AND lt.reference_type = 'customer_referral'
         AND lt.transaction_type = 'earned'`,
        [customerId]
      );

      // Get monthly stats
      const monthlyReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM customer_referrals 
         WHERE referrer_customer_id = $1::uuid 
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [customerId]
      );

      const monthlyEarnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
         FROM loyalty_transactions lt
         WHERE lt.customer_id = $1::uuid 
         AND lt.reference_type = 'customer_referral'
         AND lt.transaction_type = 'earned'
         AND lt.created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [customerId]
      );

      return c.json({
        success: true,
        totalReferrals: parseInt(totalReferrals.rows[0]?.count || '0', 10),
        approvedReferrals: parseInt(approvedReferrals.rows[0]?.count || '0', 10),
        pendingReferrals: parseInt(pendingReferrals.rows[0]?.count || '0', 10),
        appliedReferrals: parseInt(appliedReferrals.rows[0]?.count || '0', 10),
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
   * POST /customer/:customerId/referral/invite
   * Send referral code via SMS
   */
  app.post("/customer/:customerId/referral/invite", async (c) => {
    try {
      const { customerId } = c.req.param();
      const { phone, message } = await c.req.json();

      // Verify customer exists
      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }
      const customer = customers[0];

      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.length < 10) {
        return c.json({ error: 'Invalid phone number' }, 400);
      }
      const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;

      // Check if a referral record already exists for this phone number
      const existingForPhone = await query(
        `SELECT * FROM customer_referrals 
         WHERE referrer_customer_id = $1::uuid 
         AND referred_phone = $2 
         LIMIT 1`,
        [customerId, fullPhone]
      );

      let referralCode: string;
      let referralRecord: any;

      if (existingForPhone.rows.length > 0) {
        // Reuse existing record for this phone number
        referralRecord = existingForPhone.rows[0];
        referralCode = referralRecord.referral_code;
        console.log(`Reusing existing customer referral record ${referralRecord.id} for phone ${fullPhone}`);
      } else {
        // Get or create referral code for this customer
        const customerReferrals = await query(
          `SELECT referral_code FROM customer_referrals 
           WHERE referrer_customer_id = CAST($1 AS uuid) 
           ORDER BY created_at ASC 
           LIMIT 1`,
          [customerId]
        );

        if (customerReferrals.rows.length > 0) {
          // Use existing referral code for this customer
          referralCode = customerReferrals.rows[0].referral_code;
        } else {
          // Generate new unique referral code for this customer
          let attempts = 0;
          let isUnique = false;
          while (!isUnique && attempts < 10) {
            referralCode = `CREF${customerId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            const checkUnique = await query(
              `SELECT id FROM customer_referrals WHERE referral_code = $1 LIMIT 1`,
              [referralCode]
            );
            if (checkUnique.rows.length === 0) {
              isUnique = true;
            }
            attempts++;
          }
          if (!isUnique) {
            return c.json({ error: 'Failed to generate unique referral code. Please try again.' }, 500);
          }
        }

        // Create new referral record for this phone number
        const newReferral = await insert('customer_referrals', {
          referrer_customer_id: customerId,
          referral_code: referralCode,
          referred_phone: fullPhone,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        referralRecord = newReferral[0];
      }

      // Get customer details for personalized message
      const customerName = customer.full_name || customer.first_name || 'Warmpawz';

      // Create SMS message
      const smsMessage = message || 
        `🎉 Join Warmpawz! Use referral code ${referralCode} during registration to get started. Referred by ${customerName}. Download the app or visit warmpawz.com`;

      // Send SMS
      try {
        const smsResult = await sendSMS({
          to: fullPhone,
          message: smsMessage,
          type: 'transactional',
        });

        if (!smsResult.success) {
          console.error('Failed to send SMS:', smsResult);
          return c.json({ 
            error: 'Failed to send SMS. Please try again later.' 
          }, 500);
        }

        console.log(`✅ Customer referral SMS sent to ${fullPhone} with code ${referralCode}`);
      } catch (smsError: any) {
        console.error('Error sending referral SMS:', smsError);
        return c.json({ 
          error: 'Failed to send SMS. Please try again later.' 
        }, 500);
      }

      return c.json({
        success: true,
        message: 'Referral code sent successfully',
        referralCode,
        phone: fullPhone,
      });
    } catch (error: any) {
      console.error('Error sending customer referral invite:', error);
      const errorMessage = error?.message || error?.detail || String(error) || 'Service Unavailable';
      return c.json({ 
        error: errorMessage,
        details: error?.constraint ? `Database constraint violation: ${error.constraint}` : undefined,
      }, 500);
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
          cr.*,
          c.full_name as referee_name,
          c.phone as referee_phone,
          (SELECT COALESCE(SUM(lt.points), 0) 
           FROM loyalty_transactions lt 
           WHERE lt.customer_id = CAST($1 AS uuid) 
           AND lt.reference_type = 'customer_referral' 
           AND lt.reference_id = cr.id::text) as referrer_earnings
         FROM customer_referrals cr
         LEFT JOIN customers c ON cr.referred_customer_id = c.id
         WHERE cr.referrer_customer_id = $1::uuid
         ORDER BY cr.created_at DESC
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
         WHERE customer_id = $1::uuid AND reward_id = $2`,
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
          CASE 
            WHEN vr.status = 'approved' THEN
          (SELECT COALESCE(SUM(lt.points), 0) 
           FROM loyalty_transactions lt 
           WHERE lt.customer_id = CAST($1 AS uuid)
           AND lt.reference_type = 'vendor_referral' 
               AND lt.reference_id = vr.id)
            ELSE 0
          END as points_earned
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
         INNER JOIN vendor_referrals vr ON lt.reference_id = vr.id
         LEFT JOIN vendors v ON vr.referred_vendor_id = v.id
         WHERE lt.customer_id = CAST($1 AS uuid)
         AND lt.reference_type = 'vendor_referral'
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
         AND lt.reference_id = CAST($2 AS uuid)
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
          'vendor_refer_friend', 'referral_rewards', 'vendor', 'fixed', 500,
          NULL, 'recurring', 'Refer a friend who joins', true, 50, 'Friend must Onboard 1 End User and complete 1 booking'
        )
        ON CONFLICT (action_name) DO UPDATE SET
          points_value = 500,
          action_category = 'referral_rewards',
          user_type = 'vendor',
          points_type = 'fixed',
          frequency_type = 'recurring',
          description = 'Refer a friend who joins',
          is_active = true,
          priority = 50,
          updated_at = NOW()
      `);

      return c.json({ success: true, message: 'vendor_refer_friend rule created/updated with 500 points' });
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
    try {
      const { vendorId } = c.req.param();

      console.log(`[REFERRALS] Starting retroactive processing for vendor: ${vendorId}`);

      // Get all approved referrals without points
      const referrals = await query(
        `SELECT vr.*, v.phone as referred_vendor_phone, v.id as referred_vendor_id
         FROM vendor_referrals vr
         LEFT JOIN vendors v ON vr.referred_vendor_id = v.id
         WHERE vr.referrer_vendor_id = CAST($1 AS uuid)
         AND vr.status = 'approved'
         AND NOT EXISTS (
           SELECT 1 FROM loyalty_transactions lt
           WHERE lt.customer_id = vr.referrer_vendor_id
           AND lt.reference_type = 'vendor_referral'
           AND lt.reference_id = vr.id
         )
         ORDER BY vr.created_at DESC`,
        [vendorId]
      );

      const results = [];
      let totalPointsAwarded = 0;
      let totalWalletCredited = 0;

      for (const referral of referrals.rows) {
        try {
          if (!referral.referrer_vendor_id || !referral.id) {
            console.log(`[REFERRALS] Skipping referral ${referral.id} - missing referrer vendor ID`);
            results.push({
              referralId: referral.id,
              success: false,
              error: 'Missing referrer vendor ID',
            });
            continue;
          }

          // Check if points were already awarded
          const existingPoints = await query(
            `SELECT COUNT(*) as count FROM loyalty_transactions 
             WHERE customer_id = $1 
             AND reference_type = 'vendor_referral' 
             AND reference_id = $2`,
            [referral.referrer_vendor_id, referral.id]
          );
          
          if (parseInt(existingPoints.rows[0]?.count || '0') > 0) {
            results.push({
              referralId: referral.id,
              success: false,
              error: 'Points already awarded',
            });
            continue;
          }

          // Award points directly to referrer (bypassing the full referral processing)
          const { loyaltyPointsService } = await import('../lib/services/loyalty-points-service');
          const pointsResult = await loyaltyPointsService.awardPoints({
            vendorId: referral.referrer_vendor_id,
            actionName: 'vendor_refer_friend',
            referenceType: 'vendor_referral',
            referenceId: referral.id,
            description: `Vendor referral: Retroactive processing for approved referral ${referral.referral_code || referral.id}`,
          });

          const result = {
            success: true,
            referrerPoints: pointsResult.points,
            walletCredited: pointsResult.walletCredited,
          };

          if (result.success) {
            totalPointsAwarded += result.referrerPoints || 0;
            totalWalletCredited += (result.referrerPoints || 0) / 100; // 100 points = ₹1
            results.push({
              referralId: referral.id,
              success: true,
              points: result.referrerPoints,
              walletCredited: (result.referrerPoints || 0) / 100,
            });
            console.log(`[REFERRALS] ✅ Processed referral ${referral.id}: ${result.referrerPoints} points`);
          } else {
            const errorMsg = (result as any).error || 'Unknown error';
            results.push({
              referralId: referral.id,
              success: false,
              error: errorMsg,
            });
            console.log(`[REFERRALS] ❌ Failed to process referral ${referral.id}: ${errorMsg}`);
          }
        } catch (error: any) {
          console.error(`[REFERRALS] Error processing referral ${referral.id}:`, error);
          results.push({
            referralId: referral.id,
            success: false,
            error: error.message,
          });
        }
      }

      return c.json({
        success: true,
        message: `Processed ${results.length} referrals`,
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        totalPointsAwarded,
        totalWalletCredited: Math.round(totalWalletCredited * 100) / 100,
        results,
      });
    } catch (error: any) {
      console.error('Error in retroactive referral processing:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/referral/:referralId/process
   * Manually process a specific referral to award points
   */
  app.post("/vendor/:vendorId/referral/:referralId/process", async (c) => {
    try {
      const { vendorId, referralId } = c.req.param();

      console.log(`[REFERRALS] Processing specific referral: ${referralId} for vendor: ${vendorId}`);

      // Get the referral record
      const referralResult = await query(
        `SELECT * FROM vendor_referrals WHERE id = $1 AND referrer_vendor_id = $2`,
        [referralId, vendorId]
      );

      if (referralResult.rows.length === 0) {
        return c.json({ error: 'Referral not found' }, 404);
      }

      const referral = referralResult.rows[0];

      // CRITICAL: If referred_vendor_id is NULL, try to find it from vendor_identity
      // This fixes "Unknown Vendor" issue when processing referrals before admin approval
      let vendorIdToLink = referral.referred_vendor_id;
      if (!vendorIdToLink && referral.referred_phone) {
        console.log(`[REFERRALS] referred_vendor_id is NULL, trying to find from vendor_identity for phone: ${referral.referred_phone}`);
        const vendorIdentityResult = await query(
          `SELECT vendor_id FROM vendor_identity 
           WHERE phone LIKE $1 OR phone LIKE $2
           AND vendor_id IS NOT NULL
           ORDER BY updated_at DESC LIMIT 1`,
          [`%${referral.referred_phone}%`, `%${referral.referred_phone.slice(-10)}%`]
        );
        
        if (vendorIdentityResult.rows.length > 0 && vendorIdentityResult.rows[0].vendor_id) {
          vendorIdToLink = vendorIdentityResult.rows[0].vendor_id;
          console.log(`[REFERRALS] ✅ Found vendor_id ${vendorIdToLink} from vendor_identity`);
        } else {
          console.log(`[REFERRALS] ⚠️ No vendor_id found in vendor_identity - vendor may not be approved yet`);
        }
      }

      // Check if points were already awarded for THIS specific referral
      // Use CAST to ensure UUID comparison works correctly
      const existingPoints = await query(
        `SELECT COUNT(*) as count, COALESCE(SUM(points), 0) as total_points FROM loyalty_transactions 
         WHERE customer_id = CAST($1 AS uuid)
         AND reference_type = 'vendor_referral' 
         AND reference_id = CAST($2 AS uuid)`,
        [referral.referrer_vendor_id, referral.id]
      );

      const pointsCount = parseInt(existingPoints.rows[0]?.count || '0');
      const totalPoints = parseInt(existingPoints.rows[0]?.total_points || '0');
      console.log(`[REFERRALS] Checking points for referral ${referral.id}: found ${pointsCount} loyalty transactions, total ${totalPoints} points`);
      console.log(`[REFERRALS] Referrer vendor ID: ${referral.referrer_vendor_id}, Referral ID: ${referral.id}`);

      if (pointsCount > 0 && totalPoints > 0) {
        // Points already awarded - ALWAYS update status to approved
        // Try to extract vendor ID from the latest transaction description
        const latestTx = await query(
          `SELECT description FROM loyalty_transactions 
           WHERE customer_id = CAST($1 AS uuid)
           AND reference_type = 'vendor_referral' 
           AND reference_id = CAST($2 AS uuid)
           ORDER BY created_at DESC LIMIT 1`,
          [referral.referrer_vendor_id, referral.id]
        );
        
        let vendorIdToLink = null;
        if (latestTx.rows.length > 0) {
          const desc = latestTx.rows[0].description || '';
          // Extract vendor ID from description like "Admin approved vendor 5585e6f7-5633-417b-a7a2-314285c81a40"
          const match = desc.match(/vendor\s+([a-f0-9-]{36})/i);
          if (match && match[1]) {
            vendorIdToLink = match[1];
          }
        }
        
        // ALWAYS update status to approved, and vendor_id if we found it
        await query(
          `UPDATE vendor_referrals
           SET status = 'approved',
               referred_vendor_id = COALESCE($2, referred_vendor_id),
               approved_at = COALESCE(approved_at, NOW()),
               applied_at = COALESCE(applied_at, NOW()),
               updated_at = NOW()
           WHERE id = $1`,
          [referral.id, vendorIdToLink || referral.referred_vendor_id]
        );
        
        if (vendorIdToLink) {
          console.log(`[REFERRALS] ✅ Linked referral ${referral.id} to vendor ${vendorIdToLink} from transaction description`);
        } else {
          console.log(`[REFERRALS] ✅ Updated referral ${referral.id} status to approved (vendor_id not found in description)`);
        }
        
        return c.json({
          success: true,
          message: 'Points already awarded, status updated to approved',
          referralId: referral.id,
          points: totalPoints,
          walletCredited: totalPoints / 100,
          vendorIdLinked: vendorIdToLink || referral.referred_vendor_id || null,
        });
      }
      
      // If points count > 0 but total_points = 0, it means transaction exists but points = 0
      // This is an error case - we should still try to award points
      if (pointsCount > 0 && totalPoints === 0) {
        console.log(`[REFERRALS] ⚠️ Found ${pointsCount} loyalty transactions but total points = 0. This is an error. Will try to award points anyway.`);
      }

      console.log(`[REFERRALS] No points found - proceeding to award points...`);

      // Award points directly to referrer
      let pointsResult;
      try {
        const { loyaltyPointsService } = await import('../lib/services/loyalty-points-service');
        pointsResult = await loyaltyPointsService.awardPoints({
          vendorId: referral.referrer_vendor_id,
          actionName: 'vendor_refer_friend',
          referenceType: 'vendor_referral',
          referenceId: referral.id,
          description: `Vendor referral: ${referral.referral_code || referral.id}`,
        });
        console.log(`[REFERRALS] ✅ Awarded ${pointsResult.points} points`);
      } catch (pointsError: any) {
        console.error(`[REFERRALS] Error awarding points: ${pointsError.message}`);
        // If points award fails (e.g., schema issue), still try to update status if points already exist
        // Check if points were actually created despite the error
        const checkPoints = await query(
          `SELECT COUNT(*) as count, COALESCE(SUM(points), 0) as total FROM loyalty_transactions 
           WHERE customer_id = CAST($1 AS uuid)
           AND reference_type = 'vendor_referral' 
           AND reference_id = CAST($2 AS uuid)`,
          [referral.referrer_vendor_id, referral.id]
        );
        const actualPoints = parseInt(checkPoints.rows[0]?.total || '0');
        if (actualPoints > 0) {
          console.log(`[REFERRALS] Points exist despite error (${actualPoints}), will update status`);
          pointsResult = { points: actualPoints, walletCredited: actualPoints / 100 };
        } else {
          throw pointsError; // Re-throw if no points exist
        }
      }

      // CRITICAL: Always update referral status to approved after awarding points
      // Also update vendor_id if we found it from vendor_identity
      // This must happen even if wallet update failed
      await query(
        `UPDATE vendor_referrals
         SET status = 'approved',
             referred_vendor_id = COALESCE($2, referred_vendor_id),
             approved_at = COALESCE(approved_at, NOW()),
             applied_at = COALESCE(applied_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [referral.id, vendorIdToLink || referral.referred_vendor_id]
      );
      
      if (vendorIdToLink && !referral.referred_vendor_id) {
        console.log(`[REFERRALS] ✅ Linked referral ${referral.id} to vendor ${vendorIdToLink} from vendor_identity`);
      }

      console.log(`[REFERRALS] ✅ Updated referral ${referral.id} status to 'approved'`);

      return c.json({
        success: true,
        message: 'Referral processed successfully',
        referralId: referral.id,
        points: pointsResult.points,
        walletCredited: pointsResult.walletCredited,
      });
    } catch (error: any) {
      console.error('Error processing referral:', error);
      return c.json({ error: error.message, stack: error.stack }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/referral/convert-loyalty-to-wallet
   * Retroactively convert existing loyalty transactions to wallet balance
   * This fixes referrals where points were awarded but wallet conversion failed
   */
  app.post("/vendor/:vendorId/referral/convert-loyalty-to-wallet", async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[REFERRALS] Converting loyalty points to wallet for vendor: ${vendorId}`);

      // Get all loyalty transactions for vendor referrals
      // Use LEFT JOIN in case referral record doesn't exist
      const loyaltyTxns = await query(
        `SELECT lt.*, COALESCE(vr.referral_code, '') as referral_code
         FROM loyalty_transactions lt
         LEFT JOIN vendor_referrals vr ON lt.reference_id = vr.id
         WHERE lt.customer_id = $1
         AND lt.reference_type = 'vendor_referral'
         ORDER BY lt.created_at ASC`,
        [vendorId]
      );

      if (loyaltyTxns.rows.length === 0) {
        return c.json({
          success: true,
          message: 'No loyalty transactions found',
          converted: 0,
        });
      }

      const { query: queryFn, withTransaction, select, insert } = await import('../database/rds-connection');

      let totalConverted = 0;
      let totalWalletCredited = 0;
      const results = [];

      for (const txn of loyaltyTxns.rows) {
        try {
          const points = parseInt(txn.points || '0');
          if (points <= 0) continue;

          const walletAmount = Math.round((points / 100) * 100) / 100; // 100 points = ₹1

          // Check if wallet transaction already exists for this loyalty transaction
          const existingWalletTxn = await query(
            `SELECT COUNT(*) as count FROM wallet_transactions 
             WHERE customer_id = $1 
             AND (description LIKE $2 OR description LIKE $3)
             AND transaction_type = 'credit'`,
            [vendorId, `%${points} points%`, `%${txn.id}%`]
          );

          if (parseInt(existingWalletTxn.rows[0]?.count || '0') > 0) {
            console.log(`[REFERRALS] Skipping ${txn.id} - wallet transaction already exists`);
            continue; // Already converted
          }

          await withTransaction(async (txClient) => {
            // Get or create wallet using select/insert helpers
            let wallets = await select('customer_wallets', { customer_id: vendorId });
            
            if (wallets.length === 0) {
              await insert('customer_wallets', {
                customer_id: vendorId,
                balance: 0,
              });
              wallets = await select('customer_wallets', { customer_id: vendorId });
            }

            const wallet = wallets[0];

            // Credit wallet
            await txClient.query(
              `UPDATE customer_wallets
               SET balance = balance + $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [walletAmount, wallet.id]
            );

            // Get balance after
            const balanceAfter = await txClient.query(
              `SELECT balance FROM customer_wallets WHERE id = $1`,
              [wallet.id]
            );
            const newBalance = parseFloat(balanceAfter.rows[0]?.balance || '0');

            // Create wallet transaction
            try {
              await queryFn(
                `INSERT INTO wallet_transactions (customer_id, transaction_type, amount, balance_after, description)
                 VALUES ($1, 'credit', $2, $3, $4)`,
                [
                  vendorId,
                  walletAmount,
                  newBalance,
                  `Loyalty points converted: ${points} points = ₹${walletAmount.toFixed(2)} (100 points = ₹1) - Retroactive`
                ]
              );
            } catch (insertError: any) {
              console.error(`[REFERRALS] Error inserting wallet transaction: ${insertError.message}`);
            }

            totalConverted++;
            totalWalletCredited += walletAmount;
            results.push({
              loyaltyTransactionId: txn.id,
              points,
              walletCredited: walletAmount,
            });
          });
        } catch (error: any) {
          console.error(`[REFERRALS] Error converting transaction ${txn.id}:`, error);
          results.push({
            loyaltyTransactionId: txn.id,
            error: error.message,
          });
        }
      }

      return c.json({
        success: true,
        message: `Converted ${totalConverted} loyalty transactions to wallet`,
        converted: totalConverted,
        totalWalletCredited: Math.round(totalWalletCredited * 100) / 100,
        results,
      });
    } catch (error: any) {
      console.error('Error converting loyalty to wallet:', error);
      return c.json({ error: error.message, stack: error.stack }, 500);
    }
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

      // Look up customer by phone
      const customerResult = await query(
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

      // Get total earnings from referrals (only for completed referrals)
      const earnings = await query(
        `SELECT COALESCE(SUM(lt.points), 0) as total_earnings
         FROM loyalty_transactions lt
         INNER JOIN referrals r ON lt.reference_id = r.id
         WHERE lt.customer_id = $1 
         AND lt.reference_type = 'referral'
         AND lt.transaction_type = 'earned'
         AND EXISTS(SELECT 1 FROM bookings WHERE customer_id = r.referred_id)`,
        [customerId]
      );

      return c.json({
        success: true,
        stats: {
          referral_code: referralCode,
          total_referrals: parseInt(totalReferrals.rows[0]?.count || '0', 10),
          successful_referrals: parseInt(completedReferrals.rows[0]?.count || '0', 10),
          pending_referrals: parseInt(pendingReferrals.rows[0]?.count || '0', 10),
          total_rewards: parseInt(earnings.rows[0]?.total_earnings || '0', 10),
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
    try {
      const { customerId, referralId } = c.req.param();

      console.log(`[REFERRALS] Processing customer referral: ${referralId} for referrer: ${customerId}`);

      // Get the referral record
      const referralResult = await query(
        `SELECT * FROM referrals WHERE id = $1 AND referrer_id = $2`,
        [referralId, customerId]
      );

      if (referralResult.rows.length === 0) {
        return c.json({ error: 'Referral not found' }, 404);
      }

      const referral = referralResult.rows[0];

      // Check if referral was already used
      if (!referral.referred_id) {
        return c.json({ 
          error: 'Referral code has not been used yet',
          referral: referral
        }, 400);
      }

      // Check if points were already awarded for THIS specific referral
      const existingPoints = await query(
        `SELECT COUNT(*) as count, COALESCE(SUM(points), 0) as total_points FROM loyalty_transactions 
         WHERE customer_id = $1 
         AND reference_type = 'referral' 
         AND reference_id = $2`,
        [customerId, referralId]
      );

      const pointsCount = parseInt(existingPoints.rows[0]?.count || '0');
      const totalPoints = parseInt(existingPoints.rows[0]?.total_points || '0');
      console.log(`[REFERRALS] Checking points for referral ${referralId}: found ${pointsCount} loyalty transactions, total ${totalPoints} points`);

      if (pointsCount > 0 && totalPoints > 0) {
        // Points already awarded
        return c.json({
          success: true,
          message: 'Points already awarded',
          referralId: referral.id,
          points: totalPoints,
          walletCredited: totalPoints / 100,
        });
      }

      // Award points to referrer (via refer_friend rule)
      let referrerPoints = 0;
      try {
        const { loyaltyPointsService } = await import('../lib/services/loyalty-points-service');
        const referrerResult = await loyaltyPointsService.awardPoints({
          customerId: customerId,
          actionName: 'refer_friend',
          referenceType: 'referral',
          referenceId: referral.id,
          description: 'Referral reward for friend signup',
        });
        referrerPoints = referrerResult.points;
        console.log(`[REFERRALS] ✅ Awarded ${referrerPoints} points to referrer ${customerId}`);
      } catch (pointsError: any) {
        console.error(`[REFERRALS] ❌ Error awarding referral points: ${pointsError.message}`);
        return c.json({ 
          error: `Failed to award points: ${pointsError.message}`,
          referralId: referral.id
        }, 500);
      }

      return c.json({
        success: true,
        message: 'Referral processed successfully',
        referralId: referral.id,
        points: referrerPoints,
        walletCredited: referrerPoints / 100,
      });
    } catch (error: any) {
      console.error('Error processing customer referral:', error);
      return c.json({ error: error.message, stack: error.stack }, 500);
    }
  });
}

