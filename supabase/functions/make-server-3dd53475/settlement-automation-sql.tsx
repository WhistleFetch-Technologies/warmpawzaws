/**
 * ============================================================================
 * SETTLEMENT AUTOMATION - SQL ONLY
 * ============================================================================
 * 
 * Complete rewrite with:
 * 1. SQL-only (no KV store)
 * 2. Idempotency enforcement
 * 3. Refund exclusion
 * 4. Commission rate from payment record
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getDbClient } from "../../lib/db.ts";
import { calculateSettlement } from "../../lib/services/settlement-service.ts";

export function registerSettlementAutomation(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const client = getDbClient();

  /**
   * POST /settlements/calculate-daily
   * Run daily settlement calculation (SQL)
   */
  app.post(`${BASE}/settlements/calculate-daily`, async (c) => {
    try {
      console.log('💰 [SETTLEMENT] Starting daily settlement calculation...');

      // Get payout rules
      const { data: payoutRule } = await client
        .from('payout_rules')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const holdPeriodDays = payoutRule?.processing_days || 7;
      const minimumPayout = payoutRule?.min_payout_amount || 1000;

      // Calculate period (last 7 days)
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 7);

      // Get all vendors
      const { data: vendors, error: vendorsError } = await client
        .from('vendors')
        .select('id')
        .eq('is_active', true);

      if (vendorsError) {
        throw new Error(`Failed to fetch vendors: ${vendorsError.message}`);
      }

      const settlements = [];
      let totalAmount = 0;

      // Calculate settlement for each vendor
      for (const vendor of vendors || []) {
        try {
          const result = await calculateSettlement(
            vendor.id,
            periodStart,
            periodEnd,
            holdPeriodDays
          );

          if (result && !result.alreadySettled && result.netAmount >= minimumPayout) {
            settlements.push(result);
            totalAmount += result.netAmount;
          }
        } catch (error) {
          console.error(`❌ [SETTLEMENT] Error for vendor ${vendor.id}:`, error);
        }
      }

      console.log(`✅ [SETTLEMENT] Created ${settlements.length} settlements`);

      return c.json({
        success: true,
        settlementsCreated: settlements.length,
        totalAmount,
        settlements
      });
    } catch (error) {
      console.error('[SETTLEMENT] Error:', error);
      return c.json({ error: 'Settlement calculation failed' }, 500);
    }
  });

  /**
   * POST /settlements/:settlementId/approve
   * Admin approves a settlement for payout (SQL)
   */
  app.post(`${BASE}/settlements/:settlementId/approve`, async (c) => {
    try {
      const { settlementId } = c.req.param();
      const { adminId } = await c.req.json();

      const { data: settlement, error: settlementError } = await client
        .from('settlements')
        .select('*')
        .eq('id', settlementId)
        .single();

      if (settlementError || !settlement) {
        return c.json({ error: 'Settlement not found' }, 404);
      }

      if (settlement.settlement_status !== 'pending') {
        return c.json({ error: 'Settlement already processed' }, 400);
      }

      // Update settlement status
      await client
        .from('settlements')
        .update({
          settlement_status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('id', settlementId);

      // Create payout (would integrate with Razorpay here)
      // This is handled by payout-processing.ts service

      return c.json({
        success: true,
        message: 'Settlement approved and payout initiated'
      });
    } catch (error) {
      console.error('[SETTLEMENT] Approval error:', error);
      return c.json({ error: 'Failed to approve settlement' }, 500);
    }
  });

  /**
   * GET /settlements/vendor/:vendorId
   * Get settlement history for vendor (SQL)
   */
  app.get(`${BASE}/settlements/vendor/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const { data: settlements, error } = await client
        .from('settlements')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const totalSettled = (settlements || [])
        .filter((s: any) => s.settlement_status === 'completed')
        .reduce((sum: number, s: any) => sum + parseFloat(s.net_amount || 0), 0);

      return c.json({
        success: true,
        settlements: settlements || [],
        totalSettled
      });
    } catch (error) {
      console.error('[SETTLEMENT] History error:', error);
      return c.json({ error: 'Failed to fetch history' }, 500);
    }
  });

  console.log('✅ Settlement automation registered (SQL-only)');
}

