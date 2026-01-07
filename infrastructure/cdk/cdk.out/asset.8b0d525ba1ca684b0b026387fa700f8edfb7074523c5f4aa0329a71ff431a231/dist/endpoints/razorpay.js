"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRazorpayEndpoints = registerRazorpayEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
const crypto_1 = require("crypto");
const razorpay_client_1 = require("../utils/razorpay-client");
// Razorpay configuration is imported from utils
// ============================================================================
// RAZORPAY HANDLERS
// ============================================================================
class CreateRazorpayOrderHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { bookingId, amount, currency = 'INR', customerId } = body;
        this.validateRequired(body, ['bookingId', 'amount']);
        const config = await (0, razorpay_client_1.getRazorpayConfig)();
        // ✅ SQL: Get booking details
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
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
        const razorpayOrder = await (0, razorpay_client_1.razorpayRequest)('/orders', 'POST', orderData);
        // ✅ SQL: Create payment record (customer_id is required)
        await (0, rds_connection_1.insert)('payments', {
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
class VerifyPaymentHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
        this.validateRequired(body, ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']);
        const config = await (0, razorpay_client_1.getRazorpayConfig)();
        // ✅ Verify signature
        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = (0, crypto_1.createHmac)('sha256', config.keySecret)
            .update(text)
            .digest('hex');
        if (generatedSignature !== razorpay_signature) {
            return this.error('Invalid payment signature', 400);
        }
        // ✅ SQL: Update payment status
        const payments = await (0, rds_connection_1.select)('payments', { razorpay_order_id });
        if (payments.length === 0) {
            return this.error('Payment not found', 404);
        }
        await (0, rds_connection_1.update)('payments', { razorpay_order_id }, {
            razorpay_payment_id: razorpay_payment_id,
            payment_status: 'completed',
            completed_at: new Date(),
        });
        // ✅ SQL: Update booking payment status
        const payment = payments[0];
        await (0, rds_connection_1.update)('bookings', { id: payment.booking_id }, { payment_status: 'paid' });
        // ✅ Publish payment processed event
        try {
            const { publishPaymentProcessed } = await Promise.resolve().then(() => __importStar(require('../utils/sns-client')));
            await publishPaymentProcessed({
                paymentId: razorpay_payment_id,
                bookingId: payment.booking_id,
                amount: payment.amount,
                status: 'completed',
            });
        }
        catch (error) {
            console.error('Failed to publish payment processed event:', error);
        }
        return this.success({
            message: 'Payment verified successfully',
            paymentId: razorpay_payment_id,
        });
    }
}
class RazorpayWebhookHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const headers = this.getHeaders(context.event);
        const webhookSignature = headers['x-razorpay-signature'];
        const config = await (0, razorpay_client_1.getRazorpayConfig)();
        // ✅ Verify webhook signature
        const payload = JSON.stringify(body);
        const expectedSignature = (0, crypto_1.createHmac)('sha256', config.webhookSecret)
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
            await (0, rds_connection_1.update)('payments', { razorpay_payment_id: payment.id }, {
                payment_status: 'completed',
                completed_at: new Date(),
            });
            // Update booking
            const payments = await (0, rds_connection_1.select)('payments', { razorpay_payment_id: payment.id });
            if (payments.length > 0) {
                await (0, rds_connection_1.update)('bookings', { id: payments[0].booking_id }, { payment_status: 'paid' });
            }
        }
        else if (event === 'payment.failed') {
            const payment = payload_data.payment.entity;
            await (0, rds_connection_1.update)('payments', { razorpay_payment_id: payment.id }, {
                payment_status: 'failed',
                failure_reason: payment.error_description || 'Payment failed',
            });
        }
        else if (event === 'refund.created') {
            const refund = payload_data.refund.entity;
            // ✅ SQL: Create refund record
            await (0, rds_connection_1.insert)('refunds', {
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
class MarketplaceSettlementHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { bookingId } = body;
        if (!bookingId) {
            return this.error('Booking ID is required', 400);
        }
        // ✅ SQL: Get booking
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
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
        const tiers = await (0, rds_connection_1.select)('vendor_tiers', { vendor_id: vendorId });
        const tierInfo = tiers.length > 0 ? tiers[0] : { current_tier: 'Bronze' };
        // Tier-based commission rates
        const TIER_CONFIG = {
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
        const settlements = await (0, rds_connection_1.insert)('settlements', settlementData);
        const settlement = settlements[0];
        // ✅ TODO: Initiate Razorpay Route transfer
        // For now, mark as processing. Actual transfer would be done via Razorpay Route API
        // ✅ SQL: Update booking settlement status
        await (0, rds_connection_1.update)('bookings', { id: bookingId }, {
            settlement_status: 'processing',
            settlement_id: settlement.id,
        });
        // ✅ Send to settlement queue for async processing
        try {
            const { sendToSettlementQueue } = await Promise.resolve().then(() => __importStar(require('../utils/sqs-client')));
            await sendToSettlementQueue({
                settlementId: settlement.id,
                bookingId,
                vendorId,
                amount: vendorShare,
            });
        }
        catch (error) {
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
class ProcessRefundHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { paymentId, amount, reason } = body;
        this.validateRequired(body, ['paymentId', 'amount']);
        const config = await (0, razorpay_client_1.getRazorpayConfig)();
        // ✅ SQL: Get payment
        const payments = await (0, rds_connection_1.select)('payments', { razorpay_payment_id: paymentId });
        if (payments.length === 0) {
            return this.error('Payment not found', 404);
        }
        const payment = payments[0];
        // ✅ Create Razorpay refund
        const refund = await (0, razorpay_client_1.razorpayRequest)(`/payments/${paymentId}/refund`, 'POST', {
            amount: Math.round(amount * 100), // Convert to paise
            notes: {
                reason: reason || 'Customer request',
            },
        });
        // ✅ SQL: Create refund record
        await (0, rds_connection_1.insert)('refunds', {
            payment_id: payment.id,
            refund_id: refund.id,
            amount: amount,
            status: refund.status,
            reason: reason || null,
        });
        // ✅ SQL: Update booking payment status
        await (0, rds_connection_1.update)('bookings', { id: payment.booking_id }, { payment_status: 'refunded' });
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
function registerRazorpayEndpoints(app) {
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
        functionName: 'razorpay-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=razorpay.js.map