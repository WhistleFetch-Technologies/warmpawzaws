/**
 * ============================================================================
 * TIER SYSTEM ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor tier management:
 * - Get vendor tier with commission details
 * - Upgrade/downgrade tier with payment options:
 *   1. Direct payment via Razorpay
 *   2. Deduction from first N settlements
 * - Tier-based commission calculation
 * - Tier eligibility checking
 * - Settlement breakup with clear explanations
 * 
 * Migrated from: supabase/functions/server/tier-system.tsx
 * 
 * Date: 2025-01-28
 * Updated: 2026-01-27 - Added tier upgrade payment flow and settlement deductions
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query, insert } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// Default tier configuration (fallback if DB tiers not available)
const TIER_CONFIG = {
  Bronze: { commission: 15.0, minBookings: 0, minRevenue: 0, monthlyFee: 0, yearlyFee: 0 },
  Silver: { commission: 12.0, minBookings: 50, minRevenue: 50000, monthlyFee: 999, yearlyFee: 9990 },
  Gold: { commission: 10.0, minBookings: 200, minRevenue: 200000, monthlyFee: 2499, yearlyFee: 24990 },
  Platinum: { commission: 8.0, minBookings: 500, minRevenue: 500000, monthlyFee: 4999, yearlyFee: 49990 },
};

// Number of settlements to spread tier upgrade deduction
const DEFAULT_DEDUCTION_INSTALLMENTS = 2;

export function registerTierSystemEndpoints(app: Hono) {
  /**
   * GET /admin/tiers/list
   * List all vendor tiers from database (debug endpoint)
   */
  app.get("/admin/tiers/list", async (c) => {
    try {
      const result = await query('SELECT * FROM vendor_tiers ORDER BY tier_level ASC').catch(() => ({ rows: [] }));
      const rows = Array.isArray(result) ? result : result.rows || [];
      return c.json({ success: true, tiers: rows, count: rows.length });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/tiers/seed
   * Seed default tier data (if missing)
   */
  app.post("/admin/tiers/seed", async (c) => {
    try {
      console.log('🌱 Seeding vendor tiers...');
      
      // First, check what columns exist
      const columnsResult = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'vendor_tiers'
      `).catch(() => ({ rows: [] }));
      const columnsRows = Array.isArray(columnsResult) ? columnsResult : columnsResult.rows || [];
      const columns = columnsRows.map((r: any) => r.column_name);
      console.log('Existing columns:', columns);
      
      // Use correct column names based on existing schema
      // Columns: tier_name, tier_level, display_name, description, commission_rate, monthly_cost, yearly_cost, is_free_tier, is_active, is_default
      
      const tiers = [
        { tier_name: 'Bronze', display_name: 'Bronze', tier_level: 1, commission_rate: 15, monthly_cost: 0, yearly_cost: 0, is_free_tier: true, is_active: true, is_default: true },
        { tier_name: 'Silver', display_name: 'Silver', tier_level: 2, commission_rate: 12, monthly_cost: 999, yearly_cost: 9990, is_free_tier: false, is_active: true, is_default: false },
        { tier_name: 'Gold', display_name: 'Gold', tier_level: 3, commission_rate: 10, monthly_cost: 2499, yearly_cost: 24990, is_free_tier: false, is_active: true, is_default: false },
        { tier_name: 'Platinum', display_name: 'Platinum', tier_level: 4, commission_rate: 8, monthly_cost: 4999, yearly_cost: 49990, is_free_tier: false, is_active: true, is_default: false },
      ];

      const results: any[] = [];
      for (const tier of tiers) {
        try {
          // Try to insert, or update if exists
          const existing = await query('SELECT id FROM vendor_tiers WHERE tier_name = $1', [tier.tier_name]).catch(() => ({ rows: [] }));
          const existingRows = Array.isArray(existing) ? existing : existing.rows || [];
          
          if (existingRows.length > 0) {
            // Update existing
            await query(
              `UPDATE vendor_tiers SET 
                display_name = $1, tier_level = $2, commission_rate = $3, monthly_cost = $4, yearly_cost = $5,
                is_free_tier = $6, is_active = $7, updated_at = NOW()
               WHERE tier_name = $8`,
              [tier.display_name, tier.tier_level, tier.commission_rate, tier.monthly_cost, tier.yearly_cost,
               tier.is_free_tier, tier.is_active, tier.tier_name]
            );
            results.push({ tier_name: tier.tier_name, action: 'updated' });
          } else {
            // Insert new
            await insert('vendor_tiers', tier);
            results.push({ tier_name: tier.tier_name, action: 'inserted' });
          }
        } catch (err: any) {
          results.push({ tier_name: tier.tier_name, action: 'error', error: err.message });
        }
      }

      // Verify
      const verifyResult = await query('SELECT tier_name FROM vendor_tiers ORDER BY tier_level').catch(() => ({ rows: [] }));
      const verifyRows = Array.isArray(verifyResult) ? verifyResult : verifyResult.rows || [];

      return c.json({
        success: true,
        message: 'Tiers seeded successfully',
        results,
        tiersInDb: verifyRows.map((r: any) => r.tier_name),
        columnsFound: columns,
      });
    } catch (error: any) {
      console.error('Error seeding tiers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/tier
   * Get vendor tier information
   */
  app.get("/vendor/:vendorId/tier", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      const currentTier = vendor.tier || 'Bronze';

      // Get vendor stats
      const bookings = await query(
        `SELECT COUNT(*) as count, SUM(total_amount) as revenue 
         FROM bookings 
         WHERE vendor_id = $1 AND status = 'completed'`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: '0', revenue: '0' }] }));

      const totalBookings = parseInt(bookings.rows[0]?.count || '0', 10);
      const totalRevenue = parseFloat(bookings.rows[0]?.revenue || '0');

      // Check eligibility for next tier
      const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
      const currentTierIndex = tiers.indexOf(currentTier);
      const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;

      let nextTierEligible = false;
      let nextTierProgress = { bookings: 0, revenue: 0 };

      if (nextTier) {
        const nextTierConfig = TIER_CONFIG[nextTier as keyof typeof TIER_CONFIG];
        nextTierEligible = totalBookings >= nextTierConfig.minBookings && totalRevenue >= nextTierConfig.minRevenue;
        nextTierProgress = {
          bookings: Math.min(100, (totalBookings / nextTierConfig.minBookings) * 100),
          revenue: Math.min(100, (totalRevenue / nextTierConfig.minRevenue) * 100),
        };
      }

      return c.json({
        success: true,
        tier: {
          current: currentTier,
          commission: TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].commission,
          stats: {
            totalBookings,
            totalRevenue,
          },
          nextTier: nextTier ? {
            name: nextTier,
            eligible: nextTierEligible,
            requirements: TIER_CONFIG[nextTier as keyof typeof TIER_CONFIG],
            progress: nextTierProgress,
          } : null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching vendor tier:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tier/upgrade
   * Upgrade vendor tier with payment options:
   * - paymentMethod: 'upfront' (pay via Razorpay) OR 'settlement_deduction' (deduct from earnings)
   * - subscriptionPeriod: 'monthly', 'six_month', 'twelve_month', 'yearly'
   */
  app.post("/vendor/:vendorId/tier/upgrade", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { 
        newTier, 
        paymentMethod = 'settlement_deduction', // 'upfront' or 'settlement_deduction'
        subscriptionPeriod = 'monthly',
        razorpayPaymentId, // Required if paymentMethod is 'upfront'
        razorpayOrderId,
        adminId 
      } = await c.req.json();

      console.log(`🎯 [TIER-UPGRADE] Vendor ${vendorId} upgrading to ${newTier} via ${paymentMethod}`);

      if (!newTier || !['Bronze', 'Silver', 'Gold', 'Platinum'].includes(newTier)) {
        return c.json({ error: 'Invalid tier. Must be Bronze, Silver, Gold, or Platinum' }, 400);
      }

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      const oldTier = vendor.tier || 'Bronze';

      // Get tier details from database
      const tierResult = await query(
        `SELECT * FROM vendor_tiers WHERE tier_name = $1`,
        [newTier]
      ).catch(() => ({ rows: [] }));

      const tierRows = Array.isArray(tierResult) ? tierResult : tierResult.rows || [];
      
      // If tier not found in DB, we cannot proceed without a tier_id
      if (tierRows.length === 0) {
        console.error(`[TIER-UPGRADE] Tier ${newTier} not found in vendor_tiers table`);
        return c.json({ 
          error: `Tier ${newTier} not configured in database. Please run migration to populate vendor_tiers.` 
        }, 400);
      }
      
      const tierInfo = tierRows[0];

      // Calculate subscription cost
      const tierFee = subscriptionPeriod === 'yearly' || subscriptionPeriod === 'twelve_month'
        ? parseFloat(tierInfo.yearly_cost || tierInfo.twelve_month_cost || '0')
        : subscriptionPeriod === 'six_month'
          ? parseFloat(tierInfo.six_month_cost || (tierInfo.monthly_cost * 5.5) || '0')
          : parseFloat(tierInfo.monthly_cost || '0');

      // Bronze is always free
      if (newTier === 'Bronze') {
        // Just update tier to Bronze (free tier)
        const updated = await update('vendors',
          { id: vendorId },
          {
            tier: newTier,
            commission_percentage: TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].commission,
          }
        );

        return c.json({
          success: true,
          vendor: updated[0],
          message: `Vendor tier set to Bronze (free tier)`,
          tierFee: 0,
        });
      }

      // Handle paid tier upgrade
      if (tierFee > 0) {
        if (paymentMethod === 'upfront') {
          // Verify Razorpay payment
          if (!razorpayPaymentId) {
            return c.json({ error: 'Razorpay payment ID required for upfront payment' }, 400);
          }

          // Verify payment (simplified - in production, verify signature)
          console.log(`✅ [TIER-UPGRADE] Verifying upfront payment: ${razorpayPaymentId}`);
          
          // Create subscription record
          const subscriptionEndDate = new Date();
          if (subscriptionPeriod === 'yearly' || subscriptionPeriod === 'twelve_month') {
            subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
          } else if (subscriptionPeriod === 'six_month') {
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 6);
          } else {
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
          }

          const subscription = await insert('vendor_tier_subscriptions', {
            vendor_id: vendorId,
            tier_id: tierInfo.id,
            subscription_type: subscriptionPeriod,
            payment_type: 'upfront',
            payment_method: 'upfront',
            total_amount: tierFee,
            discount_amount: 0,
            final_amount: tierFee,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
            end_date: subscriptionEndDate.toISOString().split('T')[0],
          });

          // Record payment
          await insert('tier_upgrade_payments', {
            vendor_id: vendorId,
            subscription_id: subscription[0]?.id,
            tier_id: tierInfo.id,
            payment_type: 'upfront',
            amount: tierFee,
            payment_status: 'completed',
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            payment_date: new Date().toISOString(),
          });

        } else if (paymentMethod === 'settlement_deduction') {
          // Create deduction to be recovered from settlements
          console.log(`📉 [TIER-UPGRADE] Creating settlement deduction for ₹${tierFee} over ${DEFAULT_DEDUCTION_INSTALLMENTS} payouts`);

          const amountPerInstallment = Math.ceil(tierFee / DEFAULT_DEDUCTION_INSTALLMENTS);

          // Create subscription record
          const subscriptionEndDate = new Date();
          if (subscriptionPeriod === 'yearly' || subscriptionPeriod === 'twelve_month') {
            subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
          } else if (subscriptionPeriod === 'six_month') {
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 6);
          } else {
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
          }

          const subscription = await insert('vendor_tier_subscriptions', {
            vendor_id: vendorId,
            tier_id: tierInfo.id,
            subscription_type: subscriptionPeriod,
            payment_type: 'split',
            payment_method: 'settlement_deduction',
            total_amount: tierFee,
            discount_amount: 0,
            final_amount: tierFee,
            settlement_deduction_installments: DEFAULT_DEDUCTION_INSTALLMENTS,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
            end_date: subscriptionEndDate.toISOString().split('T')[0],
          });

          // Create deduction record to be processed during settlements
          await insert('tier_upgrade_deductions', {
            vendor_id: vendorId,
            subscription_id: subscription[0]?.id,
            tier_id: tierInfo.id,
            total_amount: tierFee,
            recovery_installments: DEFAULT_DEDUCTION_INSTALLMENTS,
            amount_per_installment: amountPerInstallment,
            amount_remaining: tierFee,
            status: 'pending',
          });

          console.log(`✅ [TIER-UPGRADE] Deduction created: ₹${amountPerInstallment} x ${DEFAULT_DEDUCTION_INSTALLMENTS} payouts`);
        }
      }

      // Update vendor tier
      const updated = await update('vendors',
        { id: vendorId },
        {
          tier: newTier,
          commission_percentage: parseFloat(tierInfo.commission_rate) || TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].commission,
          metadata: {
            ...(vendor.metadata || {}),
            tierHistory: [
              ...((vendor.metadata as any)?.tierHistory || []),
              {
                from: oldTier,
                to: newTier,
                upgradedAt: new Date().toISOString(),
                upgradedBy: adminId || 'self',
                paymentMethod,
                tierFee,
              },
            ],
          },
        }
      );

      return c.json({
        success: true,
        vendor: updated[0],
        message: `Vendor tier upgraded from ${oldTier} to ${newTier}`,
        tierFee,
        paymentMethod,
        deductionInfo: paymentMethod === 'settlement_deduction' ? {
          totalAmount: tierFee,
          installments: DEFAULT_DEDUCTION_INSTALLMENTS,
          amountPerPayout: Math.ceil(tierFee / DEFAULT_DEDUCTION_INSTALLMENTS),
          note: `₹${Math.ceil(tierFee / DEFAULT_DEDUCTION_INSTALLMENTS)} will be deducted from your next ${DEFAULT_DEDUCTION_INSTALLMENTS} settlements`,
        } : null,
      });
    } catch (error: any) {
      console.error('Error upgrading vendor tier:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/tier/deductions
   * Get pending tier upgrade deductions for a vendor
   */
  app.get("/vendor/:vendorId/tier/deductions", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const deductions = await query(
        `SELECT d.*, t.tier_name, t.commission_rate 
         FROM tier_upgrade_deductions d
         LEFT JOIN vendor_tiers t ON d.tier_id = t.id
         WHERE d.vendor_id = $1 AND d.status IN ('pending', 'in_progress')
         ORDER BY d.created_at DESC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      const deductionRows = Array.isArray(deductions) ? deductions : deductions.rows || [];

      const totalPendingDeduction = deductionRows.reduce(
        (sum: number, d: any) => sum + parseFloat(d.amount_remaining || '0'), 0
      );

      return c.json({
        success: true,
        deductions: deductionRows.map((d: any) => ({
          id: d.id,
          tierName: d.tier_name,
          totalAmount: parseFloat(d.total_amount),
          amountRecovered: parseFloat(d.amount_recovered),
          amountRemaining: parseFloat(d.amount_remaining),
          installmentsTotal: d.recovery_installments,
          installmentsCompleted: d.installments_completed,
          amountPerInstallment: parseFloat(d.amount_per_installment),
          status: d.status,
          createdAt: d.created_at,
        })),
        summary: {
          totalPendingDeduction,
          message: totalPendingDeduction > 0 
            ? `₹${totalPendingDeduction} will be deducted from upcoming settlements for tier upgrade`
            : 'No pending tier deductions',
        },
      });
    } catch (error: any) {
      console.error('Error fetching tier deductions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/tiers/config
   * Get tier configuration
   */
  app.get("/admin/tiers/config", async (c) => {
    return c.json({
      success: true,
      tiers: TIER_CONFIG,
    });
  });

  /**
   * POST /admin/tiers/calculate-commissions
   * Calculate commissions for all vendors based on their tiers
   */
  app.post("/admin/tiers/calculate-commissions", async (c) => {
    try {
      const vendors = await select('vendors', { is_active: true });

      const results = vendors.map((vendor: any) => {
        const tier = vendor.tier || 'Bronze';
        const commission = TIER_CONFIG[tier as keyof typeof TIER_CONFIG].commission;

        return {
          vendorId: vendor.id,
          businessName: vendor.business_name,
          currentTier: tier,
          commissionPercentage: commission,
        };
      });

      return c.json({
        success: true,
        vendors: results,
        total: results.length,
      });
    } catch (error: any) {
      console.error('Error calculating commissions:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

