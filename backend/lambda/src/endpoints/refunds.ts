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

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, withTransaction } from '../database/rds-connection';
import { checkIdempotencyKey, storeIdempotencyKey } from '../utils/idempotency';
import { logAuditEntry } from '../utils/audit-log';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// REFUND HANDLERS
// ============================================================================

class CreateRefundHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.event.requestContext?.requestId;
    const {
      paymentId,
      bookingId,
      amount,
      reason,
      refundType, // 'full' or 'partial'
      idempotencyKey,
    } = body;

    this.validateRequired(body, ['paymentId', 'reason']);

    // ✅ Check idempotency
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        return this.success({
          ...existing.response,
          cached: true,
          message: 'Refund already processed',
        });
      }
    }

    // Validate payment exists
    const payments = await select('payments', { id: paymentId });
    if (payments.length === 0) {
      return this.error('Payment not found', 404);
    }

    const payment = payments[0];

    // ✅ Calculate refund amount using policy engine if bookingId provided
    let refundAmount = amount;

    if (bookingId && !amount) {
      // Calculate refund using policy engine
      try {
        // Get booking to calculate hours until booking
        const bookings = await select('bookings', { id: bookingId });
        if (bookings.length > 0) {
          const booking = bookings[0];
          
          // Calculate hours until booking
          let hoursUntilBooking = 0;
          if (booking.booking_datetime) {
            const bookingDateTime = new Date(booking.booking_datetime);
            hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
          } else if (booking.booking_date && booking.booking_time) {
            const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
            hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
          }

          if (hoursUntilBooking < 0) {
            return this.error('Cannot refund past bookings', 400);
          }

          // Get refund rules
          const rulesResult = await query(
            `SELECT * FROM booking_cancellation_rules
             WHERE (vendor_id = $1 OR vendor_id IS NULL)
               AND (service_id = $2 OR service_id IS NULL)
             ORDER BY vendor_id DESC NULLS LAST, service_id DESC NULLS LAST
             LIMIT 1`,
            [booking.vendor_id || null, booking.service_id || null]
          );

          const rows = Array.isArray(rulesResult) ? rulesResult : (rulesResult as any).rows || [];
          const rule = rows.length > 0 ? rows[0] : null;

          const fullRefundHours = rule?.full_refund_before_hours || 48;
          const partialRefundHours = rule?.partial_refund_before_hours || 24;
          const partialRefundPercentage = parseFloat(rule?.partial_refund_percentage || '50');
          const cutoffHours = rule?.cancellation_cutoff_hours || 12;

          // Calculate refund percentage
          let refundPercentage = 0;
          if (hoursUntilBooking >= fullRefundHours) {
            refundPercentage = 100;
          } else if (hoursUntilBooking >= partialRefundHours) {
            refundPercentage = partialRefundPercentage;
          } else if (hoursUntilBooking >= cutoffHours) {
            refundPercentage = partialRefundPercentage;
          } else {
            return this.error(`No refund - cancelled less than ${cutoffHours} hours before booking`, 400);
          }

          refundAmount = (payment.amount * refundPercentage) / 100;
        }
      } catch (error: any) {
        console.error('Error calculating refund policy:', error);
        // Continue with manual amount if policy calculation fails
      }
    }

    // If amount not provided and not calculated, use full payment amount
    if (!refundAmount) {
      refundAmount = payment.amount;
    }

    // Validate amount
    if (refundAmount <= 0 || refundAmount > payment.amount) {
      return this.error('Invalid refund amount', 400);
    }

    // Check if payment can be refunded
    if (!['completed', 'partially_refunded'].includes(payment.payment_status)) {
      return this.error('Payment cannot be refunded in current state', 400);
    }

    // Calculate total refunded so far
    const { rows: existingRefunds } = await query(
      `SELECT COALESCE(SUM(refund_amount), 0) AS total_refunded 
       FROM refunds 
       WHERE payment_id = $1::uuid AND refund_status IN ('completed', 'processing', 'approved', 'processed')`,
      [paymentId]
    );

    const totalRefunded = parseFloat(existingRefunds[0]?.total_refunded || '0');
    const availableToRefund = parseFloat(String(payment.amount)) - totalRefunded;

    if (refundAmount > availableToRefund + 0.01) {
      return this.error(`Only ₹${availableToRefund.toFixed(2)} available to refund`, 400);
    }

    const resolvedBookingId = bookingId || payment.booking_id;
    const customerId = payment.customer_id;

    if (!resolvedBookingId || !customerId) {
      return this.error('Booking ID and customer required for automatic Razorpay refund', 400);
    }

    try {
      const { processBookingOriginalPaymentRefund } = await import('../utils/payments/booking-original-refund');
      const result = await processBookingOriginalPaymentRefund({
        bookingId: String(resolvedBookingId),
        customerId: String(customerId),
        vendorId: payment.vendor_id ? String(payment.vendor_id) : null,
        refundAmount: parseFloat(String(refundAmount)),
        reason: String(reason),
        initiatedBy: 'admin',
      });

      const response = {
        refundId: result.refundId,
        paymentId,
        amount: result.totalAmount,
        status: result.status,
        requiresApproval: false,
        razorpayRefundId: result.razorpayRefundId,
        message: result.message,
      };

      if (idempotencyKey && result.refundId) {
        await storeIdempotencyKey(idempotencyKey, 'refund', result.refundId, response, 200);
      }

      await logAuditEntry({
        entityType: 'refund',
        entityId: result.refundId || paymentId,
        action: 'create',
        newValues: { amount: refundAmount, status: result.status, autoApproved: true },
        actorType: 'system',
        requestId,
      });

      return this.success(response);
    } catch (error: any) {
      console.error('[CreateRefundHandler] automatic refund failed:', error);
      return this.error(error.message || 'Refund processing failed', 502);
    }
  }
}

class ApproveRefundHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const refundId = context.event.pathParameters?.refundId;
    const body = this.parseBody(context.event);
    const { approved, adminComment } = body;
    const requestId = context.event.requestContext?.requestId;
    const adminId = context.userId;

    if (!refundId) {
      return this.error('Refund ID is required', 400);
    }

    const refunds = await select('refunds', { id: refundId });
    if (refunds.length === 0) {
      return this.error('Refund not found', 404);
    }

    const refund = refunds[0];

    if (refund.refund_status !== 'pending' && refund.refund_status !== 'approved') {
      return this.error(`Refund not in pending state (current: ${refund.refund_status})`, 400);
    }

    if (!approved) {
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE refunds SET refund_status = 'rejected', admin_comment = $2, updated_at = NOW() WHERE id = $1::uuid`,
          [refundId, adminComment || null]
        );
      });

      await logAuditEntry({
        entityType: 'refund',
        entityId: refundId,
        action: 'reject',
        oldValues: { status: refund.refund_status },
        newValues: { status: 'rejected', adminComment },
        actorId: adminId,
        actorType: 'admin',
        requestId,
      });

      return this.success({
        refundId,
        status: 'rejected',
        message: 'Refund rejected',
      });
    }

    try {
      const { processExistingPendingRefund } = await import('../utils/payments/booking-original-refund');
      const result = await processExistingPendingRefund(refundId, {
        adminComment,
      });

      await logAuditEntry({
        entityType: 'refund',
        entityId: refundId,
        action: 'approve',
        oldValues: { status: 'pending' },
        newValues: { status: result.status, adminComment },
        actorId: adminId,
        actorType: 'admin',
        requestId,
      });

      return this.success({
        refundId,
        status: result.status,
        razorpayRefundId: result.razorpayRefundId,
        message: result.message || 'Refund approved and processing',
      });
    } catch (error: any) {
      console.error('[ApproveRefundHandler] failed:', error);
      return this.error(error.message || 'Refund processing failed', 502);
    }
  }
}

class GetRefundHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const refundId = context.event.pathParameters?.refundId;

    if (!refundId) {
      return this.error('Refund ID is required', 400);
    }

    const refunds = await select('refunds', { id: refundId });
    if (refunds.length === 0) {
      return this.error('Refund not found', 404);
    }

    return this.success(refunds[0]);
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerRefundEndpoints(app: Hono) {
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

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: Object.fromEntries(req.headers || []),
    body: JSON.stringify(req.body || {}),
    pathParameters: {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'refund-handler',
    functionVersion: '$LATEST',
  };
}

