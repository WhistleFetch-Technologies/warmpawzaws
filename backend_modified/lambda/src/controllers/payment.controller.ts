/**
 * ============================================================================
 * PAYMENT CONTROLLERS
 * ============================================================================
 * 
 * Extracted from:
 * - endpoints/payments.ts
 * - endpoints/payments-enhanced.ts
 * - endpoints/razorpay.ts
 * - endpoints/razorpay-settlements.ts
 * - endpoints/wallet.ts
 * - endpoints/wallet-diagnostic.ts
 * - endpoints/settlements.ts
 * - endpoints/payment-gateway-management.ts
 * 
 * Date: 2026-01-28
 * Controller extraction migration
 * ============================================================================
 */

import { Context } from 'hono';
import { randomUUID } from 'crypto';
import { select, insert, update, query, withTransaction } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { BaseHandlerEnhanced } from '../handler/base-handler-enhanced';

// ============================================================================
// PAYMENT HANDLERS (from payments.ts)
// ============================================================================

export class CreatePaymentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.event.requestContext?.requestId || randomUUID();
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
      const { checkIdempotencyKey } = await import('../utils/idempotency');
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
    const { logAuditEntry } = await import('../utils/audit-log');
    await logAuditEntry({
      entityType: 'payment',
      entityId: payment.id,
      action: 'create',
      actorId: customerId || booking.customer_id,
      actorType: 'customer',
      metadata: {
        bookingId,
        amount,
        paymentMethod: paymentMethod || 'razorpay',
      },
      requestId,
    });

    // ✅ TEMPORAL FIX: Store idempotency key
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('../utils/idempotency');
      await storeIdempotencyKey(idempotencyKey, {
        httpStatus: 201,
        response: { success: true, payment },
      });
    }

    // ✅ TEMPORAL FIX: Publish event with timestamp
    try {
      const { publishPaymentCreated } = await import('../utils/sns-client');
      await publishPaymentCreated({
        paymentId: payment.id,
        bookingId,
        customerId: customerId || booking.customer_id,
        vendorId: vendorId || booking.vendor_id,
        amount,
        paymentMethod: paymentMethod || 'razorpay',
        eventTimestamp: new Date().toISOString(),
        eventId: randomUUID(),
        requestId,
      });
    } catch (error) {
      console.error('Failed to publish payment created event:', error);
    }

    return this.success({ success: true, payment }, requestId);
  }
}

export class RazorpayWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.event.requestContext?.requestId || randomUUID();
    const { event, payload } = body;

    if (!event || !payload) {
      return this.error('Invalid webhook payload', 400);
    }

    // ✅ TEMPORAL FIX: Webhook replay protection
    const webhookId = payload.id || payload.payment?.id || randomUUID();
    const { checkIdempotencyKey } = await import('../utils/idempotency');
    const existing = await checkIdempotencyKey(`webhook:${webhookId}`);
    if (existing.exists) {
      console.log(`[WEBHOOK] Replay detected for webhook: ${webhookId}`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Replay': 'true' },
        body: JSON.stringify({ success: true, message: 'Webhook already processed' }),
      };
    }

    // Process webhook event
    let paymentId: string | null = null;
    let paymentStatus: string = 'pending';

    if (event === 'payment.captured' || event === 'payment.failed') {
      paymentId = payload.payment?.entity?.id || payload.payment?.id;
      paymentStatus = event === 'payment.captured' ? 'completed' : 'failed';
    }

    if (paymentId) {
      // Update payment status
      const payments = await select('payments', { razorpay_payment_id: paymentId });
      if (payments.length > 0) {
        const payment = payments[0];
        const oldStatus = payment.payment_status;

        await update('payments', { id: payment.id }, { 
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        });

        // ✅ TEMPORAL FIX: Log payment status change
        const { logPaymentStatusChange } = await import('../utils/audit-log');
        await logPaymentStatusChange(
          payment.id,
          oldStatus,
          paymentStatus,
          'system',
          'webhook',
          `Razorpay webhook: ${event}`
        );

        // ✅ TEMPORAL FIX: Publish event with timestamp
        try {
          const { publishPaymentProcessed } = await import('../utils/sns-client');
          await publishPaymentProcessed({
            paymentId: payment.id,
            bookingId: payment.booking_id,
            customerId: payment.customer_id,
            vendorId: payment.vendor_id,
            oldStatus,
            newStatus: paymentStatus,
            eventTimestamp: new Date().toISOString(),
            eventId: randomUUID(),
            requestId,
          });
        } catch (error) {
          console.error('Failed to publish payment processed event:', error);
        }
      }
    }

    // ✅ TEMPORAL FIX: Store idempotency key for webhook
    const { storeIdempotencyKey } = await import('../utils/idempotency');
    await storeIdempotencyKey(`webhook:${webhookId}`, {
      httpStatus: 200,
      response: { success: true, message: 'Webhook processed' },
    });

    return this.success({ success: true, message: 'Webhook processed' }, requestId);
  }
}

export class GetPaymentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const paymentId = context.event.pathParameters?.id;
    const requestId = context.event.requestContext?.requestId || randomUUID();

    if (!paymentId) {
      return this.error('Payment ID is required', 400);
    }

    const payments = await select('payments', { id: paymentId });
    if (payments.length === 0) {
      return this.error('Payment not found', 404);
    }

    return this.success({ success: true, payment: normalizeDbRow(payments[0]) }, requestId);
  }
}

// Helper functions for payments.ts
export function createApiGatewayEventForPayment(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

export function createLambdaContextForPayment(): any {
  return {
    requestId: randomUUID(),
    functionName: 'payment-handler',
    functionVersion: '$LATEST',
  };
}

// ============================================================================
// RAZORPAY HANDLERS (from razorpay.ts)
// ============================================================================
// Note: The following handlers are large (200+ lines each). They will be 
// extracted from razorpay.ts:
// - CreateRazorpayOrderHandler
// - VerifyPaymentHandler
// - RazorpayWebhookHandler
// - MarketplaceSettlementHandler
// - ProcessRefundHandler
// These handlers will be added to this controller as the migration continues.

// ============================================================================
// WALLET HANDLERS (from wallet.ts)
// ============================================================================
// Note: The following handlers will be extracted from wallet.ts:
// - GetWalletHandler
// - GetWalletByPhoneHandler
// - AddFundsByPhoneHandler
// - UseWalletByPhoneHandler
// - CreditWalletHandler
// - DebitWalletHandler

// ============================================================================
// SETTLEMENT HANDLERS (from razorpay-settlements.ts, settlements.ts)
// ============================================================================
// Note: Settlement handlers will be extracted from:
// - razorpay-settlements.ts: CreateLinkedAccountHandler, AddBankAccountHandler, 
//   VerifyBankAccountHandler, ProcessSettlementHandler, GetSettlementStatusHandler,
//   GetVendorSettlementsHandler, AutoSettlementHandler
// - settlements.ts: (to be identified)

// ============================================================================
// PAYMENT GATEWAY MANAGEMENT HANDLERS (from payment-gateway-management.ts)
// ============================================================================
// Note: Payment gateway management handlers will be extracted as the migration continues.

// ============================================================================
// PAYMENTS ENHANCED HANDLERS (from payments-enhanced.ts)
// ============================================================================
// Note: Enhanced payment handlers will be extracted as the migration continues.
