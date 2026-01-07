"use strict";
/**
 * ============================================================================
 * PAYMENT ENDPOINTS - ENHANCED VERSION (PHASE 5)
 * ============================================================================
 *
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 *
 * Endpoints:
 * - POST /payments/create - Create payment
 * - POST /payments/razorpay/webhook - Razorpay webhook handler
 * - GET /payments/:id - Get payment details
 *
 * Date: 2026-01-28
 * Phase: 5
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPaymentEndpointsEnhanced = registerPaymentEndpointsEnhanced;
const base_handler_enhanced_1 = require("../handler/base-handler-enhanced");
const rds_connection_1 = require("../database/rds-connection");
const idempotency_1 = require("../utils/idempotency");
const audit_log_1 = require("../utils/audit-log");
const sns_client_1 = require("../utils/sns-client");
const payments_1 = require("@warmpawz/api-contracts/payments");
// ============================================================================
// PAYMENT HANDLERS
// ============================================================================
class CreatePaymentHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const body = this.parseBody(context.event);
        const requestId = context.requestId;
        // Validate request with Zod schema
        const validationResult = payments_1.CreatePaymentRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return this.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors }, requestId);
        }
        const { bookingId, amount, paymentMethod, customerId, vendorId, idempotencyKey } = validationResult.data;
        // Check idempotency key first
        if (idempotencyKey) {
            const existing = await (0, idempotency_1.checkIdempotencyKey)(idempotencyKey);
            if (existing.exists) {
                return {
                    statusCode: existing.httpStatus || 200,
                    headers: { 'X-Idempotent-Replay': 'true' },
                    body: existing.response,
                };
            }
        }
        // Get booking to extract customer_id and vendor_id
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
        if (bookings.length === 0) {
            return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
        }
        const booking = bookings[0];
        try {
            // Use transaction for atomicity
            const payment = await (0, rds_connection_1.withTransaction)(async (client) => {
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
            // Log audit entry
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
            // Log initial status
            await (0, audit_log_1.logPaymentStatusChange)(payment.id, null, 'pending');
            // Publish event
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
            // Store idempotency key
            if (idempotencyKey) {
                await (0, idempotency_1.storeIdempotencyKey)(idempotencyKey, 'payment', payment.id, JSON.stringify(response), 200);
            }
            return this.success(response, requestId);
        }
        catch (error) {
            console.error('Error creating payment:', error);
            return this.error(error.message || 'Failed to create payment', 500, 'INTERNAL_ERROR', undefined, requestId);
        }
    }
}
class RazorpayWebhookHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const rawBody = context.event.body || '{}';
        const headers = this.getHeaders(context.event);
        const signature = headers['x-razorpay-signature'] || headers['X-Razorpay-Signature'] || '';
        const requestId = context.requestId;
        // Verify Razorpay webhook signature
        if (!this.verifyWebhookSignature(rawBody, signature)) {
            console.error('[SECURITY] Invalid Razorpay webhook signature');
            return this.error('Invalid signature', 401, 'UNAUTHORIZED', undefined, requestId);
        }
        let body;
        try {
            body = JSON.parse(rawBody);
        }
        catch (error) {
            return this.error('Invalid JSON in webhook body', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        const { event, payload } = body;
        // Idempotency for webhooks using Razorpay event ID
        const webhookEventId = body.id || `${event}_${payload?.payment?.entity?.id || payload?.order?.entity?.id}`;
        const existing = await (0, idempotency_1.checkIdempotencyKey)(`webhook_${webhookEventId}`);
        if (existing.exists) {
            return this.success({ message: 'Webhook already processed', duplicate: true }, requestId);
        }
        // Handle different event types
        if (event === 'payment.captured') {
            const paymentEntity = payload?.payment?.entity;
            const payment_id = paymentEntity?.id;
            const order_id = paymentEntity?.order_id;
            if (!payment_id) {
                return this.success({ message: 'Webhook processed (no payment_id)' }, requestId);
            }
            try {
                // Use transaction for atomicity
                await (0, rds_connection_1.withTransaction)(async (client) => {
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
                    // Log status change
                    await (0, audit_log_1.logPaymentStatusChange)(payment.id, oldStatus, 'completed', 'webhook', event, { razorpay_payment_id: payment_id, amount: paymentEntity?.amount });
                });
                // Publish event
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
            catch (error) {
                console.error('Error processing webhook:', error);
                return this.error(error.message || 'Failed to process webhook', 500, 'INTERNAL_ERROR', undefined, requestId);
            }
        }
        // Store webhook idempotency key
        await (0, idempotency_1.storeIdempotencyKey)(`webhook_${webhookEventId}`, 'webhook', webhookEventId, JSON.stringify({ message: 'Webhook processed', event }), 200, 168 // 7 days for webhooks
        );
        return this.success({ message: 'Webhook processed' }, requestId);
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
class GetPaymentHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const paymentId = context.event.pathParameters?.paymentId;
        const requestId = context.requestId;
        if (!paymentId) {
            return this.error('Payment ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        try {
            const payments = await (0, rds_connection_1.select)('payments', { id: paymentId });
            if (payments.length === 0) {
                return this.error('Payment not found', 404, 'NOT_FOUND', undefined, requestId);
            }
            // Get payment status history
            const { rows: history } = await (0, rds_connection_1.query)(`SELECT * FROM payment_status_history 
         WHERE payment_id = $1 
         ORDER BY created_at ASC`, [paymentId]);
            return this.success({
                payment: payments[0],
                statusHistory: history,
            }, requestId);
        }
        catch (error) {
            console.error('Error getting payment:', error);
            return this.error(error.message || 'Failed to get payment', 500, 'INTERNAL_ERROR', undefined, requestId);
        }
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerPaymentEndpointsEnhanced(app) {
    const createHandler = new CreatePaymentHandlerEnhanced();
    const webhookHandler = new RazorpayWebhookHandlerEnhanced();
    const getHandler = new GetPaymentHandlerEnhanced();
    app.post('/payments/create', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await createHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.post('/payments/razorpay/webhook', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await webhookHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.get('/payments/:paymentId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { paymentId: c.req.param('paymentId') };
        const context = createLambdaContext();
        const result = await getHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
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
//# sourceMappingURL=payments-enhanced.js.map