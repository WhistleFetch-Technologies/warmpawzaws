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
import type { PoolClient } from 'pg';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { select, insert, update, query, upsert, deleteRows, withTransaction } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { resolveMinRedemptionPointsFromRuleRow } from '../../../utils/loyalty-rule-fields';

async function walletTransactionsColumnSet(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wallet_transactions'`
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function customerWalletsColumnSetForRedeem(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'customer_wallets'`
  );
  return new Set(r.rows.map((x) => x.column_name));
}

/** Active basic loyalty rule for point → wallet redeem (same rules as POST /loyalty/redeem). */
async function loadActiveLoyaltyRedeemRule(): Promise<
  | { ok: true; rule: Record<string, any> }
  | { ok: false; error: string; status: number }
> {
  const rulesRes = await query(`SELECT * FROM loyalty_rules WHERE is_active = true`);
  const rules = rulesRes.rows || [];
  if (rules.length === 0) {
    return { ok: false, error: 'Loyalty redemption is not configured (no active loyalty_rules row)', status: 400 };
  }
  if (rules.length > 1) {
    return {
      ok: false,
      error: `Loyalty misconfigured: ${rules.length} active loyalty_rules rows; exactly one required`,
      status: 400,
    };
  }
  return { ok: true, rule: rules[0] as Record<string, any> };
}

/**
 * Redeem loyalty points → INR wallet (customer). Shared by POST /loyalty/redeem and customer-scoped route.
 */
export async function executeLoyaltyRedeemPointsToWallet(params: {
  customerId: string;
  points: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
}): Promise<
  | {
      ok: true;
      pointsRedeemed: number;
      cashValue: number;
      walletCredited: number;
      remainingPoints: number;
    }
  | { ok: false; error: string; status: number }
> {
  const { customerId, points } = params;
  if (!customerId || points === undefined || points === null) {
    return { ok: false, error: 'customerId and points are required', status: 400 };
  }
  const pts = parseInt(String(points), 10);
  if (Number.isNaN(pts) || pts < 1) {
    return { ok: false, error: 'points must be a positive integer', status: 400 };
  }

  const loaded = await loadActiveLoyaltyRedeemRule();
  if (!loaded.ok) {
    return { ok: false, error: loaded.error, status: loaded.status };
  }
  const rule = loaded.rule;
  const rr = parseFloat(String(rule.redemption_rate ?? ''));
  if (Number.isNaN(rr) || rr <= 0) {
    return { ok: false, error: 'Active loyalty_rules row has invalid redemption_rate', status: 500 };
  }
  const minRedemption = resolveMinRedemptionPointsFromRuleRow(rule);
  if (Number.isNaN(minRedemption) || minRedemption < 1) {
    return { ok: false, error: 'Active loyalty_rules row has invalid min redemption points', status: 500 };
  }
  if (pts < minRedemption) {
    return { ok: false, error: `Minimum ${minRedemption} points required for redemption`, status: 400 };
  }

  const cashValue = Math.round((pts / rr) * 100) / 100;
  if (!Number.isFinite(cashValue) || cashValue <= 0) {
    return { ok: false, error: 'Invalid redemption amount for given points', status: 400 };
  }

  const redeemDescription =
    params.description || `Redeemed ${pts} points`;

  try {
    const { remainingPoints, walletCredited } = await withTransaction(async (client) => {
      const prof = await client.query(
        `SELECT total_points FROM customer_loyalty_points WHERE customer_id = $1::uuid FOR UPDATE`,
        [customerId]
      );
      if (prof.rows.length === 0) {
        throw new Error('Loyalty profile not found');
      }
      const bal = parseInt(String(prof.rows[0].total_points ?? '0'), 10);
      if (bal < pts) {
        throw new Error('INSUFFICIENT_POINTS');
      }

      await client.query(
        `INSERT INTO loyalty_transactions
             (customer_id, transaction_type, points, reference_type, reference_id, description)
           VALUES ($1::uuid, 'redeemed', $2, $3, $4, $5)`,
        [customerId, -pts, params.referenceType || null, params.referenceId || null, redeemDescription]
      );

      await client.query(
        `UPDATE customer_loyalty_points
           SET total_points = COALESCE(total_points, 0) - $1,
               lifetime_points_redeemed = COALESCE(lifetime_points_redeemed, 0) + $1,
               updated_at = NOW()
           WHERE customer_id = $2::uuid`,
        [pts, customerId]
      );

      await client.query('SAVEPOINT sp_loyalty_redeem_cw');
      try {
        await client.query(
          `INSERT INTO customer_wallets (customer_id, balance, currency)
             VALUES ($1::uuid, 0, 'INR')
             ON CONFLICT (customer_id) DO NOTHING`,
          [customerId]
        );
        await client.query('RELEASE SAVEPOINT sp_loyalty_redeem_cw');
      } catch (cwInsErr: any) {
        await client.query('ROLLBACK TO SAVEPOINT sp_loyalty_redeem_cw');
        const msg = String(cwInsErr?.message || '');
        if (msg.includes('currency') || msg.includes('column')) {
          await client.query(
            `INSERT INTO customer_wallets (customer_id, balance)
               VALUES ($1::uuid, 0)
               ON CONFLICT (customer_id) DO NOTHING`,
            [customerId]
          );
        } else {
          throw cwInsErr;
        }
      }
      await client.query(`SELECT id FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`, [customerId]);

      const cwCols = await customerWalletsColumnSetForRedeem(client);
      const cwSetBal = cwCols.has('updated_at')
        ? 'SET balance = balance + $1::numeric, updated_at = NOW()'
        : 'SET balance = balance + $1::numeric';
      const wup = await client.query(
        `UPDATE customer_wallets ${cwSetBal}
           WHERE customer_id = $2::uuid RETURNING id, balance::text`,
        [cashValue, customerId]
      );
      const walletRow = wup.rows[0] as { id: string; balance: string };
      const newBal = parseFloat(String(walletRow?.balance ?? '0')) || 0;

      const wtxnDesc = `Loyalty redeem: ${pts} points → ₹${cashValue.toFixed(2)} (${rr} pts = ₹1)`;
      const wtCols = await walletTransactionsColumnSet(client);
      const hasWtCustomerId = wtCols.has('customer_id');
      const hasWtWalletId = wtCols.has('wallet_id');
      const hasWtSource = wtCols.has('source');
      if (!hasWtCustomerId && !hasWtWalletId) {
        throw new Error('wallet_transactions has neither wallet_id nor customer_id');
      }

      const insertCols: string[] = [];
      const insertParams: unknown[] = [];
      if (hasWtWalletId) {
        insertCols.push('wallet_id');
        insertParams.push(walletRow.id);
      }
      if (hasWtCustomerId) {
        insertCols.push('customer_id');
        insertParams.push(customerId);
      }
      insertCols.push('transaction_type', 'amount', 'balance_after', 'description');
      insertParams.push('credit', cashValue, newBal, wtxnDesc);
      if (hasWtSource) {
        insertCols.push('source');
        insertParams.push('loyalty_redeem');
      }
      const ph = insertCols.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO wallet_transactions (${insertCols.join(', ')}) VALUES (${ph})`,
        insertParams as any[]
      );

      await client
        .query(
          `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + $1::numeric WHERE id = $2::uuid`,
          [cashValue, customerId]
        )
        .catch(() => null);

      const after = await client.query(
        `SELECT total_points FROM customer_loyalty_points WHERE customer_id = $1::uuid`,
        [customerId]
      );
      return {
        remainingPoints: parseInt(String(after.rows[0]?.total_points ?? '0'), 10),
        walletCredited: cashValue,
      };
    });

    return {
      ok: true,
      pointsRedeemed: pts,
      cashValue,
      walletCredited,
      remainingPoints,
    };
  } catch (error: any) {
    console.error('executeLoyaltyRedeemPointsToWallet:', error);
    if (error?.message === 'INSUFFICIENT_POINTS') {
      return { ok: false, error: 'Insufficient loyalty points', status: 400 };
    }
    if (error?.message === 'Loyalty profile not found') {
      return { ok: false, error: 'Loyalty profile not found', status: 404 };
    }
    return { ok: false, error: error?.message || 'Redeem failed', status: 500 };
  }
}

export function registerLoyaltyEndpoints(app: Hono) {
  /**
   * POST /loyalty/rules/init
   * Ensure default loyalty rules exist (idempotent)
   */
  app.post("/loyalty/rules/init", async (c) => {
    try {
      // Initialize old loyalty_rules table
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

      // Initialize loyalty_action_rules (new system)
      const { loyaltyRulesInitService } = await import('../../../lib/services/loyalty-rules-init-service');
      await loyaltyRulesInitService.initializeReferralRules();
      await loyaltyRulesInitService.initializeVendorReferralRules();

      return c.json({ success: true, message: 'Loyalty rules initialized (including vendor referral rules)' });
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
          category: r.action_category || r.category || 'loyalty',
          action: r.action_name,
          points: r.points_value ?? 0,
          type: r.points_type || 'fixed',
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
   * Deprecated: customer earning is only via action_sources → ActionOccurred → loyalty-events-consumer.
   */
  app.post("/loyalty/earn", async (c) => {
    return c.json(
      {
        success: false,
        error:
          'Customer point earning is not available on this endpoint. Configure action_sources and use the loyalty events pipeline.',
        code: 'USE_ACTION_SOURCE',
      },
      410
    );
  });

  /**
   * POST /loyalty/redeem
   * Redeem loyalty points → wallet (same rules as customer app “Redeem to Wallet”).
   */
  app.post("/loyalty/redeem", async (c) => {
    try {
      const { customerId, points, referenceType, referenceId, description } = await c.req.json();
      const result = await executeLoyaltyRedeemPointsToWallet({
        customerId,
        points,
        referenceType,
        referenceId,
        description,
      });
      if (!result.ok) {
        return c.json({ error: result.error }, result.status as ContentfulStatusCode);
      }
      return c.json({
        success: true,
        pointsRedeemed: result.pointsRedeemed,
        cashValue: result.cashValue,
        walletCredited: result.walletCredited,
        remainingPoints: result.remainingPoints,
        message: 'Points redeemed and credited to wallet successfully',
      });
    } catch (error: any) {
      console.error('Error redeeming loyalty points:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/loyalty/wallet-redeem-policy
   * Basic rules for “Redeem points to wallet” (redemption_rate, min from admin min_points_to_redeem or legacy min_redemption_points).
   */
  app.get("/customer/:customerId/loyalty/wallet-redeem-policy", async (c) => {
    try {
      const { customerId } = c.req.param();
      if (!isValidUUID(customerId)) {
        return c.json({ error: 'Invalid customerId' }, 400);
      }
      const loaded = await loadActiveLoyaltyRedeemRule();
      if (!loaded.ok) {
        return c.json({ success: false, error: loaded.error }, loaded.status as ContentfulStatusCode);
      }
      const rule = loaded.rule;
      const rr = parseFloat(String(rule.redemption_rate ?? ''));
      if (Number.isNaN(rr) || rr <= 0) {
        return c.json({ success: false, error: 'Active loyalty_rules row has invalid redemption_rate' }, 500);
      }
      const minRedemptionPoints = resolveMinRedemptionPointsFromRuleRow(rule);
      if (Number.isNaN(minRedemptionPoints) || minRedemptionPoints < 1) {
        return c.json({ success: false, error: 'Active loyalty_rules row has invalid min redemption points' }, 500);
      }
      const rupeesPerPoint = Math.round((1 / rr) * 10000) / 10000;
      return c.json({
        success: true,
        customerId,
        redemptionRatePointsPerRupee: rr,
        minRedemptionPoints,
        /** Human-readable: ₹ per 1 point (admin “redemption_rate” = points per ₹1). */
        rupeesPerPoint,
        labelPointsToRupee: `1 point = ₹${rupeesPerPoint.toFixed(2)}`,
        labelMinPoints: `Min redemption points required: ${minRedemptionPoints}`,
      });
    } catch (error: any) {
      console.error('wallet-redeem-policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/:customerId/loyalty/redeem-to-wallet
   * Body: { points, description?, referenceType?, referenceId? }
   */
  app.post("/customer/:customerId/loyalty/redeem-to-wallet", async (c) => {
    try {
      const { customerId } = c.req.param();
      if (!isValidUUID(customerId)) {
        return c.json({ error: 'Invalid customerId' }, 400);
      }
      const body = await c.req.json().catch(() => ({}));
      const points = body.points;
      const result = await executeLoyaltyRedeemPointsToWallet({
        customerId,
        points,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        description: body.description,
      });
      if (!result.ok) {
        return c.json({ success: false, error: result.error }, result.status as ContentfulStatusCode);
      }
      return c.json({
        success: true,
        pointsRedeemed: result.pointsRedeemed,
        cashValue: result.cashValue,
        walletCredited: result.walletCredited,
        remainingPoints: result.remainingPoints,
        message: 'Points redeemed and credited to wallet successfully',
      });
    } catch (error: any) {
      console.error('redeem-to-wallet:', error);
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
      const body = await c.req.json();
      const customerId = body.customerId || body.newUserId;
      const referralCode = body.referralCode || body.pendingReferralCode;

      if (!customerId || !referralCode) {
        return c.json({ error: 'customerId (or newUserId) and referralCode are required' }, 400);
      }

      const normalizedCode = String(referralCode).trim().toUpperCase();
      const customers = await select('customers', { id: customerId });
      const phoneFromRow = String(customers[0]?.phone || '').replace(/\D/g, '').slice(-10);
      const phoneFromBody = String(body.phone || '').replace(/\D/g, '').slice(-10);
      const phoneDigits = phoneFromRow.length >= 10 ? phoneFromRow : phoneFromBody;

      const {
        processReferralSignup,
        processVendorReferralForCustomerSignup,
      } = await import('../../../lib/services/referral-service');

      const referralResult = await processReferralSignup({
        customerId,
        referralCode: normalizedCode,
        phone: phoneDigits,
      });

      if (referralResult.success) {
        return c.json({
          success: true,
          message: 'Referral code applied successfully',
          referredPoints: referralResult.referredPoints,
          referrerPoints: referralResult.referrerPoints,
        });
      }

      if (referralResult.error === 'Invalid referral code') {
        if (phoneDigits.length < 10) {
          return c.json(
            { error: 'Customer phone on file is required to apply this referral code' },
            400
          );
        }
        const vendorRes = await processVendorReferralForCustomerSignup({
          customerId,
          phone: phoneDigits,
          referralCode: normalizedCode,
        });
        if (vendorRes.success) {
          return c.json({
            success: true,
            message: 'Vendor referral code applied successfully',
            referredPoints: vendorRes.referredPoints,
            referrerPoints: vendorRes.referrerPoints,
          });
        }
        return c.json(
          { error: vendorRes.error || referralResult.error || 'Invalid referral code' },
          400
        );
      }

      return c.json(
        { error: referralResult.error || 'Failed to process referral code' },
        400
      );
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
        name,
        description,
        points_per_rupee,
        redemption_rate,
        min_points_to_redeem: min_points_to_redeem || 100,
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
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.points_per_rupee !== undefined) updateData.points_per_rupee = body.points_per_rupee;
      if (body.redemption_rate !== undefined) updateData.redemption_rate = body.redemption_rate;
      if (body.min_points_to_redeem !== undefined) updateData.min_points_to_redeem = body.min_points_to_redeem;
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

