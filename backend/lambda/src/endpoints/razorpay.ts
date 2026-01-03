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

    // ✅ Create Razorpay Order via API
    const orderData = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: `booking_${bookingId}`,
      notes: {
        bookingId: bookingId,
        customerId: customerId || booking.customer_id,
        vendorId: booking.vendor_id,
      },
    };

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
    const body = this.parseBody(context.event);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    this.validateRequired(body, ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']);

    const config = await getRazorpayConfig();

    // ✅ Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = createHmac('sha256', config.keySecret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return this.error('Invalid payment signature', 400);
    }

    // ✅ SQL: Update payment status
    const payments = await select('payments', { razorpay_order_id });
    if (payments.length === 0) {
      return this.error('Payment not found', 404);
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

    // ✅ SQL: Update booking payment status
    const payment = payments[0];
    await update(
      'bookings',
      { id: payment.booking_id },
      { payment_status: 'paid' }
    );

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
    });
  }
}

class RazorpayWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const headers = this.getHeaders(context.event);
    const webhookSignature = headers['x-razorpay-signature'];

    const config = await getRazorpayConfig();

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
        await update(
          'bookings',
          { id: payments[0].booking_id },
          { payment_status: 'paid' }
        );
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

    // ✅ SQL: Get vendor tier
    const tiers = await select('vendor_tiers', { vendor_id: vendorId });
    const tierInfo = tiers.length > 0 ? tiers[0] : { current_tier: 'Bronze' };

    // Tier-based commission rates
    const TIER_CONFIG: Record<string, { commissionRate: number }> = {
      Bronze: { commissionRate: 20 },
      Silver: { commissionRate: 15 },
      Gold: { commissionRate: 12 },
      Platinum: { commissionRate: 10 },
    };

    const tierConfig = TIER_CONFIG[tierInfo.current_tier] || TIER_CONFIG.Bronze;
    const commissionRate = tierConfig.commissionRate;
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

    // ✅ TODO: Initiate Razorpay Route transfer
    // For now, mark as processing. Actual transfer would be done via Razorpay Route API

    // ✅ SQL: Update booking settlement status
    await update(
      'bookings',
      { id: bookingId },
      {
        settlement_status: 'processing',
        settlement_id: settlement.id,
      }
    );

    // ✅ Send to settlement queue for async processing
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

  app.post('/razorpay/create-order', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createOrderHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/verify-payment', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await verifyHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/webhook', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await webhookHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/marketplace/settlement', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await settlementHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/refund', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await refundHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
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

