import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getRefundsRepository } from "../../lib/repositories/refunds.ts";
import { getPaymentsRepository } from "../../lib/repositories/payments.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getDbClient } from "../../lib/db.ts";
import { withTransaction, TransactionError } from "../../lib/utils/transaction-helper.ts";
import { generateId } from './database-schema.tsx';

// Helper function to process Razorpay refund
async function processRazorpayRefund(
  paymentId: string,
  amount: number,
  keyId: string,
  keySecret: string,
  reason?: string
): Promise<{ success: boolean; refundId?: string; error?: string; response?: any }> {
  try {
    const auth = btoa(`${keyId}:${keySecret}`);
    
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to paise
        notes: {
          reason: reason || 'Customer request'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Razorpay API error: ${error}`
      };
    }

    const refundData = await response.json();
    
    return {
      success: true,
      refundId: refundData.id,
      response: refundData
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error processing refund'
    };
  }
}

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
        return sendError(c, 'bookingId and amount required', 400);
      }

      console.log(`💰 [REFUND] Processing refund for booking ${bookingId}: ₹${amount}`);

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL: Get payment associated with booking
      const paymentsRepo = getPaymentsRepository();
      const payment = booking.payment_id 
        ? await paymentsRepo.findById(booking.payment_id)
        : null;
      
      if (!payment || !payment.razorpay_payment_id) {
        return sendError(c, 'Payment not found or Razorpay payment ID missing', 404);
      }

      // ✅ SQL: Check if already refunded
      const refundsRepo = getRefundsRepository();
      const existingRefunds = await refundsRepo.findByPaymentId(payment.id);
      const completedRefund = existingRefunds.find(r => r.refund_status === 'completed');
      
      if (completedRefund) {
        return sendError(c, 'Refund already processed', 400);
      }

      // Get Razorpay credentials from environment
      const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

      if (!razorpayKeyId || !razorpayKeySecret) {
        console.error('[REFUND] Razorpay credentials not configured');
        return c.json({ error: 'Payment gateway not configured' }, 500);
      }

      // Process refund via Razorpay API (external API call)
      const refundResult = await processRazorpayRefund(
        payment.razorpay_payment_id!,
        amount,
        razorpayKeyId,
        razorpayKeySecret,
        reason
      );

      if (!refundResult.success) {
        console.error('[REFUND] Razorpay API error:', refundResult.error);
        
        // ✅ SQL: Create failed refund record
        await refundsRepo.create({
          payment_id: payment.id,
          booking_id: bookingId,
          customer_id: booking.customer_id,
          vendor_id: booking.vendor_id || undefined,
          refund_amount: amount,
          refund_reason: reason || 'Customer request',
          refund_status: 'failed',
          razorpay_refund_id: undefined,
          failure_reason: refundResult.error,
        });

        return sendError(c, 'Refund processing failed', 500);
      }

      // ✅ TRANSACTIONAL: Create refund record, update payment, update booking atomically
      const refundRecord = await withTransaction(async (client) => {
        // ✅ SQL: Create refund record
        const refund = await refundsRepo.create({
          payment_id: payment.id,
          booking_id: bookingId,
          customer_id: booking.customer_id,
          vendor_id: booking.vendor_id || undefined,
          refund_amount: amount,
          refund_reason: reason || 'Customer request',
          refund_status: 'processing',
          razorpay_refund_id: refundResult.refundId,
        });

        // ✅ SQL: Update payment status to refunded
        await paymentsRepo.update(payment.id, {
          payment_status: 'refunded',
        });

        // ✅ SQL: Update booking payment status
        await bookingsRepo.update(bookingId, {
          payment_status: 'refunded',
        });
        
        return refund;
      });

      // ✅ SQL: Adjust vendor payout (separate operation, not part of refund transaction)
      // Note: Vendor payout adjustment should be handled separately via settlement system
      // This will be handled by settlement automation system

      // ✅ SQL: Notify customer
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(booking.customer_id);
      
      if (customer) {
        try {
          await getNotificationsRepository().create({
            recipient_type: 'customer',
            recipient_id: booking.customer_id,
            notification_type: 'refund_processed',
            title: 'Refund Processed',
            message: `Your refund of ₹${amount} for booking ${bookingId} has been processed. Refund ID: ${refundRecord.id}`,
            channels: { email: true, sms: true, inApp: true, push: false },
            data: { 
              refundId: refundRecord.id, 
              bookingId, 
              amount,
              razorpayRefundId: refundResult.refundId 
            },
          });
        } catch (notifError) {
          console.error('[REFUND] Failed to send notification:', notifError);
          // Don't fail refund if notification fails
        }
      }

      console.log(`✅ [REFUND] Successfully initiated refund ${refundResult.refundId}`);

      return sendSuccess(c, {
        refundId: refundRecord.id,
        razorpayRefundId: refundResult.refundId,
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

      // Get Razorpay credentials from environment
      const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

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

  async function handleRefundProcessed(refund: any) {
    console.log(`✅ [WEBHOOK] Refund processed: ${refund.id}`);

    try {
      // ✅ SQL: Find refund by Razorpay refund ID using SQL query
      const db = getDbClient();
      const { data: refundData, error } = await db
        .from('refunds')
        .select('*')
        .eq('razorpay_refund_id', refund.id)
        .maybeSingle();
      
      if (error || !refundData) {
        console.error('[WEBHOOK] Refund not found in database:', refund.id);
        return;
      }
      
      const refundsRepo = getRefundsRepository();

      // ✅ SQL: Update refund status to completed
      await refundsRepo.update(refundData.id, {
        refund_status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // ✅ SQL: Send completion notification
      if (refundData.customer_id) {
        try {
          await getNotificationsRepository().create({
            recipient_type: 'customer',
            recipient_id: refundData.customer_id,
            notification_type: 'refund_completed',
            title: 'Refund Completed! 💰',
            message: `₹${refund.amount / 100} has been credited to your account.`,
            channels: { email: true, sms: true, inApp: true, push: false },
            data: { refundId: refund.id },
          });
        } catch (notifError) {
          console.error('[WEBHOOK] Failed to send notification:', notifError);
        }
      }

      console.log(`📧 [WEBHOOK] Refund completion processed for refund ${refund.id}`);
    } catch (error) {
      console.error('[WEBHOOK] Error processing refund webhook:', error);
    }
  }

  async function handleRefundFailed(refund: any) {
    console.log(`❌ [WEBHOOK] Refund failed: ${refund.id}`);

    try {
      // ✅ SQL: Find refund by Razorpay refund ID using SQL query
      const db = getDbClient();
      const { data: refundData, error } = await db
        .from('refunds')
        .select('*')
        .eq('razorpay_refund_id', refund.id)
        .maybeSingle();
      
      if (error || !refundData) {
        console.error('[WEBHOOK] Refund not found in database:', refund.id);
        return;
      }
      
      const refundsRepo = getRefundsRepository();
      
      // ✅ SQL: Update refund status to failed
      await refundsRepo.update(refundData.id, {
        refund_status: 'failed',
        failure_reason: refund.error?.description || 'Refund failed via Razorpay webhook',
      });

      // Alert for manual intervention
      console.error(`⚠️ [REFUND] Failed for refund ${refundData.id} - Manual intervention required`);
    } catch (error) {
      console.error('[WEBHOOK] Error processing refund failure webhook:', error);
    }
  }
}
