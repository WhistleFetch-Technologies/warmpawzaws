/**
 * ============================================================================
 * REFUND SERVICE - Generic Refund Processing Utility
 * ============================================================================
 * 
 * A reusable service for processing refunds across the application.
 * Handles:
 * - Refund record creation
 * - Razorpay refund API integration
 * - Payment status updates
 * - Customer notifications (SNS)
 * - Booking status updates (optional)
 * 
 * Date: 2026-03-03
 * ============================================================================
 */

import { query, select, insert, update, withTransaction } from '../../database/rds-connection';
import { getRazorpayClient } from '../../utils/payments/razorpay-client';
import { publishToSNS } from '../../utils/aws-clients';
import { BookingPaymentStatus } from '../../endpoints/constants';

export interface RefundRequest {
  paymentId: string;
  bookingId?: string;
  amount: number;
  reason: string;
  refundType?: 'full' | 'partial';
  initiatedBy?: 'customer' | 'vendor' | 'admin' | 'system';
  metadata?: Record<string, any>;
  skipNotification?: boolean;
  skipRazorpayRefund?: boolean; // For testing or manual refunds
}

export interface RefundResult {
  refundId: string;
  razorpayRefundId?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
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

/**
 * Check if a refund already exists for a payment
 */
export async function checkExistingRefund(paymentId: string): Promise<{
  exists: boolean;
  refundId?: string;
  status?: string;
}> {
  try {
    const result = await query(
      `SELECT id, refund_status 
       FROM refunds 
       WHERE payment_id = $1 
         AND refund_status NOT IN ('failed', 'cancelled')
       ORDER BY created_at DESC 
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

/**
 * Get payment details including Razorpay payment ID
 */
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
      `SELECT p.id, p.booking_id, p.customer_id, p.amount, 
              p.razorpay_payment_id, p.payment_status
       FROM payments p
       WHERE p.id = $1`,
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

/**
 * Process Razorpay refund
 */
async function processRazorpayRefund(
  razorpayPaymentId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, any>
): Promise<{ id: string; status: string }> {
  try {
    const razorpay = getRazorpayClient();
    const refundResult = await razorpay.payments.refund({
      payment_id: razorpayPaymentId,
      amount: Math.round(amount * 100), // Convert to paise
      notes: {
        reason: reason,
        ...metadata,
      },
    });

    return {
      id: refundResult.id,
      status: refundResult.status === 'processed' ? 'processed' : 'processing',
    };
  } catch (error: any) {
    console.error('[refund-service] Razorpay refund error:', error);
    throw error;
  }
}

/**
 * Send refund notification to customer via SNS
 */
export async function sendRefundNotification(
  options: RefundNotificationOptions
): Promise<void> {
  try {
    const { customerId, bookingId, amount, reason, refundId, customMessage, customSubject } = options;

    // Get customer details
    const customerResult = await query(
      `SELECT phone, email, full_name, name 
       FROM customers 
       WHERE id = $1`,
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      console.warn(`[refund-service] Customer ${customerId} not found for notification`);
      return;
    }

    const customer = customerResult.rows[0];
    const customerName = customer.full_name || customer.name || 'Customer';
    const bookingRef = bookingId ? `#${bookingId.substring(0, 8)}` : '';

    // Default messages
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

    // Send SMS notification
    if (customer.phone) {
      await publishToSNS('customer-notifications', {
        type: 'sms',
        phone: customer.phone,
        message: smsMessage,
      }, {
        messageType: 'Transactional',
      });
    }

    // Send email notification
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

    // Publish to payment-events topic
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
    // Don't throw - notification failure shouldn't block refund
  }
}

/**
 * Main function to process a refund
 * This is the generic function that can be used anywhere in the codebase
 */
export async function processRefund(request: RefundRequest): Promise<RefundResult> {
  const {
    paymentId,
    bookingId,
    amount,
    reason,
    refundType = 'full',
    initiatedBy = 'system',
    metadata = {},
    skipNotification = false,
    skipRazorpayRefund = false,
  } = request;

  // Validate amount
  if (amount <= 0) {
    throw new Error('Refund amount must be greater than 0');
  }

  // Get payment details
  const payment = await getPaymentDetails(paymentId);
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  // Validate amount doesn't exceed payment amount
  if (amount > payment.amount) {
    throw new Error(`Refund amount (${amount}) exceeds payment amount (${payment.amount})`);
  }

  // Check for existing refunds
  const existingRefund = await checkExistingRefund(paymentId);
  if (existingRefund.exists) {
    throw new Error(
      `Refund already exists for payment ${paymentId}. Refund ID: ${existingRefund.refundId}, Status: ${existingRefund.status}`
    );
  }

  // Validate payment can be refunded
  if (!['completed', 'partially_refunded'].includes(payment.payment_status)) {
    throw new Error(`Payment cannot be refunded in current state: ${payment.payment_status}`);
  }

  // Calculate total already refunded
  const { rows: refundedRows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total_refunded 
     FROM refunds 
     WHERE payment_id = $1 
       AND refund_status IN ('processed', 'processing', 'approved')`,
    [paymentId]
  );

  const totalRefunded = parseFloat(refundedRows[0]?.total_refunded || '0');
  const availableToRefund = payment.amount - totalRefunded;

  if (amount > availableToRefund) {
    throw new Error(
      `Only ₹${availableToRefund} available to refund. Requested: ₹${amount}`
    );
  }

  // Process refund in transaction
  return await withTransaction(async (client) => {
    // Create refund record
    const refundResult = await client.query(
      `INSERT INTO refunds (
        payment_id, booking_id, amount, reason, refund_type,
        refund_status, razorpay_payment_id, initiated_by, metadata,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        paymentId,
        bookingId || payment.booking_id || null,
        amount,
        reason,
        refundType,
        'processing',
        payment.razorpay_payment_id || null,
        initiatedBy,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    const refund = refundResult.rows[0];
    let razorpayRefundId: string | undefined;
    let finalStatus: 'pending' | 'processing' | 'processed' | 'failed' = 'processing';

    // Process Razorpay refund if payment ID exists and not skipped
    if (payment.razorpay_payment_id && !skipRazorpayRefund) {
      try {
        const razorpayResult = await processRazorpayRefund(
          payment.razorpay_payment_id,
          amount,
          reason,
          { booking_id: bookingId || payment.booking_id, ...metadata }
        );

        razorpayRefundId = razorpayResult.id;
        finalStatus = razorpayResult.status === 'processed' ? 'processed' : 'processing';

        // Update refund record with Razorpay refund ID
        await client.query(
          `UPDATE refunds 
           SET razorpay_refund_id = $1, refund_status = $2, 
               processed_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [razorpayRefundId, finalStatus, refund.id]
        );

        console.log(`[refund-service] ✅ Razorpay refund processed: ${razorpayRefundId}`);
      } catch (error: any) {
        console.error('[refund-service] Razorpay refund failed:', error);
        // Update refund status to failed
        await client.query(
          `UPDATE refunds 
           SET refund_status = 'failed', updated_at = NOW()
           WHERE id = $1`,
          [refund.id]
        );
        throw error;
      }
    } else if (skipRazorpayRefund) {
      // If skipping Razorpay, mark as processed (manual refund)
      await client.query(
        `UPDATE refunds 
         SET refund_status = 'processed', updated_at = NOW()
         WHERE id = $1`,
        [refund.id]
      );
      finalStatus = 'processed';
    }

    // Update payment status
    const newPaymentStatus =
      amount === availableToRefund ? BookingPaymentStatus.REFUNDED : 'partially_refunded';

    await client.query(
      `UPDATE payments 
       SET payment_status = $1, updated_at = NOW()
       WHERE id = $2`,
      [newPaymentStatus, paymentId]
    );

    // Update booking payment status if booking exists
    let bookingStatus: string | undefined;
    if (bookingId || payment.booking_id) {
      const finalBookingId = bookingId || payment.booking_id;
      await client.query(
        `UPDATE bookings 
         SET payment_status = $1, updated_at = NOW()
         WHERE id = $2`,
        [newPaymentStatus, finalBookingId]
      );
      bookingStatus = newPaymentStatus;
    }

    // Send notification if not skipped
    if (!skipNotification) {
      // Use setImmediate to send notification after transaction commits
      setImmediate(async () => {
        try {
          await sendRefundNotification({
            customerId: payment.customer_id,
            bookingId: bookingId || payment.booking_id,
            amount: amount,
            reason: reason,
            refundId: refund.id,
          });
        } catch (error) {
          console.error('[refund-service] Notification error (non-blocking):', error);
        }
      });
    }

    return {
      refundId: refund.id,
      razorpayRefundId,
      status: finalStatus,
      amount: parseFloat(amount.toString()),
      paymentStatus: newPaymentStatus,
      bookingStatus,
      message: finalStatus === 'processed'
        ? 'Refund processed successfully'
        : 'Refund is being processed',
    };
  });
}

/**
 * Convenience function for instant tele rejection refund
 */
export async function processInstantTeleRejectionRefund(
  bookingId: string,
  customerId: string,
  amount: number,
  vendorName: string
): Promise<RefundResult> {
  // Get payment ID from booking
  const bookingResult = await query(
    `SELECT payment_id FROM bookings WHERE id = $1`,
    [bookingId]
  );

  if (bookingResult.rows.length === 0 || !bookingResult.rows[0].payment_id) {
    throw new Error(`Payment not found for booking ${bookingId}`);
  }

  const paymentId = bookingResult.rows[0].payment_id;

  return await processRefund({
    paymentId,
    bookingId,
    amount,
    reason: `Vendor rejected instant tele consultation: ${vendorName}`,
    refundType: 'full',
    initiatedBy: 'system',
    metadata: {
      source: 'instant_tele_rejection',
      vendor_name: vendorName,
    },
  });
}