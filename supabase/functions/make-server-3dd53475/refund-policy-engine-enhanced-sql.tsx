/**
 * ============================================================================
 * REFUND POLICY ENGINE & AUTOMATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Phase 7C: Rule 6 Implementation
 * 
 * Features:
 * - Dynamic refund calculation based on time-to-service
 * - Wallet vs Original Source refund logic
 * - Razorpay refund integration (simulated)
 * - Automated processing
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `BookingsRepository`, `WalletsRepository`
 * - Uses `bookings`, `customer_wallets`, `wallet_transactions`, `platform_settings` (for refund policies) tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 17 - KV to SQL (7 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getWalletsRepository } from '../../lib/repositories/wallets.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const bookingsRepo = getBookingsRepository();
const walletsRepo = getWalletsRepository();

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
  cancellationFee: 50
};

// Helper to get vendor refund policy
async function getVendorRefundPolicy(vendorId: string): Promise<RefundPolicy> {
  const { data: policyData } = await db
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', `refund_policy_${vendorId}`)
    .single();
  
  return policyData?.setting_value || DEFAULT_POLICY;
}

export function refundPolicyEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // GET REFUND ESTIMATE
  // ========================================
  app.get(`${BASE_PATH}/refunds/estimate/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      
      // ✅ SQL: Fetch booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL: Fetch vendor specific policy or use default
      const vendorPolicy = await getVendorRefundPolicy(booking.vendor_id);

      // Calculate Refund
      const scheduledAt = new Date((booking as any).scheduled_at || booking.created_at);
      const now = new Date();
      const hoursUntilService = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilService < 0) {
        return sendError(c, 'Cannot cancel past booking', 400);
      }

      // Find applicable tier
      const sortedTiers = vendorPolicy.tiers.sort((a: any, b: any) => b.hoursBefore - a.hoursBefore);
      
      let percentage = 0;
      for (const tier of sortedTiers) {
        if (hoursUntilService >= tier.hoursBefore) {
          percentage = tier.refundPercentage;
          break;
        }
      }

      const paidAmount = parseFloat((booking as any).total_amount || 0);
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
      const { bookingId, reason, refundMethod } = await c.req.json();

      // ✅ SQL: Get Booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      if (booking.status === 'cancelled') {
        return sendError(c, 'Booking already cancelled', 400);
      }

      // Re-calculate refund amount
      const vendorPolicy = await getVendorRefundPolicy(booking.vendor_id);
      const scheduledAt = new Date((booking as any).scheduled_at || booking.created_at);
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
      
      const paidAmount = parseFloat((booking as any).total_amount || 0);
      let refundAmount = (paidAmount * percentage) / 100;
      if (refundAmount > 0) {
        refundAmount = Math.max(0, refundAmount - (vendorPolicy.cancellationFee || 0));
      }

      // Process Refund
      let transactionId = null;
      let status = 'processing';

      if (refundMethod === 'wallet') {
        // ✅ SQL: Instant Wallet Credit
        await walletsRepo.creditWallet(booking.customer_id, refundAmount, {
          reference_type: 'refund',
          reference_id: bookingId,
          description: `Refund for cancelled booking ${bookingId}`
        });
        
        status = 'completed';
        transactionId = `WAL_${Date.now()}`;
        console.log(`💰 Refunded ₹${refundAmount} to wallet for user ${booking.customer_id}`);
      } else {
        // Razorpay/Bank Refund (simulated)
        console.log(`💳 Initiating Razorpay refund for payment ${(booking as any).payment_id}, Amount: ₹${refundAmount}`);
        status = 'initiated';
        transactionId = `rfnd_${Date.now()}`;
      }

      // ✅ SQL: Update Booking Status
      await db
        .from('bookings')
        .update({
          status: 'cancelled',
          metadata: {
            ...((booking as any).metadata || {}),
            cancellationReason: reason,
            refundStatus: status,
            refundAmount,
            refundTransactionId: transactionId
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

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

  console.log('✅ Refund Policy Engine (SQL-only) registered');
}

