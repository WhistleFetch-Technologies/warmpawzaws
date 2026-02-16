/**
 * ============================================================================
 * LOYALTY & REFERRALS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles loyalty points and referrals:
 * - Earn/redeem loyalty points
 * - Get loyalty profile
 * - Referral code management
 * - Transaction history
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, upsert, deleteRows } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerLoyaltyEndpoints(app: Hono) {
  /**
   * POST /loyalty/rules/init
   * Ensure default loyalty rules exist (idempotent)
   */
  app.post("/loyalty/rules/init", async (c) => {
    try {
      const existing = await query('SELECT id FROM loyalty_rules LIMIT 1').catch(() => ({ rows: [] }));
      if (!existing.rows || existing.rows.length === 0) {
        await insert('loyalty_rules', {
          rule_name: 'default_earn_rule',
          points_per_rupee: 1,
          redemption_rate: 1,
          min_redemption_points: 100,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).catch(() => null);
      }
      return c.json({ success: true, message: 'Loyalty rules initialized' });
    } catch (error: any) {
      console.error('Error initializing loyalty rules:', error);
      return c.json({ success: true, message: 'Loyalty rules init skipped' });
    }
  });

  /**
   * GET /loyalty/rules
   * List loyalty rules for admin UI
   */
  app.get("/loyalty/rules", async (c) => {
    try {
      const rules = await query(
        `SELECT * FROM loyalty_action_rules ORDER BY priority ASC, created_at ASC`
      ).catch(() => ({ rows: [] }));
      const rows = (rules as { rows: any[] }).rows || [];
      return c.json({
        success: true,
        rules: rows.map((r: any) => ({
          id: r.id,
          category: r.action_category || r.category || 'loyalty', // 'loyalty' or 'referral_rewards'
          userType: r.user_type || 'customer', // 'customer', 'vendor', or 'both'
          action: r.action_name,
          points: r.points_value ?? 0,
          type: (r.points_type === 'per_amount' ? 'percentage_spend' : r.points_type) || 'fixed', // Map per_amount to percentage_spend for frontend compatibility
          thresholdAmount: r.base_amount ?? r.threshold_amount,
          frequency: (r.frequency_type || r.frequency || 'one_time').replace('_', '-'),
          isActive: r.is_active !== false,
          description: r.description || '',
        })),
      });
    } catch (error: any) {
      console.error('Error fetching loyalty rules:', error);
      return c.json({ success: true, rules: [] });
    }
  });

  /**
   * PUT /loyalty/rules
   * Bulk update loyalty action rules (for admin UI)
   */
  app.put("/loyalty/rules", async (c) => {
    try {
      const { rules } = await c.req.json();
      
      if (!Array.isArray(rules)) {
        return c.json({ error: 'rules must be an array' }, 400);
      }

      // Update each rule
      for (const rule of rules) {
        if (!rule.id) {
          console.warn('Skipping rule without id:', rule);
          continue;
        }

        const updateData: any = {};
        if (rule.isActive !== undefined) updateData.is_active = rule.isActive;
        if (rule.points !== undefined) updateData.points_value = rule.points;
        // Note: category, userType, action, type, frequency are typically not updated via bulk endpoint
        // They are managed via the dedicated /admin/loyalty-action-rules endpoints

        if (Object.keys(updateData).length > 0) {
          await update('loyalty_action_rules', { id: rule.id }, updateData);
        }
      }

      return c.json({
        success: true,
        message: 'Loyalty rules updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating loyalty rules:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /loyalty/profile/:customerId
   * Get customer loyalty profile
   */
  app.get("/loyalty/profile/:customerId", async (c) => {
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

      // Get referral code
      const referrals = await select('referrals', { referrer_id: customerId });
      let referralCode = '';
      if (referrals.length > 0) {
        referralCode = referrals[0].referral_code;
      } else {
        // Generate new referral code
        const code = `REF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        await insert('referrals', {
          referrer_id: customerId,
          referral_code: code,
        });
        referralCode = code;
      }

      // Get transaction history
      const transactions = await query(
        `SELECT * FROM loyalty_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [customerId]
      );

      return c.json({
        success: true,
        profile: {
          customerId,
          pointsBalance: parseInt(profile[0]?.total_points || '0', 10), // Schema uses INTEGER, not NUMERIC
          totalPointsEarned: parseInt(profile[0]?.lifetime_points_earned || '0', 10),
          totalPointsRedeemed: parseInt(profile[0]?.lifetime_points_redeemed || '0', 10),
          referralCode,
          transactions: transactions.rows,
        },
      });
    } catch (error: any) {
      console.error('Error fetching loyalty profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /loyalty/earn
   * Earn loyalty points
   */
  app.post("/loyalty/earn", async (c) => {
    try {
      const { customerId, amount, referenceType, referenceId, description } = await c.req.json();

      if (!customerId || amount === undefined) {
        return c.json({ error: 'customerId and amount are required' }, 400);
      }

      // Get active loyalty rule
      const rules = await select('loyalty_rules', { is_active: true });
      if (rules.length === 0) {
        return c.json({ error: 'Loyalty points earning is not configured' }, 400);
      }

      const rule = rules[0];
      const points = Math.floor(amount * parseFloat(rule.points_per_rupee || '1'));

      if (points <= 0) {
        return c.json({ error: 'Amount too low to earn points' }, 400);
      }

      // Get or create profile
      let profile = await select('customer_loyalty_points', { customer_id: customerId });
      if (profile.length === 0) {
        profile = await insert('customer_loyalty_points', {
          customer_id: customerId,
          total_points: 0,
          lifetime_points_earned: 0,
          lifetime_points_redeemed: 0,
        });
      }

      // Create transaction
      await insert('loyalty_transactions', {
        customer_id: customerId,
        transaction_type: 'earned',
        points: points,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        description: description || `Earned ${points} points`,
      });

      // Update profile
      await query(
        `UPDATE customer_loyalty_points
         SET total_points = total_points + $1,
             lifetime_points_earned = lifetime_points_earned + $1
         WHERE customer_id = $2`,
        [points, customerId]
      );

      const updatedProfile = await select('customer_loyalty_points', { customer_id: customerId });

      return c.json({
        success: true,
        pointsEarned: points,
        totalPoints: parseInt(updatedProfile[0]?.total_points || '0', 10), // Schema uses INTEGER
        message: 'Points earned successfully',
      });
    } catch (error: any) {
      console.error('Error earning loyalty points:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /loyalty/redeem
   * Redeem loyalty points
   */
  app.post("/loyalty/redeem", async (c) => {
    try {
      const { customerId, points, referenceType, referenceId, description } = await c.req.json();

      if (!customerId || points === undefined) {
        return c.json({ error: 'customerId and points are required' }, 400);
      }

      // Get active loyalty rule
      const rules = await select('loyalty_rules', { is_active: true });
      if (rules.length === 0) {
        return c.json({ error: 'Loyalty points redemption is not configured' }, 400);
      }

      const rule = rules[0];
      const minRedemption = parseInt(rule.min_redemption_points || '100', 10);

      if (points < minRedemption) {
        return c.json({ error: `Minimum ${minRedemption} points required for redemption` }, 400);
      }

      // Check balance
      let profile = await select('customer_loyalty_points', { customer_id: customerId });
      if (profile.length === 0 || parseInt(profile[0]?.total_points || '0', 10) < points) {
        return c.json({ error: 'Insufficient loyalty points' }, 400);
      }

      // Create transaction
      await insert('loyalty_transactions', {
        customer_id: customerId,
        transaction_type: 'redeemed',
        points: -points,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        description: description || `Redeemed ${points} points`,
      });

      // Update profile
      await query(
        `UPDATE customer_loyalty_points
         SET total_points = total_points - $1,
             lifetime_points_redeemed = lifetime_points_redeemed + $1
         WHERE customer_id = $2`,
        [points, customerId]
      );

      const updatedProfile = await select('customer_loyalty_points', { customer_id: customerId });
      const cashValue = points / parseFloat(rule.redemption_rate || '100');

      return c.json({
        success: true,
        pointsRedeemed: points,
        cashValue,
        remainingPoints: parseInt(updatedProfile[0]?.total_points || '0', 10), // Schema uses INTEGER
        message: 'Points redeemed successfully',
      });
    } catch (error: any) {
      console.error('Error redeeming loyalty points:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /loyalty/transactions/:customerId
   * Get loyalty transaction history
   */
  app.get("/loyalty/transactions/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const transactions = await query(
        `SELECT * FROM loyalty_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [customerId, limit, offset]
      );

      return c.json({
        success: true,
        transactions: transactions.rows,
        total: transactions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching loyalty transactions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /referrals/apply
   * Apply referral code
   */
  app.post("/referrals/apply", async (c) => {
    try {
      const { customerId, referralCode } = await c.req.json();

      if (!customerId || !referralCode) {
        return c.json({ error: 'customerId and referralCode are required' }, 400);
      }

      // Find referral
      const referrals = await select('referrals', { referral_code: referralCode });
      if (referrals.length === 0) {
        return c.json({ error: 'Invalid referral code' }, 400);
      }

      const referral = referrals[0];

      // Check if customer is trying to use their own code
      if (referral.referrer_id === customerId) {
        return c.json({ error: 'Cannot use your own referral code' }, 400);
      }

      // Check if already used
      const existing = await query(
        'SELECT * FROM referrals WHERE referred_id = $1',
        [customerId]
      );

      if (existing.rows.length > 0) {
        return c.json({ error: 'Referral code already used' }, 400);
      }

      // Update referral
      await query(
        `UPDATE referrals
         SET referred_id = $1,
             referred_at = NOW()
         WHERE id = $2`,
        [customerId, referral.id]
      );

      // Award points to both referrer and referred (if configured)
      const rules = await select('loyalty_rules', { is_active: true });
      if (rules.length > 0) {
        const referralPoints = 100; // Default referral bonus
        // Award to referrer
        await query(
          `UPDATE customer_loyalty_points
           SET total_points = total_points + $1,
               lifetime_points_earned = lifetime_points_earned + $1
           WHERE customer_id = $2`,
          [referralPoints, referral.referrer_id]
        );
        // Award to referred
        await query(
          `UPDATE customer_loyalty_points
           SET total_points = total_points + $1,
               lifetime_points_earned = lifetime_points_earned + $1
           WHERE customer_id = $2`,
          [referralPoints, customerId]
        );
      }

      return c.json({
        success: true,
        message: 'Referral code applied successfully',
      });
    } catch (error: any) {
      console.error('Error applying referral code:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // ADMIN ENDPOINTS - LOYALTY MANAGEMENT
  // ============================================================================

  /**
   * GET /admin/loyalty/rules
   * Get all loyalty rules (admin)
   */
  app.get("/admin/loyalty/rules", async (c) => {
    try {
      const rules = await select('loyalty_rules', {});
      return c.json({
        success: true,
        rules: rules,
        total: rules.length,
      });
    } catch (error: any) {
      console.error('Error fetching loyalty rules:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/loyalty/rules
   * Create loyalty rule (admin)
   */
  app.post("/admin/loyalty/rules", async (c) => {
    try {
      const body = await c.req.json();
      const {
        name,
        description,
        points_per_rupee,
        redemption_rate,
        min_points_to_redeem,
        max_redemption_per_transaction,
        expiry_days,
        is_active = true,
      } = body;

      if (!name || points_per_rupee === undefined || redemption_rate === undefined) {
        return c.json({ error: 'name, points_per_rupee, and redemption_rate are required' }, 400);
      }

      const rule = await insert('loyalty_rules', {
        rule_name: name, // rule_name is NOT NULL, name is the alias
        name, // Also set name for consistency
        description,
        points_per_rupee,
        redemption_rate,
        min_points_to_redeem: min_points_to_redeem || 100,
        min_redemption_points: min_points_to_redeem || 100, // Also set legacy column
        max_redemption_per_transaction,
        expiry_days,
        is_active,
      });

      return c.json({
        success: true,
        rule: rule[0],
        message: 'Loyalty rule created successfully',
      });
    } catch (error: any) {
      console.error('Error creating loyalty rule:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/loyalty/rules/:id
   * Update loyalty rule (admin)
   */
  app.put("/admin/loyalty/rules/:id", async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();

      const updateData: any = {};
      if (body.name !== undefined) {
        updateData.name = body.name;
        updateData.rule_name = body.name; // rule_name is NOT NULL, keep it in sync
      }
      if (body.description !== undefined) updateData.description = body.description;
      if (body.points_per_rupee !== undefined) updateData.points_per_rupee = body.points_per_rupee;
      if (body.redemption_rate !== undefined) updateData.redemption_rate = body.redemption_rate;
      if (body.min_points_to_redeem !== undefined) {
        updateData.min_points_to_redeem = body.min_points_to_redeem;
        updateData.min_redemption_points = body.min_points_to_redeem; // Also update legacy column
      }
      if (body.max_redemption_per_transaction !== undefined) updateData.max_redemption_per_transaction = body.max_redemption_per_transaction;
      if (body.expiry_days !== undefined) updateData.expiry_days = body.expiry_days;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      await update('loyalty_rules', { id }, updateData);

      const updated = await select('loyalty_rules', { id });
      return c.json({
        success: true,
        rule: updated[0],
        message: 'Loyalty rule updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating loyalty rule:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /admin/loyalty/rules/:id
   * Delete loyalty rule (admin)
   */
  app.delete("/admin/loyalty/rules/:id", async (c) => {
    try {
      const { id } = c.req.param();

      await deleteRows('loyalty_rules', { id });

      return c.json({
        success: true,
        message: 'Loyalty rule deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting loyalty rule:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/loyalty/stats
   * Get loyalty program statistics (admin)
   */
  app.get("/admin/loyalty/stats", async (c) => {
    try {
      const [profiles, transactions] = await Promise.all([
        query('SELECT COUNT(*) as count, SUM(total_points) as total FROM customer_loyalty_points'),
        query(`
          SELECT 
            COUNT(*) FILTER (WHERE transaction_type = 'earned') as earned_count,
            COUNT(*) FILTER (WHERE transaction_type = 'redeemed') as redeemed_count,
            SUM(points) FILTER (WHERE transaction_type = 'earned') as total_earned,
            SUM(points) FILTER (WHERE transaction_type = 'redeemed') as total_redeemed
          FROM loyalty_transactions
        `),
      ]);

      const profileCount = parseInt(profiles.rows[0]?.count || '0', 10);
      const totalPoints = parseInt(profiles.rows[0]?.total || '0', 10);
      const totalEarned = parseInt(transactions.rows[0]?.total_earned || '0', 10);
      const totalRedeemed = parseInt(transactions.rows[0]?.total_redeemed || '0', 10);
      const activePoints = totalEarned - totalRedeemed;

      return c.json({
        success: true,
        stats: {
          totalCustomers: profileCount,
          totalPointsIssued: totalEarned,
          totalPointsRedeemed: totalRedeemed,
          activePoints: activePoints,
          averagePointsPerCustomer: profileCount > 0 ? Math.round(activePoints / profileCount) : 0,
        },
      });
    } catch (error: any) {
      console.error('Error fetching loyalty stats:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/loyalty/transactions
   * Get loyalty transactions (admin)
   */
  app.get("/admin/loyalty/transactions", async (c) => {
    const startTime = Date.now();
    try {
      const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100); // Cap at 100
      const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

      // Add query timeout protection
      const queryPromise = query(
        `SELECT 
          lt.*,
          c.full_name as customer_name
         FROM loyalty_transactions lt
         LEFT JOIN customers c ON lt.customer_id = c.id
         ORDER BY lt.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Race against timeout (40 seconds to leave buffer for Lambda)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Query timeout: Request took too long to process'));
        }, 40000);
      });

      const transactions = await Promise.race([queryPromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      if (duration > 5000) {
        console.warn(`[Loyalty] Slow query for /admin/loyalty/transactions: ${duration}ms`);
      }

      return c.json({
        success: true,
        transactions: transactions.rows || [],
        total: transactions.rows?.length || 0,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[Loyalty] Error fetching transactions after ${duration}ms:`, error);
      
      // Handle timeout errors with 503
      if (error?.message?.includes('timeout') || error?.message?.includes('Query exceeded')) {
        return c.json({ 
          error: 'Service temporarily unavailable. Please try again later.',
          message: error.message 
        }, 503);
      }
      
      // Handle database connection errors with 503
      if (error?.message?.includes('connection') || error?.message?.includes('ECONNREFUSED') || error?.message?.includes('ETIMEDOUT')) {
        return c.json({ 
          error: 'Database connection error. Please try again later.',
          message: error.message 
        }, 503);
      }
      
      // Handle table not found errors - return empty array instead of error
      // This prevents frontend infinite loops when table hasn't been created yet
      if (error?.message?.includes('does not exist') || error?.message?.includes('relation') || error?.code === '42P01') {
        console.warn('[Loyalty] Table not found, returning empty array:', error.message);
        return c.json({
          success: true,
          transactions: [],
          total: 0,
        }, 200);
      }
      
      // Generic error - return 500 but with safe message
      return c.json({ 
        error: 'Failed to fetch loyalty transactions',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while fetching transactions'
      }, 500);
    }
  });
}

