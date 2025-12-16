import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 💸 REFUND POLICY ENGINE & AUTOMATION
 * 
 * Phase 7C: Rule 6 Implementation
 * 
 * Features:
 * - Dynamic refund calculation based on time-to-service
 * - Wallet vs Original Source refund logic
 * - Razorpay refund integration (simulated)
 * - Automated processing
 */

interface RefundPolicy {
  tiers: {
    hoursBefore: number;
    refundPercentage: number;
  }[];
  cancellationFee: number;
}

const DEFAULT_POLICY: RefundPolicy = {
  tiers: [
    { hoursBefore: 48, refundPercentage: 100 },
    { hoursBefore: 24, refundPercentage: 80 },
    { hoursBefore: 4, refundPercentage: 50 }
  ],
  cancellationFee: 50 // Fixed fee
};

export function refundPolicyEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // GET REFUND ESTIMATE
  // ========================================
  app.get(`${BASE_PATH}/refunds/estimate/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      
      // 1. Fetch booking details
      const booking = await kv.get(`booking_${bookingId}`);
      if (!booking) return sendError(c, 'Booking not found', 404);

      // 2. Fetch vendor specific policy or use default
      const vendorPolicy = await kv.get(`refund_policy_${booking.vendorId}`) || DEFAULT_POLICY;

      // 3. Calculate Refund
      const scheduledAt = new Date(booking.scheduledAt);
      const now = new Date();
      const hoursUntilService = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilService < 0) {
          return sendError(c, 'Cannot cancel past booking', 400);
      }

      // Find applicable tier
      // Sort tiers descending by hoursBefore
      const sortedTiers = vendorPolicy.tiers.sort((a: any, b: any) => b.hoursBefore - a.hoursBefore);
      
      let percentage = 0;
      for (const tier of sortedTiers) {
          if (hoursUntilService >= tier.hoursBefore) {
              percentage = tier.refundPercentage;
              break;
          }
      }
      // If closer than the last tier (e.g. < 4 hours), percentage remains 0 or whatever logic
      // Assuming if < 4 hours, it might be 0% or minimal.

      const paidAmount = booking.totalAmount || 0;
      let refundAmount = (paidAmount * percentage) / 100;

      // Deduct cancellation fee if applicable
      if (refundAmount > 0) {
          refundAmount = Math.max(0, refundAmount - (vendorPolicy.cancellationFee || 0));
      }

      return sendSuccess(c, {
          bookingId,
          paidAmount,
          hoursUntilService: parseFloat(hoursUntilService.toFixed(1)),
          refundPercentage: percentage,
          cancellationFee: vendorPolicy.cancellationFee || 0,
          estimatedRefund: refundAmount,
          policyApplied: vendorPolicy
      });

    } catch (error) {
      console.error('Error calculating refund:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // REQUEST REFUND / CANCEL
  // ========================================
  app.post(`${BASE_PATH}/refunds/request`, async (c) => {
    try {
      const { bookingId, reason, refundMethod } = await c.req.json(); // refundMethod: 'wallet' | 'original'

      // 1. Get Booking
      const booking = await kv.get(`booking_${bookingId}`);
      if (!booking) return sendError(c, 'Booking not found', 404);
      if (booking.status === 'cancelled') return sendError(c, 'Booking already cancelled', 400);

      // 2. Re-calculate refund amount (security check)
      // ... reuse logic from estimate ...
      const vendorPolicy = await kv.get(`refund_policy_${booking.vendorId}`) || DEFAULT_POLICY;
      const scheduledAt = new Date(booking.scheduledAt);
      const now = new Date();
      const hoursUntilService = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      const sortedTiers = vendorPolicy.tiers.sort((a: any, b: any) => b.hoursBefore - a.hoursBefore);
      let percentage = 0;
      for (const tier of sortedTiers) {
          if (hoursUntilService >= tier.hoursBefore) {
              percentage = tier.refundPercentage;
              break;
          }
      }
      let refundAmount = (booking.totalAmount * percentage) / 100;
      if (refundAmount > 0) refundAmount = Math.max(0, refundAmount - (vendorPolicy.cancellationFee || 0));

      // 3. Process Refund
      let transactionId = null;
      let status = 'processing';

      if (refundMethod === 'wallet') {
          // Instant Wallet Credit
          const customerWallet = await kv.get(`wallet_${booking.customerId}`) || { balance: 0 };
          customerWallet.balance += refundAmount;
          await kv.set(`wallet_${booking.customerId}`, customerWallet);
          
          status = 'completed';
          transactionId = `WAL_${Date.now()}`;
          console.log(`💰 Refunded ₹${refundAmount} to wallet for user ${booking.customerId}`);

      } else {
          // Razorpay/Bank Refund
          // Mocking the API call
          console.log(`💳 Initiating Razorpay refund for payment ${booking.paymentId}, Amount: ₹${refundAmount}`);
          // await razorpay.refunds.create(...)
          status = 'initiated'; // Takes 5-7 days
          transactionId = `rfnd_${Date.now()}`;
      }

      // 4. Update Booking Status
      booking.status = 'cancelled';
      booking.cancellationReason = reason;
      booking.refundStatus = status;
      booking.refundAmount = refundAmount;
      booking.refundTransactionId = transactionId;
      
      await kv.set(`booking_${bookingId}`, booking);

      return sendSuccess(c, {
          success: true,
          bookingId,
          status: 'cancelled',
          refundAmount,
          refundStatus: status,
          refundMethod,
          message: refundMethod === 'wallet' ? 'Refund credited to wallet instantly' : 'Refund initiated to original source (5-7 days)'
      });

    } catch (error) {
      console.error('Error processing refund:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Refund Policy Engine registered');
}
