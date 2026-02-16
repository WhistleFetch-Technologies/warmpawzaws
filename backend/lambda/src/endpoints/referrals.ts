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
}

