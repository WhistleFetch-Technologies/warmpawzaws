"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPaymentEndpoints = registerPaymentEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
const idempotency_1 = require("../utils/idempotency");
const audit_log_1 = require("../utils/audit-log");
const sns_client_1 = require("../utils/sns-client");
// ============================================================================
// PAYMENT HANDLERS
// ============================================================================
class CreatePaymentHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const requestId = context.event.requestContext?.requestId || crypto.randomUUID();
        const { bookingId, amount, paymentMethod, customerId, vendorId, idempotencyKey } = body;
        this.validateRequired(body, ['bookingId', 'amount']);
        // ✅ TEMPORAL FIX: Check idempotency key first
        if (idempotencyKey) {
            const existing = await (0, idempotency_1.checkIdempotencyKey)(idempotencyKey);
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
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
        if (bookings.length === 0) {
            return this.error('Booking not found', 404);
        }
        const booking = bookings[0];
        // ✅ TEMPORAL FIX: Use transaction
        const payment = await (0, rds_connection_1.withTransaction)(async (client) => {
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
            const result = await client.query(`INSERT INTO payments (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
            return result.rows[0];
        });
        // ✅ TEMPORAL FIX: Log audit entry
        await (0, audit_log_1.logAuditEntry)({
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
        await (0, audit_log_1.logPaymentStatusChange)(payment.id, null, 'pending');
        // ✅ TEMPORAL FIX: Publish event with timestamps
        try {
            await (0, sns_client_1.publishPaymentCreated)({
                paymentId: payment.id,
                bookingId,
                customerId: payment.customer_id,
                vendorId: payment.vendor_id,
                amount: payment.amount,
                currency: 'INR',
                status: 'pending',
                requestId,
            });
        }
        catch (error) {
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
            await (0, idempotency_1.storeIdempotencyKey)(idempotencyKey, 'payment', payment.id, response, 200);
        }
        return this.success(response);
    }
}
class RazorpayWebhookHandler extends base_handler_1.BaseHandler {
    async handle(context) {
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
        const existing = await (0, idempotency_1.checkIdempotencyKey)(`webhook_${webhookEventId}`);
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
            await (0, rds_connection_1.withTransaction)(async (client) => {
                // Get existing payment by razorpay_payment_id or order_id
                const { rows: payments } = await client.query(`SELECT * FROM payments 
           WHERE razorpay_payment_id = $1 OR razorpay_order_id = $2
           FOR UPDATE`, [payment_id, order_id]);
                if (payments.length === 0) {
                    console.warn(`Payment not found for razorpay_payment_id: ${payment_id}`);
                    return;
                }
                const payment = payments[0];
                const oldStatus = payment.payment_status;
                // Update payment status
                await client.query(`UPDATE payments SET 
             payment_status = 'completed',
             razorpay_payment_id = $1,
             razorpay_order_id = $2,
             completed_at = NOW(),
             updated_at = NOW()
           WHERE id = $3`, [payment_id, order_id, payment.id]);
                // Update booking payment status
                if (payment.booking_id) {
                    await client.query(`UPDATE bookings SET payment_status = 'paid', updated_at = NOW() WHERE id = $1`, [payment.booking_id]);
                }
                // ✅ TEMPORAL FIX: Log status change
                await (0, audit_log_1.logPaymentStatusChange)(payment.id, oldStatus, 'completed', 'webhook', // changedByType
                event, // razorpayEvent
                { razorpay_payment_id: payment_id, amount: paymentEntity?.amount } // metadata
                );
            });
            // ✅ TEMPORAL FIX: Publish event with timestamps
            try {
                await (0, sns_client_1.publishPaymentProcessed)({
                    paymentId: payment_id,
                    amount: (paymentEntity?.amount || 0) / 100,
                    status: 'completed',
                    razorpayPaymentId: payment_id,
                });
            }
            catch (error) {
                console.error('Failed to publish payment processed event:', error);
            }
        }
        // ✅ TEMPORAL FIX: Store webhook idempotency key
        await (0, idempotency_1.storeIdempotencyKey)(`webhook_${webhookEventId}`, 'webhook', webhookEventId, { message: 'Webhook processed', event }, 200, 168 // 7 days for webhooks
        );
        return this.success({ message: 'Webhook processed' });
    }
    /**
     * Verify Razorpay webhook signature using HMAC SHA256
     */
    verifyWebhookSignature(body, signature) {
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
            return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
        }
        catch (error) {
            console.error('[SECURITY] Signature verification failed:', error);
            return false;
        }
    }
}
class GetPaymentHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const paymentId = context.event.pathParameters?.paymentId;
        if (!paymentId) {
            return this.error('Payment ID is required', 400);
        }
        const payments = await (0, rds_connection_1.select)('payments', { id: paymentId });
        if (payments.length === 0) {
            return this.error('Payment not found', 404);
        }
        // Get payment status history
        const { rows: history } = await (0, rds_connection_1.query)(`SELECT * FROM payment_status_history 
       WHERE payment_id = $1 
       ORDER BY created_at ASC`, [paymentId]);
        return this.success({
            payment: payments[0],
            statusHistory: history,
        });
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerPaymentEndpoints(app) {
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
function createApiGatewayEvent(req) {
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
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'payment-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=payments.js.map