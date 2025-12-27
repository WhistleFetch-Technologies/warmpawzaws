/**
 * ============================================================================
 * SETTLEMENT & TIER SYSTEM ENHANCED - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 *
 * Automated commission calculation based on Tier, Settlement processing, Tier management & Upgrades
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `VendorTiersRepository` for tier data
 * - Uses `VendorEarningsRepository` for earnings stats
 * - Uses `PayoutsRepository` for payout history
 * - Uses `vendor_bank_details` table for bank verification
 *
 * Date: 2025-01-28
 * Migration: Batch 9 - KV to SQL (7 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorTiersRepository } from "../../lib/repositories/vendor-tiers.ts";
import { getVendorEarningsRepository } from "../../lib/repositories/vendor-earnings.ts";
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { getDbClient } from "../../lib/db.ts";

const db = getDbClient();

export function settlementTierSystemEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const vendorTiersRepo = getVendorTiersRepository();
  const vendorEarningsRepo = getVendorEarningsRepository();
  const payoutsRepo = getPayoutsRepository();

  // ========================================
  // GET VENDOR TIER & STATS
  // ========================================
  app.get(`${BASE_PATH}/vendor/:vendorId/tier`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      
      // ✅ SQL: Get vendor's current tier subscription
      const subscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendorId);
      const currentTier = subscription 
        ? await vendorTiersRepo.findById(subscription.tier_id)
        : await vendorTiersRepo.findDefaultTier();

      if (!currentTier) {
        return sendError(c, 'No tier found', 404);
      }

      // ✅ SQL: Get vendor earnings stats
      const earnings = await vendorEarningsRepo.findByVendor(vendorId);
      const totalEarnings = earnings.reduce((sum, e) => sum + (e.total_earnings || 0), 0);
      const pendingEarnings = earnings
        .filter(e => e.settlement_status === 'pending')
        .reduce((sum, e) => sum + (e.pending_amount || 0), 0);

      // ✅ SQL: Get payout history
      const payouts = await payoutsRepo.findByVendor(vendorId, { limit: 1 });
      const lastPayout = payouts[0]?.processed_at || null;

      // Get next tier (higher level)
      const allTiers = await vendorTiersRepo.findAllActive();
      const nextTier = allTiers.find(t => t.tier_level > currentTier.tier_level) || null;

      return sendSuccess(c, {
        currentTier: {
          id: currentTier.id,
          name: currentTier.tier_name,
          commissionRate: currentTier.commission_rate,
          features: currentTier.features || [],
        },
        nextTier: nextTier ? {
          id: nextTier.id,
          name: nextTier.tier_name,
          commissionRate: nextTier.commission_rate,
          features: nextTier.features || [],
        } : null,
        stats: {
          totalEarnings,
          pendingSettlement: pendingEarnings,
          completedSettlements: totalEarnings - pendingEarnings,
          lastPayout
        }
      });
    } catch (error) {
      console.error('Error getting vendor tier:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPGRADE TIER
  // ========================================
  app.post(`${BASE_PATH}/vendor/:vendorId/tier/upgrade`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const { targetTierId } = await c.req.json();

      // ✅ SQL: Validate target tier
      const targetTier = await vendorTiersRepo.findById(targetTierId);
      if (!targetTier || !targetTier.is_active) {
        return sendError(c, 'Invalid tier', 400);
      }

      // ✅ SQL: Get current subscription
      const currentSubscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendorId);
      
      // In real world: Process payment for upgrade or check eligibility
      // Here: Create new subscription (cancels old one automatically)
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1); // Default to monthly

      const newSubscription = await vendorTiersRepo.createSubscription({
        vendor_id: vendorId,
        tier_id: targetTierId,
        subscription_type: 'monthly',
        payment_type: 'upfront',
        total_amount: targetTier.monthly_cost,
        discount_amount: 0,
        final_amount: targetTier.monthly_cost,
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
      });

      return sendSuccess(c, {
        success: true,
        newTier: {
          id: targetTier.id,
          name: targetTier.tier_name,
          commissionRate: targetTier.commission_rate,
          features: targetTier.features || [],
        },
        message: `Successfully upgraded to ${targetTier.tier_name.toUpperCase()} tier`
      });
    } catch (error) {
      console.error('Error upgrading tier:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // REQUEST SETTLEMENT / PAYOUT
  // ========================================
  app.post(`${BASE_PATH}/settlement/process`, async (c) => {
    try {
      const { vendorId, amount } = await c.req.json();
      
      // ✅ SQL: Get vendor earnings
      const earnings = await vendorEarningsRepo.findByVendor(vendorId);
      const pendingEarnings = earnings
        .filter(e => e.settlement_status === 'pending')
        .reduce((sum, e) => sum + (e.pending_amount || 0), 0);

      if (amount > pendingEarnings) {
        return sendError(c, 'Insufficient pending balance', 400);
      }

      // ✅ SQL: Check bank verification
      const { data: bankDetails } = await db
        .from('vendor_bank_details')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_verified', true)
        .single();

      if (!bankDetails) {
        return sendError(c, 'Bank account not verified', 400);
      }

      // 3. Process Payout (Mock Bank API)
      const payoutId = `payout_${Date.now()}`;
      console.log(`💸 Processing payout of ₹${amount} to vendor ${vendorId}`);
      
      // ✅ SQL: Create payout record
      const payout = await payoutsRepo.create({
        vendor_id: vendorId,
        amount,
        scheduled_at: new Date().toISOString(),
        settlement_ids: [], // Will be populated from earnings
      });

      // ✅ SQL: Update earnings settlement status
      // Mark earnings as processing
      const earningsToSettle = earnings
        .filter(e => e.settlement_status === 'pending')
        .slice(0, Math.ceil(amount / 1000)); // Approximate - in production, match exact amounts

      for (const earning of earningsToSettle) {
        await vendorEarningsRepo.update(earning.id, {
          settlement_status: 'processing',
        });
      }

      return sendSuccess(c, {
        success: true,
        payoutId: payout.id,
        amount,
        remainingBalance: pendingEarnings - amount,
        status: 'processed'
      });

    } catch (error) {
      console.error('Error processing settlement:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // VERIFY BANK ACCOUNT (Automation)
  // ========================================
  app.post(`${BASE_PATH}/bank-account/verify`, async (c) => {
    try {
      const { vendorId, accountDetails } = await c.req.json();
      
      // Simulate "Penny Drop" verification
      console.log(`🏦 Verifying bank account for ${vendorId}: ${accountDetails.accountNumber}`);
      
      // Simulate API delay
      // await new Promise(r => setTimeout(r, 1000));
      
      const isValid = true; // Mock success
      
      if (isValid) {
        // ✅ SQL: Update or create bank details
        const { data: existing } = await db
          .from('vendor_bank_details')
          .select('*')
          .eq('vendor_id', vendorId)
          .single();

        if (existing) {
          await db
            .from('vendor_bank_details')
            .update({
              account_number: accountDetails.accountNumber,
              ifsc_code: accountDetails.ifsc,
              account_holder_name: accountDetails.accountHolderName,
              bank_name: accountDetails.bankName,
              is_verified: true,
              verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await db
            .from('vendor_bank_details')
            .insert({
              vendor_id: vendorId,
              account_number: accountDetails.accountNumber,
              ifsc_code: accountDetails.ifsc,
              account_holder_name: accountDetails.accountHolderName,
              bank_name: accountDetails.bankName,
              is_verified: true,
              verified_at: new Date().toISOString(),
            });
        }

        return sendSuccess(c, { verified: true, message: 'Bank account verified successfully' });
      } else {
        return sendError(c, 'Bank verification failed', 400);
      }

    } catch (error) {
      console.error('Error verifying bank account:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Settlement & Tier endpoints (SQL-only) registered');
}
