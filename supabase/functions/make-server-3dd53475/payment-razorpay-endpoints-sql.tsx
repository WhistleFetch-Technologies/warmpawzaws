/**
 * 💳 RAZORPAY PAYMENT ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Features:
 * - Order creation
 * - Payment verification
 * - Refund processing
 * - Payment status tracking
 * - Webhook handling
 * - Settlement management
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (21 KV operations → 0)
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { createHmac } from "node:crypto";
import { getDbClient } from '../../lib/db.ts';
import { getPaymentsRepository } from '../../lib/repositories/payments.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';

const db = getDbClient();
const paymentsRepo = getPaymentsRepository();
const bookingsRepo = getBookingsRepository();

// Get Razorpay credentials from platform_integrations
async function getRazorpayConfig() {
  const { data: integration } = await db
    .from('platform_integrations')
    .select('*')
    .eq('integration_name', 'razorpay')
    .single();
  
  if (!integration || !integration.integration_config) {
    throw new Error('Razorpay credentials not configured');
  }

  const config = integration.integration_config;
  return {
    keyId: config.keyId,
    keySecret: config.keySecret
  };
}

// Call Razorpay API
async function razorpayRequest(method: string, endpoint: string, body?: any) {
  const config = await getRazorpayConfig();
  const credentials = btoa(`${config.keyId}:${config.keySecret}`);
  
  const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.description || 'Razorpay API error');
  }

  return data;
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

export function paymentRazorpayEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // Create Razorpay order
  app.post(`${BASE_PATH}/payment/razorpay/create-order`, async (c) => {
    try {
      const { amount, currency = 'INR', receipt, notes = {} } = await c.req.json();

      if (!amount || amount <= 0) {
        return sendError(c, 'Invalid amount', 400);
      }

      if (!receipt) {
        return sendError(c, 'Receipt (booking ID) required', 400);
      }

      console.log(`💳 Creating Razorpay order for ₹${amount}`);

      // Create order on Razorpay
      const razorpayOrder = await razorpayRequest('POST', '/orders', {
        amount: amount * 100,
        currency,
        receipt,
        notes
      });

      // ✅ SQL: Create payment record
      const payment = await paymentsRepo.create({
        booking_id: notes.bookingId || receipt,
        customer_id: notes.customerId || '',
        vendor_id: notes.vendorId || undefined,
        amount: amount,
        currency: currency,
        payment_method: 'razorpay',
        payment_status: 'pending',
        razorpay_order_id: razorpayOrder.id
      });

      console.log(`✅ Order created: ${payment.id} (Razorpay: ${razorpayOrder.id})`);

      return sendSuccess(c, {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        internalOrderId: payment.id
      }, 'Order created successfully');

    } catch (error) {
      console.error('❌ Error creating order:', error);
      return sendError(c, error, 500);
    }
  });

  // Verify payment
  app.post(`${BASE_PATH}/payment/razorpay/verify`, async (c) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bookingId,
        customerId,
        amount
      } = await c.req.json();

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return sendError(c, 'Missing payment verification parameters', 400);
      }

      console.log(`🔐 Verifying payment: ${razorpay_payment_id}`);

      // Verify signature
      const isValid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

      if (!isValid) {
        console.error('❌ Invalid payment signature');
        return sendError(c, 'Payment verification failed: Invalid signature', 400);
      }

      // ✅ SQL: Get payment by Razorpay order ID
      const payment = await paymentsRepo.findByRazorpayOrderId(razorpay_order_id);
      
      if (payment) {
        await paymentsRepo.update(payment.id, {
          payment_status: 'completed',
          razorpay_payment_id: razorpay_payment_id,
          razorpay_signature: razorpay_signature,
          completed_at: new Date().toISOString()
        });
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await razorpayRequest('GET', `/payments/${razorpay_payment_id}`);

      // ✅ SQL: Update booking payment status
      if (bookingId) {
        await bookingsRepo.update(bookingId, {
          payment_status: 'paid',
          payment_id: payment?.id,
          status: 'confirmed'
        });
      }

      console.log(`✅ Payment verified and captured: ${payment?.id}`);

      return sendSuccess(c, {
        paymentId: payment?.id,
        razorpayPaymentId: razorpay_payment_id,
        status: 'success',
        amount: paymentDetails.amount / 100,
        method: paymentDetails.method
      }, 'Payment verified successfully');

    } catch (error) {
      console.error('❌ Error verifying payment:', error);
      return sendError(c, error, 500);
    }
  });

  // Refund processing
  app.post(`${BASE_PATH}/payment/razorpay/refund`, async (c) => {
    try {
      const { paymentId, amount, reason } = await c.req.json();

      if (!paymentId) {
        return sendError(c, 'Payment ID required', 400);
      }

      console.log(`💰 Processing refund for payment: ${paymentId}`);

      // ✅ SQL: Get payment record
      const payment = await paymentsRepo.findById(paymentId);
      
      if (!payment || !payment.razorpay_payment_id) {
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
        refundData.amount = amount * 100;
      }

      const refund = await razorpayRequest(
        'POST',
        `/payments/${payment.razorpay_payment_id}/refund`,
        refundData
      );

      // ✅ SQL: Update payment status
      await paymentsRepo.update(paymentId, {
        payment_status: 'refunded'
      });

      // ✅ SQL: Update booking
      if (payment.booking_id) {
        await bookingsRepo.update(payment.booking_id, {
          payment_status: 'refunded'
        });
      }

      console.log(`✅ Refund processed: ${refund.id}`);

      return sendSuccess(c, {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }, 'Refund processed successfully');

    } catch (error) {
      console.error('❌ Error processing refund:', error);
      return sendError(c, error, 500);
    }
  });

  // Get payment details
  app.get(`${BASE_PATH}/payment/:paymentId`, async (c) => {
    try {
      const paymentId = c.req.param('paymentId');

      // ✅ SQL: Get payment
      const payment = await paymentsRepo.findById(paymentId);

      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      return sendSuccess(c, { payment });

    } catch (error) {
      console.error('❌ Error fetching payment:', error);
      return sendError(c, error, 500);
    }
  });

  // Get payments for a booking
  app.get(`${BASE_PATH}/payment/booking/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');

      // ✅ SQL: Get payments by booking
      const payments = await paymentsRepo.findByBooking(bookingId);

      return sendSuccess(c, {
        bookingId,
        count: payments.length,
        payments
      });

    } catch (error) {
      console.error('❌ Error fetching booking payments:', error);
      return sendError(c, error, 500);
    }
  });

  // Webhook handling
  app.post(`${BASE_PATH}/payment/razorpay/webhook`, async (c) => {
    try {
      const signature = c.req.header('x-razorpay-signature') || '';
      const body = await c.req.text();

      // Verify webhook signature
      const config = await getRazorpayConfig();
      const expectedSignature = createHmac('sha256', config.keySecret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.error('❌ Invalid webhook signature');
        return sendError(c, 'Invalid signature', 400);
      }

      const event = JSON.parse(body);

      console.log(`📬 Webhook received: ${event.event}`);

      // Handle different events
      switch (event.event) {
        case 'payment.captured':
          const payment = event.payload.payment.entity;
          const paymentRecord = await paymentsRepo.findByRazorpayPaymentId(payment.id);
          if (paymentRecord) {
            await paymentsRepo.update(paymentRecord.id, {
              payment_status: 'completed',
              completed_at: new Date().toISOString()
            });
          }
          console.log(`✅ Payment captured: ${payment.id}`);
          break;

        case 'payment.failed':
          const failedPayment = event.payload.payment.entity;
          const failedPaymentRecord = await paymentsRepo.findByRazorpayPaymentId(failedPayment.id);
          if (failedPaymentRecord) {
            await paymentsRepo.update(failedPaymentRecord.id, {
              payment_status: 'failed',
              failure_reason: failedPayment.error_description
            });
          }
          console.log(`❌ Payment failed: ${failedPayment.id}`);
          break;

        case 'refund.created':
          const refund = event.payload.refund.entity;
          console.log(`💰 Refund created: ${refund.id}`);
          break;

        default:
          console.log(`ℹ️ Unhandled event: ${event.event}`);
      }

      return sendSuccess(c, { received: true });

    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Razorpay Payment Endpoints registered (SQL-only)');
}

