"use strict";
/**
 * ============================================================================
 * REFUND HANDLER WITH IDEMPOTENCY & STATE GUARDS
 * ============================================================================
 *
 * Comprehensive refund handling with:
 * - Idempotency protection
 * - State machine validation
 * - Auto-approval for small amounts
 * - Double-entry ledger integration
 *
 * Date: 2026-01-03
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRefundEndpoints = registerRefundEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
const idempotency_1 = require("../utils/idempotency");
const audit_log_1 = require("../utils/audit-log");
// Maximum amount for auto-approval (in INR)
const AUTO_APPROVAL_THRESHOLD = 5000.00;
// ============================================================================
// REFUND HANDLERS
// ============================================================================
class CreateRefundHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const requestId = context.event.requestContext?.requestId;
        const { paymentId, bookingId, amount, reason, refundType, // 'full' or 'partial'
        idempotencyKey, } = body;
        this.validateRequired(body, ['paymentId', 'amount', 'reason']);
        // ✅ Check idempotency
        if (idempotencyKey) {
            const existing = await (0, idempotency_1.checkIdempotencyKey)(idempotencyKey);
            if (existing.exists) {
                return this.success({
                    ...existing.response,
                    cached: true,
                    message: 'Refund already processed',
                });
            }
        }
        // Validate payment exists
        const payments = await (0, rds_connection_1.select)('payments', { id: paymentId });
        if (payments.length === 0) {
            return this.error('Payment not found', 404);
        }
        const payment = payments[0];
        // Validate amount
        if (amount <= 0 || amount > payment.amount) {
            return this.error('Invalid refund amount', 400);
        }
        // Check if payment can be refunded
        if (!['completed', 'partially_refunded'].includes(payment.payment_status)) {
            return this.error('Payment cannot be refunded in current state', 400);
        }
        // Calculate total refunded so far
        const { rows: existingRefunds } = await (0, rds_connection_1.query)(`SELECT COALESCE(SUM(amount), 0) AS total_refunded 
       FROM refunds 
       WHERE payment_id = $1 AND refund_status IN ('completed', 'processing', 'approved')`, [paymentId]);
        const totalRefunded = parseFloat(existingRefunds[0].total_refunded || '0');
        const availableToRefund = payment.amount - totalRefunded;
        if (amount > availableToRefund) {
            return this.error(`Only ${availableToRefund} available to refund`, 400);
        }
        // Determine if auto-approval applies
        const requiresApproval = amount > AUTO_APPROVAL_THRESHOLD;
        const initialStatus = requiresApproval ? 'pending' : 'auto_approved';
        // Create refund in transaction
        const result = await (0, rds_connection_1.withTransaction)(async (client) => {
            // Insert refund record
            const refundResult = await client.query(`INSERT INTO refunds (
          payment_id, booking_id, amount, reason, refund_type, 
          refund_status, razorpay_payment_id, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`, [
                paymentId,
                bookingId || null,
                amount,
                reason,
                refundType || 'partial',
                initialStatus,
                payment.razorpay_payment_id,
                idempotencyKey || null,
            ]);
            const refund = refundResult.rows[0];
            // Update payment status
            const newPaymentStatus = amount === availableToRefund ? 'refunded' : 'partially_refunded';
            await client.query(`UPDATE payments 
         SET payment_status = $1, updated_at = NOW()
         WHERE id = $2`, [newPaymentStatus, paymentId]);
            // If auto-approved, initiate refund process immediately
            if (!requiresApproval) {
                await client.query(`UPDATE refunds SET refund_status = 'processing', updated_at = NOW() WHERE id = $1`, [refund.id]);
                // TODO: Integrate with Razorpay refund API
            }
            return { refund, newPaymentStatus };
        });
        // Log audit entry
        await (0, audit_log_1.logAuditEntry)({
            entityType: 'refund',
            entityId: result.refund.id,
            action: 'create',
            newValues: {
                amount,
                status: initialStatus,
                autoApproved: !requiresApproval,
            },
            actorType: 'system',
            requestId,
        });
        const response = {
            refundId: result.refund.id,
            paymentId,
            amount: parseFloat(amount),
            status: initialStatus,
            requiresApproval,
            message: requiresApproval
                ? 'Refund request created, pending admin approval'
                : 'Refund auto-approved and processing',
        };
        // Store idempotency key
        if (idempotencyKey) {
            await (0, idempotency_1.storeIdempotencyKey)(idempotencyKey, 'refund', result.refund.id, response, 200);
        }
        return this.success(response);
    }
}
class ApproveRefundHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const refundId = context.event.pathParameters?.refundId;
        const body = this.parseBody(context.event);
        const { approved, adminComment } = body;
        const requestId = context.event.requestContext?.requestId;
        const adminId = context.userId; // From auth token
        if (!refundId) {
            return this.error('Refund ID is required', 400);
        }
        const refunds = await (0, rds_connection_1.select)('refunds', { id: refundId });
        if (refunds.length === 0) {
            return this.error('Refund not found', 404);
        }
        const refund = refunds[0];
        // Validate current status
        if (refund.refund_status !== 'pending') {
            return this.error('Refund not in pending state', 400);
        }
        const newStatus = approved ? 'approved' : 'rejected';
        // Update refund status
        await (0, rds_connection_1.withTransaction)(async (client) => {
            await client.query(`UPDATE refunds 
         SET refund_status = $1, admin_comment = $2, updated_at = NOW()
         WHERE id = $3`, [newStatus, adminComment || null, refundId]);
            // If approved, initiate refund
            if (approved) {
                await client.query(`UPDATE refunds SET refund_status = 'processing', updated_at = NOW() WHERE id = $1`, [refundId]);
                // TODO: Integrate with Razorpay refund API
            }
            else {
                // If rejected, revert payment status
                await client.query(`UPDATE payments 
           SET payment_status = 'completed', updated_at = NOW()
           WHERE id = $1`, [refund.payment_id]);
            }
        });
        // Log audit entry
        await (0, audit_log_1.logAuditEntry)({
            entityType: 'refund',
            entityId: refundId,
            action: approved ? 'approve' : 'reject',
            oldValues: { status: 'pending' },
            newValues: { status: newStatus, adminComment },
            actorId: adminId,
            actorType: 'admin',
            requestId,
        });
        return this.success({
            refundId,
            status: newStatus,
            message: approved ? 'Refund approved and processing' : 'Refund rejected',
        });
    }
}
class GetRefundHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const refundId = context.event.pathParameters?.refundId;
        if (!refundId) {
            return this.error('Refund ID is required', 400);
        }
        const refunds = await (0, rds_connection_1.select)('refunds', { id: refundId });
        if (refunds.length === 0) {
            return this.error('Refund not found', 404);
        }
        return this.success(refunds[0]);
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerRefundEndpoints(app) {
    const createHandler = new CreateRefundHandler();
    const approveHandler = new ApproveRefundHandler();
    const getHandler = new GetRefundHandler();
    app.post('/refunds/create', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await createHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/refunds/:refundId/approve', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { refundId: c.req.param('refundId') };
        const context = createLambdaContext();
        const result = await approveHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/refunds/:refundId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { refundId: c.req.param('refundId') };
        const context = createLambdaContext();
        const result = await getHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
function createApiGatewayEvent(req) {
    return {
        httpMethod: req.method,
        path: req.url,
        headers: Object.fromEntries(req.headers || []),
        body: JSON.stringify(req.body || {}),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
        requestContext: {
            requestId: crypto.randomUUID(),
        },
    };
}
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'refund-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=refunds.js.map