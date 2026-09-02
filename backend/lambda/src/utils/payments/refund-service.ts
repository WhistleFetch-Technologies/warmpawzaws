/**
 * ============================================================================
 * REFUND SERVICE - Generic Refund Processing Utility
 * ============================================================================
 *
 * Delegates booking refunds to booking-original-refund orchestrator.
 * ============================================================================
 */

import { query, withTransaction } from '../../database/rds-connection';
import { publishToSNS } from '../aws/aws-clients';
import { BookingPaymentStatus } from '../../endpoints/constants';
import {
  processBookingOriginalPaymentRefund,
  processExistingPendingRefund,
} from './booking-original-refund';

export interface RefundRequest {
  paymentId: string;
  bookingId?: string;
  amount: number;
  reason: string;
  refundType?: 'full' | 'partial';
  initiatedBy?: 'customer' | 'vendor' | 'admin' | 'system';
  metadata?: Record<string, any>;
  skipNotification?: boolean;
  skipRazorpayRefund?: boolean;
  customerId?: string;
  vendorId?: string;
}

export interface RefundResult {
  refundId: string;
  razorpayRefundId?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'completed';
  amount: number;
  paymentStatus: string;
  bookingStatus?: string;
  message: string;
}

export interface RefundNotificationOptions {
  customerId: string;
  bookingId?: string;
  amount: number;
  reason: string;
  refundId: string;
  customMessage?: string;
  customSubject?: string;
}

export async function checkExistingRefund(paymentId: string): Promise<{
  exists: boolean;
  refundId?: string;
  status?: string;
}> {
  try {
    const result = await query(
      `SELECT id, refund_status 
       FROM refunds 
       WHERE payment_id = $1::uuid
         AND refund_status NOT IN ('failed', 'rejected')
       ORDER BY requested_at DESC NULLS LAST
       LIMIT 1`,
      [paymentId]
    );

    if (result.rows.length > 0) {
      return {
        exists: true,
        refundId: result.rows[0].id,
        status: result.rows[0].refund_status,
      };
    }

    return { exists: false };
  } catch (error: any) {
    console.error('[refund-service] Error checking existing refund:', error);
    throw error;
  }
}

export async function getPaymentDetails(paymentId: string): Promise<{
  id: string;
  booking_id?: string;
  customer_id: string;
  amount: number;
  razorpay_payment_id?: string;
  payment_status: string;
} | null> {
  try {
    const result = await query(
      `SELECT p.id, p.booking_id, p.customer_id, p.amount::text, 
              p.razorpay_payment_id, p.payment_status
       FROM payments p
       WHERE p.id = $1::uuid`,
      [paymentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      id: result.rows[0].id,
      booking_id: result.rows[0].booking_id,
      customer_id: result.rows[0].customer_id,
      amount: parseFloat(result.rows[0].amount || '0'),
      razorpay_payment_id: result.rows[0].razorpay_payment_id,
      payment_status: result.rows[0].payment_status,
    };
  } catch (error: any) {
    console.error('[refund-service] Error getting payment details:', error);
    throw error;
  }
}

export async function sendRefundNotification(
  options: RefundNotificationOptions
): Promise<void> {
  try {
    const { customerId, bookingId, amount, reason, refundId, customMessage, customSubject } = options;

    const customerResult = await query(
      `SELECT phone, email, full_name, name 
       FROM customers 
       WHERE id = $1::uuid`,
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      console.warn(`[refund-service] Customer ${customerId} not found for notification`);
      return;
    }

    const customer = customerResult.rows[0];
    const customerName = customer.full_name || customer.name || 'Customer';
    const bookingRef = bookingId ? `#${bookingId.substring(0, 8)}` : '';

    const smsMessage = customMessage || 
      `Your payment of ₹${amount}${bookingRef ? ` for booking ${bookingRef}` : ''} has been refunded. ${reason}. Refund will be processed within 5-7 business days.`;

    const emailSubject = customSubject || 
      `Payment Refund Initiated${bookingRef ? ` - Booking ${bookingRef}` : ''}`;

    const emailBody = customMessage || 
      `Hi ${customerName},\n\n` +
      `Your payment of ₹${amount}${bookingRef ? ` for booking ${bookingRef}` : ''} has been refunded.\n\n` +
      `Reason: ${reason}\n\n` +
      `The refund will be processed to your original payment method within 5-7 business days.\n\n` +
      `If you have any questions, please contact our support team.\n\n` +
      `Thank you,\nWarmpawz Team`;

    if (customer.phone) {
      await publishToSNS('customer-notifications', {
        type: 'sms',
        phone: customer.phone,
        message: smsMessage,
      }, {
        messageType: 'Transactional',
      });
    }

    if (customer.email) {
      await publishToSNS('customer-notifications', {
        type: 'email',
        email: customer.email,
        subject: emailSubject,
        body: emailBody,
      }, {
        messageType: 'Transactional',
      });
    }

    await publishToSNS('payment-events', {
      event_type: 'refund_initiated',
      booking_id: bookingId || null,
      customer_id: customerId,
      amount: amount,
      reason: reason,
      refund_id: refundId,
      timestamp: new Date().toISOString(),
    });

    console.log(`[refund-service] ✅ Notification sent to customer ${customerId}`);
  } catch (error: any) {
    console.error('[refund-service] Error sending notification:', error);
  }
}

/**
 * Process a refund — uses booking orchestrator when bookingId is available.
 */
export async function processRefund(request: RefundRequest): Promise<RefundResult> {
  const {
    paymentId,
    bookingId,
    amount,
    reason,
    initiatedBy = 'system',
    skipNotification = false,
    skipRazorpayRefund = false,
    customerId: customerIdParam,
    vendorId,
  } = request;

  if (amount <= 0) {
    throw new Error('Refund amount must be greater than 0');
  }

  const payment = await getPaymentDetails(paymentId);
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  if (amount > payment.amount) {
    throw new Error(`Refund amount (${amount}) exceeds payment amount (${payment.amount})`);
  }

  if (!['completed', 'partially_refunded'].includes(payment.payment_status)) {
    throw new Error(`Payment cannot be refunded in current state: ${payment.payment_status}`);
  }

  const resolvedBookingId = bookingId || payment.booking_id;
  const resolvedCustomerId = customerIdParam || payment.customer_id;

  if (skipRazorpayRefund) {
    return await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO refunds (
          payment_id, booking_id, customer_id, refund_amount, refund_reason,
          refund_status, refund_method, requested_at, processed_at
        ) VALUES ($1, $2, $3, $4, $5, 'completed', 'original', NOW(), NOW())
        RETURNING id::text`,
        [paymentId, resolvedBookingId || null, resolvedCustomerId, amount, reason]
      );
      return {
        refundId: ins.rows[0].id,
        status: 'completed' as const,
        amount,
        paymentStatus: payment.payment_status,
        message: 'Manual refund recorded',
      };
    });
  }

  if (!resolvedBookingId && resolvedCustomerId && payment.razorpay_payment_id) {
    const { getRazorpayClient } = await import('./razorpay-client');
    const existing = await checkExistingRefund(paymentId);
    if (existing.exists) {
      return {
        refundId: existing.refundId || '',
        status: (existing.status as RefundResult['status']) || 'processing',
        amount,
        paymentStatus: payment.payment_status,
        message: 'Refund already exists for this Event payment',
      };
    }

    const razorpay = getRazorpayClient();
    const rzRefund = await razorpay.payments.refund({
      payment_id: String(payment.razorpay_payment_id),
      amount: Math.round(amount * 100),
      idempotencyKey: `event-refund-${paymentId}`.slice(0, 36),
    });

    const inserted = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO refunds (
          payment_id, booking_id, customer_id, vendor_id, refund_amount, refund_reason,
          refund_status, refund_method, razorpay_refund_id, requested_at, processed_at
        ) VALUES ($1, NULL, $2, $3, $4, $5, 'processing', 'original', $6, NOW(), NOW())
        RETURNING id::text`,
        [paymentId, resolvedCustomerId, vendorId || null, amount, reason, rzRefund.id]
      );
      await client.query(
        `UPDATE payments SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1::uuid`,
        [paymentId]
      );
      return ins.rows[0].id as string;
    });

    if (!skipNotification) {
      await sendRefundNotification({
        customerId: resolvedCustomerId,
        amount,
        reason,
        refundId: inserted,
      });
    }

    return {
      refundId: inserted,
      razorpayRefundId: rzRefund.id,
      status: 'processing',
      amount,
      paymentStatus: 'refunded',
      message: 'Event refund initiated via existing Razorpay refund infrastructure',
    };
  }

  if (resolvedBookingId && resolvedCustomerId) {
    const result = await processBookingOriginalPaymentRefund({
      bookingId: String(resolvedBookingId),
      customerId: String(resolvedCustomerId),
      vendorId: vendorId || null,
      refundAmount: amount,
      reason,
      initiatedBy,
      skipNotification,
    });

    return {
      refundId: result.refundId || '',
      razorpayRefundId: result.razorpayRefundId,
      status: result.status === 'completed' ? 'completed' : result.status === 'failed' ? 'failed' : 'processing',
      amount: result.totalAmount,
      paymentStatus:
        result.status === 'failed' ? payment.payment_status : BookingPaymentStatus.REFUNDED,
      bookingStatus: BookingPaymentStatus.REFUNDED,
      message: result.message,
    };
  }

  throw new Error('Booking ID and customer ID required for automatic Razorpay refund');
}

export async function processInstantTeleRejectionRefund(
  bookingId: string,
  customerId: string,
  amount: number,
  vendorName: string
): Promise<RefundResult> {
  const bookingResult = await query(
    `SELECT payment_id FROM bookings WHERE id = $1::uuid`,
    [bookingId]
  );

  if (bookingResult.rows.length === 0 || !bookingResult.rows[0].payment_id) {
    const payments = await query(
      `SELECT id FROM payments WHERE booking_id = $1::uuid AND payment_status = 'completed' LIMIT 1`,
      [bookingId]
    );
    if (payments.rows.length === 0) {
      throw new Error(`Payment not found for booking ${bookingId}`);
    }
    return processRefund({
      paymentId: payments.rows[0].id,
      bookingId,
      customerId,
      amount,
      reason: `Vendor rejected instant tele consultation: ${vendorName}`,
      initiatedBy: 'system',
    });
  }

  return processRefund({
    paymentId: bookingResult.rows[0].payment_id,
    bookingId,
    customerId,
    amount,
    reason: `Vendor rejected instant tele consultation: ${vendorName}`,
    initiatedBy: 'system',
  });
}

export { processExistingPendingRefund };
