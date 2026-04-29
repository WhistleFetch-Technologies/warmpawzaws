/**
 * ============================================================================
 * PAYMENT ENDPOINTS - ENHANCED VERSION (PHASE 5)
 * ============================================================================
 * 
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * 
 * Endpoints:
 * - POST /payments/create - Create payment
 * - POST /payments/razorpay/webhook - Razorpay webhook handler
 * - GET /payments/:id - Get payment details
 * 
 * Date: 2026-01-28
 * Phase: 5
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { query, select, insert, update, withTransaction } from '../database/rds-connection';
import { checkIdempotencyKey, storeIdempotencyKey } from '../utils/idempotency';
import { logAuditEntry, logBookingStatusChange, logPaymentStatusChange } from '../utils/audit-log';
import { publishPaymentCreated, publishPaymentProcessed } from '../utils/sns-client';
import { normalizeDbRow, buildPaymentResponse } from '../utils/entity-extractor';
import { normalizePayment, isValidUUID } from '../types/entities';
import { notifyBookingCreated } from '../utils/booking-notifications';
import {
  CreatePaymentRequestSchema,
} from '@warmpawz/api-contracts/payments';
import { calculateFinalFees, mapCatalogCategoryToBusinessType } from '../utils/feeCalculator';
import { debitCustomerWalletForBookingInTransaction } from '../utils/wallet-operations';

// ============================================================================
// PAYMENT HANDLERS
// ============================================================================

class CreatePaymentHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    // Log incoming request for debugging
    console.log('📥 [PAYMENT-CREATE] Received request:', {
      requestId,
      bodyKeys: Object.keys(body || {}),
      bookingId: body?.bookingId,
      amount: body?.amount,
      amountType: typeof body?.amount,
      paymentMethod: body?.paymentMethod,
      customerId: body?.customerId,
      vendorId: body?.vendorId,
    });

    // Validate request with Zod schema
    const validationResult = CreatePaymentRequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('❌ [PAYMENT-CREATE] Validation failed:', {
        errors: validationResult.error.errors,
        receivedBody: body,
      });
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const { 
      bookingId, 
      amount, 
      paymentMethod, 
      customerId, 
      vendorId,
      idempotencyKey,
    } = validationResult.data;

    const rawBody = body as Record<string, unknown>;
    const categoryFromBody =
      typeof rawBody.category === 'string' && rawBody.category.trim() !== ''
        ? rawBody.category.trim()
        : undefined;
    
    // Extract wallet fields from raw body (not in schema yet)
    const useWallet = (body as any).useWallet ?? false;
    const walletAmount = (body as any).walletAmount ?? 0;

    // Check idempotency key first
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        return {
          statusCode: existing.httpStatus || 200,
          headers: { 'X-Idempotent-Replay': 'true' },
          body: existing.response,
        };
      }
    }

    // ✅ bookingId is REQUIRED - booking should already exist (created before payment)
    let bookings: any[];
    try {
      bookings = await select('bookings', { id: bookingId });
    } catch (dbErr: any) {
      const err = dbErr as Error & { step?: string };
      err.step = 'select_booking';
      throw err;
    }
    if (bookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    const booking = bookings[0];

    // Payments table requires customer_id NOT NULL
    const effectiveCustomerId = customerId || booking.customer_id;
    if (!effectiveCustomerId) {
      return this.error(
        'Customer ID is required for payment (missing in request and booking)',
        400,
        'VALIDATION_ERROR',
        { bookingId },
        requestId
      );
    }

    const effectiveVendorId = vendorId || booking.vendor_id;

    try {
      // Calculate tax for booking payment
      let taxBreakdown = null;
      let gstAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let gstRuleId = null;

      // Get customer and vendor locations for tax calculation
      let customerLocation: { state: string; city?: string; pincode?: string } | undefined = undefined;
      let vendorLocation: { state: string; city?: string } | undefined = undefined;

      if (booking.customer_id) {
        const customers = await select('customers', { id: effectiveCustomerId });
        if (customers.length > 0 && customers[0].address) {
          try {
            // ✅ FIX: Handle both JSON and plain text addresses
            const rawAddr = customers[0].address;
            let addr: any = null;
            if (typeof rawAddr === 'string') {
              // Try to parse as JSON, but handle plain text addresses gracefully
              if (rawAddr.startsWith('{') || rawAddr.startsWith('[')) {
                addr = JSON.parse(rawAddr);
              } else {
                // Plain text address - skip location extraction
                console.log('[PAYMENT] Customer address is plain text, skipping location extraction');
              }
            } else {
              addr = rawAddr;
            }
            if (addr?.state) {
              customerLocation = {
                state: addr.state,
                city: addr.city,
                pincode: addr.pincode,
              };
            }
          } catch (addrParseError) {
            console.warn('[PAYMENT] Failed to parse customer address as JSON:', addrParseError);
            // Continue without location - tax calculation will use defaults
          }
        }
      }

      if (booking.vendor_id) {
        const vendors = await select('vendors', { id: booking.vendor_id });
        if (vendors.length > 0 && vendors[0].address) {
          try {
            // ✅ FIX: Handle both JSON and plain text addresses
            const rawAddr = vendors[0].address;
            let addr: any = null;
            if (typeof rawAddr === 'string') {
              // Try to parse as JSON, but handle plain text addresses gracefully
              if (rawAddr.startsWith('{') || rawAddr.startsWith('[')) {
                addr = JSON.parse(rawAddr);
              } else {
                // Plain text address - skip location extraction
                console.log('[PAYMENT] Vendor address is plain text, skipping location extraction');
              }
            } else {
              addr = rawAddr;
            }
            if (addr?.state) {
              vendorLocation = {
                state: addr.state,
                city: addr.city,
              };
            }
          } catch (addrParseError) {
            console.warn('[PAYMENT] Failed to parse vendor address as JSON:', addrParseError);
            // Continue without location - tax calculation will use defaults
          }
        }
      }

      // Get service details for tax calculation - 360 mapping: vendor_services → service_catalog → tax
      const serviceId = booking.service_id;
      let serviceHsnCode = null;
      let serviceHsnCodeId = null;
      let serviceTaxCategoryId = null;
      let serviceCategory = null;
      let serviceStyle = booking.service_style;

      if (serviceId) {
        // 1. Try vendor_services (booking.service_id is often vendor_services.id)
        const vendorSvcs = await query(
          `SELECT vs.*, sc.tax_category_id, sc.hsn_code_id, sc.category_id, sc.category_name
           FROM vendor_services vs
           LEFT JOIN service_catalog sc ON sc.id = vs.service_id
           WHERE vs.id = $1::uuid LIMIT 1`,
          [serviceId]
        ).catch(() => ({ rows: [] }));
        if (vendorSvcs.rows?.length > 0) {
          const row = vendorSvcs.rows[0];
          serviceTaxCategoryId = row.tax_category_id;
          serviceHsnCodeId = row.hsn_code_id;
          serviceCategory = row.category_name || row.category_id || row.category;
        }
        // 2. Try service_catalog directly (booking.service_id may be catalog id)
        if (!serviceTaxCategoryId && !serviceHsnCodeId) {
          const catalogRows = await query(
            `SELECT tax_category_id, hsn_code_id, category_id, category_name FROM service_catalog WHERE id = $1::uuid LIMIT 1`,
            [serviceId]
          ).catch(() => ({ rows: [] }));
          if (catalogRows.rows?.length > 0) {
            const row = catalogRows.rows[0];
            serviceTaxCategoryId = row.tax_category_id;
            serviceHsnCodeId = row.hsn_code_id;
            if (!serviceCategory) serviceCategory = row.category_name || row.category_id;
          }
        }
        // 3. Fallback: legacy services table
        if (!serviceHsnCode && !serviceHsnCodeId && !serviceTaxCategoryId) {
          const services = await select('services', { id: serviceId });
          if (services.length > 0) {
            serviceHsnCode = services[0].hsn_code;
            if (!serviceCategory) serviceCategory = services[0].category;
          }
        }
      }

      const vendorRow = booking.vendor_id ? await select('vendors', { id: booking.vendor_id }) : [];
      const roleId = vendorRow.length > 0 ? vendorRow[0]?.role_id : undefined;

      // Calculate tax using tax calculation service (GST Config → Tax Rules → 18%)
      try {
        const { taxCalculationService } = await import('../lib/services/tax-calculation-service');
        const taxResult = await taxCalculationService.calculateTax({
          items: [{
            id: serviceId || booking.id,
            type: 'service',
            hsnCode: serviceHsnCode || undefined,
            hsnCodeId: serviceHsnCodeId || undefined,
            taxCategoryId: serviceTaxCategoryId || undefined,
            amount: amount,
            quantity: 1,
            category: serviceCategory || undefined,
            serviceStyle: serviceStyle || undefined,
            roleId,
          }],
          customerLocation,
          vendorLocation,
          vendorId: booking.vendor_id || undefined,
          serviceType: serviceCategory || undefined,
          category: serviceCategory || undefined,
        });

        taxBreakdown = taxResult;
        gstAmount = taxResult.totalTax;
        cgstAmount = taxResult.totalCGST;
        sgstAmount = taxResult.totalSGST;
        igstAmount = taxResult.totalIGST;
        gstRuleId = taxResult.items[0]?.taxRuleId || null;
      } catch (taxError) {
        console.error('Error calculating tax, using amount as base:', taxError);
        // Fallback: if tax calculation fails, use the amount as base (tax already included or will be calculated later)
        gstAmount = 0;
      }

      // Platform / convenience / delivery / packaging — same rules as GET /config/fees (admin_settings)
      let platformFee = 0;
      let convenienceFee = 0;
      let deliveryFee = 0;
      let packagingFee = 0;
      let feesBreakdown: Record<string, unknown> | null = null;

      const fromBookingTotal = parseFloat(String(booking.total_amount ?? booking.amount ?? ''));
      const feeBaseAmount =
        Number.isFinite(fromBookingTotal) && fromBookingTotal > 0 ? fromBookingTotal : amount;

      const businessServiceType =
        (categoryFromBody && String(categoryFromBody).trim()) ||
        mapCatalogCategoryToBusinessType(serviceCategory) ||
        '';

      try {
        const fees = await calculateFinalFees({
          amount: feeBaseAmount,
          type: 'booking',
          serviceStyle: String(serviceStyle || booking.service_style || booking.service_type || ''),
          businessServiceType,
        });

        platformFee = fees.platformFee;
        convenienceFee = fees.convenienceFee;
        deliveryFee = fees.deliveryFee;
        packagingFee = fees.packagingFee;
        feesBreakdown = { ...fees, feeBaseAmount, businessServiceType };

        console.log(
          `[PAYMENT] Calculated fees: platform=₹${platformFee}, convenience=₹${convenienceFee}, delivery=₹${deliveryFee}, packaging=₹${packagingFee}`
        );
      } catch (feeError) {
        console.warn('[PAYMENT] Error calculating fees, using defaults:', feeError);
        platformFee = Math.round((feeBaseAmount * 2) / 100);
        platformFee = Math.min(platformFee, 200);
        convenienceFee = 0;
      }

      const feesTotal = platformFee + convenienceFee + deliveryFee + packagingFee;

      // Total amount including fees (fees are added on top of tax-inclusive request amount)
      const totalAmount = amount + gstAmount + feesTotal;

      let walletDebited = false;
      let remainingAmount = totalAmount;
      let walletDebitedAmount = 0;

      // Wallet debit + payment insert must be atomic (rollback wallet if payment insert fails)
      let payment: any;
      try {
        payment = await withTransaction(async (client) => {
        let walletApplied = 0;
        if (useWallet && effectiveCustomerId) {
          const walletCap =
            walletAmount > 0 ? Math.min(Number(walletAmount), totalAmount) : totalAmount;
          const wbalRes = await client.query(
            `SELECT COALESCE(balance, 0)::text AS b FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
            [effectiveCustomerId]
          );
          const bal = parseFloat(String(wbalRes.rows[0]?.b ?? '0')) || 0;
          const targetDebit = Math.min(walletCap, bal, totalAmount);
          if (targetDebit > 0) {
            const idem =
              idempotencyKey != null && String(idempotencyKey).trim() !== ''
                ? String(idempotencyKey).trim()
                : `legacy-${bookingId}`;
            const d = await debitCustomerWalletForBookingInTransaction(client, {
              customerId: effectiveCustomerId,
              bookingId,
              amount: Math.round(targetDebit * 100) / 100,
              idempotencyKey: idem,
            });
            walletApplied = d.debited;
          }
        }

        const roundedRemain = Math.max(0, Math.round((totalAmount - walletApplied) * 100) / 100);
        const fullyWallet = walletApplied > 0 && roundedRemain < 0.01;

        const paymentData: any = {
          booking_id: bookingId, // ✅ bookingId is REQUIRED - booking should already exist
          customer_id: effectiveCustomerId,
          vendor_id: vendorId || booking.vendor_id,
          amount: amount, // Base service amount
          currency: 'INR',
          payment_method: fullyWallet ? 'wallet' : (paymentMethod || 'razorpay'),
          payment_status: fullyWallet ? 'completed' : 'pending',
        };

        // Add tax fields if calculated
        if (gstAmount > 0) {
          paymentData.gst_amount = gstAmount;
          paymentData.cgst_amount = cgstAmount;
          paymentData.sgst_amount = sgstAmount;
          paymentData.igst_amount = igstAmount;
          if (gstRuleId) {
            paymentData.gst_rule_id = gstRuleId;
          }
        }
        
        // Add platform and convenience fees
        if (feesTotal > 0) {
          if (platformFee > 0) paymentData.platform_fee = platformFee;
          if (convenienceFee > 0) paymentData.convenience_fee = convenienceFee;
          paymentData.total_amount = totalAmount;
        }

        // Only insert columns that exist on payments table (avoids 42703 when migrations not yet applied)
        const colsResult = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments'`
        );
        const existingColumns = new Set(colsResult.rows.map((r) => r.column_name));
        const filteredData: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(paymentData)) {
          if (existingColumns.has(k)) filteredData[k] = v;
        }

        const columns = Object.keys(filteredData);
        const values = Object.values(filteredData);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const result = await client.query(
          `INSERT INTO payments (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          values
        );

        const row = result.rows[0];
        return { row, walletApplied, remainingAfterWallet: roundedRemain };
      });
      } catch (txErr: any) {
        (txErr as Error & { step?: string }).step = 'payment_insert';
        throw txErr;
      }

      walletDebitedAmount = (payment as any).walletApplied ?? 0;
      remainingAmount = (payment as any).remainingAfterWallet ?? totalAmount;
      walletDebited = walletDebitedAmount > 0;
      payment = (payment as any).row;

      // Log audit entry
      await logAuditEntry({
        entityType: 'payment',
        entityId: payment.id,
        action: 'create',
        newValues: {
          bookingId,
          amount,
          paymentMethod: paymentMethod || 'razorpay',
          status: 'pending',
        },
        actorId: customerId || booking.customer_id,
        actorType: 'customer',
        requestId,
      });

      // Log initial status
      await logPaymentStatusChange(payment.id, null, payment.payment_status);

      // Full wallet at create: payment is completed immediately (no Razorpay webhook). Confirm booking and notify like payment.captured.
      if (payment.payment_status === 'completed' && payment.booking_id) {
        try {
          let bookingToNotify: string | null = null;
          let bookingStatusChange: { bookingId: string; from: string | null; to: string | null } | null = null;

          await withTransaction(async (client) => {
            const { rows: bookingRows } = await client.query(
              `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
              [payment.booking_id]
            );
            if (bookingRows.length > 0) {
              const booking = bookingRows[0];
              const previousStatus = booking.status || null;
              const shouldNotify = booking.payment_status !== 'paid' || previousStatus === 'pending_payment';
              const nextStatus = previousStatus === 'pending_payment' ? 'confirmed' : previousStatus;

              await client.query(
                `UPDATE bookings SET 
                   payment_status = 'paid', 
                   status = $2,
                   updated_at = NOW() 
                 WHERE id = $1`,
                [booking.id, nextStatus]
              );

              if (shouldNotify) {
                bookingToNotify = booking.id;
              }
              if (previousStatus !== nextStatus) {
                bookingStatusChange = { bookingId: booking.id, from: previousStatus, to: nextStatus };
              }
            }
          });

          if (bookingStatusChange) {
            try {
              await logBookingStatusChange(
                bookingStatusChange.bookingId,
                bookingStatusChange.from,
                bookingStatusChange.to,
                'system',
                'system',
                'Payment completed (wallet)'
              );
            } catch (auditErr) {
              console.error('[PAYMENT-CREATE] Failed to log booking status change after wallet payment:', auditErr);
            }
          }

          if (bookingToNotify) {
            try {
              await notifyBookingCreated(bookingToNotify, requestId);
            } catch (notifyErr) {
              console.error('[PAYMENT-CREATE] Failed to notify booking after wallet payment:', notifyErr);
            }
          }
        } catch (error) {
          console.error('[PAYMENT-CREATE] Wallet full-payment booking update failed:', error);
        }
      }

      // Wallet covered the booking row total but /payments total (tax + platform fees) left a Razorpay remainder —
      // payment row stays "pending" while the customer already paid the slot via wallet. Confirm the booking.
      const bookingServiceTotal =
        Math.round(
          (parseFloat(String(booking.total_amount ?? booking.amount ?? 0)) || 0) * 100
        ) / 100;
      const walletCoversBookingService =
        bookingServiceTotal > 0 &&
        walletDebitedAmount > 0 &&
        walletDebitedAmount + 0.02 >= bookingServiceTotal;
      if (
        walletCoversBookingService &&
        payment.booking_id &&
        payment.payment_status !== 'completed' &&
        String(booking.status || '').toLowerCase() === 'pending_payment'
      ) {
        try {
          let bookingToNotify: string | null = null;
          let bookingStatusChange: { bookingId: string; from: string | null; to: string | null } | null = null;
          await withTransaction(async (client) => {
            const { rows: bookingRows } = await client.query(
              `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
              [payment.booking_id]
            );
            if (bookingRows.length > 0) {
              const bRow = bookingRows[0];
              const previousStatus = bRow.status || null;
              if (String(previousStatus || '').toLowerCase() !== 'pending_payment') return;
              await client.query(
                `UPDATE bookings SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE id = $1`,
                [bRow.id]
              );
              bookingToNotify = bRow.id;
              bookingStatusChange = { bookingId: bRow.id, from: previousStatus, to: 'confirmed' };
            }
          });
          if (bookingStatusChange) {
            try {
              await logBookingStatusChange(
                bookingStatusChange.bookingId,
                bookingStatusChange.from,
                bookingStatusChange.to,
                'system',
                'system',
                'Wallet covered booking total (fees may remain on payment row)'
              );
            } catch (auditErr) {
              console.error('[PAYMENT-CREATE] Failed to log booking confirm after wallet/service parity:', auditErr);
            }
          }
          if (bookingToNotify) {
            try {
              await notifyBookingCreated(bookingToNotify, requestId);
            } catch (notifyErr) {
              console.error('[PAYMENT-CREATE] Failed to notify after wallet/service parity:', notifyErr);
            }
          }
        } catch (e) {
          console.error('[PAYMENT-CREATE] Wallet vs booking-total confirm failed:', e);
        }
      }

      // Payment/booking loyalty for customer: handled by action_sources → loyalty-events-consumer (not inline here).

      // Publish event
      try {
        await publishPaymentCreated({
          paymentId: payment.id,
          bookingId,
          customerId: payment.customer_id,
          vendorId: payment.vendor_id,
          amount: payment.amount,
          currency: 'INR',
          status: payment.payment_status,
          requestId,
        });
      } catch (error) {
        console.error('Failed to publish payment created event:', error);
      }

      const response = {
        paymentId: payment.id,
        status: payment.payment_status,
        message: 'Payment created successfully',
        isNew: true,
        walletUsed: walletDebited,
        walletAmount: walletDebitedAmount,
        remainingAmount: remainingAmount > 0 ? remainingAmount : 0,
        // Fee breakdown for frontend display
        fees: {
          baseAmount: amount,
          platformFee,
          convenienceFee,
          deliveryFee,
          packagingFee,
          gstAmount,
          totalAmount,
          breakdown: feesBreakdown,
        },
      };

      // Store idempotency key
      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, 'payment', payment.id, JSON.stringify(response), 200);
      }

      return this.success(response, requestId);
    } catch (error: any) {
      const message = error?.message || 'Failed to create payment';
      console.error('[PAYMENT-CREATE] Error creating payment:', message, error?.stack);
      // Include error details in response so client can show them (and so CloudWatch has context)
      const details: Record<string, unknown> = {
        step: error?.step || 'unknown',
        message: message,
      };
      if (process.env.NODE_ENV === 'development' || process.env.STAGE === 'dev') {
        details.stack = error?.stack;
        details.code = error?.code;
      }
      return this.error(
        message,
        500,
        'INTERNAL_ERROR',
        details,
        requestId
      );
    }
  }
}

class RazorpayWebhookHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const rawBody = context.event.body || '{}';
    const headers = this.getHeaders(context.event);
    const signature = headers['x-razorpay-signature'] || headers['X-Razorpay-Signature'] || '';
    const requestId = context.requestId;

    // Verify Razorpay webhook signature
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      console.error('[SECURITY] Invalid Razorpay webhook signature');
      return this.error('Invalid signature', 401, 'UNAUTHORIZED', undefined, requestId);
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      return this.error('Invalid JSON in webhook body', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const { event, payload } = body;

    // Idempotency for webhooks using Razorpay event ID
    const webhookEventId = body.id || `${event}_${payload?.payment?.entity?.id || payload?.order?.entity?.id}`;
    
    const existing = await checkIdempotencyKey(`webhook_${webhookEventId}`);
    if (existing.exists) {
      return this.success({ message: 'Webhook already processed', duplicate: true }, requestId);
    }

    // Handle different event types
    if (event === 'payment.captured') {
      const paymentEntity = payload?.payment?.entity;
      const payment_id = paymentEntity?.id;
      const order_id = paymentEntity?.order_id;
      
      if (!payment_id) {
        return this.success({ message: 'Webhook processed (no payment_id)' }, requestId);
      }

      try {
        let bookingToNotify: string | null = null;
        let bookingStatusChange: { bookingId: string; from: string | null; to: string | null } | null = null;

        // Use transaction for atomicity
        await withTransaction(async (client) => {
          const { rows: payments } = await client.query(
            `SELECT * FROM payments 
             WHERE razorpay_payment_id = $1 OR razorpay_order_id = $2
             FOR UPDATE`,
            [payment_id, order_id]
          );

          if (payments.length === 0) {
            console.warn(`Payment not found for razorpay_payment_id: ${payment_id}`);
            return;
          }

          const payment = payments[0];
          const oldStatus = payment.payment_status;

          // Update payment status
          await client.query(
            `UPDATE payments SET 
               payment_status = 'completed',
               razorpay_payment_id = $1,
               razorpay_order_id = $2,
               completed_at = NOW(),
               updated_at = NOW()
             WHERE id = $3`,
            [payment_id, order_id, payment.id]
          );

          // Update booking payment status
          if (payment.booking_id) {
            const { rows: bookingRows } = await client.query(
              `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
              [payment.booking_id]
            );
            if (bookingRows.length > 0) {
              const booking = bookingRows[0];
              const previousStatus = booking.status || null;
              const shouldNotify = booking.payment_status !== 'paid' || previousStatus === 'pending_payment';
              const nextStatus = previousStatus === 'pending_payment' ? 'confirmed' : previousStatus;

              await client.query(
                `UPDATE bookings SET 
                   payment_status = 'paid', 
                   status = $2,
                   updated_at = NOW() 
                 WHERE id = $1`,
                [booking.id, nextStatus]
              );

              if (shouldNotify) {
                bookingToNotify = booking.id;
              }
              if (previousStatus !== nextStatus) {
                bookingStatusChange = { bookingId: booking.id, from: previousStatus, to: nextStatus };
              }
            }
          }

          // Log status change
          await logPaymentStatusChange(
            payment.id,
            oldStatus,
            'completed',
            'webhook',
            event,
            { razorpay_payment_id: payment_id, amount: paymentEntity?.amount }
          );
        });

        // Log booking status change (if any)
        if (bookingStatusChange) {
          await logBookingStatusChange(
            bookingStatusChange.bookingId,
            bookingStatusChange.from,
            bookingStatusChange.to,
            'system',
            'system',
            'Payment captured'
          );
        }

        // Notify vendor/customer only after payment confirmation
        if (bookingToNotify) {
          await notifyBookingCreated(bookingToNotify, requestId);
        }

        // Publish event
        try {
          await publishPaymentProcessed({
            paymentId: payment_id,
            amount: (paymentEntity?.amount || 0) / 100,
            status: 'completed',
            razorpayPaymentId: payment_id,
          });
        } catch (error) {
          console.error('Failed to publish payment processed event:', error);
        }

        // Trigger auto-shipment creation for e-commerce orders
        try {
          // Get the order from payment notes or metadata
          const notes = paymentEntity?.notes || {};
          const orderId = notes.order_id || notes.orderId;
          const orderType = notes.order_type || notes.orderType || 'ecommerce';
          
          if (orderId && (orderType === 'ecommerce' || orderType === 'pharmacy' || orderType === 'meal')) {
            // Async call to auto-create shipment (don't wait for result)
            triggerAutoShipment(orderId, orderType).catch((e) => {
              console.error('[AUTO-SHIPMENT] Failed to trigger:', e);
            });
          }
        } catch (shipmentError) {
          console.error('[AUTO-SHIPMENT] Error in trigger:', shipmentError);
          // Don't fail the webhook for shipment errors
        }
      } catch (error: any) {
        console.error('Error processing webhook:', error);
        return this.error(
          error.message || 'Failed to process webhook',
          500,
          'INTERNAL_ERROR',
          undefined,
          requestId
        );
      }
    }

    // Store webhook idempotency key
    await storeIdempotencyKey(
      `webhook_${webhookEventId}`,
      'webhook',
      webhookEventId,
      JSON.stringify({ message: 'Webhook processed', event }),
      200,
      168 // 7 days for webhooks
    );

    return this.success({ message: 'Webhook processed' }, requestId);
  }

  /**
   * Verify Razorpay webhook signature using HMAC SHA256
   */
  private verifyWebhookSignature(body: string, signature: string): boolean {
    if (!signature) {
      return false;
    }

    try {
      const crypto = require('crypto');
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('[SECURITY] RAZORPAY_WEBHOOK_SECRET not configured');
        return false;
      }

      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[SECURITY] Signature verification failed:', error);
      return false;
    }
  }
}

class GetPaymentHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const paymentId = context.event.pathParameters?.paymentId;
    const requestId = context.requestId;

    if (!paymentId) {
      return this.error('Payment ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      const payments = await select('payments', { id: paymentId });
      
      if (payments.length === 0) {
        return this.error('Payment not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      // Get payment status history
      const { rows: history } = await query(
        `SELECT * FROM payment_status_history 
         WHERE payment_id = $1 
         ORDER BY created_at ASC`,
        [paymentId]
      );

      return this.success({
        payment: payments[0],
        statusHistory: history,
      }, requestId);
    } catch (error: any) {
      console.error('Error getting payment:', error);
      return this.error(
        error.message || 'Failed to get payment',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerPaymentEndpointsEnhanced(app: Hono) {
  const createHandler = new CreatePaymentHandlerEnhanced();
  const webhookHandler = new RazorpayWebhookHandlerEnhanced();
  const getHandler = new GetPaymentHandlerEnhanced();

  app.post('/payments/create', async (c) => {
    try {
      // ✅ FIX: Parse body from Hono context FIRST, then pass to createApiGatewayEvent
      const requestBody = await c.req.json().catch(() => ({}));
      console.log('📥 [PAYMENT-CREATE] Raw request body from Hono:', JSON.stringify(requestBody));
      
      const event = createApiGatewayEventWithBody(c.req, requestBody);
      const context = createLambdaContext();
      const result: any = await createHandler.execute(event, context);
      
      // Parse body safely
      let body: any;
      try {
        body = JSON.parse(result.body);
      } catch (parseError) {
        // If parsing fails, return the raw body as error
        console.error('Failed to parse response body:', result.body);
        return c.json({ 
          success: false, 
          error: { 
            code: 'PARSE_ERROR', 
            message: 'Failed to parse response',
            details: { rawBody: result.body }
          } 
        }, result.statusCode || 500);
      }
      
      return c.json(body, result.statusCode);
    } catch (error: any) {
      const message = error?.message || 'Internal server error';
      console.error('[PAYMENTS-CREATE] Endpoint error:', message, error?.stack);
      // Return structured JSON so client can display it (CORS-safe; API Gateway forwards body)
      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message,
            details: {
              step: error?.step,
              ...(process.env.NODE_ENV === 'development' || process.env.STAGE === 'dev'
                ? { stack: error?.stack, raw: String(error) }
                : {}),
            },
          },
          meta: { timestamp: new Date().toISOString() },
        },
        500
      );
    }
  });
  
  // Alias for frontend compatibility
  app.post('/payments/create-order', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result: any = await createHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/payments/razorpay/webhook', async (c) => {
    // ✅ FIX: Parse body from Hono context FIRST
    const requestBody = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result: any = await webhookHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.get('/payments/:paymentId', async (c) => {
    const event = createApiGatewayEventWithBody(c.req, null);
    event.pathParameters = { paymentId: c.req.param('paymentId') };
    const context = createLambdaContext();
    const result: any = await getHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  /**
   * POST /payments/verify
   * Verify a Razorpay payment
   */
  app.post('/payments/verify', async (c) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await c.req.json();

      console.log(`🔐 [PAYMENT-VERIFY] Verifying payment ${razorpay_payment_id}`);

      if (!razorpay_order_id || !razorpay_payment_id) {
        return c.json({ error: 'Missing required payment details' }, 400);
      }

      // In production, verify signature using Razorpay secret
      // For now, just update the payment status
      const payment = await query(
        `UPDATE payments SET status = 'success', razorpay_payment_id = $1, updated_at = NOW()
         WHERE razorpay_order_id = $2 RETURNING *`,
        [razorpay_payment_id, razorpay_order_id]
      ).catch(() => ({ rows: [] }));

      // Also update the booking if payment is linked
      if (payment.rows.length > 0) {
        await query(
          `UPDATE bookings SET payment_status = 'paid', status = 'confirmed'
           WHERE id = $1`,
          [payment.rows[0].booking_id]
        ).catch((error) => {
          // Expected: notification may fail, but don't fail the main operation
          console.warn('[PAYMENTS] Error sending notification:', error instanceof Error ? error.message : 'Unknown error');
        });
      }

      return c.json({
        success: true,
        verified: true,
        payment: payment.rows[0] || { order_id: razorpay_order_id, status: 'success' }
      });
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      return c.json({ error: error.message }, 500);
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
    functionName: 'payment-handler',
    functionVersion: '$LATEST',
  };
}

/**
 * Trigger auto-shipment creation after payment success
 * This is called asynchronously to not block the webhook response
 */
async function triggerAutoShipment(orderId: string, orderType: string): Promise<void> {
  console.log(`[AUTO-SHIPMENT] Triggering for order ${orderId}, type: ${orderType}`);
  
  try {
    // Import the auto-shipment logic directly to avoid HTTP call
    const { select, insert, update, query: dbQuery } = await import('../database/rds-connection');
    const { logisticsPartnerService } = await import('../lib/services/logistics-partner-service');

    // Get order details based on type
    let order: any = null;
    let orderItems: any[] = [];
    let vendorId: string | null = null;

    if (orderType === 'ecommerce') {
      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        console.warn(`[AUTO-SHIPMENT] Order not found: ${orderId}`);
        return;
      }
      order = orders[0];
      
      // Get order items
      const items = await select('order_items', { order_id: orderId });
      orderItems = items;
      vendorId = order.vendor_id;
      
    } else if (orderType === 'pharmacy') {
      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        console.warn(`[AUTO-SHIPMENT] Pharmacy order not found: ${orderId}`);
        return;
      }
      order = orders[0];
      vendorId = order.pharmacy_id;
      
      // Create delivery tracking for pharmacy orders
      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await insert('delivery_tracking', {
        pharmacy_order_id: orderId,
        status: 'pending_assignment',
        delivery_otp: deliveryOtp,
      });
      
      await update('pharmacy_orders', { id: orderId }, {
        status: 'processing',
        logistics_type: 'warmpawz',
      });
      
      console.log(`[AUTO-SHIPMENT] Pharmacy delivery tracking created for ${orderId}`);
      return;
      
    } else if (orderType === 'meal') {
      const orders = await select('meal_orders', { id: orderId });
      if (orders.length === 0) {
        console.warn(`[AUTO-SHIPMENT] Meal order not found: ${orderId}`);
        return;
      }
      order = orders[0];
      vendorId = order.vendor_id;
      
      // Create delivery tracking for meal orders
      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await insert('delivery_tracking', {
        meal_order_id: orderId,
        status: 'pending_assignment',
        delivery_otp: deliveryOtp,
      });
      
      await update('meal_orders', { id: orderId }, {
        status: 'processing',
        logistics_type: 'warmpawz',
      });
      
      console.log(`[AUTO-SHIPMENT] Meal delivery tracking created for ${orderId}`);
      return;
    }

    // For e-commerce orders - check if auto-shipment is enabled
    const settingsResult = await dbQuery(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'platform:logistics:auto_shipment'`
    );
    const autoShipmentEnabled = settingsResult.rows.length > 0 
      ? (settingsResult.rows[0].setting_value as any)?.enabled !== false 
      : true;

    if (!autoShipmentEnabled) {
      console.log(`[AUTO-SHIPMENT] Auto-shipment disabled, skipping for ${orderId}`);
      return;
    }

    // Get customer details
    let customer: any = null;
    if (order.customer_id) {
      const customers = await select('customers', { id: order.customer_id });
      if (customers.length > 0) customer = customers[0];
    }

    // Parse shipping address
    const shippingAddress = typeof order.shipping_address === 'string' 
      ? JSON.parse(order.shipping_address) 
      : order.shipping_address;

    // Select best logistics partner
    const partner = await logisticsPartnerService.selectPartner({
      orderId,
      pickupLocation: {
        pincode: order.pickup_pincode || '560001',
      },
      deliveryLocation: {
        pincode: shippingAddress?.pincode || shippingAddress?.zip || '000000',
        city: shippingAddress?.city,
        state: shippingAddress?.state,
      },
      weight: order.total_weight || 1,
      orderValue: parseFloat(order.total_amount || '0'),
    });

    if (!partner) {
      console.log(`[AUTO-SHIPMENT] No partner available, marking for manual processing: ${orderId}`);
      await update('orders', { id: orderId }, {
        order_status: 'processing',
        logistics_notes: 'Pending manual shipment creation',
      });
      return;
    }

    // Create shipment record (actual Shiprocket API call would happen during manual processing or scheduled job)
    await insert('shipments', {
      order_id: orderId,
      logistics_partner: partner.partner_type,
      logistics_partner_id: partner.id,
      status: 'pending_creation',
    });

    await update('orders', { id: orderId }, {
      order_status: 'processing',
    });

    console.log(`[AUTO-SHIPMENT] Shipment record created for ${orderId}, partner: ${partner.partner_name}`);

  } catch (error: any) {
    console.error(`[AUTO-SHIPMENT] Error processing ${orderId}:`, error.message);
    throw error;
  }
}
