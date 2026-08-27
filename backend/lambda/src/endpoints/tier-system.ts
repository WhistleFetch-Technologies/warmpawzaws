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
 * 
 * Date: 2025-01-28
 * Updated: 2026-01-27 - Added tier upgrade payment flow and settlement deductions
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query, insert } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { resolveVendorById } from './vendor/endpoints/vendorProfile.vendor';

// Fallback when vendor_tiers is empty (legacy)
const TIER_CONFIG_FALLBACK: Record<string, { commission: number; minBookings: number; minRevenue: number; monthlyFee: number; yearlyFee: number }> = {
  Bronze: { commission: 15.0, minBookings: 0, minRevenue: 0, monthlyFee: 0, yearlyFee: 0 },
  Silver: { commission: 12.0, minBookings: 50, minRevenue: 50000, monthlyFee: 999, yearlyFee: 9990 },
  Gold: { commission: 10.0, minBookings: 200, minRevenue: 200000, monthlyFee: 2499, yearlyFee: 24990 },
  Platinum: { commission: 8.0, minBookings: 500, minRevenue: 500000, monthlyFee: 4999, yearlyFee: 49990 },
  Basic: { commission: 0, minBookings: 0, minRevenue: 0, monthlyFee: 0, yearlyFee: 0 },
};

// Settlement deduction options: monthly (1x), weekly_4 (4x over 4 weeks)
const DEDUCTION_OPTIONS = { monthly: 1, weekly_4: 4 } as const;
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
   * Get vendor tier information from vendor_tiers (admin-configured).
   * Uses applicable_roles to filter upgrade options by vendor role.
   */
  app.get("/vendor/:vendorId/tier", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      // Fetch all active Marketplace-applicable tiers from vendor_tiers (admin-configured)
      const tiersResult = await query(
        `SELECT id, tier_name, tier_level, display_name, commission_rate, payout_period_days,
                monthly_cost, yearly_cost, six_month_cost, twelve_month_cost,
                features, applicable_roles, is_default, is_free_tier,
                terms_and_conditions, terms_version, allow_split_payment, split_payment_installments,
                marketplace_enabled, warmpawz_pay_enabled
         FROM vendor_tiers
         WHERE is_active = true
           AND COALESCE(marketplace_enabled, true) = true
         ORDER BY tier_level ASC`
      ).catch(async () =>
        query(
          `SELECT id, tier_name, tier_level, display_name, commission_rate, payout_period_days,
                  monthly_cost, yearly_cost, six_month_cost, twelve_month_cost,
                  features, applicable_roles, is_default, is_free_tier,
                  terms_and_conditions, terms_version, allow_split_payment, split_payment_installments
           FROM vendor_tiers
           WHERE is_active = true
           ORDER BY tier_level ASC`,
        ).catch(() => ({ rows: [] })),
      );
      const dbTiers = tiersResult.rows || [];

      // Resolve current tier: vendor.tier → lookup in dbTiers; else use default
      let currentTierRow = dbTiers.find((t: any) =>
        String(t.tier_name || '').toLowerCase() === String(vendor.tier || '').toLowerCase()
      );
      if (!currentTierRow) {
        currentTierRow = dbTiers.find((t: any) => t.is_default) || dbTiers[0];
      }
      const currentTierName = currentTierRow?.tier_name || vendor.tier || 'Basic';
      const currentLevel = currentTierRow?.tier_level ?? 1;

      // Get vendor stats
      const bookings = await query(
        `SELECT COUNT(*) as count, SUM(total_amount) as revenue 
         FROM bookings 
         WHERE vendor_id = $1 AND status = 'completed'`,
        [actualVendorId]
      ).catch(() => ({ rows: [{ count: '0', revenue: '0' }] }));
      const totalBookings = parseInt(bookings.rows[0]?.count || '0', 10);
      const totalRevenue = parseFloat(bookings.rows[0]?.revenue || '0');

      // Filter upgrade tiers: tier_level > current, and applicable to vendor role
      const vendorRoleId = vendor.role_id || null;
      const upgradeTiers = dbTiers.filter((t: any) => {
        if ((t.tier_level ?? 0) <= currentLevel) return false;
        const roles = t.applicable_roles;
        if (!roles || !Array.isArray(roles) || roles.length === 0) return true;
        return vendorRoleId && roles.some((r: any) => String(r) === String(vendorRoleId));
      });

      const nextTierRow = upgradeTiers[0];
      const nextTierName = nextTierRow?.tier_name || null;
      const features = Array.isArray(currentTierRow?.features)
        ? currentTierRow.features
        : (currentTierRow?.features ? [currentTierRow.features] : ['Basic listing', 'Standard support', 'Weekly settlements']);
      const commissionRate = currentTierRow
        ? parseFloat(currentTierRow.commission_rate || '0')
        : (TIER_CONFIG_FALLBACK[currentTierName]?.commission ?? 0);
      const payoutDays = currentTierRow?.payout_period_days ?? 7;

      // allTiers: all active tiers from vendor_tiers for Tier Benefits display (Finance & Logistics config)
      const allTiers = dbTiers.map((t: any) => {
        const payoutDays = t.payout_period_days ?? 7;
        return {
          name: t.tier_name,
          displayName: t.display_name || t.tier_name,
          commissionRate: parseFloat(t.commission_rate || '0'),
          features: Array.isArray(t.features) ? t.features : (t.features ? [t.features] : []),
          payoutPeriodDays: payoutDays,
          payoutCycleLabel: payoutDays === 1 ? 'Daily' : payoutDays === 7 ? 'Weekly' : `Every ${payoutDays} days`,
          monthlyCost: parseFloat(t.monthly_cost || '0'),
          yearlyCost: parseFloat(t.yearly_cost || '0'),
          tierLevel: t.tier_level ?? 0,
        };
      });

      return c.json({
        success: true,
        tier: {
          current: currentTierName,
          name: currentTierRow?.display_name || currentTierName,
          commission: commissionRate,
          commissionRate,
          commission_rate: commissionRate,
          payoutPeriodDays: payoutDays,
          payoutCycleLabel: payoutDays === 1 ? 'Daily' : payoutDays === 7 ? 'Weekly' : `Every ${payoutDays} days`,
          stats: { totalBookings, totalRevenue },
          features,
          nextTier: nextTierName,
          next_tier: nextTierName,
          eligible: !!nextTierRow,
          canUpgrade: !!nextTierRow,
          allTiers,
          upgradeTiers: upgradeTiers.map((t: any) => ({
            name: t.tier_name,
            displayName: t.display_name,
            commissionRate: parseFloat(t.commission_rate || '0'),
            monthlyCost: parseFloat(t.monthly_cost || '0'),
            yearlyCost: parseFloat(t.yearly_cost || '0'),
            features: Array.isArray(t.features) ? t.features : [],
            termsAndConditions: t.terms_and_conditions || null,
            termsVersion: t.terms_version || '1.0',
            requiresTermsAcceptance: !!(t.terms_and_conditions && String(t.terms_and_conditions).trim()),
          })),
          requirements: nextTierRow ? {
            upgradeCost: parseFloat(nextTierRow.monthly_cost || '0'),
            commissionRate: parseFloat(nextTierRow.commission_rate || '0'),
            features: Array.isArray(nextTierRow.features) ? nextTierRow.features : [],
            termsAndConditions: nextTierRow.terms_and_conditions || null,
            requiresTermsAcceptance: !!(nextTierRow.terms_and_conditions && String(nextTierRow.terms_and_conditions).trim()),
          } : null,
          progress: { bookings: 100, revenue: 100 },
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
        subscriptionPeriod = 'monthly', // 'monthly' | 'yearly' | 'twelve_month' | 'six_month'
        settlementSchedule = 'monthly', // 'monthly' = 1 installment from next settlement; 'weekly_4' = 4 weekly installments
        termsAccepted = false,
        razorpayPaymentId, // Required if paymentMethod is 'upfront'
        razorpayOrderId,
        adminId 
      } = await c.req.json();

      console.log(`🎯 [TIER-UPGRADE] Vendor ${vendorId} upgrading to ${newTier} via ${paymentMethod}`);

      if (!newTier || typeof newTier !== 'string') {
        return c.json({ error: 'Tier name is required' }, 400);
      }

      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;
      const oldTier = vendor.tier || 'Basic';

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

      // T&C check: if tier has terms, vendor must accept
      const hasTerms = tierInfo.terms_and_conditions && String(tierInfo.terms_and_conditions).trim().length > 0;
      if (hasTerms && !termsAccepted) {
        return c.json({ 
          error: 'You must accept the terms and conditions for this tier to upgrade',
          requiresTermsAcceptance: true,
          termsPreview: String(tierInfo.terms_and_conditions).slice(0, 200) + (String(tierInfo.terms_and_conditions).length > 200 ? '...' : ''),
        }, 400);
      }

      // Calculate subscription cost
      const tierFee = subscriptionPeriod === 'yearly' || subscriptionPeriod === 'twelve_month'
        ? parseFloat(tierInfo.yearly_cost || tierInfo.twelve_month_cost || '0')
        : subscriptionPeriod === 'six_month'
          ? parseFloat(tierInfo.six_month_cost || (tierInfo.monthly_cost * 5.5) || '0')
          : parseFloat(tierInfo.monthly_cost || '0');

      // Free tier: is_free_tier or monthly_cost = 0
      const isFreeTier = tierInfo.is_free_tier === true || parseFloat(tierInfo.monthly_cost || '0') === 0;
      if (isFreeTier) {
        const commissionPct = parseFloat(tierInfo.commission_rate || '0');
        const updated = await update('vendors',
          { id: actualVendorId },
          {
            tier: newTier,
            commission_percentage: commissionPct,
          }
        );

        return c.json({
          success: true,
          vendor: updated[0],
          message: `Vendor tier set to ${newTier} (free tier)`,
          tierFee: 0,
        });
      }

      let usedDeductionInstallments = 0;
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
            vendor_id: actualVendorId,
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
            vendor_id: actualVendorId,
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
          // settlementSchedule: 'monthly' = 1 installment; 'weekly_4' = 4 weekly installments
          const installments = DEDUCTION_OPTIONS[settlementSchedule as keyof typeof DEDUCTION_OPTIONS]
            ?? (tierInfo.allow_split_payment ? (tierInfo.split_payment_installments || DEFAULT_DEDUCTION_INSTALLMENTS) : DEFAULT_DEDUCTION_INSTALLMENTS);
          const safeInstallments = Math.min(4, Math.max(1, installments));
          const amountPerInstallment = Math.ceil(tierFee / safeInstallments);

          console.log(`📉 [TIER-UPGRADE] Creating settlement deduction for ₹${tierFee} over ${safeInstallments} payouts (schedule: ${settlementSchedule})`);

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
            vendor_id: actualVendorId,
            tier_id: tierInfo.id,
            subscription_type: subscriptionPeriod,
            payment_type: 'split',
            payment_method: 'settlement_deduction',
            total_amount: tierFee,
            discount_amount: 0,
            final_amount: tierFee,
            settlement_deduction_installments: safeInstallments,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
            end_date: subscriptionEndDate.toISOString().split('T')[0],
          });

          // Create deduction record to be processed during settlements
          await insert('tier_upgrade_deductions', {
            vendor_id: actualVendorId,
            subscription_id: subscription[0]?.id,
            tier_id: tierInfo.id,
            total_amount: tierFee,
            recovery_installments: safeInstallments,
            amount_per_installment: amountPerInstallment,
            amount_remaining: tierFee,
            status: 'pending',
          });

          console.log(`✅ [TIER-UPGRADE] Deduction created: ₹${amountPerInstallment} x ${safeInstallments} payouts`);
        }
      }

      // Update vendor tier
      const updated = await update('vendors',
        { id: actualVendorId },
        {
          tier: newTier,
          commission_percentage: parseFloat(tierInfo.commission_rate) || 0,
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

      // Record T&C acceptance if tier has terms
      if (hasTerms && tierInfo.terms_and_conditions) {
        try {
          await insert('vendor_tier_acceptances', {
            vendor_id: actualVendorId,
            tier_id: tierInfo.id,
            terms_version: tierInfo.terms_version || '1.0',
            terms_text_snapshot: String(tierInfo.terms_and_conditions).slice(0, 10000),
            accepted_via: 'web',
          }).catch((err) => console.warn('[TIER-UPGRADE] T&C acceptance record failed (non-fatal):', err?.message));
        } catch (_) { /* non-fatal */ }
      }

      const deductionInstallments = paymentMethod === 'settlement_deduction' ? usedDeductionInstallments || (DEDUCTION_OPTIONS[settlementSchedule as keyof typeof DEDUCTION_OPTIONS] ?? DEFAULT_DEDUCTION_INSTALLMENTS) : 0;
      const amtPerPayout = deductionInstallments > 0 ? Math.ceil(tierFee / deductionInstallments) : 0;

      return c.json({
        success: true,
        vendor: updated[0],
        message: `Vendor tier upgraded from ${oldTier} to ${newTier}`,
        tierFee,
        paymentMethod,
        settlementSchedule: paymentMethod === 'settlement_deduction' ? settlementSchedule : null,
        deductionInfo: paymentMethod === 'settlement_deduction' ? {
          totalAmount: tierFee,
          installments: deductionInstallments,
          amountPerPayout: amtPerPayout,
          schedule: settlementSchedule,
          note: deductionInstallments === 1
            ? `₹${amtPerPayout} will be deducted from your next settlement`
            : `₹${amtPerPayout} will be deducted from your next ${deductionInstallments} settlements (weekly)`,
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
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      const actualVendorId = vendor.id;

      const deductions = await query(
        `SELECT d.*, t.tier_name, t.commission_rate 
         FROM tier_upgrade_deductions d
         LEFT JOIN vendor_tiers t ON d.tier_id = t.id
         WHERE d.vendor_id = $1 AND d.status IN ('pending', 'in_progress')
         ORDER BY d.created_at DESC`,
        [actualVendorId]
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
    const dbTiers = await query('SELECT * FROM vendor_tiers WHERE is_active = true ORDER BY tier_level').catch(() => ({ rows: [] }));
    const rows = dbTiers.rows || [];
    if (rows.length > 0) {
      return c.json({ success: true, tiers: rows.map((r: any) => ({ name: r.tier_name, commission: r.commission_rate, monthlyFee: r.monthly_cost, yearlyFee: r.yearly_cost })) });
    }
    return c.json({ success: true, tiers: TIER_CONFIG_FALLBACK });
  });

  /**
   * POST /admin/tiers/calculate-commissions
   * Calculate commissions for all vendors based on their tiers
   */
  app.post("/admin/tiers/calculate-commissions", async (c) => {
    try {
      const vendors = await select('vendors', { is_active: true });
      const tiersResult = await query('SELECT tier_name, commission_rate FROM vendor_tiers WHERE is_active = true').catch(() => ({ rows: [] }));
      const tierMap = Object.fromEntries((tiersResult.rows || []).map((r: any) => [r.tier_name, parseFloat(r.commission_rate || '0')]));

      const results = vendors.map((vendor: any) => {
        const tier = vendor.tier || 'Basic';
        const commission = tierMap[tier] ?? TIER_CONFIG_FALLBACK[tier]?.commission ?? 0;

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

