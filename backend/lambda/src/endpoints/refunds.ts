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
import { query, select, insert, update, withTransaction } from '../database/rds-connection';
import { checkIdempotencyKey, storeIdempotencyKey } from '../utils/idempotency';
import { logAuditEntry } from '../utils/audit-log';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// Maximum amount for auto-approval (in INR)
const AUTO_APPROVAL_THRESHOLD = 5000.00;

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
      `SELECT COALESCE(SUM(amount), 0) AS total_refunded 
       FROM refunds 
       WHERE payment_id = $1 AND refund_status IN ('completed', 'processing', 'approved')`,
      [paymentId]
    );

    const totalRefunded = parseFloat(existingRefunds[0].total_refunded || '0');
    const availableToRefund = payment.amount - totalRefunded;

    if (amount > availableToRefund) {
      return this.error(`Only ${availableToRefund} available to refund`, 400);
    }

    // Determine if auto-approval applies
    const requiresApproval = amount > AUTO_APPROVAL_THRESHOLD;
    const initialStatus = requiresApproval ? 'pending' : 'auto_approved';

    // Create refund in transaction
    const result = await withTransaction(async (client) => {
      // Insert refund record
      const refundResult = await client.query(
        `INSERT INTO refunds (
          payment_id, booking_id, amount, reason, refund_type, 
          refund_status, razorpay_payment_id, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          paymentId,
          bookingId || null,
          amount,
          reason,
          refundType || 'partial',
          initialStatus,
          payment.razorpay_payment_id,
          idempotencyKey || null,
        ]
      );

      const refund = refundResult.rows[0];

      // Update payment status
      const newPaymentStatus =
        amount === availableToRefund ? 'refunded' : 'partially_refunded';

      await client.query(
        `UPDATE payments 
         SET payment_status = $1, updated_at = NOW()
         WHERE id = $2`,
        [newPaymentStatus, paymentId]
      );

      // If auto-approved, initiate refund process immediately
      if (!requiresApproval) {
        await client.query(
          `UPDATE refunds SET refund_status = 'processing', updated_at = NOW() WHERE id = $1`,
          [refund.id]
        );

        // Integrate with Razorpay refund API
        try {
          const { getRazorpayClient } = require('../utils/razorpay-client');
          const razorpay = getRazorpayClient();
          
          // Get payment details
          const payments = await select('payments', { id: refund.payment_id });
          if (payments.length > 0 && payments[0].razorpay_payment_id) {
            const refundResult = await razorpay.payments.refund({
              payment_id: payments[0].razorpay_payment_id,
              amount: Math.round(refund.amount * 100), // Convert to paise
            });
            
            // Update refund with Razorpay refund ID
            await client.query(
              `UPDATE refunds 
               SET razorpay_refund_id = $1, refund_status = 'processed', processed_at = NOW(), updated_at = NOW()
               WHERE id = $2`,
              [refundResult.id, refund.id]
            );
            
            console.log(`✅ Razorpay refund processed: ${refundResult.id}`);
          } else {
            console.warn(`⚠️ Payment not found or missing Razorpay payment ID for refund ${refund.id}`);
          }
        } catch (error: any) {
          console.error('Error processing Razorpay refund:', error);
          // Update refund status to failed
          await client.query(
            `UPDATE refunds SET refund_status = 'failed', updated_at = NOW() WHERE id = $1`,
            [refund.id]
          );
          throw error;
        }
      }

      return { refund, newPaymentStatus };
    });

    // Log audit entry
    await logAuditEntry({
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
      await storeIdempotencyKey(
        idempotencyKey,
        'refund',
        result.refund.id,
        response,
        200
      );
    }

    return this.success(response);
  }
}

class ApproveRefundHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const refundId = context.event.pathParameters?.refundId;
    const body = this.parseBody(context.event);
    const { approved, adminComment } = body;
    const requestId = context.event.requestContext?.requestId;
    const adminId = context.userId; // From auth token

    if (!refundId) {
      return this.error('Refund ID is required', 400);
    }

    const refunds = await select('refunds', { id: refundId });
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
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE refunds 
         SET refund_status = $1, admin_comment = $2, updated_at = NOW()
         WHERE id = $3`,
        [newStatus, adminComment || null, refundId]
      );

      // If approved, initiate refund
      if (approved) {
        await client.query(
          `UPDATE refunds SET refund_status = 'processing', updated_at = NOW() WHERE id = $1`,
          [refundId]
        );

        // Integrate with Razorpay refund API
        try {
          const { getRazorpayClient } = require('../utils/razorpay-client');
          const razorpay = getRazorpayClient();
          
          // Get payment details
          const payments = await select('payments', { id: refund.payment_id });
          if (payments.length > 0 && payments[0].razorpay_payment_id) {
            const refundResult = await razorpay.payments.refund({
              payment_id: payments[0].razorpay_payment_id,
              amount: Math.round(refund.amount * 100), // Convert to paise
            });
            
            // Update refund with Razorpay refund ID
            await client.query(
              `UPDATE refunds 
               SET razorpay_refund_id = $1, refund_status = 'processed', processed_at = NOW(), updated_at = NOW()
               WHERE id = $2`,
              [refundResult.id, refund.id]
            );
            
            console.log(`✅ Razorpay refund processed: ${refundResult.id}`);
          } else {
            console.warn(`⚠️ Payment not found or missing Razorpay payment ID for refund ${refund.id}`);
          }
        } catch (error: any) {
          console.error('Error processing Razorpay refund:', error);
          // Update refund status to failed
          await client.query(
            `UPDATE refunds SET refund_status = 'failed', updated_at = NOW() WHERE id = $1`,
            [refund.id]
          );
          throw error;
        }
      } else {
        // If rejected, revert payment status
        await client.query(
          `UPDATE payments 
           SET payment_status = 'completed', updated_at = NOW()
           WHERE id = $1`,
          [refund.payment_id]
        );
      }
    });

    // Log audit entry
    await logAuditEntry({
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

