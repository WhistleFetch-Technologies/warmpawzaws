/**
 * ============================================================================
 * PAYMENT VERIFICATION SERVICE
 * ============================================================================
 * 
 * Centralized functions for verifying payments across all endpoints
 * - Checks database for completed payments
 * - Verifies with Razorpay API
 * - Supports multiple payment methods (COD, online, etc.)
 * 
 * Date: 2026-03-18
 * ============================================================================
 */

import { query } from "src/database/rds-connection";
import { getRazorpayConfig, razorpayRequest } from "src/utils/payments/razorpay-client";


export interface PaymentVerificationParams {
  customerId: string;
  totalAmount: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentMethod?: string;
  pharmacyOrderId?: string;
  bookingId?: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  error?: string;
  payment?: {
    id: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    payment_status: string;
    amount: number;
    customer_id: string;
    pharmacy_order_id?: string;
    booking_id?: string;
  };
  razorpayVerified?: boolean;
  databaseVerified?: boolean;
}

/**
 * Verify payment for any order type (pharmacy, booking, etc.)
 * Checks both database and Razorpay API
 */
export async function verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult> {
  const { 
    customerId, 
    totalAmount, 
    razorpayOrderId, 
    razorpayPaymentId, 
    paymentMethod,
    pharmacyOrderId,
    bookingId
  } = params;

  // If payment method is COD, no verification needed
  if (paymentMethod === 'cod' || paymentMethod === 'cash_on_delivery') {
    return { 
      verified: true,
      databaseVerified: true,
      razorpayVerified: false,
    };
  }

  // If no payment IDs provided, payment verification is required
  if (!razorpayOrderId && !razorpayPaymentId) {
    return {
      verified: false,
      error: 'Payment verification required. Please provide razorpay_order_id or razorpay_payment_id',
      databaseVerified: false,
      razorpayVerified: false,
    };
  }

  try {
    // Step 1: Check database for completed payment
    const databaseResult = await verifyPaymentInDatabase({
      customerId,
      totalAmount,
      razorpayOrderId,
      razorpayPaymentId,
      pharmacyOrderId,
      bookingId,
    });

    if (!databaseResult.verified) {
      return {
        ...databaseResult,
        databaseVerified: false,
        razorpayVerified: false,
      };
    }

    // Step 2: Verify with Razorpay API (optional but recommended)
    const razorpayResult = await verifyPaymentWithRazorpay({
      razorpayOrderId: databaseResult.payment?.razorpay_order_id || razorpayOrderId,
      razorpayPaymentId: databaseResult.payment?.razorpay_payment_id || razorpayPaymentId,
      expectedAmount: totalAmount,
    });

    // If Razorpay verification fails but database shows completed, log warning but accept database result
    if (!razorpayResult.verified && databaseResult.verified) {
      console.warn('[PAYMENT-VERIFY] Database shows payment completed but Razorpay verification failed:', {
        razorpayOrderId,
        razorpayPaymentId,
        error: razorpayResult.error,
      });
      // Still return verified=true based on database, but mark Razorpay as not verified
      return {
        verified: true,
        databaseVerified: true,
        razorpayVerified: false,
        payment: databaseResult.payment,
      };
    }

    // Both verifications passed
    return {
      verified: true,
      databaseVerified: true,
      razorpayVerified: razorpayResult.verified,
      payment: databaseResult.payment,
    };
  } catch (error: any) {
    console.error('[PAYMENT-VERIFY] Payment verification error:', error);
    return {
      verified: false,
      error: `Payment verification failed: ${error.message}`,
      databaseVerified: false,
      razorpayVerified: false,
    };
  }
}

/**
 * Verify payment in database
 */
async function verifyPaymentInDatabase(params: {
  customerId: string;
  totalAmount: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  pharmacyOrderId?: string;
  bookingId?: string;
}): Promise<PaymentVerificationResult> {
  const { customerId, totalAmount, razorpayOrderId, razorpayPaymentId, pharmacyOrderId, bookingId } = params;

  try {
    let paymentQuery = `
      SELECT p.*
      FROM payments p
      WHERE p.customer_id = $1
        AND p.payment_status = 'completed'
        AND ABS(p.amount - $2) < 0.01
    `;
    const queryParams: any[] = [customerId, totalAmount];

    // Add optional filters
    if (razorpayOrderId) {
      paymentQuery += ` AND p.razorpay_order_id = $${queryParams.length + 1}`;
      queryParams.push(razorpayOrderId);
    } else if (razorpayPaymentId) {
      paymentQuery += ` AND p.razorpay_payment_id = $${queryParams.length + 1}`;
      queryParams.push(razorpayPaymentId);
    }

    if (pharmacyOrderId) {
      paymentQuery += ` AND p.pharmacy_order_id = $${queryParams.length + 1}`;
      queryParams.push(pharmacyOrderId);
    }

    if (bookingId) {
      paymentQuery += ` AND p.booking_id = $${queryParams.length + 1}`;
      queryParams.push(bookingId);
    }

    paymentQuery += ` ORDER BY p.completed_at DESC LIMIT 1`;

    const paymentResult = await query(paymentQuery, queryParams);

    if (paymentResult.rows.length === 0) {
      return {
        verified: false,
        error: 'No completed payment found in database for this order',
      };
    }

    const payment = paymentResult.rows[0];

    return {
      verified: true,
      payment: {
        id: payment.id,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        payment_status: payment.payment_status,
        amount: parseFloat(payment.amount),
        customer_id: payment.customer_id,
        pharmacy_order_id: payment.pharmacy_order_id,
        booking_id: payment.booking_id,
      },
    };
  } catch (error: any) {
    console.error('[PAYMENT-VERIFY] Database verification error:', error);
    return {
      verified: false,
      error: `Database verification failed: ${error.message}`,
    };
  }
}

/**
 * Verify payment with Razorpay API
 */
async function verifyPaymentWithRazorpay(params: {
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  expectedAmount: number;
}): Promise<PaymentVerificationResult> {
  const { razorpayOrderId, razorpayPaymentId, expectedAmount } = params;

  try {
    const config = await getRazorpayConfig();

    if (!config || !config.keyId || !config.keySecret) {
      console.warn('[PAYMENT-VERIFY] Razorpay config not available, skipping API verification');
      return {
        verified: false,
        error: 'Razorpay configuration not available',
      };
    }

    // Verify order status
    if (razorpayOrderId) {
      try {
        const razorpayOrder = await razorpayRequest(
          `/orders/${razorpayOrderId}`,
          'GET',
          null,
          10000
        ) as any;

        if (razorpayOrder.status !== 'paid') {
          return {
            verified: false,
            error: `Razorpay order not paid. Status: ${razorpayOrder.status}`,
          };
        }

        // Verify amount matches
        const razorpayAmount = razorpayOrder.amount / 100; // Convert from paise to rupees
        if (Math.abs(razorpayAmount - expectedAmount) > 0.01) {
          return {
            verified: false,
            error: `Amount mismatch. Expected: ${expectedAmount}, Got: ${razorpayAmount}`,
          };
        }
      } catch (orderError: any) {
        console.warn('[PAYMENT-VERIFY] Could not fetch Razorpay order:', orderError.message);
        // Continue to payment verification
      }
    }

    // Verify payment details if payment ID is available
    if (razorpayPaymentId) {
      try {
        const razorpayPayment = await razorpayRequest(
          `/payments/${razorpayPaymentId}`,
          'GET',
          null,
          10000
        ) as any;

        if (razorpayPayment.status !== 'captured' && razorpayPayment.status !== 'authorized') {
          return {
            verified: false,
            error: `Razorpay payment not captured. Status: ${razorpayPayment.status}`,
          };
        }

        // Verify amount matches
        const razorpayAmount = razorpayPayment.amount / 100; // Convert from paise to rupees
        if (Math.abs(razorpayAmount - expectedAmount) > 0.01) {
          return {
            verified: false,
            error: `Payment amount mismatch. Expected: ${expectedAmount}, Got: ${razorpayAmount}`,
          };
        }
      } catch (paymentError: any) {
        console.warn('[PAYMENT-VERIFY] Could not fetch Razorpay payment:', paymentError.message);
        // If order verification passed, we can still return verified
        if (razorpayOrderId) {
          return { verified: true };
        }
        return {
          verified: false,
          error: `Razorpay payment verification failed: ${paymentError.message}`,
        };
      }
    }

    return { verified: true };
  } catch (error: any) {
    console.error('[PAYMENT-VERIFY] Razorpay verification error:', error);
    return {
      verified: false,
      error: `Razorpay verification failed: ${error.message}`,
    };
  }
}

/**
 * Quick check if payment is required for an order
 */
export function requiresPayment(paymentMethod?: string): boolean {
  return paymentMethod !== 'cod' && paymentMethod !== 'cash_on_delivery';
}