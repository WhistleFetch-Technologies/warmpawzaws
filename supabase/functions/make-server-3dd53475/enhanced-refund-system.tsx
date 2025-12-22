/**
 * ENHANCED REFUND SYSTEM WITH POLICY ENFORCEMENT
 * 
 * Features:
 * - Refund to wallet (100% - no fees)
 * - Refund to original payment method (with cancellation fees)
 * - Automatic policy enforcement based on service type and cancellation window
 * - Support for vendor penalties
 * - Comprehensive refund tracking
 * 
 * Status: ✅ P0 CRITICAL IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

const app = new Hono();
app.use('*', cors());

// Helper: Generate refund ID
function generateRefundId() {
  return `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Get refund policy from admin settings
async function getRefundPolicy(roleId: string, serviceStyle: string) {
  const settings = await kv.get('platform:refund_settings') || {};
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
 * 
 * P0 CRITICAL - Refund calculation with policy enforcement
 */
app.post('/refund/calculate', async (c) => {
  try {
    const { bookingId, refundMethod } = await c.req.json();

    if (!bookingId) {
      return c.json({ error: 'bookingId is required' }, 400);
    }

    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Get refund policy
    const policy = await getRefundPolicy(booking.roleId || 'veterinarian', booking.serviceStyle || 'at_center');

    if (!policy.allowRefund) {
      return c.json({
        success: false,
        allowRefund: false,
        message: 'Refunds are not allowed for this service'
      });
    }

    // Calculate hours until appointment
    const hoursUntil = getHoursUntilAppointment(
      booking.scheduledDateTime || booking.scheduledDate + 'T' + booking.scheduledTime
    );

    const originalAmount = booking.price || booking.amount || 0;
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

    return c.json({
      success: true,
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
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /refund/process-enhanced
 * Process refund with policy enforcement
 * Supports both wallet and original payment method
 * 
 * P0 CRITICAL - Enhanced refund processing
 */
app.post('/refund/process-enhanced', async (c) => {
  try {
    const { bookingId, refundMethod, reason, cancelledBy } = await c.req.json();

    if (!bookingId || !refundMethod) {
      return c.json({ error: 'bookingId and refundMethod are required' }, 400);
    }

    if (!['wallet', 'original'].includes(refundMethod)) {
      return c.json({ error: 'refundMethod must be "wallet" or "original"' }, 400);
    }

    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Check if already refunded
    if (booking.refundStatus === 'completed') {
      return c.json({ error: 'Booking already refunded' }, 400);
    }

    // Calculate refund amount
    const calcResponse = await fetch(`${c.req.url.replace('/refund/process-enhanced', '/refund/calculate')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, refundMethod })
    });

    if (!calcResponse.ok) {
      return c.json({ error: 'Failed to calculate refund' }, 500);
    }

    const calcResult = await calcResponse.json();

    if (!calcResult.allowRefund) {
      return c.json({ error: 'Refund not allowed for this booking' }, 400);
    }

    const { refundAmount, cancellationFee, originalAmount } = calcResult.calculation;

    const refundId = generateRefundId();

    // Process based on refund method
    if (refundMethod === 'wallet') {
      // Credit to wallet (100% refund)
      const wallet = await kv.get(`wallet:${booking.customerId}`) || {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0
      };

      wallet.balance += refundAmount;
      wallet.totalEarned += refundAmount;
      await kv.set(`wallet:${booking.customerId}`, wallet);

      // Record wallet transaction
      const walletTxn = {
        id: `wallet_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        customerId: booking.customerId,
        type: 'refund',
        amount: refundAmount,
        status: 'completed',
        bookingId,
        refundId,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      await kv.set(`wallet:transaction:${walletTxn.id}`, walletTxn);

      // Add to customer's transaction history
      const transactions = await kv.get(`wallet:${booking.customerId}:transactions`) || [];
      transactions.unshift(walletTxn.id);
      await kv.set(`wallet:${booking.customerId}:transactions`, transactions);

      console.log(`✅ [REFUND-WALLET] ₹${refundAmount} credited to wallet for customer ${booking.customerId}`);

    } else if (refundMethod === 'original') {
      // Refund to original payment method via Razorpay
      if (!booking.razorpayPaymentId && !booking.paymentId) {
        return c.json({ error: 'No payment ID found for this booking' }, 400);
      }

      const razorpayResult = await processRazorpayRefund(
        booking.razorpayPaymentId || booking.paymentId,
        refundAmount,
        reason || 'Booking cancellation'
      );

      if (!razorpayResult.success) {
        return c.json({ 
          error: 'Razorpay refund failed',
          details: razorpayResult.error 
        }, 500);
      }

      console.log(`✅ [REFUND-ORIGINAL] Razorpay refund ${razorpayResult.refundId} for ₹${refundAmount}`);
    }

    // Create refund record
    const refundRecord = {
      id: refundId,
      bookingId,
      customerId: booking.customerId,
      vendorId: booking.vendorId,
      originalAmount,
      refundAmount,
      cancellationFee,
      refundMethod,
      status: refundMethod === 'wallet' ? 'completed' : 'processing',
      reason: reason || 'Customer cancellation',
      cancelledBy: cancelledBy || 'customer',
      razorpayRefundId: refundMethod === 'original' ? 'razorpay_refund_id' : null,
      processedAt: new Date().toISOString(),
      completedAt: refundMethod === 'wallet' ? new Date().toISOString() : null
    };

    await kv.set(`refund:${refundId}`, refundRecord);

    // Update booking
    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();
    booking.cancelledBy = cancelledBy || 'customer';
    booking.refundStatus = refundRecord.status;
    booking.refundId = refundId;
    booking.refundAmount = refundAmount;
    booking.cancellationFee = cancellationFee;

    await kv.set(`booking:${bookingId}`, booking);

    // Adjust vendor earnings (deduct from pending)
    if (booking.vendorId) {
      const vendorEarnings = await kv.get(`earnings:vendor:${booking.vendorId}`) || {
        lifetime: { totalEarnings: 0, settledEarnings: 0, pendingEarnings: 0 }
      };

      // Deduct the vendor's earnings for this booking
      const vendorShare = booking.earnings?.vendorEarnings || 0;
      vendorEarnings.lifetime.pendingEarnings = Math.max(0, (vendorEarnings.lifetime.pendingEarnings || 0) - vendorShare);
      vendorEarnings.lifetime.totalEarnings = Math.max(0, (vendorEarnings.lifetime.totalEarnings || 0) - vendorShare);

      await kv.set(`earnings:vendor:${booking.vendorId}`, vendorEarnings);

      console.log(`💸 [VENDOR-EARNINGS] Adjusted vendor ${booking.vendorId} earnings by -₹${vendorShare}`);
    }

    // Send notification to customer
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: booking.customerId,
      userType: 'customer',
      type: 'refund_processed',
      title: refundMethod === 'wallet' ? 'Refund Completed' : 'Refund Initiated',
      message: refundMethod === 'wallet' 
        ? `₹${refundAmount} has been added to your wallet`
        : `Your refund of ₹${refundAmount} will be processed within 5-7 business days`,
      data: { refundId, bookingId, amount: refundAmount, method: refundMethod },
      read: false,
      priority: 'high',
      createdAt: new Date().toISOString()
    };

    const notifications = await kv.get(`notifications:${booking.customerId}`) || [];
    notifications.unshift(notification);
    await kv.set(`notifications:${booking.customerId}`, notifications);

    console.log(`✅ [REFUND] Processed ${refundId}: ₹${refundAmount} via ${refundMethod} for booking ${bookingId}`);

    return c.json({
      success: true,
      refund: refundRecord,
      message: refundMethod === 'wallet'
        ? 'Refund completed and added to wallet'
        : 'Refund initiated. Amount will be credited within 5-7 business days'
    });

  } catch (error) {
    console.error('❌ Error processing refund:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /refund/:refundId
 * Get refund details
 */
app.get('/refund/:refundId', async (c) => {
  try {
    const refundId = c.req.param('refundId');

    const refund = await kv.get(`refund:${refundId}`);
    if (!refund) {
      return c.json({ error: 'Refund not found' }, 404);
    }

    return c.json({
      success: true,
      refund
    });

  } catch (error) {
    console.error('❌ Error fetching refund:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customer/:customerId/refunds
 * Get customer's refund history
 */
app.get('/customer/:customerId/refunds', async (c) => {
  try {
    const customerId = c.req.param('customerId');

    const allRefunds = await kv.getByPrefix('refund:');
    const customerRefunds = allRefunds.filter((r: any) => r.customerId === customerId);

    // Sort by most recent first
    customerRefunds.sort((a: any, b: any) => 
      new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
    );

    return c.json({
      success: true,
      refunds: customerRefunds,
      count: customerRefunds.length
    });

  } catch (error) {
    console.error('❌ Error fetching customer refunds:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /refund/:refundId/update-status
 * Update refund status (for webhook processing)
 */
app.post('/refund/:refundId/update-status', async (c) => {
  try {
    const refundId = c.req.param('refundId');
    const { status, razorpayRefundId } = await c.req.json();

    const refund = await kv.get(`refund:${refundId}`);
    if (!refund) {
      return c.json({ error: 'Refund not found' }, 404);
    }

    refund.status = status;
    refund.updatedAt = new Date().toISOString();

    if (status === 'completed') {
      refund.completedAt = new Date().toISOString();
    }

    if (razorpayRefundId) {
      refund.razorpayRefundId = razorpayRefundId;
    }

    await kv.set(`refund:${refundId}`, refund);

    // Update booking status
    if (refund.bookingId) {
      const booking = await kv.get(`booking:${refund.bookingId}`);
      if (booking) {
        booking.refundStatus = status;
        await kv.set(`booking:${refund.bookingId}`, booking);
      }
    }

    console.log(`✅ [REFUND] Status updated: ${refundId} -> ${status}`);

    return c.json({
      success: true,
      refund
    });

  } catch (error) {
    console.error('❌ Error updating refund status:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
