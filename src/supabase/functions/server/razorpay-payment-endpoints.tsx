import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { createHmac } from "node:crypto";

/**
 * 💳 RAZORPAY PAYMENT ENDPOINTS
 * 
 * Complete Razorpay integration for Warmpawz platform
 * 
 * Features:
 * - Order creation
 * - Payment verification
 * - Refund processing
 * - Payment status tracking
 * - Webhook handling
 * - Transaction history
 * 
 * Environment Variables Required:
 * - RAZORPAY_KEY_ID
 * - RAZORPAY_KEY_SECRET
 */

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  bookingId: string;
  customerId: string;
  notes?: any;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

interface PaymentRecord {
  paymentId: string;
  orderId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'pending';
  bookingId: string;
  customerId: string;
  method?: string; // card, upi, netbanking, wallet
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

// Create Razorpay order via API
async function createRazorpayOrder(amount: number, currency: string, receipt: string, notes?: any) {
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  
  const response = await fetch(`${RAZORPAY_API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: amount * 100, // Convert to paise
      currency,
      receipt,
      notes
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Razorpay API error: ${error}`);
  }

  return await response.json();
}

// Verify Razorpay signature
function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const text = `${orderId}|${paymentId}`;
  const generated_signature = createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');
  
  return generated_signature === signature;
}

// Create refund
async function createRefund(paymentId: string, amount?: number) {
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  
  const body: any = { payment_id: paymentId };
  if (amount) {
    body.amount = amount * 100; // Convert to paise
  }

  const response = await fetch(`${RAZORPAY_API_URL}/refunds`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Razorpay refund error: ${error}`);
  }

  return await response.json();
}

export function razorpayPaymentEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /payment/razorpay/create-order
   * Create Razorpay order
   */
  app.post(`${BASE_PATH}/payment/razorpay/create-order`, async (c) => {
    try {
      const body = await c.req.json();
      const { amount, currency = 'INR', receipt, notes } = body;

      if (!amount || !receipt) {
        return sendError(c, 'Missing required fields: amount, receipt', 400);
      }

      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        return sendError(c, 'Razorpay credentials not configured', 500);
      }

      console.log(`💳 Creating Razorpay order: ₹${amount} for ${receipt}`);

      // Create order via Razorpay API
      const razorpayOrder = await createRazorpayOrder(amount, currency, receipt, notes);

      // Store order in KV
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const order: RazorpayOrder = {
        orderId,
        amount,
        currency,
        receipt,
        status: 'created',
        razorpayOrderId: razorpayOrder.id,
        bookingId: notes?.bookingId || receipt,
        customerId: notes?.customerId || '',
        notes,
        createdAt: new Date().toISOString()
      };

      await kv.set(`payment:order:${orderId}`, order);
      await kv.set(`payment:razorpay-order:${razorpayOrder.id}`, orderId);

      console.log(`✅ Order created: ${orderId} (Razorpay: ${razorpayOrder.id})`);

      return sendSuccess(c, {
        orderId,
        razorpayOrderId: razorpayOrder.id,
        amount,
        currency,
        keyId: RAZORPAY_KEY_ID // Send to frontend for checkout
      }, 'Order created successfully');

    } catch (error) {
      console.error('❌ Error creating order:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /payment/razorpay/verify
   * Verify Razorpay payment signature
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
      const isValid = verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        console.error('❌ Invalid payment signature');
        return sendError(c, 'Invalid payment signature', 400);
      }

      // Get order from KV
      const orderId = await kv.get(`payment:razorpay-order:${razorpay_order_id}`);
      
      if (orderId) {
        const order = await kv.get(`payment:order:${orderId}`);
        if (order) {
          order.status = 'paid';
          order.razorpayPaymentId = razorpay_payment_id;
          order.razorpaySignature = razorpay_signature;
          order.paidAt = new Date().toISOString();
          await kv.set(`payment:order:${orderId}`, order);
        }
      }

      // Create payment record
      const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const payment: PaymentRecord = {
        paymentId,
        orderId: orderId || razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        amount,
        currency: 'INR',
        status: 'success',
        bookingId: bookingId || '',
        customerId: customerId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`payment:${paymentId}`, payment);
      await kv.set(`payment:razorpay:${razorpay_payment_id}`, paymentId);

      // Update booking payment status
      if (bookingId) {
        // Try ambulance booking
        let booking = await kv.get(`ambulance:booking:${bookingId}`);
        if (booking) {
          booking.paymentStatus = 'paid';
          booking.paymentId = paymentId;
          booking.razorpayPaymentId = razorpay_payment_id;
          await kv.set(`ambulance:booking:${bookingId}`, booking);
        }

        // Try diagnostics booking
        booking = await kv.get(`diagnostics:booking:${bookingId}`);
        if (booking) {
          booking.paymentStatus = 'paid';
          booking.paymentId = paymentId;
          booking.razorpayPaymentId = razorpay_payment_id;
          await kv.set(`diagnostics:booking:${bookingId}`, booking);
        }
      }

      console.log(`✅ Payment verified: ${paymentId}`);

      return sendSuccess(c, {
        paymentId,
        razorpayPaymentId: razorpay_payment_id,
        status: 'success',
        verified: true
      }, 'Payment verified successfully');

    } catch (error) {
      console.error('❌ Error verifying payment:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /payment/razorpay/refund
   * Create refund
   */
  app.post(`${BASE_PATH}/payment/razorpay/refund`, async (c) => {
    try {
      const body = await c.req.json();
      const { paymentId, amount, reason } = body;

      if (!paymentId) {
        return sendError(c, 'Missing paymentId', 400);
      }

      console.log(`💸 Creating refund for payment: ${paymentId}`);

      // Get payment record
      const payment = await kv.get(`payment:${paymentId}`);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      if (payment.status === 'refunded') {
        return sendError(c, 'Payment already refunded', 400);
      }

      // Create refund via Razorpay API
      const refund = await createRefund(payment.razorpayPaymentId, amount);

      // Update payment status
      payment.status = 'refunded';
      payment.refundId = refund.id;
      payment.refundAmount = amount || payment.amount;
      payment.refundReason = reason;
      payment.refundedAt = new Date().toISOString();
      payment.updatedAt = new Date().toISOString();

      await kv.set(`payment:${paymentId}`, payment);

      // Update order status
      if (payment.orderId) {
        const order = await kv.get(`payment:order:${payment.orderId}`);
        if (order) {
          order.status = 'refunded';
          order.refundedAt = new Date().toISOString();
          await kv.set(`payment:order:${payment.orderId}`, order);
        }
      }

      // Update booking status
      if (payment.bookingId) {
        // Try ambulance booking
        let booking = await kv.get(`ambulance:booking:${payment.bookingId}`);
        if (booking) {
          booking.paymentStatus = 'refunded';
          booking.refundId = refund.id;
          await kv.set(`ambulance:booking:${payment.bookingId}`, booking);
        }

        // Try diagnostics booking
        booking = await kv.get(`diagnostics:booking:${payment.bookingId}`);
        if (booking) {
          booking.paymentStatus = 'refunded';
          booking.refundId = refund.id;
          await kv.set(`diagnostics:booking:${payment.bookingId}`, booking);
        }
      }

      console.log(`✅ Refund created: ${refund.id}`);

      return sendSuccess(c, {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }, 'Refund created successfully');

    } catch (error) {
      console.error('❌ Error creating refund:', error);
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
   * GET /payment/customer/:customerId/history
   * Get customer payment history
   */
  app.get(`${BASE_PATH}/payment/customer/:customerId/history`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');

      const allPayments = await kv.getByPrefix('payment:PAY-') || [];
      
      let customerPayments = allPayments
        .map((item: any) => item.value || item)
        .filter((payment: any) => payment.customerId === customerId);

      if (status) {
        customerPayments = customerPayments.filter((p: any) => p.status === status);
      }

      customerPayments.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return sendSuccess(c, {
        customerId,
        count: customerPayments.length,
        payments: customerPayments
      });

    } catch (error) {
      console.error('❌ Error fetching payment history:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /payment/webhook/razorpay
   * Handle Razorpay webhooks
   */
  app.post(`${BASE_PATH}/payment/webhook/razorpay`, async (c) => {
    try {
      const body = await c.req.json();
      const signature = c.req.header('X-Razorpay-Signature');

      console.log('📨 Received Razorpay webhook:', body.event);

      // Verify webhook signature
      const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';
      if (webhookSecret) {
        const expectedSignature = createHmac('sha256', webhookSecret)
          .update(JSON.stringify(body))
          .digest('hex');

        if (expectedSignature !== signature) {
          console.error('❌ Invalid webhook signature');
          return sendError(c, 'Invalid signature', 400);
        }
      }

      // Handle different webhook events
      const event = body.event;
      const payload = body.payload;

      switch (event) {
        case 'payment.authorized':
        case 'payment.captured':
          // Payment successful
          console.log(`✅ Payment captured: ${payload.payment.entity.id}`);
          break;

        case 'payment.failed':
          // Payment failed
          console.log(`❌ Payment failed: ${payload.payment.entity.id}`);
          const paymentId = await kv.get(`payment:razorpay:${payload.payment.entity.id}`);
          if (paymentId) {
            const payment = await kv.get(`payment:${paymentId}`);
            if (payment) {
              payment.status = 'failed';
              payment.updatedAt = new Date().toISOString();
              await kv.set(`payment:${paymentId}`, payment);
            }
          }
          break;

        case 'refund.created':
        case 'refund.processed':
          console.log(`💸 Refund processed: ${payload.refund.entity.id}`);
          break;

        default:
          console.log(`ℹ️ Unhandled webhook event: ${event}`);
      }

      return sendSuccess(c, { received: true });

    } catch (error) {
      console.error('❌ Error handling webhook:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Razorpay Payment Endpoints registered');
}
