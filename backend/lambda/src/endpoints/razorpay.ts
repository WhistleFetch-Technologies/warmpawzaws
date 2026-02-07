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
import { getRazorpayConfig, getRazorpayAuthHeader, getRazorpayClient, razorpayRequest } from '../utils/razorpay-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { DEFAULT_COMMISSION_RATE } from '../lib/constants/commission';

// Razorpay configuration is imported from utils

// ============================================================================
// STRICT BANK ACCOUNT VALIDATION (shared: name + IFSC + account number)
// ============================================================================

export interface BankVerificationResult {
  valid: boolean;
  error?: string;
  details?: string;
  bank_details?: { bank: string; branch: string; city: string; state: string; ifsc: string };
  account_number_masked?: string;
  message?: string;
}

/**
 * Strict bank account validation: Name, IFSC Code, and Account Number must all be valid.
 * Returns valid: false until Razorpay Fund Account Validation is integrated (no pass on IFSC-only).
 */
export async function validateBankAccountStrict(
  account_number: string,
  ifsc_code: string,
  beneficiary_name: string
): Promise<BankVerificationResult> {
  const account = (account_number != null ? String(account_number).replace(/\s/g, '') : '');
  const ifsc = (ifsc_code != null ? String(ifsc_code).trim().toUpperCase() : '');
  const name = (beneficiary_name != null ? String(beneficiary_name).trim() : '');

  if (!account || !ifsc || !name) {
    return { valid: false, error: 'account_number, ifsc_code, and beneficiary_name are required', details: 'All three parameters must be provided.' };
  }
  if (name.length < 2 || name.length > 100) {
    return { valid: false, error: 'Invalid beneficiary name', details: 'Beneficiary name must be between 2 and 100 characters.' };
  }
  if (!/[\p{L}\p{N}]/u.test(name)) {
    return { valid: false, error: 'Invalid beneficiary name', details: 'Beneficiary name must contain at least one letter or number.' };
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return { valid: false, error: 'Invalid IFSC code', details: 'IFSC must be 11 characters (e.g. HDFC0001234).' };
  }
  const ifscResponse = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
  if (!ifscResponse.ok) {
    return { valid: false, error: 'Invalid IFSC code', details: 'IFSC code not found in bank database.' };
  }
  const ifscData = await ifscResponse.json();
  if (!/^\d{9,18}$/.test(account)) {
    return { valid: false, error: 'Invalid account number', details: 'Account number must be 9–18 digits.' };
  }
  return {
    valid: false,
    bank_details: { bank: ifscData.BANK || '', branch: ifscData.BRANCH || '', city: ifscData.CITY || '', state: ifscData.STATE || '', ifsc: ifsc },
    account_number_masked: account.replace(/\d(?=\d{4})/g, '*'),
    message: 'Format validation passed. Verification (name + account + IFSC match) requires Razorpay Fund Account Validation.',
  };
}

// ============================================================================
// RAZORPAY HANDLERS
// ============================================================================

class CreateRazorpayOrderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const { bookingId, orderId: pharmacyOrderId, amount, currency = 'INR', customerId, vendorId, type } = body;

      const isPharmacyOrder = type === 'pharmacy_order';
      const isDiagnosticsOrder = type === 'diagnostics';
      if (isPharmacyOrder) {
        if (!pharmacyOrderId || amount == null) {
          return this.error('orderId and amount are required for pharmacy_order', 400);
        }
      } else if (isDiagnosticsOrder) {
        // Diagnostics: payment before booking – only amount, customerId, vendorId required
        const missing = ['amount', 'customerId', 'vendorId'].filter((f) => !body[f]);
        if (missing.length > 0) {
          return this.error(`Missing required fields for diagnostics order: ${missing.join(', ')}`, 400);
        }
      } else {
        // Return 400 for missing required fields (do not throw - would become 500 in BaseHandler)
        const missing = ['bookingId', 'amount'].filter((f) => !body[f]);
        if (missing.length > 0) {
          return this.error(`Missing required fields: ${missing.join(', ')}`, 400);
        }
      }

      console.log('[RAZORPAY-CREATE-ORDER] Starting order creation:', { type: type || 'booking', bookingId, pharmacyOrderId, amount, customerId });

      let config: any;
      try {
        config = await getRazorpayConfig();
        console.log('[RAZORPAY-CREATE-ORDER] ✅ Config loaded successfully');
      } catch (error: any) {
        console.error('[RAZORPAY-CREATE-ORDER] ❌ Failed to load Razorpay config:', error.message);
        return this.error('Payment gateway configuration error. Please configure Razorpay in Platform Settings or environment variables.', 500);
      }

      if (!config || !config.keyId || !config.keySecret) {
        console.error('[RAZORPAY-CREATE-ORDER] ❌ Razorpay config invalid');
        return this.error('Payment gateway configuration error', 500);
      }

      let booking: any;
      let vendor: any;
      let receipt: string;
      let notes: Record<string, string>;
      let customerIdFinal: string;
      let vendorIdFinal: string;

      if (isPharmacyOrder) {
        const orderResult = await Promise.race([
          select('pharmacy_orders', { id: pharmacyOrderId }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 5000)),
        ]);
        if (!orderResult || orderResult.length === 0) {
          return this.error('Pharmacy order not found', 404);
        }
        const order = orderResult[0];
        if (order.status !== 'invoice_generated') {
          return this.error('Order is not in invoice state. Please wait for pharmacy to send invoice.', 400);
        }
        customerIdFinal = customerId || order.customer_id;
        vendorIdFinal = order.pharmacy_id;
        const vendorResult = await select('vendors', { id: vendorIdFinal });
        vendor = vendorResult.length > 0 ? vendorResult[0] : null;
        const shortId = String(pharmacyOrderId).replace(/-/g, '').substring(0, 32);
        receipt = `po_${shortId}`;
        notes = { pharmacyOrderId: String(pharmacyOrderId), customerId: customerIdFinal, vendorId: vendorIdFinal };
      } else if (isDiagnosticsOrder) {
        customerIdFinal = customerId;
        vendorIdFinal = vendorId;
        const vendorResult = await Promise.race([
          select('vendors', { id: vendorIdFinal }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Vendor query timeout')), 5000)),
        ]);
        vendor = vendorResult.length > 0 ? vendorResult[0] : null;
        const shortId = String(Date.now()).replace(/-/g, '').substring(0, 32);
        receipt = `diag_${shortId}`;
        notes = { type: 'diagnostics', customerId: customerIdFinal, vendorId: vendorIdFinal };
      } else {
        const bookingResult = await Promise.race([
          select('bookings', { id: bookingId }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Booking query timeout')), 5000)),
        ]);
        if (!bookingResult || bookingResult.length === 0) {
          return this.error('Booking not found', 404);
        }
        booking = bookingResult[0];
        const vendorPromise = select('vendors', { id: booking.vendor_id });
        const vendorResult = await Promise.race([
          vendorPromise,
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Vendor query timeout')), 5000)),
        ]);
        vendor = vendorResult.length > 0 ? vendorResult[0] : null;
        customerIdFinal = customerId || booking.customer_id;
        vendorIdFinal = booking.vendor_id;
        const shortBookingId = bookingId.replace(/-/g, '').substring(0, 32);
        receipt = `bk_${shortBookingId}`;
        notes = { bookingId, customerId: customerIdFinal, vendorId: vendorIdFinal };
      }

      const orderData: any = {
        amount: Math.round(Number(amount) * 100),
        currency: currency,
        receipt,
        notes,
      };

      // If vendor has linked account and marketplace mode enabled, add transfers
      if (vendor?.razorpay_account_id && vendor.bank_verified) {
        let tierCommission = DEFAULT_COMMISSION_RATE;
        try {
          tierCommission = await Promise.race([
            getVendorTierCommission(vendorIdFinal),
            new Promise<number>((resolve) => setTimeout(() => resolve(DEFAULT_COMMISSION_RATE), 2000))
          ]);
        } catch (error) {
          tierCommission = DEFAULT_COMMISSION_RATE;
        }
        const amt = Number(amount);
        const commissionAmount = Math.round((amt * tierCommission / 100) * 100);
        const vendorShare = Math.round(amt * 100) - commissionAmount;
        const transferNotes = isPharmacyOrder
          ? { pharmacy_order_id: String(pharmacyOrderId), vendor_id: vendorIdFinal, commission_rate: tierCommission.toString() }
          : isDiagnosticsOrder
            ? { type: 'diagnostics', vendor_id: vendorIdFinal, commission_rate: tierCommission.toString() }
            : { booking_id: bookingId, vendor_id: vendorIdFinal, commission_rate: tierCommission.toString() };
        orderData.transfers = [
          {
            account: vendor.razorpay_account_id,
            amount: vendorShare,
            currency: currency,
            notes: transferNotes,
            on_hold: false,
          },
        ];
      }

      const razorpayOrder = await razorpayRequest('/orders', 'POST', orderData, 20000) as any;

      if (!razorpayOrder || !razorpayOrder.id) {
        console.error('[RAZORPAY-CREATE-ORDER] Invalid Razorpay response:', razorpayOrder);
        return this.error('Failed to create payment order', 500);
      }

      if (isPharmacyOrder) {
        await query(
          `INSERT INTO payments (booking_id, pharmacy_order_id, customer_id, vendor_id, razorpay_order_id, amount, currency, payment_method, payment_status)
           VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)`,
          [pharmacyOrderId, customerIdFinal, vendorIdFinal, razorpayOrder.id, Number(amount), currency, 'razorpay', 'pending']
        );
      } else if (isDiagnosticsOrder) {
        // Diagnostics: booking is created after payment success; do not insert payment row here (no booking_id yet)
      } else {
        await insert('payments', {
          booking_id: bookingId,
          customer_id: customerIdFinal,
          vendor_id: vendorIdFinal,
          razorpay_order_id: razorpayOrder.id,
          amount: Number(amount),
          currency: currency,
          payment_method: 'razorpay',
          payment_status: 'pending',
        });
      }

      return this.success({
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount / 100,
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

      // ✅ SQL: Look up payment record
      const payments = await select('payments', { razorpay_order_id });
      if (payments.length === 0) {
        // Diagnostics (and similar) orders: payment-before-booking – no row was inserted at create-order.
        // Verify that this Razorpay order is a diagnostics order, then return success so frontend can create the booking.
        try {
          const razorpayOrder = await razorpayRequest(`/orders/${razorpay_order_id}`, 'GET', undefined, 10000) as any;
          const notes = razorpayOrder?.notes || {};
          const orderType = typeof notes === 'object' && notes !== null ? (notes.type || notes.orderType) : undefined;
          if (orderType === 'diagnostics') {
            console.log('[PAYMENT-VERIFY] Diagnostics order verified (no pre-inserted payment row), returning success');
            return this.success({
              message: 'Payment verified successfully',
              paymentId: razorpay_payment_id,
              orderId: razorpay_order_id,
            });
          }
        } catch (fetchErr: any) {
          console.warn('[PAYMENT-VERIFY] Could not fetch Razorpay order for diagnostics check:', fetchErr?.message);
        }
        console.error('[PAYMENT-VERIFY] Payment record not found for order:', razorpay_order_id);
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

      const payment = payments[0];
      const pharmacyOrderId = payment.pharmacy_order_id;

      if (pharmacyOrderId) {
        // Pharmacy order: update status and create delivery_tracking with OTP for later use at dispatch
        await update('pharmacy_orders', { id: pharmacyOrderId }, {
          payment_status: 'paid',
          razorpay_payment_id: razorpay_payment_id,
          status: 'payment_confirmed',
          updated_at: new Date().toISOString(),
        });
        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const existing = await select('delivery_tracking', { pharmacy_order_id: pharmacyOrderId });
        if (existing.length === 0) {
          await insert('delivery_tracking', {
            pharmacy_order_id: pharmacyOrderId,
            status: 'assigned',
            delivery_otp: deliveryOtp,
            assigned_at: new Date().toISOString(),
          });
        }
      } else if (payment.booking_id) {
        await update(
          'bookings',
          { id: payment.booking_id },
          { 
            payment_status: 'paid',
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          }
        );
        try {
          const vendors = await select('vendors', { id: payment.vendor_id });
          const vendor = vendors.length > 0 ? vendors[0] : null;
          if (vendor?.razorpay_account_id && vendor.bank_verified) {
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
        // Missing required fields = 400 Bad Request (validation), not 500
        const statusCode = error?.statusCode
          || (errorMessage.includes('Missing required') ? 400 : 500);
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

  /**
   * GET /razorpay/ifsc/:ifscCode
   * Lookup bank details by IFSC code using Razorpay IFSC API
   * This is a public API that doesn't require Razorpay authentication
   */
  app.get('/razorpay/ifsc/:ifscCode', async (c) => {
    try {
      const { ifscCode } = c.req.param();
      
      if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode)) {
        return c.json({ 
          error: 'Invalid IFSC code format. Must be 11 characters (e.g., HDFC0001234)' 
        }, 400);
      }

      // Razorpay IFSC API is public and doesn't require authentication
      const response = await fetch(`https://ifsc.razorpay.com/${ifscCode.toUpperCase()}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return c.json({ 
            error: 'IFSC code not found',
            ifsc: ifscCode.toUpperCase()
          }, 404);
        }
        throw new Error(`IFSC lookup failed: ${response.statusText}`);
      }

      const bankData = await response.json();
      
      return c.json({
        success: true,
        ifsc: bankData.IFSC || ifscCode.toUpperCase(),
        bank: bankData.BANK || '',
        branch: bankData.BRANCH || '',
        address: bankData.ADDRESS || '',
        city: bankData.CITY || '',
        district: bankData.DISTRICT || '',
        state: bankData.STATE || '',
        contact: bankData.CONTACT || '',
        imps: bankData.IMPS === true,
        neft: bankData.NEFT === true,
        rtgs: bankData.RTGS === true,
        upi: bankData.UPI === true,
        micr: bankData.MICR || '',
      });
    } catch (error: any) {
      console.error('Error looking up IFSC code:', error);
      return c.json({ 
        error: error.message || 'Failed to lookup IFSC code' 
      }, 500);
    }
  });

  /**
   * POST /razorpay/verify-bank-account
   * Strict bank account verification: Name, IFSC Code, and Account Number must all be valid.
   * Does NOT pass verification on IFSC-only; full verification requires Razorpay Fund Account Validation.
   */
  app.post('/razorpay/verify-bank-account', async (c) => {
    try {
      const body = await c.req.json();
      const account_number = body?.account_number != null ? String(body.account_number).replace(/\s/g, '') : '';
      const ifsc_code = body?.ifsc_code != null ? String(body.ifsc_code).trim().toUpperCase() : '';
      const beneficiary_name = body?.beneficiary_name != null ? String(body.beneficiary_name).trim() : '';

      // Strict: all three parameters required
      if (!account_number || !ifsc_code || !beneficiary_name) {
        return c.json({
          success: false,
          valid: false,
          error: 'account_number, ifsc_code, and beneficiary_name are required',
          details: 'All three parameters must be provided for verification.',
        }, 400);
      }

      // Strict: beneficiary name 2–100 chars, no only special chars
      if (beneficiary_name.length < 2 || beneficiary_name.length > 100) {
        return c.json({
          success: false,
          valid: false,
          error: 'Invalid beneficiary name',
          details: 'Beneficiary name must be between 2 and 100 characters.',
        }, 400);
      }
      if (!/[\p{L}\p{N}]/u.test(beneficiary_name)) {
        return c.json({
          success: false,
          valid: false,
          error: 'Invalid beneficiary name',
          details: 'Beneficiary name must contain at least one letter or number.',
        }, 400);
      }

      // Strict: IFSC format (11 chars: 4 letters + 0 + 6 alphanumeric)
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code)) {
        return c.json({
          success: false,
          valid: false,
          error: 'Invalid IFSC code',
          details: 'IFSC must be 11 characters (e.g. HDFC0001234).',
        }, 400);
      }

      // IFSC lookup – must exist in Razorpay database
      const ifscResponse = await fetch(`https://ifsc.razorpay.com/${ifsc_code}`);
      if (!ifscResponse.ok) {
        return c.json({
          success: false,
          valid: false,
          error: 'Invalid IFSC code',
          details: 'IFSC code not found in bank database.',
        }, 400);
      }
      const ifscData = await ifscResponse.json();

      // Strict: account number 9–18 digits only
      if (!/^\d{9,18}$/.test(account_number)) {
        return c.json({
          success: false,
          valid: false,
          error: 'Invalid account number',
          details: 'Account number must be 9–18 digits.',
        }, 400);
      }

      // When RazorpayX is configured (RAZORPAY_X_ACCOUNT_NUMBER + credentials in AWS Secrets), use Razorpay Fund Account Validation API
      try {
        const client = getRazorpayClient();
        const result = await client.validateBankAccount({
          account_number,
          ifsc: ifsc_code,
          beneficiary_name,
          contact_phone: body?.contact,
          contact_email: body?.email,
          reference_id: body?.reference_id,
        });
        if (result.valid) {
          return c.json({
            success: true,
            valid: true,
            bank_details: {
              bank: ifscData.BANK || '',
              branch: ifscData.BRANCH || '',
              city: ifscData.CITY || '',
              state: ifscData.STATE || '',
              ifsc: ifsc_code,
            },
            account_number_masked: account_number.replace(/\d(?=\d{4})/g, '*'),
            validationId: result.validationId,
            message: 'Bank account verified via Razorpay.',
          });
        }
        if (result.error) {
          return c.json({
            success: false,
            valid: false,
            error: result.error,
            details: result.error,
          }, 400);
        }
      } catch (apiErr: any) {
        console.warn('[verify-bank-account] Razorpay validation API not used:', apiErr?.message);
      }

      // Format-only response when RazorpayX validation not configured or API unavailable
      return c.json({
        success: true,
        valid: false,
        bank_details: {
          bank: ifscData.BANK || '',
          branch: ifscData.BRANCH || '',
          city: ifscData.CITY || '',
          state: ifscData.STATE || '',
          ifsc: ifsc_code,
        },
        account_number_masked: account_number.replace(/\d(?=\d{4})/g, '*'),
        message: 'Format validation passed. For full verification, configure RazorpayX (RAZORPAY_X_ACCOUNT_NUMBER) and allowlist IPs in RazorpayX Dashboard.',
      });
    } catch (error: any) {
      console.error('Error verifying bank account:', error);
      return c.json({
        success: false,
        valid: false,
        error: error.message || 'Failed to verify bank account',
      }, 500);
    }
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
 * @exported - Used by vendor-booking-actions.ts for earnings calculation
 */
export async function getVendorTierCommission(vendorId: string): Promise<number> {
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

    // Fallback to default commission rate if no tier found
    return DEFAULT_COMMISSION_RATE;
  } catch (error) {
    console.error('Error getting vendor tier commission:', error);
    // Fallback to default commission rate on error
    return DEFAULT_COMMISSION_RATE;
  }
}

