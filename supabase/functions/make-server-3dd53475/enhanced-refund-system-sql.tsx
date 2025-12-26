/**
 * 💰 ENHANCED REFUND SYSTEM WITH POLICY ENFORCEMENT - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Features:
 * - Refund to wallet (100% - no fees)
 * - Refund to original payment method (with cancellation fees)
 * - Automatic policy enforcement based on service type and cancellation window
 * - Support for vendor penalties
 * - Comprehensive refund tracking
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (20 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getRefundsRepository } from '../../lib/repositories/refunds.ts';
import { getPaymentsRepository } from '../../lib/repositories/payments.ts';
import { getWalletsRepository } from '../../lib/repositories/wallets.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorEarningsRepository } from '../../lib/repositories/vendor-earnings.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';
import { withTransaction } from '../../lib/utils/transaction-helper.ts';

const app = new Hono();
app.use('*', cors());

const db = getDbClient();
const refundsRepo = getRefundsRepository();
const paymentsRepo = getPaymentsRepository();
const walletsRepo = getWalletsRepository();
const bookingsRepo = getBookingsRepository();
const vendorEarningsRepo = getVendorEarningsRepository();
const notificationsRepo = getNotificationsRepository();

// Helper: Get refund policy from platform_settings
async function getRefundPolicy(roleId: string, serviceStyle: string) {
  // ✅ SQL: Get refund policy from platform_settings
  const { data: setting } = await db
    .from('platform_settings')
    .select('*')
    .eq('setting_key', 'refund_settings')
    .single();

  const settings = setting?.setting_value || {};
  const policyKey = `${roleId}_${serviceStyle}`;
  
  // Return policy or default
  return settings.policies?.[policyKey] || {
    allowRefund: true,
    refundPercentage: 100,
    cancellationWindow: 24, // hours
    cancellationFeePercentage: 10
  };
}

// Helper: Calculate hours until appointment
function getHoursUntilAppointment(scheduledDateTime: string): number {
  const appointmentTime = new Date(scheduledDateTime).getTime();
  const currentTime = Date.now();
  return (appointmentTime - currentTime) / (1000 * 60 * 60);
}

// Helper: Process Razorpay refund
async function processRazorpayRefund(
  paymentId: string,
  amount: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      return { success: false, error: 'Razorpay credentials not configured' };
    }

    const amountInPaise = Math.round(amount * 100);
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amountInPaise,
          speed: 'normal',
          notes: {
            reason: reason || 'Booking cancellation',
            platform: 'warmpawz'
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.description || 'Refund failed'
      };
    }

    const refund = await response.json();
    return {
      success: true,
      refundId: refund.id
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * POST /refund/calculate
 * Calculate refund amount based on policy
 */
app.post('/make-server-3dd53475/refund/calculate', async (c) => {
  try {
    const { bookingId, refundMethod } = await c.req.json();

    if (!bookingId) {
      return sendError(c, 'bookingId is required', 400);
    }

    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }

    // ✅ SQL: Get refund policy
    const policy = await getRefundPolicy(
      booking.metadata?.roleId || 'veterinarian',
      booking.service_type || 'at_vendor'
    );

    if (!policy.allowRefund) {
      return sendSuccess(c, {
        allowRefund: false,
        message: 'Refunds are not allowed for this service'
      });
    }

    // Calculate hours until appointment
    const scheduledDateTime = booking.booking_date && booking.booking_time
      ? `${booking.booking_date}T${booking.booking_time}`
      : booking.metadata?.scheduledDateTime || '';
    
    const hoursUntil = getHoursUntilAppointment(scheduledDateTime);

    const originalAmount = booking.total_amount || 0;
    let refundAmount = originalAmount;
    let cancellationFee = 0;
    let cancellationFeePercentage = 0;

    // Wallet refund: 100% refund, no fees
    if (refundMethod === 'wallet') {
      refundAmount = originalAmount;
      cancellationFee = 0;
      cancellationFeePercentage = 0;
    } 
    // Original payment refund: Apply cancellation fee based on window
    else if (refundMethod === 'original') {
      if (hoursUntil < policy.cancellationWindow) {
        // Within cancellation window - apply fee
        cancellationFeePercentage = policy.cancellationFeePercentage || 10;
        cancellationFee = Math.round((originalAmount * cancellationFeePercentage) / 100);
        refundAmount = originalAmount - cancellationFee;
      } else {
        // Outside window - full refund
        refundAmount = originalAmount;
        cancellationFee = 0;
        cancellationFeePercentage = 0;
      }
    }

    console.log(`💰 [REFUND-CALC] Booking ${bookingId}: Original ₹${originalAmount}, Refund ₹${refundAmount}, Fee ₹${cancellationFee}`);

    return sendSuccess(c, {
      allowRefund: true,
      calculation: {
        originalAmount,
        refundAmount,
        cancellationFee,
        cancellationFeePercentage,
        refundMethod,
        hoursUntilAppointment: hoursUntil,
        cancellationWindow: policy.cancellationWindow,
        withinCancellationWindow: hoursUntil < policy.cancellationWindow
      },
      policy
    });

  } catch (error) {
    console.error('❌ Error calculating refund:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /refund/process-enhanced
 * Process refund with policy enforcement
 */
app.post('/make-server-3dd53475/refund/process-enhanced', async (c) => {
  try {
    const { bookingId, refundMethod, reason, cancelledBy } = await c.req.json();

    if (!bookingId || !refundMethod) {
      return sendError(c, 'bookingId and refundMethod are required', 400);
    }

    if (!['wallet', 'original'].includes(refundMethod)) {
      return sendError(c, 'refundMethod must be "wallet" or "original"', 400);
    }

    return await withTransaction(async (txClient) => {
      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Check if already refunded
      if (booking.payment_status === 'refunded') {
        return sendError(c, 'Booking already refunded', 400);
      }

      // Calculate refund amount
      const calcResponse = await fetch(`${c.req.url.replace('/refund/process-enhanced', '/refund/calculate')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, refundMethod })
      });

      if (!calcResponse.ok) {
        return sendError(c, 'Failed to calculate refund', 500);
      }

      const calcResult = await calcResponse.json();
      if (!calcResult.data?.allowRefund) {
        return sendError(c, 'Refund not allowed for this booking', 400);
      }

      const { refundAmount, cancellationFee, originalAmount } = calcResult.data.calculation;

      // ✅ SQL: Get payment for this booking
      const payments = await paymentsRepo.findByBooking(bookingId);
      const payment = payments.length > 0 ? payments[0] : null;
      if (!payment && refundMethod === 'original') {
        return sendError(c, 'No payment found for this booking', 400);
      }

      // Process based on refund method
      let razorpayRefundId: string | null = null;

      if (refundMethod === 'wallet') {
        // ✅ SQL: Credit to wallet (100% refund)
        const wallet = await walletsRepo.findOrCreate(booking.customer_id);
        await walletsRepo.addTransaction({
          wallet_id: wallet.id,
          customer_id: booking.customer_id,
          transaction_type: 'credit',
          amount: refundAmount,
          purpose: 'refund',
          description: `Refund for booking ${bookingId}`,
          reference_id: bookingId
        });

        console.log(`✅ [REFUND-WALLET] ₹${refundAmount} credited to wallet for customer ${booking.customer_id}`);

      } else if (refundMethod === 'original') {
        // Refund to original payment method via Razorpay
        if (!payment?.razorpay_payment_id) {
          return sendError(c, 'No Razorpay payment ID found for this booking', 400);
        }

        const razorpayResult = await processRazorpayRefund(
          payment.razorpay_payment_id,
          refundAmount,
          reason || 'Booking cancellation'
        );

        if (!razorpayResult.success) {
          return sendError(c, `Razorpay refund failed: ${razorpayResult.error}`, 500);
        }

        razorpayRefundId = razorpayResult.refundId || null;
        console.log(`✅ [REFUND-ORIGINAL] Razorpay refund ${razorpayRefundId} for ₹${refundAmount}`);
      }

      // ✅ SQL: Create refund record
      const refund = await refundsRepo.create({
        payment_id: payment?.id || '',
        booking_id: bookingId,
        customer_id: booking.customer_id,
        vendor_id: booking.vendor_id || null,
        refund_amount: refundAmount,
        refund_reason: reason || 'Customer cancellation',
        refund_status: refundMethod === 'wallet' ? 'completed' : 'processing',
        razorpay_refund_id: razorpayRefundId
      });

      // ✅ SQL: Update booking
      await bookingsRepo.update(bookingId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Customer cancellation',
        payment_status: refundMethod === 'wallet' ? 'refunded' : 'processing'
      });

      // ✅ SQL: Update payment status
      if (payment) {
        await paymentsRepo.update(payment.id, {
          payment_status: refundMethod === 'wallet' ? 'refunded' : 'processing'
        });
      }

      // ✅ SQL: Adjust vendor earnings (deduct from pending)
      if (booking.vendor_id) {
        // Get vendor earnings for this booking
        const bookingEarnings = await vendorEarningsRepo.findByBooking(bookingId);
        
        if (bookingEarnings) {
          // Deduct the vendor's earnings for this booking
          const vendorShare = bookingEarnings.total_amount || 0;
          await vendorEarningsRepo.update(bookingEarnings.id, {
            status: 'cancelled'
          });

          console.log(`💸 [VENDOR-EARNINGS] Adjusted vendor ${booking.vendor_id} earnings by -₹${vendorShare}`);
        }
      }

      // ✅ SQL: Send notification to customer
      await notificationsRepo.create({
        recipient_type: 'customer',
        recipient_id: booking.customer_id,
        notification_type: 'refund_processed',
        title: refundMethod === 'wallet' ? 'Refund Completed' : 'Refund Initiated',
        message: refundMethod === 'wallet' 
          ? `₹${refundAmount} has been added to your wallet`
          : `Your refund of ₹${refundAmount} will be processed within 5-7 business days`,
        channels: { inApp: true, push: true },
        metadata: {
          refundId: refund.id,
          bookingId,
          amount: refundAmount,
          method: refundMethod
        }
      });

      console.log(`✅ [REFUND] Processed ${refund.id}: ₹${refundAmount} via ${refundMethod} for booking ${bookingId}`);

      return sendSuccess(c, {
        refund: {
          id: refund.id,
          bookingId: refund.booking_id,
          customerId: refund.customer_id,
          vendorId: refund.vendor_id,
          originalAmount,
          refundAmount: refund.refund_amount,
          cancellationFee,
          refundMethod,
          status: refund.refund_status,
          razorpayRefundId: refund.razorpay_refund_id,
          processedAt: refund.processed_at,
          completedAt: refund.completed_at
        }
      }, refundMethod === 'wallet'
        ? 'Refund completed and added to wallet'
        : 'Refund initiated. Amount will be credited within 5-7 business days');

    });
  } catch (error) {
    console.error('❌ Error processing refund:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /refund/:refundId
 * Get refund details
 */
app.get('/make-server-3dd53475/refund/:refundId', async (c) => {
  try {
    const refundId = c.req.param('refundId');

    // ✅ SQL: Get refund
    const refund = await refundsRepo.findById(refundId);
    if (!refund) {
      return sendError(c, 'Refund not found', 404);
    }

    return sendSuccess(c, { refund });

  } catch (error) {
    console.error('❌ Error fetching refund:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /customer/:customerId/refunds
 * Get customer's refund history
 */
app.get('/make-server-3dd53475/customer/:customerId/refunds', async (c) => {
  try {
    const customerId = c.req.param('customerId');

    // ✅ SQL: Get customer refunds
    const refunds = await refundsRepo.findByCustomerId(customerId);

    return sendSuccess(c, {
      refunds,
      count: refunds.length
    });

  } catch (error) {
    console.error('❌ Error fetching customer refunds:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /refund/:refundId/update-status
 * Update refund status (for webhook processing)
 */
app.post('/make-server-3dd53475/refund/:refundId/update-status', async (c) => {
  try {
    const refundId = c.req.param('refundId');
    const { status, razorpayRefundId } = await c.req.json();

    // ✅ SQL: Get refund
    const refund = await refundsRepo.findById(refundId);
    if (!refund) {
      return sendError(c, 'Refund not found', 404);
    }

    // ✅ SQL: Update refund status
    const updateData: any = {
      refund_status: status
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (razorpayRefundId) {
      updateData.razorpay_refund_id = razorpayRefundId;
    }

    await refundsRepo.update(refundId, updateData);

    // ✅ SQL: Update booking status
    if (refund.booking_id) {
      await bookingsRepo.update(refund.booking_id, {
        payment_status: status === 'completed' ? 'refunded' : 'processing'
      });
    }

    console.log(`✅ [REFUND] Status updated: ${refundId} -> ${status}`);

    return sendSuccess(c, {
      refund: {
        ...refund,
        ...updateData
      }
    });

  } catch (error) {
    console.error('❌ Error updating refund status:', error);
    return sendError(c, error, 500);
  }
});

export default app;

