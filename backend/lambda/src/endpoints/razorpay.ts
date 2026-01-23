/**
 * ============================================================================
 * RAZORPAY PAYMENT & SETTLEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Migrated from: supabase/functions/make-server-payment/razorpay-payment-integration-sql.tsx
 * 
 * Endpoints:
 * - POST /razorpay/create-order - Create Razorpay order
 * - POST /razorpay/verify-payment - Verify payment
 * - POST /razorpay/webhook - Razorpay webhook handler
 * - POST /razorpay/marketplace/settlement - Marketplace settlement
 * - POST /razorpay/refund - Process refund
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { createHmac } from 'crypto';
import { getRazorpayConfig, getRazorpayAuthHeader, razorpayRequest } from '../utils/razorpay-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// Razorpay configuration is imported from utils

// ============================================================================
// RAZORPAY HANDLERS
// ============================================================================

class CreateRazorpayOrderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, amount, currency = 'INR', customerId } = body;

    this.validateRequired(body, ['bookingId', 'amount']);

    const config = await getRazorpayConfig();

    // ✅ SQL: Get booking details
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const booking = bookings[0];

    // ✅ Get vendor details for marketplace mode
    const vendors = await select('vendors', { id: booking.vendor_id });
    const vendor = vendors.length > 0 ? vendors[0] : null;

    // ✅ Create Razorpay Order with marketplace mode (automatic transfers)
    // Note: Razorpay receipt max length is 40 characters
    // Use shortened format: "bk_" + first 32 chars of UUID (without hyphens) = 35 chars
    const shortBookingId = bookingId.replace(/-/g, '').substring(0, 32);
    const orderData: any = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: `bk_${shortBookingId}`,
      notes: {
        bookingId: bookingId,
        customerId: customerId || booking.customer_id,
        vendorId: booking.vendor_id,
      },
    };

    // ✅ If vendor has linked account and marketplace mode enabled, add transfers
    if (vendor?.razorpay_account_id && vendor.bank_verified) {
      // Get vendor tier to calculate commission
      const tierCommission = await getVendorTierCommission(booking.vendor_id);
      const commissionAmount = Math.round((amount * tierCommission / 100) * 100); // In paise
      const vendorShare = Math.round(amount * 100) - commissionAmount;

      // Add transfer configuration for marketplace mode
      orderData.transfers = [
        {
          account: vendor.razorpay_account_id,
          amount: vendorShare,
          currency: currency,
          notes: {
            booking_id: bookingId,
            vendor_id: booking.vendor_id,
            commission_rate: tierCommission.toString(),
          },
          on_hold: false,
        },
      ];
    }

    const razorpayOrder = await razorpayRequest('/orders', 'POST', orderData);

    // ✅ SQL: Create payment record (customer_id is required)
    await insert('payments', {
      booking_id: bookingId,
      customer_id: customerId || booking.customer_id, // Required field
      vendor_id: booking.vendor_id,
      razorpay_order_id: razorpayOrder.id,
      amount: amount,
      currency: currency,
      payment_method: 'razorpay',
      payment_status: 'pending',
    });

    return this.success({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount / 100, // Convert back to rupees
      currency: razorpayOrder.currency,
      keyId: config.keyId,
    });
  }
}

class VerifyPaymentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

      // ✅ FIX: Better validation with specific error messages
      if (!razorpay_order_id) {
        return this.error('razorpay_order_id is required', 400);
      }
      if (!razorpay_payment_id) {
        return this.error('razorpay_payment_id is required', 400);
      }
      if (!razorpay_signature) {
        return this.error('razorpay_signature is required', 400);
      }

      const config = await getRazorpayConfig();
      
      // ✅ FIX: Validate Razorpay config before proceeding
      if (!config || !config.keySecret) {
        console.error('[PAYMENT-VERIFY] Razorpay configuration missing or invalid');
        return this.error('Payment gateway configuration error. Please contact support.', 500);
      }

      // ✅ Verify signature
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;
      const generatedSignature = createHmac('sha256', config.keySecret)
        .update(text)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        console.error('[PAYMENT-VERIFY] Signature mismatch:', {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          received: razorpay_signature.substring(0, 10) + '...',
          generated: generatedSignature.substring(0, 10) + '...'
        });
        return this.error('Invalid payment signature. Please ensure payment details are correct.', 400);
      }

      // ✅ SQL: Update payment status
      const payments = await select('payments', { razorpay_order_id });
      if (payments.length === 0) {
        console.error('[PAYMENT-VERIFY] Payment record not found for order:', razorpay_order_id);('[PAYMENT-VERIFY] Payment not found for order:', razorpay_order_id);
        return this.error('Payment record not found. Please contact support with your order ID.', 404);
      }

      await update(
        'payments',
        { razorpay_order_id },
        {
          razorpay_payment_id: razorpay_payment_id,
          payment_status: 'completed',
          completed_at: new Date(),
        }
      );

      // ✅ SQL: Update booking payment status and confirm booking
      const payment = payments[0];
      await update(
        'bookings',
        { id: payment.booking_id },
        { 
          payment_status: 'paid',
          status: 'confirmed', // ✅ CRITICAL: Confirm booking after payment
          updated_at: new Date().toISOString(),
        }
      );

      // ✅ Trigger automatic settlement if marketplace mode is enabled
      try {
        const vendors = await select('vendors', { id: payment.vendor_id });
        const vendor = vendors.length > 0 ? vendors[0] : null;
        
        if (vendor?.razorpay_account_id && vendor.bank_verified) {
          // Queue automatic settlement
          const { sendToSQS } = await import('../utils/aws-clients');
          await sendToSQS('settlement-queue', {
            type: 'auto_settle_booking',
            bookingId: payment.booking_id,
            vendorId: payment.vendor_id,
            paymentId: payment.id,
          });
        }
      } catch (error) {
        console.error('Failed to queue automatic settlement:', error);
      }

      // ✅ Publish payment processed event
      try {
        const { publishPaymentProcessed } = await import('../utils/sns-client');
        await publishPaymentProcessed({
          paymentId: razorpay_payment_id,
          bookingId: payment.booking_id,
          amount: payment.amount,
          status: 'completed',
        });
      } catch (error) {
        console.error('Failed to publish payment processed event:', error);
      }

      return this.success({
        message: 'Payment verified successfully',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      });
    } catch (error: any) {
      console.error('[PAYMENT-VERIFY] Verification error:', error);
      // ✅ FIX: Return more specific error messages
      if (error.message) {
        return this.error(`Payment verification failed: ${error.message}`, 500);
      }
      return this.error('Payment verification failed. Please try again or contact support.', 500);
    }
  }
}

class RazorpayWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const headers = this.getHeaders(context.event);
    const webhookSignature = headers['x-razorpay-signature'];

    let config;
    try {
      config = await getRazorpayConfig();
    } catch (error: any) {
      // If Razorpay is not configured, return 400 (bad request) instead of 500
      if (error.message?.includes('not configured')) {
        return this.error('Razorpay not configured. Please configure in Platform Settings.', 400);
      }
      throw error;
    }
    
    // If Razorpay is not configured, return 400 (bad request) instead of 500
    if (!config || !config.keyId || !config.webhookSecret) {
      return this.error('Razorpay not configured. Please configure in Platform Settings.', 400);
    }

    // ✅ Verify webhook signature
    const payload = JSON.stringify(body);
    const expectedSignature = createHmac('sha256', config.webhookSecret)
      .update(payload)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      return this.error('Invalid webhook signature', 401);
    }

    const event = body.event;
    const payload_data = body.payload;

    // Handle different event types
    if (event === 'payment.captured') {
      const payment = payload_data.payment.entity;
      
      // ✅ SQL: Update payment
      await update(
        'payments',
        { razorpay_payment_id: payment.id },
        {
          payment_status: 'completed',
          completed_at: new Date(),
        }
      );

      // Update booking
      const payments = await select('payments', { razorpay_payment_id: payment.id });
      if (payments.length > 0) {
        const paymentRecord = payments[0];
        await update(
          'bookings',
          { id: paymentRecord.booking_id },
          { payment_status: 'paid' }
        );

        // ✅ Trigger automatic settlement if marketplace mode is enabled
        try {
          const vendors = await select('vendors', { id: paymentRecord.vendor_id });
          const vendor = vendors.length > 0 ? vendors[0] : null;
          
          if (vendor?.razorpay_account_id && vendor.bank_verified) {
            // Queue automatic settlement
            const { sendToSQS } = await import('../utils/aws-clients');
            await sendToSQS('settlement-queue', {
              type: 'auto_settle_booking',
              bookingId: paymentRecord.booking_id,
              vendorId: paymentRecord.vendor_id,
              paymentId: paymentRecord.id,
            });
          }
        } catch (error) {
          console.error('Failed to queue automatic settlement from webhook:', error);
        }
      }
    } else if (event === 'payment.failed') {
      const payment = payload_data.payment.entity;
      
      await update(
        'payments',
        { razorpay_payment_id: payment.id },
        {
          payment_status: 'failed',
          failure_reason: payment.error_description || 'Payment failed',
        }
      );
    } else if (event === 'refund.created') {
      const refund = payload_data.refund.entity;
      
      // ✅ SQL: Create refund record
      await insert('refunds', {
        payment_id: refund.payment_id,
        refund_id: refund.id,
        amount: refund.amount / 100, // Convert from paise
        status: refund.status,
        reason: refund.notes?.reason || null,
      });
    }

    return this.success({ message: 'Webhook processed' });
  }
}

class MarketplaceSettlementHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId } = body;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    // ✅ SQL: Get booking
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const booking = bookings[0];

    if (booking.status !== 'completed') {
      return this.error('Booking must be completed to settle', 400);
    }

    if (booking.settlement_status === 'settled') {
      return this.success({ message: 'Already settled' });
    }

    const vendorId = booking.vendor_id;
    const amount = parseFloat(booking.total_amount) || 0;

    // ✅ Get vendor tier commission from database
    const commissionRate = await getVendorTierCommission(vendorId);
    const commissionAmount = (amount * commissionRate) / 100;
    const vendorShare = amount - commissionAmount;

    // ✅ SQL: Create settlement record
    const settlementData = {
      vendor_id: vendorId,
      booking_id: bookingId,
      total_amount: amount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      net_amount: vendorShare,
      settlement_status: 'processing',
      settlement_period_start: new Date().toISOString().split('T')[0],
      settlement_period_end: new Date().toISOString().split('T')[0],
    };

    const settlements = await insert('settlements', settlementData);
    const settlement = settlements[0];

    // ✅ SQL: Get vendor details for Razorpay Route transfer
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }

    const vendor = vendors[0];
    let transferId: string | null = null;
    let settlementStatus = 'processing';

    // ✅ Initiate Razorpay Route transfer if vendor has linked account
    if (vendor.razorpay_account_id && vendor.bank_verified) {
      try {
        // Get payment for this booking to find the Razorpay payment ID
        const payments = await select('payments', { booking_id: bookingId, payment_status: 'completed' });
        
        if (payments.length > 0 && payments[0].razorpay_payment_id) {
          // Create transfer via Razorpay Route API
          const transfer = await razorpayRequest('/transfers', 'POST', {
            account: vendor.razorpay_account_id,
            amount: Math.round(vendorShare * 100), // Convert to paise
            currency: 'INR',
            linked_account_notes: {
              booking_id: bookingId,
              settlement_id: settlement.id,
            },
            notes: {
              vendor_id: vendorId,
              booking_id: bookingId,
              settlement_date: new Date().toISOString(),
            },
            on_hold: false,
            on_hold_until: null,
          });

          transferId = transfer.id;
          settlementStatus = transfer.status === 'processed' ? 'completed' : 'processing';

          // Update settlement with transfer ID
          await update('settlements', { id: settlement.id }, {
            razorpay_transfer_id: transferId,
            settlement_status: settlementStatus,
          });
        } else {
          // No payment found, mark for manual processing
          console.warn(`No completed payment found for booking ${bookingId}, settlement queued for manual processing`);
        }
      } catch (error: any) {
        console.error('Error initiating Razorpay Route transfer:', error);
        // Continue with settlement record but mark as pending manual processing
        settlementStatus = 'pending';
        await update('settlements', { id: settlement.id }, {
          settlement_status: 'pending',
          settlement_notes: `Route transfer failed: ${error.message}`,
        });
      }
    } else {
      // Vendor doesn't have linked account or bank not verified
      settlementStatus = 'pending';
      await update('settlements', { id: settlement.id }, {
        settlement_status: 'pending',
        settlement_notes: vendor.razorpay_account_id 
          ? 'Bank account not verified' 
          : 'Linked account not configured',
      });
    }

    // ✅ SQL: Update booking settlement status
    await update(
      'bookings',
      { id: bookingId },
      {
        settlement_status: settlementStatus,
        settlement_id: settlement.id,
      }
    );

    // ✅ Send to settlement queue for async processing (if not already processed)
    if (settlementStatus === 'processing' || settlementStatus === 'pending') {
      try {
        const { sendToSettlementQueue } = await import('../utils/sqs-client');
        await sendToSettlementQueue({
          settlementId: settlement.id,
          bookingId,
          vendorId,
          amount: vendorShare,
        });
      } catch (error) {
        console.error('Failed to send to settlement queue:', error);
      }
    }

    return this.success({
      settlementId: settlement.id,
      totalAmount: amount,
      commissionAmount,
      vendorShare,
      status: 'processing',
    });
  }
}

class ProcessRefundHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { paymentId, amount, reason } = body;

    this.validateRequired(body, ['paymentId', 'amount']);

    const config = await getRazorpayConfig();

    // ✅ SQL: Get payment
    const payments = await select('payments', { razorpay_payment_id: paymentId });
    if (payments.length === 0) {
      return this.error('Payment not found', 404);
    }

    const payment = payments[0];

    // ✅ Create Razorpay refund
    const refund = await razorpayRequest(
      `/payments/${paymentId}/refund`,
      'POST',
      {
        amount: Math.round(amount * 100), // Convert to paise
        notes: {
          reason: reason || 'Customer request',
        },
      }
    );

    // ✅ SQL: Create refund record
    await insert('refunds', {
      payment_id: payment.id,
      refund_id: refund.id,
      amount: amount,
      status: refund.status,
      reason: reason || null,
    });

    // ✅ SQL: Update booking payment status
    await update(
      'bookings',
      { id: payment.booking_id },
      { payment_status: 'refunded' }
    );

    return this.success({
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerRazorpayEndpoints(app: Hono) {
  const createOrderHandler = new CreateRazorpayOrderHandler();
  const verifyHandler = new VerifyPaymentHandler();
  const webhookHandler = new RazorpayWebhookHandler();
  const settlementHandler = new MarketplaceSettlementHandler();
  const refundHandler = new ProcessRefundHandler();

  /**
   * GET /razorpay/offers
   * Get available Razorpay offers for the given amount
   * ✅ FIX: Add this endpoint for frontend checkout flow
   */
  app.get('/razorpay/offers', async (c) => {
    try {
      const amount = parseFloat(c.req.query('amount') || '0');
      
      // For now, return empty offers array
      // In production, this would fetch offers from Razorpay API or database
      // Razorpay offers API: GET /offers (requires authentication)
      
      // Return graceful empty response instead of 404
      return c.json({
        success: true,
        offers: [],
        message: 'No offers available at this time',
        amount,
      });
    } catch (error: any) {
      console.error('Error fetching Razorpay offers:', error);
      // Return empty offers on error, not 500
      return c.json({
        success: true,
        offers: [],
        message: 'Could not fetch offers',
      });
    }
  });

  app.post('/razorpay/create-order', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    console.log('📥 [RAZORPAY-CREATE-ORDER] Raw request body from Hono:', JSON.stringify(requestBody));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await createOrderHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/verify-payment', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await verifyHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/webhook', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await webhookHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/marketplace/settlement', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await settlementHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/refund', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await refundHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// ✅ FIX: Accept pre-parsed body since Hono doesn't have req.body
function createApiGatewayEventWithBody(req: any, parsedBody: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: parsedBody ? JSON.stringify(parsedBody) : null,
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: crypto.randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'razorpay-handler',
    functionVersion: '$LATEST',
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get vendor tier commission rate from database
 */
async function getVendorTierCommission(vendorId: string): Promise<number> {
  try {
    // First, try to get from vendor_tier_subscriptions (active subscription)
    const subscriptionResult = await query(`
      SELECT vt.commission_rate
      FROM vendor_tier_subscriptions vts
      JOIN vendor_tiers vt ON vts.tier_id = vt.id
      WHERE vts.vendor_id = $1
        AND vts.status = 'active'
        AND vts.expires_at > NOW()
      ORDER BY vts.created_at DESC
      LIMIT 1
    `, [vendorId]);

    const subscriptionRows = Array.isArray(subscriptionResult) 
      ? subscriptionResult 
      : (subscriptionResult as any).rows || [];

    if (subscriptionRows.length > 0 && subscriptionRows[0].commission_rate) {
      return parseFloat(subscriptionRows[0].commission_rate);
    }

    // If no active subscription, get vendor's current tier from vendors table
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length > 0 && vendors[0].tier) {
      const tierResult = await query(`
        SELECT commission_rate
        FROM vendor_tiers
        WHERE tier_name = $1 AND is_active = true
        LIMIT 1
      `, [vendors[0].tier]);

      const tierRows = Array.isArray(tierResult) 
        ? tierResult 
        : (tierResult as any).rows || [];

      if (tierRows.length > 0 && tierRows[0].commission_rate) {
        return parseFloat(tierRows[0].commission_rate);
      }
    }

    // Get default tier (Bronze or is_default = true)
    const defaultTierResult = await query(`
      SELECT commission_rate
      FROM vendor_tiers
      WHERE (is_default = true OR tier_name = 'Bronze')
        AND is_active = true
      ORDER BY is_default DESC, tier_level ASC
      LIMIT 1
    `);

    const defaultRows = Array.isArray(defaultTierResult) 
      ? defaultTierResult 
      : (defaultTierResult as any).rows || [];

    if (defaultRows.length > 0 && defaultRows[0].commission_rate) {
      return parseFloat(defaultRows[0].commission_rate);
    }

    // Fallback to 15% if no tier found
    return 15.0;
  } catch (error) {
    console.error('Error getting vendor tier commission:', error);
    // Fallback to 15% on error
    return 15.0;
  }
}

