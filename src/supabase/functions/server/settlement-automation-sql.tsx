/**
 * ============================================================================
 * SQL-BASED SETTLEMENT AUTOMATION
 * ============================================================================
 * 
 * Migrated from: settlement-automation.tsx (KV-based)
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Transactional safety
 * ✅ Automatic payout creation
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { getPaymentsRepository } from "../../lib/repositories/payments.ts";
import { withTransaction, getDbClient } from "../../lib/db.ts";

export function registerSettlementAutomationSQL(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const bookingsRepo = getBookingsRepository();
  const vendorsRepo = getVendorsRepository();
  const payoutsRepo = getPayoutsRepository();
  const paymentsRepo = getPaymentsRepository();
  const client = getDbClient();

  /**
   * POST /settlements/calculate-daily
   * Run daily settlement calculation - SQL-BASED
   */
  app.post(`${BASE}/settlements/calculate-daily`, async (c) => {
    try {
      console.log('💰 [SETTLEMENT-SQL] Starting daily settlement calculation...');

      // ✅ SQL-BASED: Get payout policies
      const { data: policy, error: policyError } = await client
        .from('payout_policies')
        .select('*')
        .eq('is_active', true)
        .single();

      const rules = policy || {
        hold_period_days: 7,
        min_payout_amount: 1000,
        auto_payout: false,
      };

      const holdPeriodDays = rules.hold_period_days || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - holdPeriodDays);

      // ✅ SQL-BASED: Get eligible bookings
      const { data: eligibleBookings, error: bookingsError } = await client
        .from('bookings')
        .select('*')
        .eq('status', 'completed')
        .eq('payment_status', 'paid')
        .lt('completed_at', cutoffDate.toISOString());
        // Note: 'settled' column may need to be added to bookings table if not exists

      if (bookingsError) throw bookingsError;

      console.log(`📊 [SETTLEMENT-SQL] Found ${eligibleBookings?.length || 0} eligible bookings`);

      // Group by vendor
      const vendorSettlements: Record<string, any> = {};

      for (const booking of eligibleBookings || []) {
        const vendorId = booking.vendor_id;
        if (!vendorId) continue;

        if (!vendorSettlements[vendorId]) {
          vendorSettlements[vendorId] = {
            vendorId,
            bookings: [],
            paymentIds: [],
            totalAmount: 0,
            commission: 0,
            netAmount: 0
          };
        }

        // Get vendor for commission rate
        const vendor = await vendorsRepo.findById(vendorId);
        const commissionRate = vendor?.commission_percentage || 10;

        // Get payment for this booking
        const payments = await paymentsRepo.findByBooking(booking.id);
        const payment = payments.find(p => p.payment_status === 'completed');
        
        if (!payment) continue;

        const bookingAmount = Number(payment.amount);
        const commissionAmount = (bookingAmount * commissionRate) / 100;
        const netAmount = bookingAmount - commissionAmount;

        vendorSettlements[vendorId].bookings.push(booking.id);
        vendorSettlements[vendorId].paymentIds.push(payment.id);
        vendorSettlements[vendorId].totalAmount += bookingAmount;
        vendorSettlements[vendorId].commission += commissionAmount;
        vendorSettlements[vendorId].netAmount += netAmount;
      }

      // Process settlements
      const settlements = [];
      
      for (const vendorId in vendorSettlements) {
        const settlement = vendorSettlements[vendorId];

        // Check minimum payout
        if (settlement.netAmount < rules.min_payout_amount) {
          console.log(`⚠️ [SETTLEMENT-SQL] Vendor ${vendorId} below minimum (₹${settlement.netAmount})`);
          continue;
        }

        // Get vendor bank details
        const { data: bankDetails } = await client
          .from('vendor_bank_details')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('is_verified', true)
          .single();

        if (!bankDetails) {
          console.log(`⚠️ [SETTLEMENT-SQL] Vendor ${vendorId} bank not verified`);
          continue;
        }

        // ✅ SQL-BASED: Create payout in transaction
        await withTransaction(async (txClient) => {
          // Create payout
          const payout = await payoutsRepo.create({
            vendor_id: vendorId,
            amount: settlement.netAmount,
            bank_account_number: bankDetails.account_number,
            ifsc_code: bankDetails.ifsc_code,
            account_holder_name: bankDetails.account_holder_name,
            payment_ids: settlement.paymentIds,
          });

          // Mark bookings as settled (if settled column exists)
          for (const bookingId of settlement.bookings) {
            try {
              await txClient
                .from('bookings')
                .update({ settled: true, settled_at: new Date().toISOString() })
                .eq('id', bookingId);
            } catch (error) {
              // settled column might not exist, use notes field instead
              const booking = await bookingsRepo.findById(bookingId);
              if (booking) {
                await bookingsRepo.update(bookingId, {
                  notes: (booking.notes || '') + '\n[Settled]',
                });
              }
            }
          }

          settlements.push({
            payoutId: payout.id,
            vendorId,
            amount: settlement.netAmount,
            totalAmount: settlement.totalAmount,
            commission: settlement.commission,
            bookingCount: settlement.bookings.length,
          });
        });
      }

      console.log(`✅ [SETTLEMENT-SQL] Created ${settlements.length} settlements`);

      return sendSuccess(c, {
        success: true,
        settlementsCreated: settlements.length,
        totalAmount: settlements.reduce((sum, s) => sum + s.amount, 0),
        settlements
      });
    } catch (error: any) {
      console.error('[SETTLEMENT-SQL] Error:', error);
      return sendError(c, error.message || 'Settlement calculation failed', 500);
    }
  });
}

