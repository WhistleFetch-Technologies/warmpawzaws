/**
 * ============================================================================
 * RAZORPAY PAYMENT & SETTLEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
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
import { query, select, insert, update, withTransaction } from '../database/rds-connection';
import { createHmac, randomUUID } from 'crypto';
import { getRazorpayConfig, getRazorpayAuthHeader, getRazorpayClient, razorpayRequest } from '../utils/razorpay-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { DEFAULT_COMMISSION_RATE } from '../lib/constants/commission';
import { logBookingStatusChange } from '../utils/audit-log';
import { notifyBookingCreated } from '../utils/booking-notifications';

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
  
  // Add timeout to prevent hanging requests (increased for Lambda VPC network latency)
  const FETCH_TIMEOUT_MS = 20000; // 20 seconds (increased from 10s for VPC network latency)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[BANK-VALIDATE] IFSC lookup timeout after ${FETCH_TIMEOUT_MS}ms for ${ifsc}`);
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const ifscResponse = await fetch(`https://ifsc.razorpay.com/${ifsc}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WarmPawz/1.0',
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!ifscResponse.ok) {
      if (ifscResponse.status === 404) {
        return { valid: false, error: 'Invalid IFSC code', details: 'IFSC code not found in bank database.' };
      }
      const errorText = await ifscResponse.text().catch(() => ifscResponse.statusText);
      console.error(`[BANK-VALIDATE] IFSC lookup HTTP error ${ifscResponse.status} for ${ifsc}: ${errorText}`);
      return { valid: false, error: 'IFSC lookup failed', details: `HTTP ${ifscResponse.status}: ${errorText}` };
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
  } catch (fetchError: any) {
    clearTimeout(timeoutId);
    
    // Handle abort (timeout)
    if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
      console.error(`[BANK-VALIDATE] IFSC lookup timeout for ${ifsc}`);
      return { valid: false, error: 'IFSC lookup timeout', details: 'Request timed out. Please try again.' };
    }
    
    // Handle network errors
    if (fetchError.message?.includes('fetch failed') || 
        fetchError.code === 'ENOTFOUND' || 
        fetchError.code === 'ECONNREFUSED' || 
        fetchError.code === 'ETIMEDOUT' ||
        fetchError.message?.includes('network') ||
        fetchError.message?.includes('ECONNRESET')) {
      console.error(`[BANK-VALIDATE] Network error for IFSC ${ifsc}:`, {
        message: fetchError.message,
        code: fetchError.code,
        cause: fetchError.cause
      });
      return { valid: false, error: 'Network error', details: 'Failed to connect to Razorpay IFSC API. Please check Lambda VPC configuration and internet connectivity.' };
    }
    
    // Re-throw other errors
    console.error(`[BANK-VALIDATE] Unexpected error for IFSC ${ifsc}:`, fetchError);
    throw fetchError;
  }
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
      const isBookingPrepaid = type === 'booking_prepaid';
      if (isPharmacyOrder) {
        if (!pharmacyOrderId || amount == null) {
          return this.error('orderId and amount are required for pharmacy_order', 400);
        }
      } else if (isBookingPrepaid) {
        const missing = ['amount', 'customerId', 'vendorId'].filter((f) => !body[f]);
        if (missing.length > 0) {
          return this.error(`Missing required fields for booking_prepaid: ${missing.join(', ')}`, 400);
        }
      } else if (isDiagnosticsOrder) {
        // Diagnostics: payment before booking – only amount, customerId, vendorId required
        const missing = ['amount', 'customerId', 'vendorId'].filter((f) => !body[f]);
        if (missing.length > 0) {
          return this.error(`Missing required fields for diagnostics order: ${missing.join(', ')}`, 400);
        }
      } else {
        // ✅ bookingId is REQUIRED for booking orders (booking created before payment)
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
        console.error('[RAZORPAY-CREATE-ORDER] ❌ Razorpay config invalid', {
          hasConfig: !!config,
          hasKeyId: !!config?.keyId,
          hasKeySecret: !!config?.keySecret,
          keyIdLength: config?.keyId?.length,
        });
        return this.error('Payment gateway configuration error: Razorpay keys not configured. Please check AWS Secrets Manager, Platform Settings, or environment variables.', 500);
      }
      
      // ✅ Log config status (without exposing secrets)
      console.log('[RAZORPAY-CREATE-ORDER] ✅ Razorpay config loaded', {
        keyId: config.keyId ? `${config.keyId.substring(0, 8)}...` : 'missing',
        hasKeySecret: !!config.keySecret,
        hasWebhookSecret: !!config.webhookSecret,
      });

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
      } else if (isBookingPrepaid) {
        customerIdFinal = customerId;
        vendorIdFinal = vendorId;
        const vendorResult = await Promise.race([
          select('vendors', { id: vendorIdFinal }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Vendor query timeout')), 5000)),
        ]);
        vendor = vendorResult.length > 0 ? vendorResult[0] : null;
        const shortId = String(Date.now()).replace(/-/g, '').substring(0, 32);
        receipt = `bk_pre_${shortId}`;
        notes = { type: 'booking_prepaid', customerId: customerIdFinal, vendorId: vendorIdFinal };
      } else {
        // ✅ bookingId is REQUIRED - booking should already exist (created before payment)
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

      // ✅ Enhanced logging before Razorpay API call
      console.log('[RAZORPAY-CREATE-ORDER] Calling Razorpay API with orderData:', {
        amount: orderData.amount,
        currency: orderData.currency,
        receipt: orderData.receipt,
        hasTransfers: !!orderData.transfers,
        notes: orderData.notes,
      });

      let razorpayOrder: any;
      try {
        razorpayOrder = await razorpayRequest('/orders', 'POST', orderData, 20000) as any;
      } catch (razorpayError: any) {
        console.error('[RAZORPAY-CREATE-ORDER] Razorpay API call failed:', {
          error: razorpayError.message,
          errorName: razorpayError.name,
          errorCode: razorpayError.code,
          stack: razorpayError.stack,
          orderData,
        });
        // ✅ Re-throw with more context
        throw new Error(`Razorpay API call failed: ${razorpayError.message || 'Unknown error'}. Check Lambda VPC configuration and internet connectivity.`);
      }

      if (!razorpayOrder || !razorpayOrder.id) {
        console.error('[RAZORPAY-CREATE-ORDER] Invalid Razorpay response:', razorpayOrder);
        return this.error('Failed to create payment order: Invalid response from Razorpay', 500);
      }

      if (isPharmacyOrder) {
        await query(
          `INSERT INTO payments (booking_id, pharmacy_order_id, customer_id, vendor_id, razorpay_order_id, amount, currency, payment_method, payment_status)
           VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)`,
          [pharmacyOrderId, customerIdFinal, vendorIdFinal, razorpayOrder.id, Number(amount), currency, 'razorpay', 'pending']
        );
      } else if (isDiagnosticsOrder) {
        // Diagnostics: booking is created after payment success; do not insert payment row here (no booking_id yet)
      } else if (isBookingPrepaid) {
        await insert('payments', {
          booking_id: null,
          customer_id: customerIdFinal,
          vendor_id: vendorIdFinal,
          razorpay_order_id: razorpayOrder.id,
          amount: Number(amount),
          currency: currency,
          payment_method: 'razorpay',
          payment_status: 'pending',
        });
      } else {
        // ✅ bookingId is REQUIRED - booking should already exist
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
      console.error('[RAZORPAY-CREATE-ORDER] Error:', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
        cause: error?.cause,
      });
      
      const errorMessage = error?.message || 'Failed to create payment order';
      
      // ✅ Handle specific error types
      if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
        return this.error('Payment gateway request timed out. Please try again.', 504);
      }
      
      if (errorMessage.includes('Network error') || errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        return this.error('Network error connecting to payment gateway. Please check Lambda VPC configuration and ensure internet connectivity is available.', 500);
      }
      
      if (errorMessage.includes('SSL') || errorMessage.includes('certificate') || errorMessage.includes('TLS')) {
        return this.error('SSL/TLS error connecting to payment gateway. Please check certificate configuration.', 500);
      }
      
      if (errorMessage.includes('configuration error') || errorMessage.includes('not configured')) {
        return this.error(errorMessage, 500);
      }
      
      // ✅ Return detailed error message for debugging
      return this.error(`Payment gateway error: ${errorMessage}`, 500);
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

      // ✅ CRITICAL: Verify signature FIRST before any database operations
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;
      const generatedSignature = createHmac('sha256', config.keySecret)
        .update(text)
        .digest('hex');

      // ✅ CRITICAL: If payment signature is invalid, rollback by deleting booking and payment
      if (generatedSignature !== razorpay_signature) {
        console.error('[PAYMENT-VERIFY] Signature mismatch - rolling back booking:', {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          received: razorpay_signature.substring(0, 10) + '...',
          generated: generatedSignature.substring(0, 10) + '...'
        });

        // ✅ ROLLBACK: Delete booking and payment if payment verification fails
        try {
          await withTransaction(async (client) => {
            const { rows: payments } = await client.query(
              `SELECT booking_id FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
              [razorpay_order_id]
            );

            if (payments.length > 0 && payments[0].booking_id) {
              // Delete booking (rollback)
              await client.query(
                `DELETE FROM bookings WHERE id = $1`,
                [payments[0].booking_id]
              );
              console.log('[PAYMENT-VERIFY] ❌ Payment failed - booking rolled back:', payments[0].booking_id);
            }

            // Delete payment record
            await client.query(
              `DELETE FROM payments WHERE razorpay_order_id = $1`,
              [razorpay_order_id]
            );
            console.log('[PAYMENT-VERIFY] ❌ Payment failed - payment record deleted');
          });
        } catch (rollbackError: any) {
          console.error('[PAYMENT-VERIFY] Error during rollback:', rollbackError);
          // Continue to return error even if rollback fails
        }

        return this.error('Invalid payment signature. Booking has been cancelled.', 400);
      }

      // ✅ Payment signature is valid - update booking and payment status
      let bookingToNotify: string | null = null;
      let bookingStatusChange: { bookingId: string; from: string | null; to: string | null } | null = null;

      const result = await withTransaction(async (client) => {
        // ✅ SQL: Look up payment record with FOR UPDATE lock
        const { rows: payments } = await client.query(
          `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
          [razorpay_order_id]
        );

        if (payments.length === 0) {
          // Diagnostics (and similar) orders: payment-before-booking – no row was inserted at create-order.
          // Verify that this Razorpay order is a diagnostics order, then return success so frontend can create the booking.
          try {
            const razorpayOrder = await razorpayRequest(`/orders/${razorpay_order_id}`, 'GET', undefined, 10000) as any;
            const notes = razorpayOrder?.notes || {};
            const orderType = typeof notes === 'object' && notes !== null ? (notes.type || notes.orderType) : undefined;
            if (orderType === 'diagnostics') {
              console.log('[PAYMENT-VERIFY] Diagnostics order verified (no pre-inserted payment row), returning success');
              return {
                message: 'Payment verified successfully',
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                bookingId: null,
              };
            }
          } catch (fetchErr: any) {
            console.warn('[PAYMENT-VERIFY] Could not fetch Razorpay order for diagnostics check:', fetchErr?.message);
          }
          console.error('[PAYMENT-VERIFY] Payment record not found for order:', razorpay_order_id);
          throw new Error('Payment record not found. Please contact support with your order ID.');
        }

        const payment = payments[0];
        const bookingId = payment.booking_id;

        // Update payment status
        await client.query(
          `UPDATE payments SET 
            payment_status = 'completed',
            razorpay_payment_id = $1,
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = $2`,
          [razorpay_payment_id, payment.id]
        );

        // ✅ If booking is created after payment (prepaid flow), return success without booking update
        if (!bookingId) {
          return {
            message: 'Payment verified successfully',
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            bookingId: null,
          };
        }

        // ✅ Update booking status to confirmed and payment_status to paid
        const { rows: bookingRows } = await client.query(
          `SELECT status, payment_status FROM bookings WHERE id = $1 FOR UPDATE`,
          [bookingId]
        );
        const previousStatus = bookingRows[0]?.status || null;
        const previousPaymentStatus = bookingRows[0]?.payment_status || null;
        const shouldNotify = previousPaymentStatus !== 'paid' || previousStatus === 'pending_payment';

        await client.query(
          `UPDATE bookings SET 
            payment_status = 'paid',
            status = 'confirmed',
            updated_at = NOW()
          WHERE id = $1`,
          [bookingId]
        );

        if (previousStatus !== 'confirmed') {
          bookingStatusChange = { bookingId, from: previousStatus, to: 'confirmed' };
        }
        if (shouldNotify) {
          bookingToNotify = bookingId;
        }

        console.log('[PAYMENT-VERIFY] ✅ Payment verified and booking confirmed:', bookingId);

        const pharmacyOrderId = payment.pharmacy_order_id;

        if (pharmacyOrderId) {
          // Pharmacy order: update status and create delivery_tracking with OTP for later use at dispatch
          await client.query(
            `UPDATE pharmacy_orders SET 
              payment_status = 'paid',
              razorpay_payment_id = $1,
              status = 'payment_confirmed',
              updated_at = NOW()
            WHERE id = $2`,
            [razorpay_payment_id, pharmacyOrderId]
          );
          const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
          const { rows: existing } = await client.query(
            `SELECT id FROM delivery_tracking WHERE pharmacy_order_id = $1`,
            [pharmacyOrderId]
          );
          if (existing.length === 0) {
            await client.query(
              `INSERT INTO delivery_tracking (pharmacy_order_id, status, delivery_otp, assigned_at)
               VALUES ($1, $2, $3, NOW())`,
              [pharmacyOrderId, 'assigned', deliveryOtp]
            );
          }
        }

        // Queue settlement and publish events (outside transaction for async operations)
        if (bookingId) {
          try {
            const { rows: vendors } = await client.query(
              `SELECT razorpay_account_id, bank_verified FROM vendors WHERE id = $1`,
              [payment.vendor_id]
            );
            const vendor = vendors.length > 0 ? vendors[0] : null;
            if (vendor?.razorpay_account_id && vendor.bank_verified) {
              // Queue settlement asynchronously (don't await in transaction)
              Promise.resolve().then(async () => {
                try {
                  const { sendToSQS } = await import('../utils/aws-clients');
                  await sendToSQS('settlement-queue', {
                    type: 'auto_settle_booking',
                    bookingId: bookingId,
                    vendorId: payment.vendor_id,
                    paymentId: payment.id,
                  });
                } catch (error) {
                  console.error('Failed to queue automatic settlement:', error);
                }
              });
            }
          } catch (error) {
            console.error('Failed to check vendor for settlement:', error);
          }
          
          try {
            // Publish event asynchronously (don't await in transaction)
            Promise.resolve().then(async () => {
              try {
                const { publishPaymentProcessed } = await import('../utils/sns-client');
                await publishPaymentProcessed({
                  paymentId: razorpay_payment_id,
                  bookingId: bookingId,
                  amount: payment.amount,
                  status: 'completed',
                });
              } catch (error) {
                console.error('Failed to publish payment processed event:', error);
              }
            });
          } catch (error) {
            console.error('Failed to publish payment event:', error);
          }
        }

        return {
          message: 'Payment verified successfully',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          bookingId: bookingId,
        };
      });

      if (bookingStatusChange) {
        await logBookingStatusChange(
          bookingStatusChange.bookingId,
          bookingStatusChange.from,
          bookingStatusChange.to,
          'system',
          'system',
          'Payment verified'
        );
      }

      if (bookingToNotify) {
        await notifyBookingCreated(bookingToNotify, context.requestId);
      }

      return this.success(result);
    } catch (error: any) {
      console.error('[PAYMENT-VERIFY] Verification error:', error);
      
      // ✅ CRITICAL: Only rollback if payment verification failed (payment_status is still 'pending')
      // If transaction already committed (payment_status = 'completed'), don't delete booking
      const body = this.parseBody(context.event);
      const orderId = body?.razorpay_order_id;
      
      if (orderId) {
        try {
          await withTransaction(async (client) => {
            const { rows: payments } = await client.query(
              `SELECT booking_id, payment_status FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
              [orderId]
            );

            if (payments.length > 0) {
              const payment = payments[0];
              
              // ✅ Only delete booking if payment_status is still 'pending' (payment didn't succeed)
              if (payment.payment_status === 'pending' && payment.booking_id) {
                // Delete booking (rollback)
                await client.query(
                  `DELETE FROM bookings WHERE id = $1`,
                  [payment.booking_id]
                );
                console.log('[PAYMENT-VERIFY] ❌ Payment verification failed - booking rolled back:', payment.booking_id);
                
                // Delete payment record
                await client.query(
                  `DELETE FROM payments WHERE razorpay_order_id = $1`,
                  [orderId]
                );
                console.log('[PAYMENT-VERIFY] ❌ Payment verification failed - payment record deleted');
              } else if (payment.payment_status === 'completed') {
                // ✅ Payment already succeeded - don't delete booking
                console.log('[PAYMENT-VERIFY] ⚠️ Error occurred but payment already succeeded (status: completed), skipping rollback');
              } else {
                // Payment status is something else (partial, failed, etc.) - still rollback
                if (payment.booking_id) {
                  await client.query(
                    `DELETE FROM bookings WHERE id = $1`,
                    [payment.booking_id]
                  );
                  console.log('[PAYMENT-VERIFY] ❌ Payment verification failed - booking rolled back (status:', payment.payment_status, ')');
                }
                await client.query(
                  `DELETE FROM payments WHERE razorpay_order_id = $1`,
                  [orderId]
                );
              }
            }
          });
        } catch (rollbackError: any) {
          console.error('[PAYMENT-VERIFY] Error during rollback:', rollbackError);
          // Continue to return error even if rollback fails
        }
      }
      
      if (error.message) {
        return this.error(`Payment verification failed: ${error.message}. Booking has been cancelled.`, 500);
      }
      return this.error('Payment verification failed. Booking has been cancelled. Please try again or contact support.', 500);
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
        let shouldNotify = false;
        let previousStatus: string | null = null;
        if (paymentRecord.booking_id) {
          const bookingRows = await select('bookings', { id: paymentRecord.booking_id });
          if (bookingRows.length > 0) {
            const booking = bookingRows[0];
            previousStatus = booking.status || null;
            shouldNotify = booking.payment_status !== 'paid' || previousStatus === 'pending_payment';
          }
        }

        await update(
          'bookings',
          { id: paymentRecord.booking_id },
          { payment_status: 'paid', status: 'confirmed' }
        );

        if (previousStatus && previousStatus !== 'confirmed') {
          await logBookingStatusChange(
            paymentRecord.booking_id,
            previousStatus,
            'confirmed',
            'system',
            'system',
            'Payment captured (webhook)'
          );
        }

        if (shouldNotify) {
          await notifyBookingCreated(paymentRecord.booking_id, context.requestId);
        }

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
      
      // ✅ FIX: Use transaction to ensure atomicity when cancelling booking
      await withTransaction(async (client) => {
        // Update payment status
        await client.query(
          `UPDATE payments SET 
            payment_status = 'failed',
            failure_reason = $1,
            updated_at = NOW()
          WHERE razorpay_payment_id = $2`,
          [payment.error_description || 'Payment failed', payment.id]
        );

        // Get payment with booking_id
        const { rows: payments } = await client.query(
          `SELECT booking_id FROM payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
          [payment.id]
        );

        if (payments.length > 0 && payments[0].booking_id) {
          const bookingId = payments[0].booking_id;
          
          // ✅ FIX: Cancel booking if payment_status is not 'paid' and status is 'pending' or 'pending_payment'
          // This ensures slot is released when payment fails
          const { rows: bookingRows } = await client.query(
            `SELECT status, payment_status FROM bookings WHERE id = $1 FOR UPDATE`,
            [bookingId]
          );
          
          if (bookingRows.length > 0) {
            const booking = bookingRows[0];
            // ✅ FIX: Check for both 'pending' and 'pending_payment' status (booking is created with 'pending')
            if (booking.payment_status !== 'paid' && 
                (booking.status === 'pending' || booking.status === 'pending_payment')) {
              await client.query(
                `UPDATE bookings SET 
                  status = 'cancelled', 
                  payment_status = 'failed',
                  cancelled_at = NOW(),
                  updated_at = NOW()
                WHERE id = $1`,
                [bookingId]
              );
              console.log('[PAYMENT-FAILED] ✅ Booking cancelled and slot released:', bookingId);
            }
          }
        }
      });
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

      const upperIfsc = ifscCode.toUpperCase();
      const url = `https://ifsc.razorpay.com/${upperIfsc}`;
      
      console.log(`[RAZORPAY-IFSC] Looking up IFSC: ${upperIfsc}`);
      
      // Add timeout to prevent hanging requests (increased for Lambda VPC network latency)
      const FETCH_TIMEOUT_MS = 20000; // 20 seconds (increased from 10s for VPC network latency)
      const MAX_RETRIES = 2; // Retry up to 2 times for transient network failures
      let lastError: any = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          console.log(`[RAZORPAY-IFSC] Retry attempt ${attempt} of ${MAX_RETRIES} for ${upperIfsc}`);
          // Wait before retry (exponential backoff: 1s, 2s)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn(`[RAZORPAY-IFSC] Request timeout after ${FETCH_TIMEOUT_MS}ms for ${upperIfsc} (attempt ${attempt + 1})`);
          controller.abort();
        }, FETCH_TIMEOUT_MS);

        try {
          // Razorpay IFSC API is public and doesn't require authentication
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'WarmPawz/1.0',
              'Accept': 'application/json',
            },
          });
          
          clearTimeout(timeoutId);
        
          if (!response.ok) {
            if (response.status === 404) {
              console.log(`[RAZORPAY-IFSC] IFSC code not found: ${upperIfsc}`);
              return c.json({ 
                error: 'IFSC code not found',
                ifsc: upperIfsc
              }, 404);
            }
            const errorText = await response.text().catch(() => response.statusText);
            console.error(`[RAZORPAY-IFSC] HTTP error ${response.status} for ${upperIfsc}: ${errorText}`);
            throw new Error(`IFSC lookup failed: HTTP ${response.status} ${errorText}`);
          }

          const bankData = await response.json();
          console.log(`[RAZORPAY-IFSC] Successfully retrieved data for ${upperIfsc}: ${bankData.BANK || 'Unknown'}`);
          
          return c.json({
            success: true,
            ifsc: bankData.IFSC || upperIfsc,
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
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          lastError = fetchError;
          
          // Check if this is a retryable error
          const isRetryable = 
            fetchError.name === 'AbortError' || 
            fetchError.message?.includes('aborted') ||
            fetchError.message?.includes('fetch failed') || 
            fetchError.code === 'ENOTFOUND' || 
            fetchError.code === 'ECONNREFUSED' || 
            fetchError.code === 'ETIMEDOUT' ||
            fetchError.message?.includes('network') ||
            fetchError.message?.includes('ECONNRESET');
          
          // If not retryable or we've exhausted retries, handle the error
          if (!isRetryable || attempt === MAX_RETRIES) {
            // Handle abort (timeout)
            if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
              console.error(`[RAZORPAY-IFSC] Request timeout for ${upperIfsc} after ${attempt + 1} attempts`);
              return c.json({ 
                error: 'Request timeout. Please try again.',
                ifsc: upperIfsc
              }, 504);
            }
            
            // Handle network errors
            if (fetchError.message?.includes('fetch failed') || 
                fetchError.code === 'ENOTFOUND' || 
                fetchError.code === 'ECONNREFUSED' || 
                fetchError.code === 'ETIMEDOUT' ||
                fetchError.message?.includes('network') ||
                fetchError.message?.includes('ECONNRESET')) {
              console.error(`[RAZORPAY-IFSC] Network error for ${upperIfsc} after ${attempt + 1} attempts:`, {
                message: fetchError.message,
                code: fetchError.code,
                cause: fetchError.cause
              });
              return c.json({ 
                error: 'Network error connecting to Razorpay IFSC API. Please check Lambda VPC configuration and internet connectivity.',
                ifsc: upperIfsc,
                details: fetchError.message || fetchError.code || 'Unknown network error'
              }, 503);
            }
            
            // Re-throw other errors
            throw fetchError;
          }
          
          // If retryable and we have retries left, continue to next iteration
          console.warn(`[RAZORPAY-IFSC] Retryable error on attempt ${attempt + 1}, will retry:`, fetchError.message);
        }
      }
    } catch (error: any) {
      console.error('[RAZORPAY-IFSC] Error looking up IFSC code:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      });
      
      // Don't expose internal error details in production
      const errorMessage = error.message || 'Failed to lookup IFSC code';
      return c.json({ 
        error: errorMessage.includes('Network error') || errorMessage.includes('timeout') 
          ? errorMessage 
          : 'Failed to lookup IFSC code. Please try again later.',
        ifsc: c.req.param('ifscCode')?.toUpperCase()
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
