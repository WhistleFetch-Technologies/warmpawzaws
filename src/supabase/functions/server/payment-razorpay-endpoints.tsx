/**
 * ============================================================================
 * 💳 RAZORPAY PAYMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Complete Razorpay payment integration for Warmpawz
 * 
 * Features:
 * - Order creation
 * - Payment verification
 * - Refund processing
 * - Payment status tracking
 * - Webhook handling
 * - Settlement management
 * 
 * KV Operations: 21 → 0
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ❌ NO Deno.env - use PlatformSettingsRepository
 * ✅ All operations use SQL only
 */

import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { createHmac } from "node:crypto";
import { getPaymentsRepository } from '../../../supabase/lib/repositories/payments';
import { getBookingsRepository } from '../../../supabase/lib/repositories/bookings';
import { getRefundsRepository } from '../../../supabase/lib/repositories/refunds';
import { getDiagnosticBookingsRepository } from '../../../supabase/lib/repositories/diagnostic-bookings';
import { getPlatformSettingsRepository } from '../../../supabase/lib/repositories/platform-settings';

interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

// Get Razorpay credentials from platform settings
async function getRazorpayConfig(): Promise<RazorpayConfig> {
  // ✅ SQL: Get Razorpay config from platform_settings
  const platformSettingsRepo = getPlatformSettingsRepository();
  const configSetting = await platformSettingsRepo.findByKey('razorpay_config');
  
  if (!configSetting || !configSetting.value) {
    throw new Error('Razorpay credentials not configured. Please configure in Platform Settings.');
  }

  const config = typeof configSetting.value === 'string' 
    ? JSON.parse(configSetting.value) 
    : configSetting.value;

  if (!config.keyId || !config.keySecret) {
    throw new Error('Razorpay credentials incomplete. Please configure in Platform Settings.');
  }

  return {
    keyId: config.keyId,
    keySecret: config.keySecret
  };
}

const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

// Basic Auth for Razorpay API
async function getAuthHeader(): Promise<string> {
  const config = await getRazorpayConfig();
  const credentials = btoa(`${config.keyId}:${config.keySecret}`);
  return `Basic ${credentials}`;
}

// Call Razorpay API
async function razorpayRequest(method: string, endpoint: string, body?: any) {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${RAZORPAY_API_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.description || 'Razorpay API error');
    }

    return data;
  } catch (error) {
    console.error('Razorpay API error:', error);
    throw error;
  }
}

// Verify Razorpay signature
async function verifySignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  const config = await getRazorpayConfig();
  const text = `${orderId}|${paymentId}`;
  const generated = createHmac('sha256', config.keySecret)
    .update(text)
    .digest('hex');
  
  return generated === signature;
}

// Verify webhook signature
async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  const config = await getRazorpayConfig();
  const generated = createHmac('sha256', config.keySecret)
    .update(body)
    .digest('hex');
  
  return generated === signature;
}

export function paymentRazorpayEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /payment/razorpay/create-order
   * Create Razorpay order
   */
  app.post(`${BASE_PATH}/payment/razorpay/create-order`, async (c) => {
    try {
      const body = await c.req.json();
      const { amount, currency = 'INR', receipt, notes = {} } = body;

      if (!amount || amount <= 0) {
        return sendError(c, 'Invalid amount', 400);
      }

      if (!receipt) {
        return sendError(c, 'Receipt (booking ID) required', 400);
      }

      console.log(`💳 Creating Razorpay order for ₹${amount}`);

      // Create order on Razorpay
      const razorpayOrder = await razorpayRequest('POST', '/orders', {
        amount: amount * 100, // Convert to paise
        currency,
        receipt,
        notes
      });

      // ✅ SQL: Create payment record
      const paymentsRepo = getPaymentsRepository();
      const bookingId = notes.bookingId || receipt;
      
      const payment = await paymentsRepo.create({
        booking_id: bookingId || null,
        customer_id: notes.customerId || null,
        vendor_id: notes.vendorId || null,
        amount: amount,
        currency: currency,
        payment_method: 'razorpay',
        payment_status: 'pending',
        razorpay_order_id: razorpayOrder.id,
        transaction_id: razorpayOrder.id
      });

      console.log(`✅ Order created: ${payment.id} (Razorpay: ${razorpayOrder.id})`);

      return sendSuccess(c, {
        orderId: razorpayOrder.id, // Return Razorpay order ID for frontend
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        internalOrderId: payment.id
      }, 'Order created successfully');

    } catch (error: any) {
      console.error('❌ Error creating order:', error);
      return sendError(c, error.message || error, 500);
    }
  });

  /**
   * POST /payment/razorpay/verify
   * Verify payment signature and capture payment
   */
  app.post(`${BASE_PATH}/payment/razorpay/verify`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bookingId,
        customerId,
        amount
      } = body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return sendError(c, 'Missing payment verification parameters', 400);
      }

      console.log(`🔐 Verifying payment: ${razorpay_payment_id}`);

      // Verify signature
      const isValid = await verifySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        console.error('❌ Invalid payment signature');
        return sendError(c, 'Payment verification failed: Invalid signature', 400);
      }

      // ✅ SQL: Get payment by Razorpay order ID
      const paymentsRepo = getPaymentsRepository();
      const payment = await paymentsRepo.findByRazorpayOrderId(razorpay_order_id);
      
      if (!payment) {
        return sendError(c, 'Order not found', 404);
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await razorpayRequest('GET', `/payments/${razorpay_payment_id}`);

      // ✅ SQL: Update payment record
      await paymentsRepo.update(payment.id, {
        payment_status: 'completed',
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature,
        completed_at: new Date().toISOString()
      });

      // ✅ SQL: Update booking payment status
      if (bookingId || payment.booking_id) {
        const bookingsRepo = getBookingsRepository();
        const booking = await bookingsRepo.findById(bookingId || payment.booking_id!);
        
        if (booking) {
          await bookingsRepo.update(booking.id, {
            payment_status: 'paid',
            payment_id: payment.id
          });
        } else {
          // Try diagnostic bookings
          const diagnosticBookingsRepo = getDiagnosticBookingsRepository();
          try {
            const diagnosticBooking = await diagnosticBookingsRepo.findById(bookingId || payment.booking_id!);
            if (diagnosticBooking) {
              await diagnosticBookingsRepo.update(diagnosticBooking.id, {
                payment_status: 'paid',
                payment_id: payment.id
              });
            }
          } catch (err) {
            // Diagnostic booking not found, that's ok
          }
        }
      }

      console.log(`✅ Payment verified and captured: ${payment.id}`);

      return sendSuccess(c, {
        paymentId: payment.id,
        razorpayPaymentId: razorpay_payment_id,
        status: 'success',
        amount: payment.amount,
        method: paymentDetails.method
      }, 'Payment verified successfully');

    } catch (error: any) {
      console.error('❌ Error verifying payment:', error);
      return sendError(c, error.message || error, 500);
    }
  });

  /**
   * POST /payment/razorpay/refund
   * Initiate refund
   */
  app.post(`${BASE_PATH}/payment/razorpay/refund`, async (c) => {
    try {
      const body = await c.req.json();
      const { paymentId, amount, reason } = body;

      if (!paymentId) {
        return sendError(c, 'Payment ID required', 400);
      }

      console.log(`💰 Processing refund for payment: ${paymentId}`);

      // ✅ SQL: Get payment record
      const paymentsRepo = getPaymentsRepository();
      const payment = await paymentsRepo.findById(paymentId);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      if (payment.payment_status === 'refunded') {
        return sendError(c, 'Payment already refunded', 400);
      }

      // Create refund on Razorpay
      const refundData: any = {
        notes: {
          reason: reason || 'Refund requested by customer',
          paymentId
        }
      };

      if (amount) {
        refundData.amount = amount * 100; // Partial refund
      }

      const razorpayRefund = await razorpayRequest(
        'POST',
        `/payments/${payment.razorpay_payment_id || payment.razorpay_order_id}/refund`,
        refundData
      );

      // ✅ SQL: Create refund record
      const refundsRepo = getRefundsRepository();
      const refund = await refundsRepo.create({
        payment_id: payment.id,
        booking_id: payment.booking_id || null,
        customer_id: payment.customer_id,
        vendor_id: payment.vendor_id || null,
        amount: amount || payment.amount,
        refund_status: razorpayRefund.status,
        reason: reason || 'Refund requested by customer',
        razorpay_refund_id: razorpayRefund.id
      });

      // ✅ SQL: Update payment status
      await paymentsRepo.update(payment.id, {
        payment_status: 'refunded'
      });

      // ✅ SQL: Update booking
      if (payment.booking_id) {
        const bookingsRepo = getBookingsRepository();
        const booking = await bookingsRepo.findById(payment.booking_id);
        
        if (booking) {
          await bookingsRepo.update(payment.booking_id, {
            payment_status: 'refunded'
          });
        } else {
          // Try diagnostic bookings
          const diagnosticBookingsRepo = getDiagnosticBookingsRepository();
          try {
            const diagnosticBooking = await diagnosticBookingsRepo.findById(payment.booking_id);
            if (diagnosticBooking) {
              await diagnosticBookingsRepo.update(diagnosticBooking.id, {
                payment_status: 'refunded'
              });
            }
          } catch (err) {
            // Diagnostic booking not found, that's ok
          }
        }
      }

      console.log(`✅ Refund processed: ${refund.id}`);

      return sendSuccess(c, {
        refundId: refund.id,
        amount: razorpayRefund.amount / 100,
        status: razorpayRefund.status
      }, 'Refund processed successfully');

    } catch (error: any) {
      console.error('❌ Error processing refund:', error);
      return sendError(c, error.message || error, 500);
    }
  });

  /**
   * GET /payment/:paymentId
   * Get payment details
   */
  app.get(`${BASE_PATH}/payment/:paymentId`, async (c) => {
    try {
      const { paymentId } = c.req.param();

      // ✅ SQL: Get payment
      const paymentsRepo = getPaymentsRepository();
      const payment = await paymentsRepo.findById(paymentId);

      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      return sendSuccess(c, { payment });

    } catch (error: any) {
      console.error('❌ Error fetching payment:', error);
      return sendError(c, error.message || error, 500);
    }
  });

  /**
   * GET /payment/booking/:bookingId
   * Get payments for a booking
   */
  app.get(`${BASE_PATH}/payment/booking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      // ✅ SQL: Get payments for booking
      const paymentsRepo = getPaymentsRepository();
      const payments = await paymentsRepo.findByBooking(bookingId);

      return sendSuccess(c, {
        bookingId,
        count: payments.length,
        payments
      });

    } catch (error: any) {
      console.error('❌ Error fetching booking payments:', error);
      return sendError(c, error.message || error, 500);
    }
  });

  /**
   * POST /payment/razorpay/webhook
   * Handle Razorpay webhooks
   */
  app.post(`${BASE_PATH}/payment/razorpay/webhook`, async (c) => {
    try {
      const signature = c.req.header('x-razorpay-signature') || '';
      const body = await c.req.text();

      // Verify webhook signature
      const isValid = await verifyWebhookSignature(body, signature);

      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return sendError(c, 'Invalid signature', 400);
      }

      const event = JSON.parse(body);

      console.log(`📬 Webhook received: ${event.event}`);

      // Handle different events
      switch (event.event) {
        case 'payment.captured':
          // Payment captured successfully
          const payment = event.payload.payment.entity;
          console.log(`✅ Payment captured: ${payment.id}`);
          
          // ✅ SQL: Update payment status
          const paymentsRepo = getPaymentsRepository();
          const paymentRecord = await paymentsRepo.findByRazorpayPaymentId(payment.id);
          if (paymentRecord) {
            await paymentsRepo.update(paymentRecord.id, {
              payment_status: 'completed',
              completed_at: new Date().toISOString()
            });
          }
          break;

        case 'payment.failed':
          // Payment failed
          const failedPayment = event.payload.payment.entity;
          console.log(`❌ Payment failed: ${failedPayment.id}`);
          
          // ✅ SQL: Update payment status
          const paymentsRepo2 = getPaymentsRepository();
          const failedPaymentRecord = await paymentsRepo2.findByRazorpayPaymentId(failedPayment.id);
          if (failedPaymentRecord) {
            await paymentsRepo2.fail(failedPaymentRecord.id, failedPayment.error_description || 'Payment failed');
          }
          break;

        case 'refund.created':
          // Refund created
          const refund = event.payload.refund.entity;
          console.log(`💰 Refund created: ${refund.id}`);
          break;

        default:
          console.log(`ℹ️ Unhandled event: ${event.event}`);
      }

      return sendSuccess(c, { received: true });

    } catch (error: any) {
      console.error('❌ Error processing webhook:', error);
      return sendError(c, error.message || error, 500);
    }
  });

  console.log('✅ Razorpay Payment Endpoints registered');
}
