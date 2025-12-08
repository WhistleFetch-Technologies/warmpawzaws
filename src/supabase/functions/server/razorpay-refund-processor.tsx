import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';

/**
 * RAZORPAY REFUND PROCESSOR
 * 
 * Handles actual refund processing via Razorpay API
 * Called by booking cancellation flow
 * 
 * Features:
 * - Process refund via Razorpay API
 * - Handle refund webhooks
 * - Adjust vendor payout
 * - Update booking status
 * - Notify customer
 */

export function registerRazorpayRefundProcessor(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * POST /refunds/process
   * Process a refund for a cancelled booking
   */
  app.post(`${BASE}/refunds/process`, async (c) => {
    try {
      const { bookingId, amount, reason } = await c.req.json();

      if (!bookingId || !amount) {
        return c.json({ error: 'bookingId and amount required' }, 400);
      }

      console.log(`💰 [REFUND] Processing refund for booking ${bookingId}: ₹${amount}`);

      // Get booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Check if already refunded
      if (booking.refund?.status === 'completed' || booking.refund?.razorpayRefundId) {
        return c.json({ 
          error: 'Refund already processed',
          refundId: booking.refund.razorpayRefundId
        }, 400);
      }

      // Get payment settings
      const paymentSettings = await kv.get('admin:settings:payment') || {};
      const razorpayKeyId = paymentSettings.razorpay?.keyId || Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = paymentSettings.razorpay?.keySecret || Deno.env.get('RAZORPAY_KEY_SECRET');

      if (!razorpayKeyId || !razorpayKeySecret) {
        console.error('[REFUND] Razorpay credentials not configured');
        return c.json({ error: 'Payment gateway not configured' }, 500);
      }

      // Process refund via Razorpay API
      const refundResult = await processRazorpayRefund(
        booking.razorpayPaymentId || booking.paymentId,
        amount,
        razorpayKeyId,
        razorpayKeySecret,
        reason
      );

      if (!refundResult.success) {
        console.error('[REFUND] Razorpay API error:', refundResult.error);
        
        // Save failed refund attempt
        booking.refund = {
          ...booking.refund,
          status: 'failed',
          error: refundResult.error,
          attemptedAt: new Date().toISOString()
        };
        await kv.set(`booking:${bookingId}`, booking);

        return c.json({ 
          error: 'Refund processing failed',
          details: refundResult.error
        }, 500);
      }

      // Update booking with refund details
      booking.refund = {
        ...booking.refund,
        status: 'processing',
        razorpayRefundId: refundResult.refundId,
        processedAt: new Date().toISOString(),
        razorpayResponse: refundResult.response
      };
      await kv.set(`booking:${bookingId}`, booking);

      // Adjust vendor payout
      await adjustVendorPayout(
        booking.vendorId,
        -amount,
        bookingId,
        'refund'
      );

      // Send notification to customer
      await sendRefundNotification(booking.customerId, amount, refundResult.refundId);

      console.log(`✅ [REFUND] Successfully initiated refund ${refundResult.refundId}`);

      return c.json({
        success: true,
        refundId: refundResult.refundId,
        amount,
        status: 'processing',
        message: 'Refund initiated successfully. It will be processed within 5-7 business days.'
      });

    } catch (error) {
      console.error('[REFUND] Error:', error);
      return c.json({ error: 'Failed to process refund' }, 500);
    }
  });

  /**
   * POST /webhooks/razorpay/refund
   * Handle Razorpay refund webhooks
   */
  app.post(`${BASE}/webhooks/razorpay/refund`, async (c) => {
    try {
      const webhook = await c.req.json();
      console.log(`🔔 [WEBHOOK] Razorpay refund event: ${webhook.event}`);

      // Verify webhook signature (production requirement)
      // const isValid = verifyRazorpayWebhook(webhook, c.req.header('X-Razorpay-Signature'));
      // if (!isValid) return c.json({ error: 'Invalid signature' }, 401);

      if (webhook.event === 'refund.processed') {
        const refund = webhook.payload.refund.entity;
        await handleRefundProcessed(refund);
      } else if (webhook.event === 'refund.failed') {
        const refund = webhook.payload.refund.entity;
        await handleRefundFailed(refund);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('[WEBHOOK] Error:', error);
      return c.json({ error: 'Webhook processing failed' }, 500);
    }
  });

  /**
   * GET /refunds/:refundId/status
   * Check refund status
   */
  app.get(`${BASE}/refunds/:refundId/status`, async (c) => {
    try {
      const { refundId } = c.req.param();

      // Get payment settings
      const paymentSettings = await kv.get('admin:settings:payment') || {};
      const razorpayKeyId = paymentSettings.razorpay?.keyId || Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = paymentSettings.razorpay?.keySecret || Deno.env.get('RAZORPAY_KEY_SECRET');

      const status = await fetchRefundStatus(refundId, razorpayKeyId, razorpayKeySecret);

      return c.json({
        success: true,
        refund: status
      });
    } catch (error) {
      console.error('[REFUND] Status check error:', error);
      return c.json({ error: 'Failed to fetch refund status' }, 500);
    }
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  async function processRazorpayRefund(
    paymentId: string,
    amount: number,
    keyId: string,
    keySecret: string,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string; response?: any; error?: string }> {
    try {
      // Convert to paise (Razorpay uses smallest currency unit)
      const amountInPaise = Math.round(amount * 100);

      const auth = btoa(`${keyId}:${keySecret}`);
      
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
            speed: 'normal', // normal | optimum
            notes: {
              reason: reason || 'Booking cancellation',
              platform: 'warmpawz'
            },
            receipt: `refund_${Date.now()}`
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('[RAZORPAY] Refund API error:', error);
        return {
          success: false,
          error: error.error?.description || 'Refund failed'
        };
      }

      const refund = await response.json();
      
      console.log(`✅ [RAZORPAY] Refund created: ${refund.id}`);

      return {
        success: true,
        refundId: refund.id,
        response: refund
      };

    } catch (error) {
      console.error('[RAZORPAY] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async function fetchRefundStatus(refundId: string, keyId: string, keySecret: string) {
    const auth = btoa(`${keyId}:${keySecret}`);
    
    const response = await fetch(
      `https://api.razorpay.com/v1/refunds/${refundId}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch refund status');
    }

    return await response.json();
  }

  async function adjustVendorPayout(
    vendorId: string,
    amount: number,
    bookingId: string,
    type: string
  ) {
    try {
      // Get vendor earnings
      const earnings = await kv.get(`vendor:${vendorId}:earnings`) || {
        totalEarnings: 0,
        availableBalance: 0,
        pendingBalance: 0,
        transactions: []
      };

      // Deduct from pending balance (refund)
      earnings.pendingBalance = Math.max(0, earnings.pendingBalance + amount); // amount is negative
      
      // Add transaction record
      earnings.transactions.unshift({
        id: generateId('txn'),
        type,
        amount,
        bookingId,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });

      await kv.set(`vendor:${vendorId}:earnings`, earnings);

      console.log(`💸 [PAYOUT] Adjusted vendor ${vendorId} balance by ₹${amount}`);
    } catch (error) {
      console.error('[PAYOUT] Adjustment error:', error);
    }
  }

  async function sendRefundNotification(customerId: string, amount: number, refundId: string) {
    try {
      const notification = {
        id: generateId('notif'),
        userId: customerId,
        userType: 'customer',
        type: 'refund_processed',
        title: 'Refund Initiated',
        message: `Your refund of ₹${amount} has been initiated. It will be credited within 5-7 business days.`,
        data: { refundId, amount },
        read: false,
        priority: 'high',
        createdAt: new Date().toISOString()
      };

      const notifications = await kv.get(`notifications:${customerId}`) || [];
      notifications.unshift(notification);
      await kv.set(`notifications:${customerId}`, notifications);

      console.log(`📧 [NOTIFICATION] Refund notification sent to customer ${customerId}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error:', error);
    }
  }

  async function handleRefundProcessed(refund: any) {
    console.log(`✅ [WEBHOOK] Refund processed: ${refund.id}`);

    // Find booking by payment ID
    const bookings = await kv.getByPrefix('booking:');
    const booking = bookings.find((b: any) => 
      b.refund?.razorpayRefundId === refund.id
    );

    if (booking) {
      booking.refund.status = 'completed';
      booking.refund.completedAt = new Date().toISOString();
      await kv.set(`booking:${booking.id}`, booking);

      // Send completion notification
      const notification = {
        id: generateId('notif'),
        userId: booking.customerId,
        userType: 'customer',
        type: 'refund_completed',
        title: 'Refund Completed! 💰',
        message: `₹${refund.amount / 100} has been credited to your account.`,
        data: { refundId: refund.id },
        read: false,
        priority: 'high',
        createdAt: new Date().toISOString()
      };

      const notifications = await kv.get(`notifications:${booking.customerId}`) || [];
      notifications.unshift(notification);
      await kv.set(`notifications:${booking.customerId}`, notifications);

      console.log(`📧 [NOTIFICATION] Refund completion notification sent`);
    }
  }

  async function handleRefundFailed(refund: any) {
    console.log(`❌ [WEBHOOK] Refund failed: ${refund.id}`);

    const bookings = await kv.getByPrefix('booking:');
    const booking = bookings.find((b: any) => 
      b.refund?.razorpayRefundId === refund.id
    );

    if (booking) {
      booking.refund.status = 'failed';
      booking.refund.failedAt = new Date().toISOString();
      await kv.set(`booking:${booking.id}`, booking);

      // Alert customer and admin
      console.error(`⚠️ [REFUND] Failed for booking ${booking.id} - Manual intervention required`);
    }
  }
}
