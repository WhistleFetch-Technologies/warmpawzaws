/**
 * ============================================================================
 * RAZORPAY PAYMENT & SETTLEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Migrated from: supabase/functions/make-server-payment/razorpay-payment-integration-sql.tsx
 * 
 * Endpoints:
 * - POST /razorpay/create-order - Create Razorpay order
 * - POST /razorpay/verify-payment - Verify payment
 * - POST /razorpay/webhook - Razorpay webhook handler
 * - POST /razorpay/marketplace/settlement - Marketplace settlement
 * - POST /razorpay/refund - Process refund
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * Version: 1.1.0 - Fixed Service Unavailable error with timeout handling
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { createHmac, randomUUID } from 'crypto';
import { getRazorpayConfig, getRazorpayAuthHeader, razorpayRequest } from '../utils/razorpay-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// Razorpay configuration is imported from utils

// ============================================================================
// RAZORPAY HANDLERS
// ============================================================================

class CreateRazorpayOrderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const { bookingId, amount, currency = 'INR', customerId } = body;

      this.validateRequired(body, ['bookingId', 'amount']);

      console.log('[RAZORPAY-CREATE-ORDER] Starting order creation:', { bookingId, amount, customerId });

      // ✅ FIX: Get Razorpay config - use getRazorpayConfig directly with its built-in fallbacks
      // It tries: Secrets Manager (with timeout) → Database → Environment Variables
      let config: any;
      try {
        // Call getRazorpayConfig directly - it handles all fallbacks internally
        // No need for Promise.race wrapper - getRazorpayConfig has its own timeout handling
        config = await getRazorpayConfig();
        console.log('[RAZORPAY-CREATE-ORDER] ✅ Config loaded successfully');
      } catch (error: any) {
        console.error('[RAZORPAY-CREATE-ORDER] ❌ Failed to load Razorpay config:', error.message);
        // getRazorpayConfig already tried all fallbacks, so if it fails, config is truly missing
        return this.error('Payment gateway configuration error. Please configure Razorpay in Platform Settings or environment variables.', 500);
      }

      if (!config || !config.keyId || !config.keySecret) {
        console.error('[RAZORPAY-CREATE-ORDER] ❌ Razorpay config invalid:', { hasKeyId: !!config?.keyId, hasKeySecret: !!config?.keySecret });
        return this.error('Payment gateway configuration error', 500);
      }
      
      console.log('[RAZORPAY-CREATE-ORDER] ✅ Razorpay config loaded successfully');

      // ✅ SQL: Get booking details with timeout handling
      console.log('[RAZORPAY-CREATE-ORDER] Fetching booking:', bookingId);
      let booking: any;
      let vendor: any;
      
      try {
        // ✅ FIX: Add timeout to database queries to prevent Lambda timeout
        const bookingPromise = select('bookings', { id: bookingId });
        const bookingResult = await Promise.race([
          bookingPromise,
          new Promise<any[]>((_, reject) => 
            setTimeout(() => reject(new Error('Booking query timeout')), 5000) // 5s timeout
          )
        ]);
        
        if (bookingResult.length === 0) {
          console.error('[RAZORPAY-CREATE-ORDER] Booking not found:', bookingId);
          return this.error('Booking not found', 404);
        }
        
        booking = bookingResult[0];
        console.log('[RAZORPAY-CREATE-ORDER] Booking found:', { vendorId: booking.vendor_id, customerId: booking.customer_id });

        // ✅ Get vendor details for marketplace mode with timeout
        console.log('[RAZORPAY-CREATE-ORDER] Fetching vendor:', booking.vendor_id);
        const vendorPromise = select('vendors', { id: booking.vendor_id });
        const vendorResult = await Promise.race([
          vendorPromise,
          new Promise<any[]>((_, reject) => 
            setTimeout(() => reject(new Error('Vendor query timeout')), 5000) // 5s timeout
          )
        ]);
        vendor = vendorResult.length > 0 ? vendorResult[0] : null;
      } catch (dbError: any) {
        console.error('[RAZORPAY-CREATE-ORDER] Database query error:', dbError.message);
        if (dbError.message.includes('timeout')) {
          return this.error('Database query timed out. Please try again.', 504);
        }
        return this.error('Failed to fetch booking details', 500);
      }

      // ✅ Create Razorpay Order with marketplace mode (automatic transfers)
      // Note: Razorpay receipt max length is 40 characters
      // Use shortened format: "bk_" + first 32 chars of UUID (without hyphens) = 35 chars
      const shortBookingId = bookingId.replace(/-/g, '').substring(0, 32);
      const orderData: any = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: currency,
        receipt: `bk_${shortBookingId}`,
        notes: {
          bookingId: bookingId,
          customerId: customerId || booking.customer_id,
          vendorId: booking.vendor_id,
        },
      };

      // ✅ If vendor has linked account and marketplace mode enabled, add transfers
      if (vendor?.razorpay_account_id && vendor.bank_verified) {
        console.log('[RAZORPAY-CREATE-ORDER] Vendor has Razorpay account, calculating commission');
        // ✅ FIX: Use faster commission lookup with aggressive timeout
        // Default to 10% commission to avoid blocking on slow DB queries
        let tierCommission = 10; // Default 10% commission
        try {
          tierCommission = await Promise.race([
            getVendorTierCommission(booking.vendor_id),
            new Promise<number>((resolve) => setTimeout(() => resolve(10), 2000)) // ✅ FIX: Reduced to 2s timeout
          ]);
        } catch (error) {
          console.warn('[RAZORPAY-CREATE-ORDER] Failed to get tier commission, using default:', error);
          tierCommission = 10; // Default commission
        }

        const commissionAmount = Math.round((amount * tierCommission / 100) * 100); // In paise
        const vendorShare = Math.round(amount * 100) - commissionAmount;

        // Add transfer configuration for marketplace mode
        orderData.transfers = [
          {
            account: vendor.razorpay_account_id,
            amount: vendorShare,
            currency: currency,
            notes: {
              booking_id: bookingId,
              vendor_id: booking.vendor_id,
              commission_rate: tierCommission.toString(),
            },
            on_hold: false,
          },
        ];
        console.log('[RAZORPAY-CREATE-ORDER] Transfer configured:', { vendorShare, commissionAmount, tierCommission });
      }

      // ✅ FIX: Create Razorpay order with proper timeout (no double timeout)
      // Removed Promise.race - razorpayRequest already has timeout handling
      console.log('[RAZORPAY-CREATE-ORDER] Creating Razorpay order with data:', { 
        amount: orderData.amount, 
        currency: orderData.currency,
        hasTransfers: !!orderData.transfers 
      });
      const razorpayOrder = await razorpayRequest('/orders', 'POST', orderData, 20000) as any; // ✅ FIX: 20s timeout, removed double timeout

      if (!razorpayOrder || !razorpayOrder.id) {
        console.error('[RAZORPAY-CREATE-ORDER] Invalid Razorpay response:', razorpayOrder);
        return this.error('Failed to create payment order', 500);
      }

      console.log('[RAZORPAY-CREATE-ORDER] Razorpay order created:', razorpayOrder.id);

      // ✅ SQL: Create payment record (customer_id is required)
      console.log('[RAZORPAY-CREATE-ORDER] Creating payment record');
      await insert('payments', {
        booking_id: bookingId,
        customer_id: customerId || booking.customer_id, // Required field
        vendor_id: booking.vendor_id,
        razorpay_order_id: razorpayOrder.id,
        amount: amount,
        currency: currency,
        payment_method: 'razorpay',
        payment_status: 'pending',
      });

      console.log('[RAZORPAY-CREATE-ORDER] Order creation successful');
      return this.success({
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount / 100, // Convert back to rupees
        currency: razorpayOrder.currency,
        keyId: config.keyId,
      });
    } catch (error: any) {
      console.error('[RAZORPAY-CREATE-ORDER] Error:', error);
      const errorMessage = error?.message || 'Failed to create payment order';
      if (errorMessage.includes('timeout')) {
        return this.error('Payment gateway request timed out. Please try again.', 504);
      }
      return this.error(errorMessage, 500);
    }
  }
}

class VerifyPaymentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

      // ✅ FIX: Better validation with specific error messages
      if (!razorpay_order_id) {
        return this.error('razorpay_order_id is required', 400);
      }
      if (!razorpay_payment_id) {
        return this.error('razorpay_payment_id is required', 400);
      }
      if (!razorpay_signature) {
        return this.error('razorpay_signature is required', 400);
      }

      const config = await getRazorpayConfig();
      
      // ✅ FIX: Validate Razorpay config before proceeding
      if (!config || !config.keySecret) {
        console.error('[PAYMENT-VERIFY] Razorpay configuration missing or invalid');
        return this.error('Payment gateway configuration error. Please contact support.', 500);
      }

      // ✅ Verify signature
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;
      const generatedSignature = createHmac('sha256', config.keySecret)
        .update(text)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        console.error('[PAYMENT-VERIFY] Signature mismatch:', {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          received: razorpay_signature.substring(0, 10) + '...',
          generated: generatedSignature.substring(0, 10) + '...'
        });
        return this.error('Invalid payment signature. Please ensure payment details are correct.', 400);
      }

      // ✅ SQL: Update payment status
      const payments = await select('payments', { razorpay_order_id });
      if (payments.length === 0) {
        console.error('[PAYMENT-VERIFY] Payment record not found for order:', razorpay_order_id);('[PAYMENT-VERIFY] Payment not found for order:', razorpay_order_id);
        return this.error('Payment record not found. Please contact support with your order ID.', 404);
      }

      await update(
        'payments',
        { razorpay_order_id },
        {
          razorpay_payment_id: razorpay_payment_id,
          payment_status: 'completed',
          completed_at: new Date(),
        }
      );

      // ✅ SQL: Update booking payment status and confirm booking
      const payment = payments[0];
      await update(
        'bookings',
        { id: payment.booking_id },
        { 
          payment_status: 'paid',
          status: 'confirmed', // ✅ CRITICAL: Confirm booking after payment
          updated_at: new Date().toISOString(),
        }
      );

      // ✅ Trigger automatic settlement if marketplace mode is enabled
      try {
        const vendors = await select('vendors', { id: payment.vendor_id });
        const vendor = vendors.length > 0 ? vendors[0] : null;
        
        if (vendor?.razorpay_account_id && vendor.bank_verified) {
          // Queue automatic settlement
          const { sendToSQS } = await import('../utils/aws-clients');
          await sendToSQS('settlement-queue', {
            type: 'auto_settle_booking',
            bookingId: payment.booking_id,
            vendorId: payment.vendor_id,
            paymentId: payment.id,
          });
        }
      } catch (error) {
        console.error('Failed to queue automatic settlement:', error);
      }

      // ✅ Publish payment processed event
      try {
        const { publishPaymentProcessed } = await import('../utils/sns-client');
        await publishPaymentProcessed({
          paymentId: razorpay_payment_id,
          bookingId: payment.booking_id,
          amount: payment.amount,
          status: 'completed',
        });
      } catch (error) {
        console.error('Failed to publish payment processed event:', error);
      }

      return this.success({
        message: 'Payment verified successfully',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      });
    } catch (error: any) {
      console.error('[PAYMENT-VERIFY] Verification error:', error);
      // ✅ FIX: Return more specific error messages
      if (error.message) {
        return this.error(`Payment verification failed: ${error.message}`, 500);
      }
      return this.error('Payment verification failed. Please try again or contact support.', 500);
    }
  }
}

class RazorpayWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const headers = this.getHeaders(context.event);
    const webhookSignature = headers['x-razorpay-signature'];

    let config;
    try {
      config = await getRazorpayConfig();
    } catch (error: any) {
      // If Razorpay is not configured, return 400 (bad request) instead of 500
      if (error.message?.includes('not configured')) {
        return this.error('Razorpay not configured. Please configure in Platform Settings.', 400);
      }
      throw error;
    }
    
    // If Razorpay is not configured, return 400 (bad request) instead of 500
    if (!config || !config.keyId || !config.webhookSecret) {
      return this.error('Razorpay not configured. Please configure in Platform Settings.', 400);
    }

    // ✅ Verify webhook signature
    const payload = JSON.stringify(body);
    const expectedSignature = createHmac('sha256', config.webhookSecret)
      .update(payload)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      return this.error('Invalid webhook signature', 401);
    }

    const event = body.event;
    const payload_data = body.payload;

    // Handle different event types
    if (event === 'payment.captured') {
      const payment = payload_data.payment.entity;
      
      // ✅ SQL: Update payment
      await update(
        'payments',
        { razorpay_payment_id: payment.id },
        {
          payment_status: 'completed',
          completed_at: new Date(),
        }
      );

      // Update booking
      const payments = await select('payments', { razorpay_payment_id: payment.id });
      if (payments.length > 0) {
        const paymentRecord = payments[0];
        await update(
          'bookings',
          { id: paymentRecord.booking_id },
          { payment_status: 'paid' }
        );

        // ✅ Trigger automatic settlement if marketplace mode is enabled
        try {
          const vendors = await select('vendors', { id: paymentRecord.vendor_id });
          const vendor = vendors.length > 0 ? vendors[0] : null;
          
          if (vendor?.razorpay_account_id && vendor.bank_verified) {
            // Queue automatic settlement
            const { sendToSQS } = await import('../utils/aws-clients');
            await sendToSQS('settlement-queue', {
              type: 'auto_settle_booking',
              bookingId: paymentRecord.booking_id,
              vendorId: paymentRecord.vendor_id,
              paymentId: paymentRecord.id,
            });
          }
        } catch (error) {
          console.error('Failed to queue automatic settlement from webhook:', error);
        }
      }
    } else if (event === 'payment.failed') {
      const payment = payload_data.payment.entity;
      
      await update(
        'payments',
        { razorpay_payment_id: payment.id },
        {
          payment_status: 'failed',
          failure_reason: payment.error_description || 'Payment failed',
        }
      );
    } else if (event === 'refund.created') {
      const refund = payload_data.refund.entity;
      
      // ✅ SQL: Create refund record
      await insert('refunds', {
        payment_id: refund.payment_id,
        refund_id: refund.id,
        amount: refund.amount / 100, // Convert from paise
        status: refund.status,
        reason: refund.notes?.reason || null,
      });
    }

    return this.success({ message: 'Webhook processed' });
  }
}

class MarketplaceSettlementHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId } = body;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    // ✅ SQL: Get booking
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const booking = bookings[0];

    if (booking.status !== 'completed') {
      return this.error('Booking must be completed to settle', 400);
    }

    if (booking.settlement_status === 'settled') {
      return this.success({ message: 'Already settled' });
    }

    const vendorId = booking.vendor_id;
    const amount = parseFloat(booking.total_amount) || 0;

    // ✅ Get vendor tier commission from database
    const commissionRate = await getVendorTierCommission(vendorId);
    const commissionAmount = (amount * commissionRate) / 100;
    const vendorShare = amount - commissionAmount;

    // ✅ SQL: Create settlement record
    const settlementData = {
      vendor_id: vendorId,
      booking_id: bookingId,
      total_amount: amount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      net_amount: vendorShare,
      settlement_status: 'processing',
      settlement_period_start: new Date().toISOString().split('T')[0],
      settlement_period_end: new Date().toISOString().split('T')[0],
    };

    const settlements = await insert('settlements', settlementData);
    const settlement = settlements[0];

    // ✅ SQL: Get vendor details for Razorpay Route transfer
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }

    const vendor = vendors[0];
    let transferId: string | null = null;
    let settlementStatus = 'processing';

    // ✅ Initiate Razorpay Route transfer if vendor has linked account
    if (vendor.razorpay_account_id && vendor.bank_verified) {
      try {
        // Get payment for this booking to find the Razorpay payment ID
        const payments = await select('payments', { booking_id: bookingId, payment_status: 'completed' });
        
        if (payments.length > 0 && payments[0].razorpay_payment_id) {
          // Create transfer via Razorpay Route API
          const transfer = await razorpayRequest('/transfers', 'POST', {
            account: vendor.razorpay_account_id,
            amount: Math.round(vendorShare * 100), // Convert to paise
            currency: 'INR',
            linked_account_notes: {
              booking_id: bookingId,
              settlement_id: settlement.id,
            },
            notes: {
              vendor_id: vendorId,
              booking_id: bookingId,
              settlement_date: new Date().toISOString(),
            },
            on_hold: false,
            on_hold_until: null,
          });

          transferId = transfer.id;
          settlementStatus = transfer.status === 'processed' ? 'completed' : 'processing';

          // Update settlement with transfer ID
          await update('settlements', { id: settlement.id }, {
            razorpay_transfer_id: transferId,
            settlement_status: settlementStatus,
          });
        } else {
          // No payment found, mark for manual processing
          console.warn(`No completed payment found for booking ${bookingId}, settlement queued for manual processing`);
        }
      } catch (error: any) {
        console.error('Error initiating Razorpay Route transfer:', error);
        // Continue with settlement record but mark as pending manual processing
        settlementStatus = 'pending';
        await update('settlements', { id: settlement.id }, {
          settlement_status: 'pending',
          settlement_notes: `Route transfer failed: ${error.message}`,
        });
      }
    } else {
      // Vendor doesn't have linked account or bank not verified
      settlementStatus = 'pending';
      await update('settlements', { id: settlement.id }, {
        settlement_status: 'pending',
        settlement_notes: vendor.razorpay_account_id 
          ? 'Bank account not verified' 
          : 'Linked account not configured',
      });
    }

    // ✅ SQL: Update booking settlement status
    await update(
      'bookings',
      { id: bookingId },
      {
        settlement_status: settlementStatus,
        settlement_id: settlement.id,
      }
    );

    // ✅ Send to settlement queue for async processing (if not already processed)
    if (settlementStatus === 'processing' || settlementStatus === 'pending') {
      try {
        const { sendToSettlementQueue } = await import('../utils/sqs-client');
        await sendToSettlementQueue({
          settlementId: settlement.id,
          bookingId,
          vendorId,
          amount: vendorShare,
        });
      } catch (error) {
        console.error('Failed to send to settlement queue:', error);
      }
    }

    return this.success({
      settlementId: settlement.id,
      totalAmount: amount,
      commissionAmount,
      vendorShare,
      status: 'processing',
    });
  }
}

class ProcessRefundHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { paymentId, amount, reason } = body;

    this.validateRequired(body, ['paymentId', 'amount']);

    const config = await getRazorpayConfig();

    // ✅ SQL: Get payment
    const payments = await select('payments', { razorpay_payment_id: paymentId });
    if (payments.length === 0) {
      return this.error('Payment not found', 404);
    }

    const payment = payments[0];

    // ✅ Create Razorpay refund
    const refund = await razorpayRequest(
      `/payments/${paymentId}/refund`,
      'POST',
      {
        amount: Math.round(amount * 100), // Convert to paise
        notes: {
          reason: reason || 'Customer request',
        },
      }
    );

    // ✅ SQL: Create refund record
    await insert('refunds', {
      payment_id: payment.id,
      refund_id: refund.id,
      amount: amount,
      status: refund.status,
      reason: reason || null,
    });

    // ✅ SQL: Update booking payment status
    await update(
      'bookings',
      { id: payment.booking_id },
      { payment_status: 'refunded' }
    );

    return this.success({
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerRazorpayEndpoints(app: Hono) {
  const createOrderHandler = new CreateRazorpayOrderHandler();
  const verifyHandler = new VerifyPaymentHandler();
  const webhookHandler = new RazorpayWebhookHandler();
  const settlementHandler = new MarketplaceSettlementHandler();
  const refundHandler = new ProcessRefundHandler();

  /**
   * GET /razorpay/offers
   * Get available Razorpay offers for the given amount
   * ✅ FIX: Add this endpoint for frontend checkout flow
   */
  app.get('/razorpay/offers', async (c) => {
    try {
      const amount = parseFloat(c.req.query('amount') || '0');
      
      // For now, return empty offers array
      // In production, this would fetch offers from Razorpay API or database
      // Razorpay offers API: GET /offers (requires authentication)
      
      // Return graceful empty response instead of 404
      return c.json({
        success: true,
        offers: [],
        message: 'No offers available at this time',
        amount,
      });
    } catch (error: any) {
      console.error('Error fetching Razorpay offers:', error);
      // Return empty offers on error, not 500
      return c.json({
        success: true,
        offers: [],
        message: 'Could not fetch offers',
      });
    }
  });

  app.post('/razorpay/create-order', async (c) => {
    // ✅ FIX: Add overall timeout wrapper to prevent Lambda timeout (25s to leave buffer)
    const handlerPromise = (async () => {
      try {
        // ✅ FIX: Parse body from Hono context FIRST
        const requestBody = await c.req.json().catch(() => ({}));
        console.log('📥 [RAZORPAY-CREATE-ORDER] Raw request body from Hono:', JSON.stringify(requestBody));
        const event = createApiGatewayEventWithBody(c.req, requestBody);
        const context = createLambdaContext();
        const result = await createOrderHandler.execute(event, context);
        
        // ✅ FIX: Safely parse result body - handle cases where body might already be an object
        let responseBody: any;
        try {
          responseBody = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        } catch (parseError) {
          // If parsing fails, use the body as-is or create error response
          console.error('[RAZORPAY-CREATE-ORDER] Failed to parse result body:', parseError);
          responseBody = { error: 'Invalid response format', message: result.body || 'Unknown error' };
        }
        
        return c.json(responseBody, result.statusCode);
      } catch (error: any) {
        // ✅ FIX: Catch any unhandled errors and return proper error response
        console.error('❌ [RAZORPAY-CREATE-ORDER] Unhandled error:', error);
        console.error('❌ [RAZORPAY-CREATE-ORDER] Error stack:', error?.stack);
        const errorMessage = error?.message || 'Internal server error';
        const statusCode = error?.statusCode || 500;
        return c.json({ 
          error: errorMessage,
          message: errorMessage 
        }, statusCode);
      }
    })();

    // ✅ FIX: Race against timeout to prevent Lambda 503
    try {
      return await Promise.race([
        handlerPromise,
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout - operation took too long')), 25000) // 25s timeout
        )
      ]);
    } catch (timeoutError: any) {
      console.error('❌ [RAZORPAY-CREATE-ORDER] Request timeout:', timeoutError.message);
      return c.json({ 
        error: 'Request timeout',
        message: 'The payment request took too long to process. Please try again.'
      }, 504);
    }
  });

  app.post('/razorpay/verify-payment', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await verifyHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/webhook', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await webhookHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/marketplace/settlement', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await settlementHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/razorpay/refund', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await refundHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// ✅ FIX: Accept pre-parsed body since Hono doesn't have req.body
function createApiGatewayEventWithBody(req: any, parsedBody: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: parsedBody ? JSON.stringify(parsedBody) : null,
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'razorpay-handler',
    functionVersion: '$LATEST',
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * ✅ FIX: Optimized vendor tier commission lookup - single query instead of multiple
 * Get vendor tier commission rate from database with optimized query
 */
async function getVendorTierCommission(vendorId: string): Promise<number> {
  try {
    // ✅ FIX: Single optimized query that checks all conditions at once
    // This reduces database round trips from 3-4 queries to 1 query
    const result = await query(`
      WITH vendor_tier_info AS (
        -- First, try active subscription
        SELECT vt.commission_rate, 1 as priority
        FROM vendor_tier_subscriptions vts
        JOIN vendor_tiers vt ON vts.tier_id = vt.id
        WHERE vts.vendor_id = $1
          AND vts.status = 'active'
          AND vts.expires_at > NOW()
        ORDER BY vts.created_at DESC
        LIMIT 1
        
        UNION ALL
        
        -- Second, try vendor's current tier
        SELECT vt.commission_rate, 2 as priority
        FROM vendors v
        JOIN vendor_tiers vt ON v.tier = vt.tier_name
        WHERE v.id = $1
          AND vt.is_active = true
        LIMIT 1
        
        UNION ALL
        
        -- Third, get default tier
        SELECT commission_rate, 3 as priority
        FROM vendor_tiers
        WHERE (is_default = true OR tier_name = 'Bronze')
          AND is_active = true
        ORDER BY is_default DESC, tier_level ASC
        LIMIT 1
      )
      SELECT commission_rate
      FROM vendor_tier_info
      ORDER BY priority ASC
      LIMIT 1
    `, [vendorId]);

    const rows = Array.isArray(result) 
      ? result 
      : (result as any).rows || [];

    if (rows.length > 0 && rows[0].commission_rate) {
      return parseFloat(rows[0].commission_rate);
    }

    // Fallback to 10% if no tier found (reduced from 15% to match default)
    return 10.0;
  } catch (error) {
    console.error('Error getting vendor tier commission:', error);
    // Fallback to 10% on error (reduced from 15% to match default)
    return 10.0;
  }
}

