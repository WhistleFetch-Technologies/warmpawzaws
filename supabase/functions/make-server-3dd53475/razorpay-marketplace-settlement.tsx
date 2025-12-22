import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { TIER_CONFIG } from "./tier-system.tsx";

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

export function razorpayMarketplaceSettlement(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /razorpay/marketplace/settlement
   * Trigger settlement for a completed booking
   */
  app.post(`${BASE_PATH}/razorpay/marketplace/settlement`, async (c) => {
    try {
      const { bookingId } = await c.req.json();
      
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) return sendError(c, 'Booking not found', 404);
      
      if (booking.status !== 'completed') {
        return sendError(c, 'Booking must be completed to settle', 400);
      }
      
      if (booking.settlementStatus === 'settled') {
        return sendSuccess(c, { message: 'Already settled' });
      }

      const vendorId = booking.vendorId;
      const amount = booking.totalAmount || 0;

      // 1. Get Vendor Tier & Commission
      const tierData = await kv.get(`vendor_tier_${vendorId}`) || { currentTier: 'SILVER' };
      const tierConfig = TIER_CONFIG[tierData.currentTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.SILVER;
      
      const commissionRate = tierConfig.commissionRate;
      const commissionAmount = (amount * commissionRate) / 100;
      const vendorShare = amount - commissionAmount;

      // 2. Create Settlement Record
      const settlementId = `set_${Date.now()}_${bookingId}`;
      const settlement = {
        id: settlementId,
        bookingId,
        vendorId,
        totalAmount: amount,
        commissionRate,
        commissionAmount,
        vendorShare,
        status: 'processing', // pending Razorpay transfer
        createdAt: new Date().toISOString()
      };

      await kv.set(`settlement:${settlementId}`, settlement);

      // 3. Initiate Transfer (Simulated Razorpay Route API)
      // In production: await razorpay.transfers.create(...)
      
      console.log(`💸 Settling Booking ${bookingId}: Total ${amount}, Vendor ${vendorShare}, Platform ${commissionAmount}`);

      // Simulate success
      settlement.status = 'settled';
      settlement.settledAt = new Date().toISOString();
      await kv.set(`settlement:${settlementId}`, settlement);
      
      // Update Booking
      booking.settlementStatus = 'settled';
      booking.settlementId = settlementId;
      await kv.set(`booking:${bookingId}`, booking);

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
        await kv.set(`vendor_bank:${vendorId}`, {
           accountNumber,
           ifsc,
           accountName: name,
           isVerified: true,
           verifiedAt: new Date().toISOString()
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
