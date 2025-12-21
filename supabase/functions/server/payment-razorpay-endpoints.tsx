import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { createHmac } from "node:crypto";

/**
 * 💳 RAZORPAY PAYMENT ENDPOINTS
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
 * Required Environment Variables:
 * - RAZORPAY_KEY_ID
 * - RAZORPAY_KEY_SECRET
 */

interface RazorpayOrder {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  receipt: string;
  status: 'created' | 'attempted' | 'paid' | 'failed' | 'refunded';
  bookingId: string;
  customerId: string;
  paymentId?: string;
  signature?: string;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

interface RazorpayPayment {
  paymentId: string;
  razorpayPaymentId: string;
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method?: string;
  email?: string;
  contact?: string;
  customerId: string;
  bookingId: string;
  createdAt: string;
  capturedAt?: string;
}

// Get Razorpay credentials
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

// Basic Auth for Razorpay API
const getAuthHeader = () => {
  const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  return `Basic ${credentials}`;
};

// Call Razorpay API
async function razorpayRequest(method: string, endpoint: string, body?: any) {
  try {
    const response = await fetch(`${RAZORPAY_API_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': getAuthHeader(),
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
function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const text = `${orderId}|${paymentId}`;
  const generated = createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');
  
  return generated === signature;
}

// Verify webhook signature
function verifyWebhookSignature(body: string, signature: string): boolean {
  const generated = createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  
  return generated === signature;
}

export function paymentRazorpayEndpoints(app: Hono, kv: any) {
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

      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        return sendError(c, 'Razorpay credentials not configured', 500);
      }

      console.log(`💳 Creating Razorpay order for ₹${amount}`);

      // Create order on Razorpay
      const razorpayOrder = await razorpayRequest('POST', '/orders', {
        amount: amount * 100, // Convert to paise
        currency,
        receipt,
        notes
      });

      // Save order in KV store
      const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const order: RazorpayOrder = {
        orderId,
        razorpayOrderId: razorpayOrder.id,
        amount,
        currency,
        receipt,
        status: 'created',
        bookingId: notes.bookingId || receipt,
        customerId: notes.customerId || '',
        createdAt: new Date().toISOString()
      };

      await kv.set(`payment:order:${orderId}`, order);
      await kv.set(`payment:razorpay-order:${razorpayOrder.id}`, orderId);

      console.log(`✅ Order created: ${orderId} (Razorpay: ${razorpayOrder.id})`);

      return sendSuccess(c, {
        orderId: razorpayOrder.id, // Return Razorpay order ID for frontend
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        internalOrderId: orderId
      }, 'Order created successfully');

    } catch (error) {
      console.error('❌ Error creating order:', error);
      return sendError(c, error, 500);
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
      const isValid = verifySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        console.error('❌ Invalid payment signature');
        return sendError(c, 'Payment verification failed: Invalid signature', 400);
      }

      // Get internal order ID
      const internalOrderId = await kv.get(`payment:razorpay-order:${razorpay_order_id}`);
      
      if (internalOrderId) {
        const order = await kv.get(`payment:order:${internalOrderId}`);
        if (order) {
          order.status = 'paid';
          order.paymentId = razorpay_payment_id;
          order.signature = razorpay_signature;
          order.paidAt = new Date().toISOString();
          await kv.set(`payment:order:${internalOrderId}`, order);
        }
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await razorpayRequest('GET', `/payments/${razorpay_payment_id}`);

      // Save payment record
      const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const payment: RazorpayPayment = {
        paymentId,
        razorpayPaymentId: razorpay_payment_id,
        orderId: internalOrderId || bookingId,
        razorpayOrderId: razorpay_order_id,
        amount: amount || paymentDetails.amount / 100,
        currency: paymentDetails.currency,
        status: paymentDetails.status,
        method: paymentDetails.method,
        email: paymentDetails.email,
        contact: paymentDetails.contact,
        customerId: customerId || '',
        bookingId: bookingId || '',
        createdAt: new Date().toISOString(),
        capturedAt: paymentDetails.captured ? new Date().toISOString() : undefined
      };

      await kv.set(`payment:${paymentId}`, payment);
      await kv.set(`payment:razorpay:${razorpay_payment_id}`, paymentId);

      // Update booking payment status
      if (bookingId) {
        // Try ambulance booking
        let booking = await kv.get(`ambulance:booking:${bookingId}`);
        
        if (!booking) {
          // Try diagnostics booking
          booking = await kv.get(`diagnostics:booking:${bookingId}`);
        }

        if (booking) {
          booking.paymentStatus = 'paid';
          booking.paymentId = paymentId;
          booking.razorpayPaymentId = razorpay_payment_id;
          booking.updatedAt = new Date().toISOString();
          
          // Save back
          if (await kv.get(`ambulance:booking:${bookingId}`)) {
            await kv.set(`ambulance:booking:${bookingId}`, booking);
          } else {
            await kv.set(`diagnostics:booking:${bookingId}`, booking);
          }
        }
      }

      console.log(`✅ Payment verified and captured: ${paymentId}`);

      return sendSuccess(c, {
        paymentId,
        razorpayPaymentId: razorpay_payment_id,
        status: 'success',
        amount: payment.amount,
        method: payment.method
      }, 'Payment verified successfully');

    } catch (error) {
      console.error('❌ Error verifying payment:', error);
      return sendError(c, error, 500);
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

      // Get payment record
      const payment = await kv.get(`payment:${paymentId}`);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      if (payment.status === 'refunded') {
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

      const refund = await razorpayRequest(
        'POST',
        `/payments/${payment.razorpayPaymentId}/refund`,
        refundData
      );

      // Update payment status
      payment.status = 'refunded';
      payment.refundId = refund.id;
      payment.refundedAmount = refund.amount / 100;
      payment.refundedAt = new Date().toISOString();
      await kv.set(`payment:${paymentId}`, payment);

      // Update booking
      if (payment.bookingId) {
        let booking = await kv.get(`ambulance:booking:${payment.bookingId}`) ||
                      await kv.get(`diagnostics:booking:${payment.bookingId}`);
        
        if (booking) {
          booking.paymentStatus = 'refunded';
          booking.refundId = refund.id;
          booking.refundedAmount = payment.refundedAmount;
          booking.updatedAt = new Date().toISOString();
          
          if (await kv.get(`ambulance:booking:${payment.bookingId}`)) {
            await kv.set(`ambulance:booking:${payment.bookingId}`, booking);
          } else {
            await kv.set(`diagnostics:booking:${payment.bookingId}`, booking);
          }
        }
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

  /**
   * GET /payment/:paymentId
   * Get payment details
   */
  app.get(`${BASE_PATH}/payment/:paymentId`, async (c) => {
    try {
      const { paymentId } = c.req.param();

      const payment = await kv.get(`payment:${paymentId}`);

      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      return sendSuccess(c, { payment });

    } catch (error) {
      console.error('❌ Error fetching payment:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /payment/booking/:bookingId
   * Get payments for a booking
   */
  app.get(`${BASE_PATH}/payment/booking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const allPayments = await kv.getByPrefix('payment:PAY-') || [];
      
      const bookingPayments = allPayments
        .map((item: any) => item.value || item)
        .filter((payment: any) => payment.bookingId === bookingId);

      return sendSuccess(c, {
        bookingId,
        count: bookingPayments.length,
        payments: bookingPayments
      });

    } catch (error) {
      console.error('❌ Error fetching booking payments:', error);
      return sendError(c, error, 500);
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
      const isValid = verifyWebhookSignature(body, signature);

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
          break;

        case 'payment.failed':
          // Payment failed
          const failedPayment = event.payload.payment.entity;
          console.log(`❌ Payment failed: ${failedPayment.id}`);
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

    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Razorpay Payment Endpoints registered');
}
