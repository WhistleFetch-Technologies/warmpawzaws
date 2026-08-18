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
import { writeBookingFinancialSnapshotIfMissing } from '../utils/booking-financial-snapshot';
import { debitCustomerWalletForBookingInTransaction } from '../utils/wallet-operations';
import {
  computeWalletBookingSplit,
  resolveLockedBookingGrossFromNotes,
} from '../utils/booking-financial-gross';
import { calculateAuthoritativeServiceGst } from '../utils/calculate-authoritative-service-gst';
import { isGstConfigurationError } from '../lib/services/gst-catalog-role-resolution';
import { isGstPlaceOfSupplyError } from '../lib/gst-place-of-supply';
import { readAuthoritativeGst, snapshotToPaymentColumns, isBackendAuthoritativeGstLock } from '../utils/canonical-gst-snapshot';
import { scheduleBookingStartOtpIfNeeded } from '../utils/booking-start-otp';
import { triggerAutoShipment } from '../utils/logistics/trigger-auto-shipment';
import {
  finalizeCapturedPayment,
  recordRazorpayWebhookEvent,
} from '../utils/payments/finalize-captured-payment';

// Type-only helper (no runtime emit)
type BookingStatusChange = { bookingId: string; from: string | null; to: string | null };

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
      let paymentGstSnap: ReturnType<typeof readAuthoritativeGst> | null = null;
      let paymentIsInterState: boolean | null = null;

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

      // Get service details for tax calculation — align with POST /tax/calculate (catalog + role).
      const serviceId = booking.service_id;
      let serviceCategory = null;
      let serviceStyle = booking.service_style;

      if (serviceId) {
        const vendorSvcs = await query(
          `SELECT vs.*, sc.category_id, sc.category_name
           FROM vendor_services vs
           LEFT JOIN service_catalog sc ON sc.id = vs.service_id
           WHERE vs.id = $1::uuid LIMIT 1`,
          [serviceId]
        ).catch(() => ({ rows: [] }));
        if (vendorSvcs.rows?.length > 0) {
          const row = vendorSvcs.rows[0];
          serviceCategory = row.category_name || row.category_id || row.category;
        }
        if (!serviceCategory) {
          const catalogRows = await query(
            `SELECT category_id, category_name FROM service_catalog WHERE id = $1::uuid LIMIT 1`,
            [serviceId]
          ).catch(() => ({ rows: [] }));
          if (catalogRows.rows?.length > 0) {
            const row = catalogRows.rows[0];
            serviceCategory = row.category_name || row.category_id;
          }
        }
        if (!serviceCategory) {
          const services = await select('services', { id: serviceId });
          if (services.length > 0) serviceCategory = services[0].category;
        }
      }

      const vendorRow = booking.vendor_id ? await select('vendors', { id: booking.vendor_id }) : [];
      const roleId = vendorRow.length > 0 ? vendorRow[0]?.role_id : undefined;

      // Prefer write-once financial meta; otherwise tax the post-discount taxable base (not Razorpay cash).
      const lockedGrossEarly = resolveLockedBookingGrossFromNotes(booking.notes);
      const bookingBase = parseFloat(String(booking.base_price ?? booking.basePrice ?? '')) || 0;
      const bookingDiscount = parseFloat(String(booking.discount_amount ?? booking.discountAmount ?? '')) || 0;
      const taxBaseFromBooking =
        bookingBase > 0 ? Math.max(0, bookingBase - bookingDiscount) : 0;
      const taxAmountInput =
        lockedGrossEarly && lockedGrossEarly.subtotalAfterDiscounts > 0
          ? lockedGrossEarly.subtotalAfterDiscounts
          : taxBaseFromBooking > 0
            ? taxBaseFromBooking
            : amount;

      try {
        const lockedSnap = lockedGrossEarly
          ? readAuthoritativeGst({
              gstAmount: lockedGrossEarly.totalTax,
              cgstAmount: lockedGrossEarly.cgst,
              sgstAmount: lockedGrossEarly.sgst,
              igstAmount: lockedGrossEarly.igst,
              isInterState: lockedGrossEarly.isInterState,
              taxableAmount: lockedGrossEarly.subtotalAfterDiscounts,
            })
          : null;
        const lockedIsBackend = isBackendAuthoritativeGstLock({
          gstAuthority: lockedGrossEarly?.gstAuthority,
          lockedSnap,
          gstAmount: lockedGrossEarly?.totalTax,
          cgstAmount: lockedGrossEarly?.cgst,
          sgstAmount: lockedGrossEarly?.sgst,
          igstAmount: lockedGrossEarly?.igst,
        });

        if (lockedIsBackend && lockedSnap) {
          taxBreakdown = null;
          gstAmount = lockedSnap.gstAmount;
          cgstAmount = lockedSnap.cgstAmount;
          sgstAmount = lockedSnap.sgstAmount;
          igstAmount = lockedSnap.igstAmount;
          paymentGstSnap = lockedSnap;
          paymentIsInterState = lockedSnap.isInterState;
        } else {
          const snap = await calculateAuthoritativeServiceGst({
            taxableAmount: taxAmountInput,
            vendorId: booking.vendor_id,
            serviceId: serviceId || undefined,
            bookingId: booking.id,
            customerId: effectiveCustomerId,
            addressId: booking.address_id || undefined,
            serviceStyle: serviceStyle || undefined,
            category: serviceCategory || undefined,
          });
          taxBreakdown = null;
          gstAmount = snap.gstAmount;
          cgstAmount = snap.cgstAmount;
          sgstAmount = snap.sgstAmount;
          igstAmount = snap.igstAmount;
          paymentGstSnap = snap;
          paymentIsInterState = snap.isInterState;
        }
      } catch (taxError) {
        console.error('Error calculating tax:', taxError);
        if (isGstConfigurationError(taxError) || isGstPlaceOfSupplyError(taxError)) {
          throw taxError;
        }
        // Do not treat GST=0 as "no lock" — only recalculate fallback when lock was never backend-authoritative.
        const hadBackendZeroLock =
          lockedGrossEarly &&
          isBackendAuthoritativeGstLock({
            gstAuthority: lockedGrossEarly.gstAuthority,
            lockedSnap: readAuthoritativeGst({
              gstAmount: lockedGrossEarly.totalTax,
              cgstAmount: lockedGrossEarly.cgst,
              sgstAmount: lockedGrossEarly.sgst,
              igstAmount: lockedGrossEarly.igst,
              isInterState: lockedGrossEarly.isInterState,
              taxableAmount: lockedGrossEarly.subtotalAfterDiscounts,
            }),
            gstAmount: lockedGrossEarly.totalTax,
            cgstAmount: lockedGrossEarly.cgst,
            sgstAmount: lockedGrossEarly.sgst,
            igstAmount: lockedGrossEarly.igst,
          });
        if (!hadBackendZeroLock && (!lockedGrossEarly || lockedGrossEarly.totalTax <= 0.009)) {
          throw taxError;
        }
        if (hadBackendZeroLock && lockedGrossEarly) {
          gstAmount = lockedGrossEarly.totalTax;
          cgstAmount = lockedGrossEarly.cgst;
          sgstAmount = lockedGrossEarly.sgst;
          igstAmount = lockedGrossEarly.igst;
          paymentGstSnap = readAuthoritativeGst({
            gstAmount: lockedGrossEarly.totalTax,
            cgstAmount: lockedGrossEarly.cgst,
            sgstAmount: lockedGrossEarly.sgst,
            igstAmount: lockedGrossEarly.igst,
            isInterState: lockedGrossEarly.isInterState,
            taxableAmount: lockedGrossEarly.subtotalAfterDiscounts,
          });
          paymentIsInterState = paymentGstSnap?.isInterState ?? false;
        } else {
          gstAmount = 0;
        }
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

      let feesTotal = platformFee + convenienceFee + deliveryFee + packagingFee;

      const lockedGross = lockedGrossEarly ?? resolveLockedBookingGrossFromNotes(booking.notes);
      const walletIntent = useWallet ? Math.max(0, Number(walletAmount) || 0) : 0;
      // Client sends amount=0 when wallet covers all cash; amount>0 is the Razorpay remainder after wallet.
      const walletOnlyPayment = amount <= 0.009 && walletIntent > 0;
      // Prefer locked all-in snapshot whenever present (wallet or not) so GST/fees match create-time.
      const useLockedGross =
        lockedGross != null && lockedGross.grossTotal > 0;

      let totalAmount: number;
      if (useLockedGross) {
        totalAmount = lockedGross!.grossTotal;
        const lockedGst = readAuthoritativeGst({
          gstAmount: lockedGross!.totalTax,
          cgstAmount: lockedGross!.cgst,
          sgstAmount: lockedGross!.sgst,
          igstAmount: lockedGross!.igst,
          isInterState: (lockedGross as { isInterState?: boolean }).isInterState,
          taxableAmount: lockedGross!.subtotalAfterDiscounts,
        });
        if (lockedGst.splitAvailable) {
          gstAmount = lockedGst.gstAmount;
          cgstAmount = lockedGst.cgstAmount;
          sgstAmount = lockedGst.sgstAmount;
          igstAmount = lockedGst.igstAmount;
          paymentGstSnap = lockedGst;
          paymentIsInterState = lockedGst.isInterState;
        }
        platformFee = lockedGross!.platformFee;
        convenienceFee = lockedGross!.convenienceFee;
        deliveryFee = lockedGross!.deliveryFee;
        feesTotal = platformFee + convenienceFee + deliveryFee + packagingFee;
        console.log(
          `[PAYMENT] Locked gross from financial meta: gross=₹${totalAmount}, walletIntent=₹${walletIntent}, source=${lockedGross!.source}`
        );
      } else {
        // Total amount including fees (fees are added on top of tax-inclusive request amount)
        totalAmount = amount + gstAmount + feesTotal;
      }

      const useLockedGrossForWallet = useLockedGross && walletIntent > 0;

      // Clients send `amount` as the cash payable AFTER wallet, so a fully-wallet checkout
      // arrives as amount=0 + walletAmount>0 — the wallet slice IS the payable.

      // Nothing to charge at all (100% promo): payments.check_payment_amount_positive
      // forbids a ₹0 row, and there is no money movement to record anyway.
      if (totalAmount <= 0.009 && walletIntent <= 0) {
        console.log('[PAYMENT-CREATE] Zero payable with no wallet slice — skipping payment row');
        return this.success(
          {
            paymentId: null,
            status: 'completed',
            message: 'No payment required (zero payable)',
            isNew: false,
            walletUsed: false,
            walletAmount: 0,
            remainingAmount: 0,
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
          },
          requestId
        );
      }

      let walletDebited = false;
      let remainingAmount = totalAmount;
      let walletDebitedAmount = 0;

      // Wallet debit + payment insert must be atomic (rollback wallet if payment insert fails)
      let payment: any;
      try {
        payment = await withTransaction(async (client) => {
        let walletApplied = 0;
        let roundedRemain = totalAmount;
        let fullyWallet = false;

        if (useWallet && effectiveCustomerId) {
          const wbalRes = await client.query(
            `SELECT COALESCE(balance, 0)::text AS b FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
            [effectiveCustomerId]
          );
          const bal = parseFloat(String(wbalRes.rows[0]?.b ?? '0')) || 0;

          // GST must be collected via Razorpay when wallet is used — never from wallet.
          const split = computeWalletBookingSplit({
            grossTotal: totalAmount,
            walletIntent: useLockedGrossForWallet
              ? walletIntent
              : walletOnlyPayment
                ? walletIntent
                : walletAmount > 0
                  ? Math.min(Number(walletAmount), totalAmount)
                  : totalAmount,
            walletBalance: bal,
            gstAmount,
          });
          const targetDebit = split.walletApplied;
          roundedRemain = split.cashRemainder;
          fullyWallet = split.fullyWallet;

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
            roundedRemain = Math.max(0, Math.round((totalAmount - walletApplied) * 100) / 100);
            fullyWallet =
              walletApplied > 0 && roundedRemain < 0.01 && gstAmount < 0.01;
          }
        }

        // Wallet-only is only valid when there is no GST left for Razorpay.
        if (walletOnlyPayment && gstAmount < 0.01 && walletApplied < walletIntent - 0.009) {
          const insufficientErr: Error & { step?: string } = new Error(
            'Wallet balance is insufficient to cover this booking'
          );
          insufficientErr.step = 'wallet_debit';
          throw insufficientErr;
        }
        if (walletOnlyPayment && gstAmount > 0.009) {
          fullyWallet = false;
        }

        const paymentData: any = {
          booking_id: bookingId, // ✅ bookingId is REQUIRED - booking should already exist
          customer_id: effectiveCustomerId,
          vendor_id: vendorId || booking.vendor_id,
          // check_payment_amount_positive forbids ₹0 rows — for wallet-only payments record the
          // wallet-covered amount; for wallet+Razorpay split record the cash remainder for Razorpay.
          amount: fullyWallet
            ? walletApplied
            : useLockedGrossForWallet
              ? roundedRemain
              : walletOnlyPayment
                ? walletApplied
                : amount,
          currency: 'INR',
          payment_method: fullyWallet ? 'wallet' : (paymentMethod || 'razorpay'),
          payment_status: fullyWallet ? 'completed' : 'pending',
        };
        if (walletApplied > 0) {
          paymentData.wallet_amount_used = walletApplied;
        }
        if (fullyWallet) {
          paymentData.completed_at = new Date().toISOString();
        }

        if (gstAmount > 0) {
          const snapCols = paymentGstSnap
            ? snapshotToPaymentColumns(paymentGstSnap)
            : {
                gst_amount: gstAmount,
                cgst_amount: cgstAmount,
                sgst_amount: sgstAmount,
                igst_amount: igstAmount,
                is_inter_state: paymentIsInterState,
              };
          Object.assign(paymentData, snapCols);
          if (gstRuleId) {
            paymentData.gst_rule_id = gstRuleId;
          }
        }
        
        // Add platform and convenience fees
        if (feesTotal > 0 || useLockedGross) {
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

      // Snapshot the computed breakdown onto the booking (write-once) so booking
      // detail renders GST/fees even if this payment row never completes.
      try {
        await writeBookingFinancialSnapshotIfMissing(String(bookingId), {
          servicePrice: feeBaseAmount,
          vendorDiscount: 0,
          platformDiscount: 0,
          couponDiscount: 0,
          subtotalAfterDiscounts: feeBaseAmount,
          cgst: cgstAmount,
          sgst: sgstAmount,
          igst: igstAmount,
          totalTax: gstAmount,
          platformFee,
          convenienceFee,
          deliveryFee,
          walletAmount: walletDebitedAmount,
          finalPaid: totalAmount,
        });
      } catch (snapshotErr: any) {
        console.warn(
          '[PAYMENT-CREATE] Booking financial snapshot write failed (non-blocking):',
          snapshotErr?.message
        );
      }

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
                (bookingStatusChange as BookingStatusChange).bookingId,
                (bookingStatusChange as BookingStatusChange).from,
                (bookingStatusChange as BookingStatusChange).to as string,
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
          if (payment.booking_id) {
            scheduleBookingStartOtpIfNeeded(String(payment.booking_id), '[PAYMENT-CREATE]');
          }

          // Wallet-only payments never reach Razorpay verify, so record promo/coupon
          // usage here (idempotent for coupons via coupon_usages booking check).
          try {
            const { recordBookingPromotionUsageFromBooking } = await import(
              '../lib/services/booking-promotion-service'
            );
            await recordBookingPromotionUsageFromBooking(String(payment.booking_id));
          } catch (usageErr) {
            console.warn('[PAYMENT-CREATE] wallet-only promotion usage record failed:', usageErr);
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
                (bookingStatusChange as BookingStatusChange).bookingId,
                (bookingStatusChange as BookingStatusChange).from,
                (bookingStatusChange as BookingStatusChange).to as string,
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
          if (payment.booking_id) {
            scheduleBookingStartOtpIfNeeded(String(payment.booking_id), '[PAYMENT-CREATE]');
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
      const gstConfig = isGstConfigurationError(error);
      const gstPlace = isGstPlaceOfSupplyError(error);
      return this.error(
        message,
        gstConfig || gstPlace ? 400 : 500,
        gstPlace
          ? 'GST_PLACE_OF_SUPPLY_UNKNOWN'
          : gstConfig
            ? 'GST_CONFIGURATION_MISSING'
            : 'INTERNAL_ERROR',
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
        let webhookBookingId: string | null = null;
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
          webhookBookingId = payment.booking_id ? String(payment.booking_id) : null;

          await logPaymentStatusChange(
            payment.id,
            oldStatus,
            'completed',
            'webhook',
            event,
            { razorpay_payment_id: payment_id, amount: paymentEntity?.amount }
          );
        });

        const fin = await finalizeCapturedPayment({
          source: 'webhook',
          razorpayOrderId: order_id,
          razorpayPaymentId: payment_id,
        });
        await recordRazorpayWebhookEvent(String(webhookEventId), String(event), fin.paymentId);
        if (fin.outcome === 'fulfilled' && fin.entityType === 'booking' && fin.entityId) {
          bookingStatusChange = {
            bookingId: String(fin.entityId),
            from: fin.previousEntityStatus || null,
            to: 'confirmed',
          };
        }
        bookingToNotify = null;

        // Log booking status change (if any)
        if (bookingStatusChange) {
          await logBookingStatusChange(
            (bookingStatusChange as BookingStatusChange).bookingId,
            (bookingStatusChange as BookingStatusChange).from,
            (bookingStatusChange as BookingStatusChange).to as string,
            'system',
            'system',
            'Payment captured'
          );
        }

        // Notify vendor/customer only after payment confirmation
        if (bookingToNotify) {
          await notifyBookingCreated(bookingToNotify, requestId);
        }
        scheduleBookingStartOtpIfNeeded(webhookBookingId, '[PAYMENTS-WEBHOOK]');

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
   * Legacy verify stub — does NOT perform HMAC signature verification.
   *
   * WARNING: This endpoint must NOT be used for ecommerce or booking checkout flows.
   * Those flows call POST /razorpay/verify-payment which is handled by VerifyPaymentHandler
   * in razorpay.razorpay.ts and performs a full HMAC SHA-256 signature check before
   * updating any order/payment state.
   *
   * This stub is retained only for legacy internal tooling that already validates
   * the Razorpay signature before calling this endpoint. Do not expose this route
   * to any client-facing checkout flow.
   */
  app.post('/payments/verify', async (c) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await c.req.json();

      console.log(`🔐 [PAYMENT-VERIFY-LEGACY] Verifying payment ${razorpay_payment_id} (no HMAC check — use /razorpay/verify-payment for checkout)`);

      if (!razorpay_order_id || !razorpay_payment_id) {
        return c.json({ error: 'Missing required payment details' }, 400);
      }

      // Signature field is accepted but not verified here — use /razorpay/verify-payment for HMAC validation.
      void razorpay_signature;

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

