/**
 * ============================================================================
 * RAZORPAY MARKETPLACE SETTLEMENT - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 *
 * Handles Razorpay marketplace settlement and bank account verification
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `BookingsRepository` for booking data
 * - Uses `VendorTiersRepository` for tier data
 * - Uses `SettlementsRepository` for settlement records
 * - Uses `vendors` table for bank account info
 *
 * Date: 2025-01-28
 * Migration: Batch 9 - KV to SQL (6 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { TIER_CONFIG } from "./tier-system.tsx";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorTiersRepository } from "../../lib/repositories/vendor-tiers.ts";
import { getSettlementsRepository } from "../../lib/repositories/settlements.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient, withTransaction } from "../../lib/db.ts";

export function razorpayMarketplaceSettlementSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();
  const bookingsRepo = getBookingsRepository();
  const vendorTiersRepo = getVendorTiersRepository();
  const settlementsRepo = getSettlementsRepository();
  const vendorsRepo = getVendorsRepository();

  /**
   * POST /razorpay/marketplace/settlement
   * Trigger settlement for a completed booking
   */
  app.post(`${BASE_PATH}/razorpay/marketplace/settlement`, async (c) => {
    try {
      const { bookingId } = await c.req.json();
      
      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) return sendError(c, 'Booking not found', 404);
      
      if (booking.status !== 'completed') {
        return sendError(c, 'Booking must be completed to settle', 400);
      }
      
      if (booking.settlement_id) {
        // Check if already settled
        const existingSettlement = await settlementsRepo.findById(booking.settlement_id);
        if (existingSettlement && existingSettlement.settlement_status === 'completed') {
          return sendSuccess(c, { message: 'Already settled', settlement: existingSettlement });
        }
      }

      const vendorId = booking.vendor_id;
      if (!vendorId) {
        return sendError(c, 'Booking has no vendor ID', 400);
      }

      const amount = booking.total_amount || 0;

      // ✅ SQL: Get Vendor Tier & Commission
      const vendorTierSubscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendorId);
      const currentTier = vendorTierSubscription 
        ? await vendorTiersRepo.findById(vendorTierSubscription.tier_id)
        : null;
      
      const tierName = currentTier?.tier_name || 'SILVER';
      const tierConfig = TIER_CONFIG[tierName as keyof typeof TIER_CONFIG] || TIER_CONFIG.SILVER;
      
      const commissionRate = currentTier?.commission_rate || tierConfig.commissionRate;
      const commissionAmount = (amount * commissionRate) / 100;
      const vendorShare = amount - commissionAmount;

      // ✅ SQL: Create Settlement Record
      const settlementDate = new Date(booking.booking_date).toISOString().split('T')[0];
      const settlement = await settlementsRepo.create({
        vendor_id: vendorId,
        booking_id: bookingId,
        settlement_amount: amount,
        commission_amount: commissionAmount,
        vendor_amount: vendorShare,
        settlement_date: settlementDate,
      });

      // 3. Initiate Transfer (Simulated Razorpay Route API)
      // In production: await razorpay.transfers.create(...)
      
      console.log(`💸 Settling Booking ${bookingId}: Total ${amount}, Vendor ${vendorShare}, Platform ${commissionAmount}`);

      // Simulate success
      await settlementsRepo.update(settlement.id, {
        settlement_status: 'completed',
      });
      
      // ✅ SQL: Update Booking
      await bookingsRepo.update(bookingId, {
        settlement_id: settlement.id,
      });

      const updatedSettlement = await settlementsRepo.findById(settlement.id);

      return sendSuccess(c, { settlement: updatedSettlement });

    } catch (error) {
      console.error('Error in marketplace settlement:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /razorpay/bank-account/verify
   * Verify Vendor Bank Account (Rule 15 - Automated Verification)
   */
  app.post(`${BASE_PATH}/razorpay/bank-account/verify`, async (c) => {
    try {
      const { vendorId, accountNumber, ifsc, name } = await c.req.json();

      // Simulate Razorpay Fund Account Validation API
      // In production: await razorpay.fundAccount.validate(...)
      
      const isValid = ifsc.length === 11; // Basic mock validation
      
      if (isValid) {
        // ✅ SQL: Update vendor bank account info
        const vendor = await vendorsRepo.findById(vendorId);
        if (!vendor) {
          return sendError(c, 'Vendor not found', 404);
        }

        // Store bank account info in vendor metadata
        const metadata = vendor.metadata || {};
        metadata.bank_account = {
          account_number: accountNumber,
          ifsc,
          account_name: name,
          is_verified: true,
          verified_at: new Date().toISOString(),
        };

        await vendorsRepo.update(vendorId, {
          metadata,
        });

        return sendSuccess(c, { 
          valid: true, 
          message: 'Bank account verified successfully',
          beneficiaryName: name 
        });
      } else {
        return sendError(c, 'Invalid Bank Account Details', 400);
      }

    } catch (error) {
      console.error('Error verifying bank account:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Razorpay marketplace settlement endpoints (SQL-only) registered');
}

