// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { 
  getBookingsRepository,
  getVendorsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';
import { TIER_CONFIG } from "./tier-system";

/**
 * 💸 RAZORPAY MARKETPLACE SETTLEMENT
 * 
 * Phase 7C: Rule 15
 * 
 * Logic:
 * 1. Payment received -> Booking Confirmed
 * 2. Service Delivered -> Settlement Triggered
 * 3. Settlement Calculation:
 *    - Vendor Share = Total - (Commission + Tax)
 *    - Platform Share = Commission
 * 4. Payout via Razorpay Route or Linked Accounts
 */

export function razorpayMarketplaceSettlement(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /razorpay/marketplace/settlement
   * Trigger settlement for a completed booking
   */
  app.post(`${BASE_PATH}/razorpay/marketplace/settlement`, async (c) => {
    try {
      const { bookingId } = await c.req.json();
      
      // ✅ SQL: Get booking using repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) return sendError(c, 'Booking not found', 404);
      
      if (booking.status !== 'completed') {
        return sendError(c, 'Booking must be completed to settle', 400);
      }
      
      if (booking.settlement_status === 'settled') {
        return sendSuccess(c, { message: 'Already settled' });
      }

      const vendorId = booking.vendor_id;
      const amount = booking.total_amount || 0;

      // ✅ SQL: Get Vendor Tier & Commission from vendor_tiers table
      const db = getDbClient();
      const { data: tierData } = await db
        .from('vendor_tiers')
        .select('current_tier, total_gmv, last_updated')
        .eq('vendor_id', vendorId)
        .single();
      
      const tierInfo = tierData || { current_tier: 'SILVER' };
      const tierConfig = TIER_CONFIG[tierInfo.current_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.SILVER;
      
      const commissionRate = tierConfig.commissionRate;
      const commissionAmount = (amount * commissionRate) / 100;
      const vendorShare = amount - commissionAmount;

      // ✅ SQL: Create Settlement Record in settlements table
      const settlementId = `set_${Date.now()}_${bookingId}`;
      const { data: settlementData, error: settlementError } = await db
        .from('settlements')
        .insert({
          id: settlementId,
          booking_id: bookingId,
          vendor_id: vendorId,
          total_amount: amount,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          vendor_share: vendorShare,
          status: 'processing', // pending Razorpay transfer
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (settlementError) {
        console.error('Error creating settlement:', settlementError);
        return sendError(c, 'Failed to create settlement', 500);
      }

      // 3. Initiate Transfer (Simulated Razorpay Route API)
      // In production: await razorpay.transfers.create(...)
      
      console.log(`💸 Settling Booking ${bookingId}: Total ${amount}, Vendor ${vendorShare}, Platform ${commissionAmount}`);

      // ✅ SQL: Simulate success - update settlement status
      await db
        .from('settlements')
        .update({
          status: 'settled',
          settled_at: new Date().toISOString()
        })
        .eq('id', settlementId);
      
      // ✅ SQL: Update Booking settlement status
      await bookingsRepo.update(bookingId, {
        settlement_status: 'settled',
        settlement_id: settlementId
      });
      
      const settlement = {
        id: settlementId,
        bookingId,
        vendorId,
        totalAmount: amount,
        commissionRate,
        commissionAmount,
        vendorShare,
        status: 'settled',
        createdAt: settlementData.created_at,
        settledAt: new Date().toISOString()
      };

      return sendSuccess(c, { settlement });

    } catch (error) {
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
        // ✅ SQL: Save vendor bank account details in vendor_bank_details table
        const db = getDbClient();
        await db
          .from('vendor_bank_details')
          .upsert({
            vendor_id: vendorId,
            account_number: accountNumber,
            ifsc_code: ifsc,
            account_holder_name: name,
            verified: true,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'vendor_id'
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
      return sendError(c, error, 500);
    }
  });
}
