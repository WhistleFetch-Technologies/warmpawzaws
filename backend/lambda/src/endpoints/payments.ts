/**
 * ============================================================================
 * PAYMENT ENDPOINTS - LAMBDA VERSION (TEMPORAL AUDIT COMPLIANT)
 * ============================================================================
 * 
 * Migrated from: supabase/functions/make-server-payment/payment-endpoints.tsx
 * 
 * Endpoints:
 * - POST /payments/create - Create payment
 * - POST /payments/razorpay/webhook - Razorpay webhook handler
 * - GET /payments/:id - Get payment details
 * 
 * TEMPORAL AUDIT FIXES (2026-01-02):
 * - ✅ Idempotency key enforcement
 * - ✅ Transaction wrapping
 * - ✅ Audit logging
 * - ✅ Event timestamps in SNS messages
 * - ✅ Webhook replay protection
 * 
 * Date: 2025-01-28
 * Updated: 2026-01-02 (Temporal Audit Fixes)
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update, withTransaction } from '../database/rds-connection';
import { checkIdempotencyKey, storeIdempotencyKey } from '../utils/idempotency';
import { logAuditEntry, logPaymentStatusChange } from '../utils/audit-log';
import { publishPaymentCreated, publishPaymentProcessed } from '../utils/sns-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// PAYMENT HANDLERS
// ============================================================================

class CreatePaymentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.event.requestContext?.requestId || crypto.randomUUID();
    const { 
      bookingId, 
      amount, 
      paymentMethod, 
      customerId, 
      vendorId,
      idempotencyKey 
    } = body;

    this.validateRequired(body, ['bookingId', 'amount']);

    // ✅ TEMPORAL FIX: Check idempotency key first
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        console.log(`[IDEMPOTENCY] Returning cached payment for key: ${idempotencyKey}`);
        return {
          statusCode: existing.httpStatus || 200,
          headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replay': 'true' },
          body: JSON.stringify(existing.response),
        };
      }
    }

    // Get booking to extract customer_id and vendor_id
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const booking = bookings[0];

    // ✅ TEMPORAL FIX: Use transaction
    const payment = await withTransaction(async (client) => {
      // Using existing schema columns only - idempotency handled via separate table
      const paymentData = {
        booking_id: bookingId,
        customer_id: customerId || booking.customer_id,
        vendor_id: vendorId || booking.vendor_id,
        amount: amount,
        currency: 'INR',
        payment_method: paymentMethod || 'razorpay',
        payment_status: 'pending',
      };

      const columns = Object.keys(paymentData);
      const values = Object.values(paymentData);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      const result = await client.query(
        `INSERT INTO payments (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );

      return result.rows[0];
    });

    // ✅ TEMPORAL FIX: Log audit entry
    await logAuditEntry({
      entityType: 'payment',
      entityId: payment.id,
      action: 'create',
      newValues: {
        bookingId,
        amount,
        paymentMethod: paymentMethod || 'razorpay',
        status: 'pending',
      },
      actorId: customerId || booking.customer_id,
      actorType: 'customer',
      requestId,
    });

    // ✅ TEMPORAL FIX: Log initial status
    await logPaymentStatusChange(payment.id, null, 'pending');

    // ✅ TEMPORAL FIX: Publish event with timestamps
    try {
      await publishPaymentCreated({
        paymentId: payment.id,
        bookingId,
        customerId: payment.customer_id,
        vendorId: payment.vendor_id,
        amount: payment.amount,
        currency: 'INR',
        status: 'pending',
        requestId,
      });
    } catch (error) {
      console.error('Failed to publish payment created event:', error);
    }

    const response = {
      paymentId: payment.id,
      status: payment.payment_status,
      message: 'Payment created successfully',
      isNew: true,
    };

    // ✅ TEMPORAL FIX: Store idempotency key
    if (idempotencyKey) {
      await storeIdempotencyKey(idempotencyKey, 'payment', payment.id, response, 200);
    }

    return this.success(response);
  }
}

class RazorpayWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const rawBody = context.event.body || '{}';
    const signature = context.event.headers?.['x-razorpay-signature'] || 
                     context.event.headers?.['X-Razorpay-Signature'] || '';

    // Verify Razorpay webhook signature
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      console.error('[SECURITY] Invalid Razorpay webhook signature');
      return this.error('Invalid signature', 401);
    }

    const body = JSON.parse(rawBody);
    const { event, payload } = body;

    // ✅ TEMPORAL FIX: Idempotency for webhooks using Razorpay event ID
    const webhookEventId = body.id || `${event}_${payload?.payment?.entity?.id || payload?.order?.entity?.id}`;
    
    const existing = await checkIdempotencyKey(`webhook_${webhookEventId}`);
    if (existing.exists) {
      console.log(`[IDEMPOTENCY] Webhook already processed: ${webhookEventId}`);
      return this.success({ message: 'Webhook already processed', duplicate: true });
    }

    // Handle different event types
    if (event === 'payment.captured') {
      const paymentEntity = payload?.payment?.entity;
      const payment_id = paymentEntity?.id;
      const order_id = paymentEntity?.order_id;
      
      if (!payment_id) {
        console.warn('Payment captured event missing payment_id');
        return this.success({ message: 'Webhook processed (no payment_id)' });
      }

      // ✅ TEMPORAL FIX: Use transaction for atomicity
      await withTransaction(async (client) => {
        // Get existing payment by razorpay_payment_id or order_id
        const { rows: payments } = await client.query(
          `SELECT * FROM payments 
           WHERE razorpay_payment_id = $1 OR razorpay_order_id = $2
           FOR UPDATE`,
          [payment_id, order_id]
        );

        if (payments.length === 0) {
          console.warn(`Payment not found for razorpay_payment_id: ${payment_id}`);
          return;
        }

        const payment = payments[0];
        const oldStatus = payment.payment_status;

        // Update payment status
        await client.query(
          `UPDATE payments SET 
             payment_status = 'completed',
             razorpay_payment_id = $1,
             razorpay_order_id = $2,
             completed_at = NOW(),
             updated_at = NOW()
           WHERE id = $3`,
          [payment_id, order_id, payment.id]
        );

        // Update booking payment status
        if (payment.booking_id) {
          await client.query(
            `UPDATE bookings SET payment_status = 'paid', updated_at = NOW() WHERE id = $1`,
            [payment.booking_id]
          );
        }

        // ✅ TEMPORAL FIX: Log status change
        await logPaymentStatusChange(
          payment.id,
          oldStatus,
          'completed',
          'webhook',              // changedByType
          event,                  // razorpayEvent
          { razorpay_payment_id: payment_id, amount: paymentEntity?.amount }  // metadata
        );
      });

      // ✅ TEMPORAL FIX: Publish event with timestamps
      try {
        await publishPaymentProcessed({
          paymentId: payment_id,
          amount: (paymentEntity?.amount || 0) / 100,
          status: 'completed',
          razorpayPaymentId: payment_id,
        });
      } catch (error) {
        console.error('Failed to publish payment processed event:', error);
      }
    }

    // ✅ TEMPORAL FIX: Store webhook idempotency key
    await storeIdempotencyKey(
      `webhook_${webhookEventId}`,
      'webhook',
      webhookEventId,
      { message: 'Webhook processed', event },
      200,
      168 // 7 days for webhooks
    );

    return this.success({ message: 'Webhook processed' });
  }

  /**
   * Verify Razorpay webhook signature using HMAC SHA256
   */
  private verifyWebhookSignature(body: string, signature: string): boolean {
    if (!signature) {
      return false;
    }

    try {
      const crypto = require('crypto');
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('[SECURITY] RAZORPAY_WEBHOOK_SECRET not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[SECURITY] Signature verification failed:', error);
      return false;
    }
  }
}

class GetPaymentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const paymentId = context.event.pathParameters?.paymentId;

    if (!paymentId) {
      return this.error('Payment ID is required', 400);
    }

    const payments = await select('payments', { id: paymentId });
    
    if (payments.length === 0) {
      return this.error('Payment not found', 404);
    }

    // Get payment status history
    const { rows: history } = await query(
      `SELECT * FROM payment_status_history 
       WHERE payment_id = $1 
       ORDER BY created_at ASC`,
      [paymentId]
    );

    return this.success({
      payment: payments[0],
      statusHistory: history,
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerPaymentEndpoints(app: Hono) {
  const createHandler = new CreatePaymentHandler();
  const webhookHandler = new RazorpayWebhookHandler();
  const getHandler = new GetPaymentHandler();

  app.post('/payments/create', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/payments/razorpay/webhook', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await webhookHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/payments/:paymentId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { paymentId: c.req.param('paymentId') };
    const context = createLambdaContext();
    const result = await getHandler.execute(event, context);
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
    functionName: 'payment-handler',
    functionVersion: '$LATEST',
  };
}
