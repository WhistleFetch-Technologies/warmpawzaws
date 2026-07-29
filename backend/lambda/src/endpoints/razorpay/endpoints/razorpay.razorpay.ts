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
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select, insert, update, withTransaction } from '../../../database/rds-connection';
import { debitCustomerWalletForBookingInTransaction } from '../../../utils/wallet-operations';
import {
  computeWalletBookingSplit,
  resolveLockedBookingGrossFromNotes,
} from '../../../utils/booking-financial-gross';
import {
  resolveExpectedBookingCharge,
  type ExpectedBookingCharge,
} from '../../../utils/booking-charge-enforcement';
import { writeBookingFinancialSnapshotIfMissing } from '../../../utils/booking-financial-snapshot';
import { createHmac, randomUUID } from 'crypto';
import { getRazorpayConfig, getRazorpayAuthHeader, getRazorpayClient, razorpayRequest } from '../../../utils/payments/razorpay-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { DEFAULT_COMMISSION_RATE } from '../../../lib/constants/commission';
import { getVendorTierCommission } from '../../../utils/vendor-tier-commission';
import {
  resolveOrderCommissionByOrderId,
  buildCommissionSnapshot,
  applyOrderCommissionAudit,
} from '../../../utils/resolve-ecommerce-commission-rate';
import { isCommissionConfigurationError } from '../../../utils/commission-configuration-error';
import { writeEcommerceOrderSettlementLedgerRow } from '../../../utils/write-ecommerce-order-settlement';
export { getVendorTierCommission } from '../../../utils/vendor-tier-commission';
import { logBookingStatusChange } from '../../../utils/audit-log';
import { notifyBookingCreated } from '../../../utils/booking-notifications';
import { notifyShopOrderPaid } from '../../../utils/shop-order-notifications';
import {
  discardUnpaidShopOrder,
  isShopOrderPaymentHoldActive,
  isShopOrderPaymentHoldExpired,
} from '../../../utils/shop-payment-hold';
import { assertShopCheckoutPaymentAllowed } from '../../../utils/shop-checkout-payment-flags';
import { PaymentTransactionStatus, BookingPaymentStatus } from '../../constants';
import { resolveLoyaltyBookingKind } from '../../../lib/loyalty-booking-kind';
import { triggerAutoShipment } from '../../../utils/logistics/trigger-auto-shipment';
import { ACTIVE_REFUND_STATUS_FILTER, mapRazorpayRefundEventStatus } from '../../../utils/payments/refund-status';
import { markShopOrderPaymentRefundedIfFull } from '../../../utils/payments/shop-order-refund';
import { reconcileRazorpayRefundWebhook } from '../../../utils/payments/razorpay-refund-webhook-reconcile';
import { ensureBookingStartOtpIfNeeded, scheduleBookingStartOtpIfNeeded } from '../../../utils/booking-start-otp';

// Razorpay configuration is imported from utils

// Type-only helpers (no runtime emit)
type BookingStatusChange = { bookingId: string; from: string | null; to: string | null };

/** Response shape from the public Razorpay IFSC lookup API (fields we read). */
interface RazorpayIfscApiResponse {
  IFSC?: string;
  BANK?: string;
  BRANCH?: string;
  ADDRESS?: string;
  CITY?: string;
  DISTRICT?: string;
  STATE?: string;
  CONTACT?: string;
  IMPS?: boolean;
  NEFT?: boolean;
  RTGS?: boolean;
  UPI?: boolean;
  MICR?: string;
}

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
  const ifscData = await ifscResponse.json() as any;
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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve customer UUID from phone number or return UUID if already provided
 * @param identifier - Phone number or customer UUID
 * @returns Customer UUID or null if not found
 */
async function resolveCustomerId(identifier: string): Promise<string | null> {
  if (!identifier) return null;
  
  // Check if it's already a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    // Verify it exists in database
    const customers = await select('customers', { id: identifier });
    return customers.length > 0 ? customers[0].id : null;
  }
  
  // It's a phone number - normalize and lookup
  try {
    // Normalize phone (remove spaces, ensure +91 prefix for Indian numbers)
    let normalizedPhone = identifier.replace(/\s+/g, '').replace(/^0+/, '');
    if (!normalizedPhone.startsWith('+')) {
      // Assume Indian number if no country code
      if (normalizedPhone.length === 10) {
        normalizedPhone = '+91' + normalizedPhone;
      }
    }
    
    // Try to find customer by phone (try both original and normalized)
    const result = await query(
      `SELECT id FROM customers WHERE phone = $1 OR phone = $2 LIMIT 1`,
      [identifier, normalizedPhone]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    return null;
  } catch (error: any) {
    console.error('[RAZORPAY] Error resolving customer ID from phone:', error.message);
    return null;
  }
}

/**
 * Normalize POST /razorpay/create-order body so wallet top-up is never mistaken for a booking:
 * - Strip null/empty bookingId (JSON often sends bookingId: null)
 * - Alias customer_id / customerID → customerId; purpose / paymentType → type
 * - Normalize wallet type casing
 * - If type is missing but payload is amount + customerId only, set type wallet_topup
 */
function normalizeCreateOrderRequestBody(raw: unknown): Record<string, any> {
  const b =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as Record<string, any>) }
      : {};
  if (b.bookingId === null || b.bookingId === undefined || b.bookingId === '') {
    delete b.bookingId;
  }
  if (b.customerId == null && b.customer_id != null) {
    b.customerId = b.customer_id;
  }
  if (b.customerId == null && (b as any).customerID != null) {
    b.customerId = (b as any).customerID;
  }
  if (
    !b.type &&
    typeof b.purpose === 'string' &&
    b.purpose.trim().toLowerCase() === 'wallet'
  ) {
    b.type = 'wallet_topup';
  }
  if (!b.type && typeof b.paymentType === 'string') {
    b.type = b.paymentType;
  }
  if (!b.type && typeof b.payment_kind === 'string') {
    b.type = b.payment_kind;
  }
  if (typeof b.type === 'string') {
    const t = b.type.trim().toLowerCase().replace(/-/g, '_');
    if (t === 'wallet_topup' || t === 'wallet') b.type = 'wallet_topup';
    else if (t === 'pharmacy_order') b.type = 'pharmacy_order';
    else if (t === 'ecommerce_order' || t === 'ecommerce' || t === 'shop_order') b.type = 'ecommerce_order';
    else if (t === 'diagnostics') b.type = 'diagnostics';
    else if (t === 'booking_prepaid') b.type = 'booking_prepaid';
  }
  const cid =
    b.customerId != null && String(b.customerId).trim() !== ''
      ? String(b.customerId).trim()
      : '';
  const amtNum =
    b.amount != null && b.amount !== '' ? Number(b.amount) : NaN;
  const normalizedType =
    typeof b.type === 'string' ? String(b.type).trim().toLowerCase().replace(/-/g, '_') : '';
  const hasPharmacyOrder =
    normalizedType === 'pharmacy_order' &&
    b.orderId != null &&
    String(b.orderId).trim() !== '';
  const hasEcommerceOrder =
    normalizedType === 'ecommerce_order' &&
    b.orderId != null &&
    String(b.orderId).trim() !== '';
  const hasVendor = b.vendorId != null && String(b.vendorId).trim() !== '';
  const hasBooking =
    b.bookingId != null && String(b.bookingId).trim() !== '';
  if (
    !b.type &&
    cid &&
    Number.isFinite(amtNum) &&
    amtNum > 0 &&
    !hasBooking &&
    !hasPharmacyOrder &&
    !hasEcommerceOrder &&
    !hasVendor
  ) {
    b.type = 'wallet_topup';
  }
  return b;
}

// ============================================================================
// RAZORPAY HANDLERS
// ============================================================================

class CreateRazorpayOrderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = normalizeCreateOrderRequestBody(this.parseBody(context.event));
      const { bookingId, orderId: requestOrderId, amount, currency = 'INR', customerId, vendorId, type } = body;

      const isPharmacyOrder = type === 'pharmacy_order';
      const isEcommerceOrder = type === 'ecommerce_order';
      const pharmacyOrderId = isPharmacyOrder ? String(requestOrderId || '').trim() : '';
      const ecommerceOrderId = isEcommerceOrder ? String(requestOrderId || '').trim() : '';
      const isDiagnosticsOrder = type === 'diagnostics';
      const isBookingPrepaid = type === 'booking_prepaid';
      const isWalletTopupExplicit = type === 'wallet_topup';
      // Minimal/legacy payloads: amount + customerId without booking/pharmacy (matches old customer-web body)
      const isWalletTopupInferred =
        !isPharmacyOrder &&
        !isEcommerceOrder &&
        !isDiagnosticsOrder &&
        !isBookingPrepaid &&
        !isWalletTopupExplicit &&
        (type == null || type === '') &&
        !body.vendorId &&
        customerId != null &&
        customerId !== '' &&
        amount != null &&
        !bookingId &&
        !pharmacyOrderId &&
        !ecommerceOrderId;
      const isWalletTopup = isWalletTopupExplicit || isWalletTopupInferred;
      if (isPharmacyOrder) {
        if (!pharmacyOrderId || amount == null) {
          return this.error('orderId and amount are required for pharmacy_order', 400);
        }
      } else if (isEcommerceOrder) {
        if (!ecommerceOrderId || amount == null) {
          return this.error('orderId and amount are required for ecommerce_order', 400);
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
      } else if (isWalletTopup) {
        const cid =
          body.customerId != null && String(body.customerId).trim() !== ''
            ? String(body.customerId).trim()
            : '';
        const amtNum =
          body.amount != null && body.amount !== '' ? Number(body.amount) : NaN;
        if (!cid) {
          return this.error('Missing required fields for wallet_topup: customerId', 400);
        }
        if (!Number.isFinite(amtNum) || amtNum <= 0) {
          return this.error('Invalid amount for wallet_topup (must be a positive number)', 400);
        }
      } else {
        // ✅ bookingId is REQUIRED for booking orders (booking created before payment)
        const missing = ['bookingId', 'amount'].filter((f) => !body[f]);
        if (missing.length > 0) {
          return this.error(`Missing required fields: ${missing.join(', ')}`, 400);
        }
      }

      console.log('[RAZORPAY-CREATE-ORDER] Starting order creation:', {
        type: type || 'booking',
        bookingId,
        pharmacyOrderId,
        ecommerceOrderId,
        amount,
        customerId,
      });

      let chargeAmount = Number(amount);

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
        
        // ✅ FIX: Resolve customerId from phone number if provided, otherwise use order.customer_id
        if (customerId) {
          const resolvedId = await resolveCustomerId(customerId);
          if (resolvedId) {
            customerIdFinal = resolvedId;
          } else {
            // If resolution fails, fall back to order.customer_id
            customerIdFinal = order.customer_id;
            console.warn('[RAZORPAY-CREATE-ORDER] Could not resolve customerId from phone, using order.customer_id');
          }
        } else {
          customerIdFinal = order.customer_id;
        }
        
        vendorIdFinal = order.pharmacy_id;
        const vendorResult = await select('vendors', { id: vendorIdFinal });
        vendor = vendorResult.length > 0 ? vendorResult[0] : null;
        const shortId = String(pharmacyOrderId).replace(/-/g, '').substring(0, 32);
        receipt = `po_${shortId}`;
        notes = { pharmacyOrderId: String(pharmacyOrderId), customerId: customerIdFinal, vendorId: vendorIdFinal };
      } else if (isEcommerceOrder) {
        const orderResult = await Promise.race([
          select('orders', { id: ecommerceOrderId }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 5000)),
        ]);
        if (!orderResult || orderResult.length === 0) {
          return this.error('Order not found', 404);
        }
        const shopOrder = orderResult[0];
        const payStatus = String(shopOrder.payment_status || 'pending').toLowerCase();
        if (payStatus === 'paid' || payStatus === 'completed') {
          return this.error('Order is already paid', 400);
        }
        const orderSt = String(shopOrder.order_status || '').toLowerCase();
        if (orderSt === 'cancelled' || ['failed', 'expired'].includes(payStatus)) {
          return this.error('Order payment window has expired or order was cancelled. Please place a new order.', 410);
        }
        if (isShopOrderPaymentHoldExpired(shopOrder)) {
          await discardUnpaidShopOrder(String(shopOrder.id), 'payment_window_expired', {
            paymentStatus: 'expired',
          });
          return this.error('Payment window expired. Please place a new order.', 410);
        }
        const pm = String(shopOrder.payment_method || '').toLowerCase();
        if (pm === 'cod' || pm === 'cash_on_delivery') {
          return this.error('This order uses cash on delivery; online payment is not required.', 400);
        }

        const walletApplied = Math.round((parseFloat(String(shopOrder.wallet_amount_applied ?? 0)) || 0) * 100) / 100;
        const shopWalletGuard = assertShopCheckoutPaymentAllowed({
          paymentMethod: shopOrder.payment_method,
          walletAmountApplied: walletApplied,
        });
        if (!shopWalletGuard.ok) {
          return this.error(shopWalletGuard.error, shopWalletGuard.status);
        }

        if (customerId) {
          const resolvedId = await resolveCustomerId(customerId);
          if (resolvedId) {
            customerIdFinal = resolvedId;
            if (
              shopOrder.customer_id &&
              String(shopOrder.customer_id) !== String(customerIdFinal)
            ) {
              return this.error('Order does not belong to this customer', 403);
            }
          } else {
            customerIdFinal = shopOrder.customer_id;
            console.warn('[RAZORPAY-CREATE-ORDER] Could not resolve customerId from phone, using order.customer_id');
          }
        } else {
          customerIdFinal = shopOrder.customer_id;
        }

        if (!customerIdFinal) {
          return this.error('customerId is required for ecommerce_order', 400);
        }

        vendorIdFinal = shopOrder.vendor_id || '';
        if (vendorIdFinal) {
          const vendorResult = await select('vendors', { id: vendorIdFinal });
          vendor = vendorResult.length > 0 ? vendorResult[0] : null;
        } else {
          vendor = null;
        }

        chargeAmount = Math.round(
          ((parseFloat(String(shopOrder.total_amount ?? 0)) || 0) - walletApplied) * 100
        ) / 100;
        if (chargeAmount < 0) chargeAmount = 0;
        // Fully covered by wallet — mark order as paid without Razorpay and surface to vendor
        if (chargeAmount <= 0) {
          // @ts-expect-error pre-existing broken relative path (src/endpoints/razorpay/database does not exist; real module is ../../../database/rds-connection) — left unchanged to avoid altering esbuild bundling/runtime; needs a real fix
          await import('../../database/rds-connection').then(({ query: dbQuery }) =>
            dbQuery(
              `UPDATE orders SET
                 payment_status = 'paid',
                 order_status = CASE WHEN order_status = 'pending_payment' THEN 'pending' ELSE order_status END,
                 payment_hold_expires_at = NULL,
                 updated_at = NOW()
               WHERE id = $1`,
              [shopOrder.id]
            )
          ).catch(() => {});
          void notifyShopOrderPaid(String(shopOrder.id)).catch((e) =>
            console.warn('[RAZORPAY-CREATE-ORDER] notifyShopOrderPaid (wallet-full) failed:', e)
          );
          return this.success({ fullyCoveredByWallet: true, orderId: shopOrder.id });
        }
        if (amount != null) {
          const clientAmt = Number(amount);
          if (Number.isFinite(clientAmt) && Math.abs(clientAmt - chargeAmount) > 0.01) {
            console.warn('[RAZORPAY-CREATE-ORDER] Client amount differs from order total', {
              clientAmt,
              chargeAmount,
              ecommerceOrderId,
            });
          }
        }

        const shortId = String(ecommerceOrderId).replace(/-/g, '').substring(0, 32);
        receipt = `eco_${shortId}`;
        notes = {
          orderId: String(ecommerceOrderId),
          order_type: 'ecommerce',
          customerId: customerIdFinal,
          vendorId: vendorIdFinal || '',
        };
      } else if (isDiagnosticsOrder) {
        // ✅ FIX: Resolve customerId from phone number if needed
        if (customerId) {
          const resolvedId = await resolveCustomerId(customerId);
          if (!resolvedId) {
            return this.error(`Customer not found for identifier: ${customerId}`, 404);
          }
          customerIdFinal = resolvedId;
        } else {
          return this.error('customerId is required for diagnostics order', 400);
        }
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
        // ✅ FIX: Resolve customerId from phone number if needed
        if (customerId) {
          const resolvedId = await resolveCustomerId(customerId);
          if (!resolvedId) {
            return this.error(`Customer not found for identifier: ${customerId}`, 404);
          }
          customerIdFinal = resolvedId;
        } else {
          return this.error('customerId is required for booking_prepaid', 400);
        }
        vendorIdFinal = vendorId;
        const vendorResult = await Promise.race([
          select('vendors', { id: vendorIdFinal }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Vendor query timeout')), 5000)),
        ]);
        vendor = vendorResult.length > 0 ? vendorResult[0] : null;
        const shortId = String(Date.now()).replace(/-/g, '').substring(0, 32);
        receipt = `bk_pre_${shortId}`;
        notes = { type: 'booking_prepaid', customerId: customerIdFinal, vendorId: vendorIdFinal };
      } else if (isWalletTopup) {
        if (customerId) {
          const resolvedId = await resolveCustomerId(customerId);
          if (!resolvedId) {
            return this.error(`Customer not found for identifier: ${customerId}`, 404);
          }
          customerIdFinal = resolvedId;
        } else {
          return this.error('customerId is required for wallet_topup', 400);
        }
        vendor = null;
        vendorIdFinal = '';
        const shortId = String(Date.now()).replace(/-/g, '').substring(0, 32);
        receipt = `wal_${shortId}`;
        notes = { type: 'wallet_topup', customerId: customerIdFinal };
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
        
        // ✅ FIX: Resolve customerId from phone number if provided, otherwise use booking.customer_id
        if (customerId) {
          const resolvedId = await resolveCustomerId(customerId);
          if (resolvedId) {
            customerIdFinal = resolvedId;
          } else {
            // If resolution fails, fall back to booking.customer_id
            customerIdFinal = booking.customer_id;
            console.warn('[RAZORPAY-CREATE-ORDER] Could not resolve customerId from phone, using booking.customer_id');
          }
        } else {
          customerIdFinal = booking.customer_id;
        }
        
        vendorIdFinal = booking.vendor_id;
        const shortBookingId = bookingId.replace(/-/g, '').substring(0, 32);
        receipt = `bk_${shortBookingId}`;
        notes = { bookingId, customerId: customerIdFinal, vendorId: vendorIdFinal };
      }

      // ✅ Wallet + orphan payment row when the client never called /payments/create (split-pay gap).
      // If an orphan pending row already exists, /payments/create already debited — do nothing here.
      const useWalletCreateOrder =
        body.useWallet === true ||
        body.useWallet === 'true' ||
        String(body.useWallet || '').toLowerCase() === 'true';
      let walletAmountCreateOrder = Math.max(
        0,
        parseFloat(String(body.walletAmount ?? body.wallet_amount ?? '0')) || 0
      );
      if (
        booking &&
        useWalletCreateOrder &&
        walletAmountCreateOrder <= 0.009 &&
        customerIdFinal
      ) {
        const grossBk =
          Math.round((parseFloat(String(booking.total_amount ?? booking.amount ?? 0)) || 0) * 100) / 100;
        if (grossBk > 0) {
          walletAmountCreateOrder = grossBk;
        }
      }
      if (
        booking &&
        bookingId &&
        !isPharmacyOrder &&
        !isEcommerceOrder &&
        !isDiagnosticsOrder &&
        !isBookingPrepaid &&
        !isWalletTopup &&
        useWalletCreateOrder &&
        walletAmountCreateOrder > 0.009 &&
        customerIdFinal
      ) {
        let walletFullyPaidBooking = false;
        try {
          await withTransaction(async (client) => {
            const orphan = await client.query(
              `SELECT id FROM payments
               WHERE booking_id = $1::uuid AND payment_status = 'pending' AND razorpay_order_id IS NULL
               ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
              [String(bookingId)]
            );
            if (orphan.rows.length > 0) {
              return;
            }
            const lockedGross = resolveLockedBookingGrossFromNotes(booking.notes);
            const grossFromBooking =
              Math.round((parseFloat(String(booking.total_amount ?? booking.amount ?? 0)) || 0) * 100) / 100;
            // Prefer locked all-in snapshot — booking.total_amount may already be cash-only/GST.
            const gross =
              lockedGross && lockedGross.grossTotal > 0
                ? lockedGross.grossTotal
                : grossFromBooking;
            const gstForWallet = lockedGross?.totalTax ?? 0;
            const walletIntentFromMeta =
              lockedGross && lockedGross.walletAmount > 0.009 ? lockedGross.walletAmount : 0;
            const balRes = await client.query(
              `SELECT COALESCE(balance, 0)::text AS b FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
              [String(customerIdFinal)]
            );
            const bal = parseFloat(String(balRes.rows[0]?.b ?? '0')) || 0;
            const split = computeWalletBookingSplit({
              grossTotal: gross,
              walletIntent: Math.max(walletAmountCreateOrder, walletIntentFromMeta),
              walletBalance: bal,
              gstAmount: gstForWallet,
            });
            const cap = split.walletApplied;
            if (cap <= 0.009) return;
            const idem = `rz-create-order-wallet-${String(bookingId)}`;
            const deb = await debitCustomerWalletForBookingInTransaction(client, {
              customerId: String(customerIdFinal),
              bookingId: String(bookingId),
              amount: Math.round(cap * 100) / 100,
              idempotencyKey: idem,
            });
            if (!deb || (deb.debited ?? 0) <= 0.009) return;
            const orphan2 = await client.query(
              `SELECT id FROM payments
               WHERE booking_id = $1::uuid AND payment_status = 'pending' AND razorpay_order_id IS NULL
               ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
              [String(bookingId)]
            );
            if (orphan2.rows.length > 0) return;
            const colsRes = await client.query<{ column_name: string }>(
              `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments'`
            );
            const ec = new Set(colsRes.rows.map((r) => r.column_name));
            const payAmount =
              gross > 0 ? gross : Math.round((Number(amount) + (deb.debited ?? 0)) * 100) / 100;
            const pdata: Record<string, unknown> = {
              booking_id: bookingId,
              customer_id: customerIdFinal,
              vendor_id: booking.vendor_id,
              amount: payAmount,
              currency: 'INR',
              payment_method: 'razorpay',
              payment_status: 'pending',
            };
            const cols = Object.keys(pdata).filter((k) => ec.has(k));
            if (cols.length < 5) return;
            const vals = cols.map((k) => pdata[k]);
            const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
            await client.query(`INSERT INTO payments (${cols.join(', ')}) VALUES (${ph})`, vals);
            const paidW = Math.round((deb.debited ?? 0) * 100) / 100;
            const razorpayRemainRupee = Math.round((Number(amount) || 0) * 100) / 100;
            // Fully paid via wallet only when GST is zero (GST must go via Razorpay).
            if (gross > 0 && gstForWallet < 0.01 && paidW + 0.02 >= gross) {
              await client.query(
                `UPDATE bookings SET payment_status = 'paid', status = CASE WHEN status = 'pending_payment' THEN 'confirmed' ELSE status END, updated_at = NOW() WHERE id = $1::uuid`,
                [String(bookingId)]
              );
              walletFullyPaidBooking = true;
            }
            if (razorpayRemainRupee < 0.01 && gross > 0 && paidW + 0.02 >= gross) {
              await client.query(
                `UPDATE payments SET payment_status = 'completed', payment_method = 'wallet', updated_at = NOW()
                 WHERE id = (SELECT id FROM payments WHERE booking_id = $1::uuid ORDER BY created_at DESC LIMIT 1)`,
                [String(bookingId)]
              );
            }
          });

          // Wallet fully covered the booking — Razorpay verify will never run, so record
          // promo/coupon usage now (idempotent for coupons via coupon_usages booking check).
          if (walletFullyPaidBooking) {
            scheduleBookingStartOtpIfNeeded(String(bookingId), '[RAZORPAY-CREATE-ORDER]');
            Promise.resolve()
              .then(async () => {
                const { recordBookingPromotionUsageFromBooking } = await import(
                  '../../../lib/services/booking-promotion-service'
                );
                await recordBookingPromotionUsageFromBooking(String(bookingId));
              })
              .catch((err) => {
                console.warn('[RAZORPAY-CREATE-ORDER] wallet-only promotion usage record failed:', err);
              });
          }
        } catch (e: any) {
          console.error('[RAZORPAY-CREATE-ORDER] wallet slice + orphan payment failed:', e?.message || e);
          return this.error(
            e?.message || 'Could not apply wallet balance to this booking. Check your wallet balance and try again.',
            400
          );
        }
      }

      // Wallet covered full booking and client sent ₹0 Razorpay remainder — do not call Razorpay with 0 paise.
      if (
        booking &&
        bookingId &&
        !isPharmacyOrder &&
        !isEcommerceOrder &&
        !isDiagnosticsOrder &&
        !isBookingPrepaid &&
        !isWalletTopup &&
        chargeAmount < 0.01
      ) {
        const paidCheck = await query(
          `SELECT payment_status::text AS ps FROM bookings WHERE id = $1::uuid LIMIT 1`,
          [String(bookingId)]
        );
        const ps = String(paidCheck.rows?.[0]?.ps || '').toLowerCase();
        if (ps === 'paid') {
          return this.success({
            orderId: 'wallet-only',
            amount: 0,
            currency: currency || 'INR',
            keyId: config.keyId,
            paidByWallet: true,
          });
        }
      }

      // ✅ DEFENSE-IN-DEPTH: never trust the client amount for booking payments.
      // Clients that skip /payments/create (which computes GST + platform fees) used to
      // get charged exactly what they sent — see prod booking 6b49e9bd (base price, no GST).
      // Floor-only: raise under-payments to the server-computed payable; never lower the
      // client amount (it may legitimately include components we cannot see here).
      // Fail OPEN on errors — this must not block payments.
      let enforcedCharge: ExpectedBookingCharge | null = null;
      let chargeWasEnforced = false;
      if (
        booking &&
        bookingId &&
        !isPharmacyOrder &&
        !isEcommerceOrder &&
        !isDiagnosticsOrder &&
        !isBookingPrepaid &&
        !isWalletTopup &&
        String(booking.payment_status || '').toLowerCase() !== 'paid'
      ) {
        try {
          enforcedCharge = await resolveExpectedBookingCharge({
            bookingId: String(bookingId),
            booking,
          });
          if (enforcedCharge && enforcedCharge.expectedCash - chargeAmount > 1) {
            console.warn(
              '[RAZORPAY-CREATE-ORDER] Client amount below server-computed payable — enforcing server amount',
              {
                bookingId,
                clientAmount: chargeAmount,
                expectedCash: enforcedCharge.expectedCash,
                grossTotal: enforcedCharge.grossTotal,
                baseAmount: enforcedCharge.baseAmount,
                gstTotal: enforcedCharge.gst?.total ?? 0,
                feesTotal: enforcedCharge.feesTotal,
                walletPaid: enforcedCharge.walletPaid,
                completedNonWalletPaid: enforcedCharge.completedNonWalletPaid,
                source: enforcedCharge.source,
              }
            );
            chargeAmount = enforcedCharge.expectedCash;
            chargeWasEnforced = true;
          } else if (enforcedCharge && chargeAmount - enforcedCharge.expectedCash > 1) {
            // Client sent more than we can account for — keep it, but leave a trace.
            console.warn('[RAZORPAY-CREATE-ORDER] Client amount above server-computed payable', {
              bookingId,
              clientAmount: chargeAmount,
              expectedCash: enforcedCharge.expectedCash,
              source: enforcedCharge.source,
            });
          }
        } catch (enforceError: any) {
          console.error(
            '[RAZORPAY-CREATE-ORDER] Booking charge enforcement skipped (fail-open):',
            enforceError?.message || enforceError
          );
        }
      }

      const orderData: any = {
        amount: Math.round(Number(chargeAmount) * 100),
        currency: currency,
        receipt,
        notes,
      };

      // If vendor has linked account and marketplace mode enabled, add transfers.
      // E-commerce orders are EXCLUDED: they settle via the batch settlement ledger
      // (ecommerce_order_settlements / ecommerce-settlement-processor.ts) instead of an
      // instant per-order Razorpay Route transfer, because admin/platform-funded promotions
      // can make a single order's platform net negative — that can only be funded by
      // pooling commission across many orders, which a per-order transfer cannot do.
      // See Ecommerce Settlement Engine plan §1/§5. Commission is still snapshotted below
      // for the settlement job to read at payment-verify time.
      if (vendor?.razorpay_account_id && vendor.bank_verified && !isEcommerceOrder) {
        const amt = Number(chargeAmount);
        let tierCommission = DEFAULT_COMMISSION_RATE;
        let commissionAmountPaise: number;

        try {
          tierCommission = await Promise.race([
            getVendorTierCommission(vendorIdFinal),
            new Promise<number>((resolve) =>
              setTimeout(() => resolve(DEFAULT_COMMISSION_RATE), 2000)
            ),
          ]);
        } catch {
          tierCommission = DEFAULT_COMMISSION_RATE;
        }
        commissionAmountPaise = Math.round((amt * tierCommission / 100) * 100);

        const vendorShare = Math.round(amt * 100) - commissionAmountPaise;
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
      } else if (isEcommerceOrder && ecommerceOrderId && vendorIdFinal) {
        // Snapshot commission now so the settlement job has it even though no Route
        // transfer happens here.
        try {
          const resolved = await resolveOrderCommissionByOrderId(
            vendorIdFinal,
            String(ecommerceOrderId)
          );
          const snapshot = buildCommissionSnapshot(resolved);
          await query(
            `UPDATE orders SET commission_snapshot = $2::jsonb, updated_at = NOW() WHERE id = $1::uuid`,
            [ecommerceOrderId, JSON.stringify(snapshot)]
          );
        } catch (snapErr) {
          console.warn('[RAZORPAY-CREATE-ORDER] commission_snapshot update skipped:', snapErr);
        }
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
          [pharmacyOrderId, customerIdFinal, vendorIdFinal, razorpayOrder.id, Number(chargeAmount), currency, 'razorpay', 'pending']
        );
      } else if (isEcommerceOrder) {
        const existingPayment = await query(
          `SELECT id FROM payments WHERE order_id = $1::uuid AND payment_status = 'pending' AND razorpay_order_id IS NULL ORDER BY created_at DESC LIMIT 1`,
          [ecommerceOrderId]
        );

        if (existingPayment.rows.length > 0) {
          console.log(
            `[RAZORPAY-CREATE-ORDER] Reusing existing orphan payment ${existingPayment.rows[0].id} for order ${ecommerceOrderId}`
          );
          await query(
            `UPDATE payments SET razorpay_order_id = $1, amount = $2, currency = $3, updated_at = NOW() WHERE id = $4`,
            [razorpayOrder.id, Number(chargeAmount), currency, existingPayment.rows[0].id]
          );
        } else {
          await insert('payments', {
            booking_id: null,
            order_id: ecommerceOrderId,
            customer_id: customerIdFinal,
            vendor_id: vendorIdFinal || null,
            razorpay_order_id: razorpayOrder.id,
            amount: Number(chargeAmount),
            currency: currency,
            payment_method: 'razorpay',
            payment_status: 'pending',
          });
        }
      } else if (isDiagnosticsOrder) {
        // Diagnostics: pay-first — persist payments row (booking_id set on POST /bookings/create after verify).
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
      } else if (isWalletTopup) {
        await insert('payments', {
          booking_id: null,
          customer_id: customerIdFinal,
          vendor_id: null,
          razorpay_order_id: razorpayOrder.id,
          amount: Number(amount),
          currency: currency,
          payment_method: 'razorpay',
          payment_status: 'pending',
        });
      } else {
        // ✅ bookingId is REQUIRED - booking should already exist
        // ✅ FIX: Upsert – if an orphan payment already exists for this booking (from /payments/create),
        //    update it with the razorpay_order_id instead of creating a duplicate.
        const existingPayment = await query(
          `SELECT id FROM payments WHERE booking_id = $1 AND payment_status = 'pending' AND razorpay_order_id IS NULL ORDER BY created_at DESC LIMIT 1`,
          [bookingId]
        );

        if (existingPayment.rows.length > 0) {
          console.log(`[RAZORPAY-CREATE-ORDER] Reusing existing orphan payment ${existingPayment.rows[0].id} for booking ${bookingId}`);
          await query(
            `UPDATE payments SET razorpay_order_id = $1, amount = $2, currency = $3, updated_at = NOW() WHERE id = $4`,
            [razorpayOrder.id, Number(chargeAmount), currency, existingPayment.rows[0].id]
          );
        } else {
          const paymentRow: Record<string, unknown> = {
            booking_id: bookingId,
            customer_id: customerIdFinal,
            vendor_id: vendorIdFinal,
            razorpay_order_id: razorpayOrder.id,
            amount: Number(chargeAmount),
            currency: currency,
            payment_method: 'razorpay',
            payment_status: 'pending',
          };
          // Enforcement recomputed GST + fees (client skipped /payments/create) — persist the
          // breakdown so reporting/settlement sees the tax component and refunds can exclude
          // fees (columns from migrations 410/510; guarded in case a schema lacks them).
          if (chargeWasEnforced && enforcedCharge?.source === 'computed' && (enforcedCharge.gst || enforcedCharge.fees)) {
            try {
              const colsRes = await query(
                `SELECT column_name FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'payments'
                   AND column_name IN ('gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'gst_rule_id',
                                       'platform_fee', 'convenience_fee', 'total_amount', 'fee_breakdown')`
              );
              const gstCols = new Set(colsRes.rows.map((r: { column_name: string }) => r.column_name));
              if (enforcedCharge.gst) {
                if (gstCols.has('gst_amount')) paymentRow.gst_amount = enforcedCharge.gst.total;
                if (gstCols.has('cgst_amount')) paymentRow.cgst_amount = enforcedCharge.gst.cgst;
                if (gstCols.has('sgst_amount')) paymentRow.sgst_amount = enforcedCharge.gst.sgst;
                if (gstCols.has('igst_amount')) paymentRow.igst_amount = enforcedCharge.gst.igst;
                if (gstCols.has('gst_rule_id') && enforcedCharge.gst.ruleId) {
                  paymentRow.gst_rule_id = enforcedCharge.gst.ruleId;
                }
              }
              if (enforcedCharge.fees) {
                if (gstCols.has('platform_fee')) paymentRow.platform_fee = enforcedCharge.fees.platformFee;
                if (gstCols.has('convenience_fee')) paymentRow.convenience_fee = enforcedCharge.fees.convenienceFee;
                if (gstCols.has('fee_breakdown')) paymentRow.fee_breakdown = JSON.stringify(enforcedCharge.fees);
              }
              if (gstCols.has('total_amount')) paymentRow.total_amount = enforcedCharge.grossTotal;
            } catch (gstColErr: any) {
              console.warn('[RAZORPAY-CREATE-ORDER] Skipping GST/fee columns on payment row:', gstColErr?.message);
            }
          }
          await insert('payments', paymentRow);

          // Snapshot the enforced breakdown onto the booking (write-once) so booking
          // detail renders GST/fees without depending on this payment row's fate.
          if (chargeWasEnforced && enforcedCharge?.source === 'computed') {
            try {
              await writeBookingFinancialSnapshotIfMissing(String(bookingId), {
                servicePrice: enforcedCharge.baseAmount,
                vendorDiscount: 0,
                platformDiscount: 0,
                couponDiscount: 0,
                subtotalAfterDiscounts: enforcedCharge.baseAmount,
                cgst: enforcedCharge.gst?.cgst ?? 0,
                sgst: enforcedCharge.gst?.sgst ?? 0,
                igst: enforcedCharge.gst?.igst ?? 0,
                totalTax: enforcedCharge.gst?.total ?? 0,
                platformFee: enforcedCharge.fees?.platformFee ?? 0,
                convenienceFee: enforcedCharge.fees?.convenienceFee ?? 0,
                deliveryFee: enforcedCharge.fees?.deliveryFee ?? 0,
                walletAmount: enforcedCharge.walletPaid,
                finalPaid: enforcedCharge.expectedCash,
              });
            } catch (snapshotErr: any) {
              console.warn(
                '[RAZORPAY-CREATE-ORDER] Booking financial snapshot write failed (non-blocking):',
                snapshotErr?.message
              );
            }
          }
        }
      }

      return this.success({
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount / 100,
        currency: razorpayOrder.currency,
        keyId: config.keyId,
        // Signals the client that the server raised the amount to include GST/fees
        // (clients must always render the returned amount, not their own).
        ...(chargeWasEnforced ? { amountEnforced: true } : {}),
      });
    } catch (error: any) {
      if (isCommissionConfigurationError(error)) {
        return this.error(error.message, 422);
      }
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

        // ✅ ROLLBACK: booking delete or ecommerce cancel + remove payment row
        let shopOrderToDiscard: string | null = null;
        try {
          await withTransaction(async (client) => {
            const { rows: payments } = await client.query(
              `SELECT booking_id, order_id FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
              [razorpay_order_id]
            );

            if (payments.length > 0) {
              const row = payments[0];
              if (row.order_id && !row.booking_id) {
                shopOrderToDiscard = String(row.order_id);
              } else if (row.booking_id) {
                await client.query(`DELETE FROM bookings WHERE id = $1`, [row.booking_id]);
                console.log('[PAYMENT-VERIFY] ❌ Payment failed - booking rolled back:', row.booking_id);
              }
            }

            await client.query(`DELETE FROM payments WHERE razorpay_order_id = $1`, [razorpay_order_id]);
            console.log('[PAYMENT-VERIFY] ❌ Payment failed - payment record deleted');
          });
        } catch (rollbackError: any) {
          console.error('[PAYMENT-VERIFY] Error during rollback:', rollbackError);
        }

        if (shopOrderToDiscard) {
          await discardUnpaidShopOrder(shopOrderToDiscard, 'payment_signature_invalid', {
            paymentStatus: 'failed',
          }).catch((e) => console.warn('[PAYMENT-VERIFY] discardUnpaidShopOrder failed:', e));
        }

        return this.error('Invalid payment signature. Payment could not be verified.', 400);
      }

      // ✅ Payment signature is valid - update booking and payment status
      let bookingToNotify: string | null = null;
      let bookingStatusChange: { bookingId: string; from: string | null; to: string | null } | null = null;
      let ecommerceOrderForShipment: string | null = null;
      let ecommerceOrderToNotify: string | null = null;
      /** Set when ecommerce paid — commission audit runs after commit (pool query must not run under FOR UPDATE). */
      let ecommerceVendorIdForCommission: string | null = null;

      const result = await withTransaction(async (client) => {
        // ✅ SQL: Look up payment record with FOR UPDATE lock
        const { rows: payments } = await client.query(
          `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
          [razorpay_order_id]
        );

        if (payments.length === 0) {
          console.error('[PAYMENT-VERIFY] Payment record not found for order:', razorpay_order_id);
          throw new Error('Payment record not found. Please contact support with your order ID.');
        }

        const payment = payments[0];
        const bookingId = payment.booking_id;
        const pharmacyOrderId = payment.pharmacy_order_id;
        const ecommerceOrderId = payment.order_id;
        // orders.payment_method is customer-facing ('online'); payments row stores gateway ('razorpay').
        const resolvedPaymentMethod =
          payment.payment_method && String(payment.payment_method) !== 'razorpay'
            ? String(payment.payment_method)
            : 'online';

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

        // ✅ FIX: Handle pharmacy orders FIRST (before early return)
        if (pharmacyOrderId) {
          console.log('[PAYMENT-VERIFY] ✅ Processing pharmacy order payment:', {
            pharmacyOrderId,
            razorpay_payment_id,
            orderId: razorpay_order_id,
          });

          // Update pharmacy order status and payment info
          const updateResult = await client.query(
            `UPDATE pharmacy_orders SET 
              payment_status = 'paid',
              razorpay_payment_id = $1,
              status = 'payment_confirmed',
              updated_at = NOW()
            WHERE id = $2
            RETURNING id, payment_status, status`,
            [razorpay_payment_id, pharmacyOrderId]
          );

          if (updateResult.rows.length === 0) {
            console.error('[PAYMENT-VERIFY] ❌ Pharmacy order not found:', pharmacyOrderId);
            throw new Error(`Pharmacy order ${pharmacyOrderId} not found`);
          }

          console.log('[PAYMENT-VERIFY] ✅ Pharmacy order updated:', {
            id: updateResult.rows[0].id,
            payment_status: updateResult.rows[0].payment_status,
            status: updateResult.rows[0].status,
          });

          // Create delivery tracking with OTP if it doesn't exist
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
            console.log('[PAYMENT-VERIFY] ✅ Delivery tracking created with OTP:', deliveryOtp);
          } else {
            console.log('[PAYMENT-VERIFY] ✅ Delivery tracking already exists for pharmacy order');
          }

          // Return success for pharmacy orders (no booking to update)
          return {
            success: true,
            message: 'Payment verified successfully',
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            bookingId: null,
            pharmacyOrderId: pharmacyOrderId,
            customerId: payment.customer_id,
            totalAmount: Number(payment.amount ?? 0),
          };
        }

        if (ecommerceOrderId) {
          console.log('[PAYMENT-VERIFY] ✅ Processing ecommerce order payment:', {
            ecommerceOrderId,
            razorpay_payment_id,
            orderId: razorpay_order_id,
          });

          const { rows: shopRows } = await client.query(
            `SELECT id, order_status, payment_status, payment_method, payment_hold_expires_at, created_at
             FROM orders WHERE id = $1::uuid FOR UPDATE`,
            [ecommerceOrderId]
          );
          if (shopRows.length === 0) {
            console.error('[PAYMENT-VERIFY] ❌ Ecommerce order not found:', ecommerceOrderId);
            throw new Error(`Order ${ecommerceOrderId} not found`);
          }
          const shopRow = shopRows[0];
          const shopPs = String(shopRow.payment_status || '').toLowerCase();
          const shopSt = String(shopRow.order_status || '').toLowerCase();
          if (shopSt === 'cancelled' || ['failed', 'expired'].includes(shopPs)) {
            throw new Error('Order payment window has expired or order was cancelled');
          }
          if (isShopOrderPaymentHoldExpired(shopRow) && shopPs !== 'paid' && shopPs !== 'completed') {
            throw new Error('PAYMENT_HOLD_EXPIRED');
          }

          // Mark paid inside this transaction only. Do NOT call applyOrderCommissionAudit
          // (or other pool-based writers on orders/items) while FOR UPDATE holds this row —
          // that second connection deadlocks until Lambda times out.
          const updateResult = await client.query(
            `UPDATE orders SET
              payment_status = 'paid',
              order_status = CASE
                WHEN order_status = 'pending_payment' THEN 'pending'
                ELSE order_status
              END,
              payment_method = COALESCE($3, payment_method),
              payment_id = COALESCE(payment_id, $2),
              payment_hold_expires_at = NULL,
              updated_at = NOW()
            WHERE id = $1::uuid
            RETURNING id, payment_status, order_status`,
            [ecommerceOrderId, payment.id, resolvedPaymentMethod]
          );

          if (updateResult.rows.length === 0) {
            const { rows: existing } = await client.query(
              `SELECT id FROM orders WHERE id = $1::uuid LIMIT 1`,
              [ecommerceOrderId]
            );
            if (existing.length === 0) {
              console.error('[PAYMENT-VERIFY] ❌ Ecommerce order not found:', ecommerceOrderId);
              throw new Error(`Order ${ecommerceOrderId} not found`);
            }
          }

          ecommerceOrderForShipment = String(ecommerceOrderId);
          ecommerceOrderToNotify = String(ecommerceOrderId);
          if (payment.vendor_id) {
            ecommerceVendorIdForCommission = String(payment.vendor_id);
          }

          return {
            success: true,
            message: 'Payment verified successfully',
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            bookingId: null,
            ecommerceOrderId: String(ecommerceOrderId),
            customerId: payment.customer_id,
            totalAmount: Number(payment.amount ?? 0),
          };
        }

        // ✅ If booking is created after payment (prepaid flow), return success without booking update
        if (!bookingId) {
          return {
            success: true,
            message: 'Payment verified successfully',
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            bookingId: null,
            customerId: payment.customer_id ?? null,
            totalAmount: Number(payment.amount ?? 0),
          };
        }

        // ✅ Update booking status to confirmed and payment_status to paid
        const { rows: bookingRows } = await client.query(
          `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
          [bookingId]
        );
        const bookingRow = bookingRows[0] || {};
        const previousStatus = bookingRow?.status || null;
        const previousPaymentStatus = bookingRow?.payment_status || null;
        const shouldNotify = previousPaymentStatus !== 'paid' || previousStatus === 'pending_payment';

        // Split-pay gate: if financial meta reserved a wallet slice, debit it before marking paid.
        // Razorpay amount alone (often GST) must not complete the booking without the wallet leg.
        const lockedAtVerify = resolveLockedBookingGrossFromNotes(bookingRow.notes);
        const intendedWallet = Math.round((lockedAtVerify?.walletAmount ?? 0) * 100) / 100;
        let walletDebitedAtVerify = 0;
        if (intendedWallet > 0.009 && bookingRow.customer_id) {
          const grossAtVerify =
            lockedAtVerify && lockedAtVerify.grossTotal > 0
              ? lockedAtVerify.grossTotal
              : Math.round((parseFloat(String(bookingRow.total_amount ?? 0)) || 0) * 100) / 100;
          const gstAtVerify = lockedAtVerify?.totalTax ?? 0;
          let alreadyDebited = 0;
          try {
            const existingDebits = await client.query(
              `SELECT COALESCE(SUM(amount), 0)::text AS total
               FROM wallet_transactions
               WHERE transaction_type = 'debit'
                 AND (
                   (reference_type = 'booking_payment' AND reference_id::text = $1)
                   OR description ILIKE $2
                 )`,
              [String(bookingId), `%${String(bookingId)}%`]
            );
            alreadyDebited =
              Math.round((parseFloat(String(existingDebits.rows[0]?.total ?? '0')) || 0) * 100) / 100;
          } catch (existingDebitErr: any) {
            console.warn(
              '[PAYMENT-VERIFY] existing wallet debit lookup skipped:',
              existingDebitErr?.message
            );
          }
          const balRes = await client.query(
            `SELECT COALESCE(balance, 0)::text AS b FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
            [String(bookingRow.customer_id)]
          );
          const bal = parseFloat(String(balRes.rows[0]?.b ?? '0')) || 0;
          const split = computeWalletBookingSplit({
            grossTotal: grossAtVerify > 0 ? grossAtVerify : intendedWallet + gstAtVerify,
            walletIntent: intendedWallet,
            walletBalance: bal + alreadyDebited,
            gstAmount: gstAtVerify,
          });
          const needDebit = Math.max(
            0,
            Math.round((split.walletApplied - alreadyDebited) * 100) / 100
          );
          if (needDebit > 0.009) {
            const deb = await debitCustomerWalletForBookingInTransaction(client, {
              customerId: String(bookingRow.customer_id),
              bookingId: String(bookingId),
              amount: needDebit,
              idempotencyKey: `rz-verify-wallet-${String(bookingId)}`,
            });
            walletDebitedAtVerify = Math.round((deb?.debited ?? needDebit) * 100) / 100;
            if (walletDebitedAtVerify > 0.009) {
              try {
                await client.query(
                  `UPDATE payments
                   SET wallet_amount_used = GREATEST(COALESCE(wallet_amount_used, 0), $1::numeric),
                       updated_at = NOW()
                   WHERE razorpay_order_id = $2`,
                  [alreadyDebited + walletDebitedAtVerify, razorpay_order_id]
                );
              } catch (walletColErr: any) {
                console.warn(
                  '[PAYMENT-VERIFY] wallet_amount_used update skipped:',
                  walletColErr?.message
                );
              }
            }
          } else {
            walletDebitedAtVerify = alreadyDebited;
          }
        }

        const cashPaid = Math.round((parseFloat(String(payment.amount ?? 0)) || 0) * 100) / 100;
        const lockedAllIn =
          lockedAtVerify && lockedAtVerify.grossTotal > 0
            ? Math.round(lockedAtVerify.grossTotal * 100) / 100
            : 0;
        const currentBookingTotal =
          Math.round((parseFloat(String(bookingRow.total_amount ?? 0)) || 0) * 100) / 100;
        // Never collapse all-in total_amount down to the Razorpay cash/GST leg.
        const nextTotalAmount = Math.max(
          currentBookingTotal,
          lockedAllIn,
          cashPaid + walletDebitedAtVerify,
          cashPaid
        );

        await client.query(
          `UPDATE bookings SET 
            payment_status = 'paid',
            status = CASE
              WHEN status IN ('pending', 'pending_payment') THEN 'confirmed'
              WHEN status = 'cancelled' AND COALESCE(cancellation_reason, '') = 'payment_window_expired' THEN 'confirmed'
              ELSE status
            END,
            cancellation_reason = CASE
              WHEN status = 'cancelled' AND COALESCE(cancellation_reason, '') = 'payment_window_expired' THEN NULL
              ELSE cancellation_reason
            END,
            cancelled_at = CASE
              WHEN status = 'cancelled' AND COALESCE(cancellation_reason, '') = 'payment_window_expired' THEN NULL
              ELSE cancelled_at
            END,
            total_amount = COALESCE($2::numeric, total_amount),
            updated_at = NOW()
          WHERE id = $1`,
          [bookingId, nextTotalAmount > 0 ? nextTotalAmount : null]
        );

        if (previousStatus !== 'confirmed') {
          bookingStatusChange = { bookingId, from: previousStatus, to: 'confirmed' };
        }
        if (shouldNotify) {
          bookingToNotify = bookingId;
        }

        console.log('[PAYMENT-VERIFY] ✅ Payment verified and booking confirmed:', bookingId);

        Promise.resolve()
          .then(async () => {
            const { recordBookingPromotionUsageFromBooking } = await import(
              '../../../lib/services/booking-promotion-service'
            );
            await recordBookingPromotionUsageFromBooking(String(bookingId));
          })
          .catch((err) => {
            console.warn('[PAYMENT-VERIFY] promotion usage record failed:', err);
          });

        // ✅ AUTO-GENERATE OTP for in-person services when booking transitions to confirmed
        await ensureBookingStartOtpIfNeeded(String(bookingId), {
          execQuery: (sql, params) => client.query(sql, params),
          logPrefix: '[PAYMENT-VERIFY]',
        });

        let loyaltyBookingKind: ReturnType<typeof resolveLoyaltyBookingKind> = 'other';
        let customerIdOut: string | null = payment.customer_id ?? null;
        let totalAmountOut = Number(payment.amount ?? 0);
        let loyaltyBookVetConsultationForPayment = false;
        try {
          const { rows: lr } = await client.query(
            `SELECT b.service_type, b.customer_id, b.total_amount, v.vendor_type,
              vs.service_name AS vs_name,
              COALESCE(sc.service_name, sc.display_name, s.name, vs.service_name) AS resolved_service_name,
              COALESCE(sc.category_name, s.category) AS resolved_category
             FROM bookings b
             LEFT JOIN vendors v ON b.vendor_id = v.id
             LEFT JOIN vendor_services vs ON b.service_id = vs.id
             LEFT JOIN service_catalog sc ON vs.service_id = sc.id
             LEFT JOIN services s ON vs.service_id = s.id
             WHERE b.id = $1::uuid`,
            [bookingId]
          );
          const row = lr[0];
          if (row) {
            if (row.customer_id) customerIdOut = row.customer_id;
            if (row.total_amount != null && row.total_amount !== '') {
              totalAmountOut = Number(row.total_amount);
            }
            const svcName = String(row.resolved_service_name || row.vs_name || '');
            loyaltyBookingKind = resolveLoyaltyBookingKind({
              bookingServiceType: row.service_type || '',
              serviceCategory: row.resolved_category ?? null,
              serviceName: svcName || null,
              vendorType: row.vendor_type ?? null,
            });
            const st = String(row.service_type || '').toLowerCase();
            const isTele = ['tele', 'online', 'video_consultation', 'tele_consultation'].includes(st);
            loyaltyBookVetConsultationForPayment =
              loyaltyBookingKind === 'vet_consultation' && isTele;
          }
        } catch (loyErr: any) {
          console.warn('[PAYMENT-VERIFY] Loyalty context query failed:', loyErr?.message || loyErr);
        }

        // Queue settlement and publish events (async side effects). Vendor SELECT must not abort
        // the verify transaction (prod may lack columns like razorpay_account_id).
        if (bookingId) {
          try {
            await client.query('SAVEPOINT payment_verify_settlement');
            const { rows: vendors } = await client.query(
              `SELECT razorpay_account_id, bank_verified FROM vendors WHERE id = $1`,
              [payment.vendor_id]
            );
            await client.query('RELEASE SAVEPOINT payment_verify_settlement');
            const vendor = vendors.length > 0 ? vendors[0] : null;
            if (vendor?.razorpay_account_id && vendor.bank_verified) {
              Promise.resolve().then(async () => {
                try {
                  const { sendToSQS } = await import('../../../utils/aws/aws-clients');
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
            try {
              await client.query('ROLLBACK TO SAVEPOINT payment_verify_settlement');
            } catch {
              /* ignore if savepoint missing */
            }
            console.error('Failed to check vendor for settlement:', error);
          }
          
          try {
            // Publish event asynchronously (don't await in transaction)
            Promise.resolve().then(async () => {
              try {
                const { publishPaymentProcessed } = await import('../../../utils/sns-client');
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
          success: true,
          message: 'Payment verified successfully',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          bookingId: bookingId,
          customerId: customerIdOut,
          totalAmount: totalAmountOut,
          loyaltyBookingKind,
          loyaltyBookVetConsultationForPayment,
        };
      });

      if (bookingStatusChange) {
        await logBookingStatusChange(
          (bookingStatusChange as BookingStatusChange).bookingId,
          (bookingStatusChange as BookingStatusChange).from,
          (bookingStatusChange as BookingStatusChange).to as string,
          'system',
          'system',
          'Payment verified'
        );
        if ((bookingStatusChange as BookingStatusChange).to === 'confirmed') {
          const { publishVendorReferralBookingConfirmedAction } = await import(
            '../../../lib/services/loyalty-action-publisher'
          );
          await publishVendorReferralBookingConfirmedAction((bookingStatusChange as BookingStatusChange).bookingId);
        }
      }

      if (bookingToNotify) {
        await notifyBookingCreated(bookingToNotify, (context as HandlerContext & { requestId?: string }).requestId);
      }

      if (ecommerceOrderForShipment) {
        triggerAutoShipment(ecommerceOrderForShipment, 'ecommerce').catch((e) =>
          console.error('[PAYMENT-VERIFY] Auto-shipment trigger failed:', e)
        );
        // Commission audit + settlement ledger after commit (pool writers; never under FOR UPDATE).
        // Batch job can backfill settlement if this fails.
        const orderIdForPostCommit = ecommerceOrderForShipment;
        const vendorIdForPostCommit = ecommerceVendorIdForCommission;
        const writeSettlement = () =>
          writeEcommerceOrderSettlementLedgerRow(orderIdForPostCommit).catch((e) =>
            console.error('[PAYMENT-VERIFY] Settlement ledger write failed:', e)
          );
        if (vendorIdForPostCommit) {
          void applyOrderCommissionAudit(orderIdForPostCommit, vendorIdForPostCommit)
            .then(() => writeSettlement())
            .catch((e) => {
              console.warn('[PAYMENT-VERIFY] Commission audit failed (settlement still attempted):', e);
              return writeSettlement();
            });
        } else {
          void writeSettlement();
        }
      }

      if (ecommerceOrderToNotify) {
        void notifyShopOrderPaid(ecommerceOrderToNotify).catch((e) =>
          console.error('[PAYMENT-VERIFY] Shop order notification failed:', e)
        );
      }

      return this.success(result);
    } catch (error: any) {
      console.error('[PAYMENT-VERIFY] Verification error:', error);

      const holdExpired =
        String(error?.message || '') === 'PAYMENT_HOLD_EXPIRED' ||
        String(error?.message || '').includes('payment window has expired');

      if (holdExpired) {
        const body = this.parseBody(context.event);
        try {
          const { rows: paymentRows } = await query(
            `SELECT order_id FROM payments WHERE razorpay_order_id = $1 AND order_id IS NOT NULL LIMIT 1`,
            [body?.razorpay_order_id]
          );
          if (paymentRows[0]?.order_id) {
            await discardUnpaidShopOrder(String(paymentRows[0].order_id), 'payment_window_expired', {
              paymentStatus: 'expired',
            });
          }
        } catch (discardErr) {
          console.warn('[PAYMENT-VERIFY] discard after hold expiry failed:', discardErr);
        }
        return this.error(
          'Payment window expired. Please place a new order. If you were charged, contact support for a refund.',
          410
        );
      }

      // ✅ CRITICAL: This catch block runs AFTER signature verification passed.
      // The customer has genuinely paid money on Razorpay. We must NEVER delete the
      // booking or payment. The Razorpay webhook (payment.captured) will act as a
      // safety net and mark the booking as paid when it fires.
      const body = this.parseBody(context.event);
      const orderId = body?.razorpay_order_id;
      const paymentId = body?.razorpay_payment_id;

      if (orderId) {
        try {
          // Attempt to mark the payment as completed even if the main transaction failed.
          // This ensures the webhook can match it and the booking won't be orphaned.
          await query(
            `UPDATE payments SET 
              payment_status = 'completed',
              razorpay_payment_id = COALESCE(razorpay_payment_id, $1),
              completed_at = COALESCE(completed_at, NOW()),
              updated_at = NOW()
            WHERE razorpay_order_id = $2 AND payment_status = 'pending'`,
            [paymentId || null, orderId]
          );

          // Try to update the booking too (best-effort)
          const { rows: paymentRows } = await query(
            `SELECT booking_id, order_id FROM payments WHERE razorpay_order_id = $1 LIMIT 1`,
            [orderId]
          );
          if (paymentRows.length > 0 && paymentRows[0].order_id && !paymentRows[0].booking_id) {
            await query(
              `UPDATE orders SET
                payment_status = 'paid',
                order_status = CASE
                  WHEN order_status = 'pending_payment' THEN 'pending'
                  ELSE order_status
                END,
                payment_hold_expires_at = NULL,
                updated_at = NOW()
              WHERE id = $1::uuid
                AND payment_status != 'paid'
                AND LOWER(COALESCE(order_status, '')) NOT IN ('cancelled', 'returned')`,
              [paymentRows[0].order_id]
            );
            console.log('[PAYMENT-VERIFY] ⚠️ Best-effort ecommerce payment update:', paymentRows[0].order_id);
          } else if (paymentRows.length > 0 && paymentRows[0].booking_id) {
            await query(
              `UPDATE bookings SET 
                payment_status = 'paid',
                status = CASE
                  WHEN status IN ('pending', 'pending_payment') THEN 'confirmed'
                  WHEN status = 'cancelled' AND COALESCE(cancellation_reason, '') = 'payment_window_expired' THEN 'confirmed'
                  ELSE status
                END,
                cancellation_reason = CASE
                  WHEN status = 'cancelled' AND COALESCE(cancellation_reason, '') = 'payment_window_expired' THEN NULL
                  ELSE cancellation_reason
                END,
                cancelled_at = CASE
                  WHEN status = 'cancelled' AND COALESCE(cancellation_reason, '') = 'payment_window_expired' THEN NULL
                  ELSE cancelled_at
                END,
                updated_at = NOW()
              WHERE id = $1 AND payment_status != 'paid'`,
              [paymentRows[0].booking_id]
            );
            console.log('[PAYMENT-VERIFY] ⚠️ Main transaction failed but best-effort update succeeded for booking:', paymentRows[0].booking_id);
          }
        } catch (recoveryError: any) {
          // Recovery also failed — the webhook will handle it
          console.error('[PAYMENT-VERIFY] ⚠️ Recovery update also failed (webhook will handle):', recoveryError?.message);
        }
      }

      if (error.message) {
        return this.error(`Payment verification encountered an error: ${error.message}. Your payment is safe — your booking will be confirmed shortly.`, 500);
      }
      return this.error('Payment verification encountered an error. Your payment is safe — your booking will be confirmed shortly.', 500);
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
      const paymentEntity = payload_data.payment.entity;
      const razorpayPaymentId = paymentEntity.id;
      const razorpayOrderId = paymentEntity.order_id; // Always present in Razorpay payment entity

      let paymentRecord: any = null;
      let bookingToNotify: string | null = null;
      let bookingStatusChange: { bookingId: string; from: string | null; to: string | null } | null = null;
      let ecommerceOrderForShipment: string | null = null;
      let ecommerceOrderToNotify: string | null = null;
      let ecommerceVendorIdForCommission: string | null = null;
      let cancelledShopOrderLateRefund: {
        orderId: string;
        amount: number;
        customerId?: string;
        vendorId?: string;
      } | null = null;

      // ✅ FIX: Use transaction with fallback lookup (razorpay_payment_id → razorpay_order_id)
      // Previously only looked up by razorpay_payment_id, which is NULL until verify-payment runs.
      // If verify-payment never fires (user closes browser, network error), the webhook must still work.
      await withTransaction(async (client) => {
        // Try razorpay_payment_id first (set by verify-payment if it ran)
        let result = await client.query(
          `SELECT * FROM payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
          [razorpayPaymentId]
        );

        // Fallback: razorpay_order_id (always set by /razorpay/create-order)
        if (result.rows.length === 0 && razorpayOrderId) {
          result = await client.query(
            `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
            [razorpayOrderId]
          );
        }

        if (result.rows.length === 0) {
          console.warn(`[RAZORPAY-WEBHOOK] Payment not found for payment_id=${razorpayPaymentId}, order_id=${razorpayOrderId}`);
          return;
        }

        paymentRecord = result.rows[0];

        // Update payment: mark completed, fill razorpay_payment_id if missing
        await client.query(
          `UPDATE payments SET 
            payment_status = 'completed',
            razorpay_payment_id = COALESCE(razorpay_payment_id, $1),
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
          WHERE id = $2`,
          [razorpayPaymentId, paymentRecord.id]
        );

        // Update booking if linked
        if (paymentRecord.booking_id) {
          const { rows: bookingRows } = await client.query(
            `SELECT status, payment_status FROM bookings WHERE id = $1 FOR UPDATE`,
            [paymentRecord.booking_id]
          );

          if (bookingRows.length > 0) {
            const booking = bookingRows[0];
            const previousStatus = booking.status || null;
            const shouldNotify = booking.payment_status !== 'paid' || previousStatus === 'pending_payment';

            await client.query(
              `UPDATE bookings SET 
                payment_status = 'paid',
                status = 'confirmed',
                updated_at = NOW()
              WHERE id = $1`,
              [paymentRecord.booking_id]
            );

            if (previousStatus !== 'confirmed') {
              bookingStatusChange = { bookingId: paymentRecord.booking_id, from: previousStatus, to: 'confirmed' };
            }
            if (shouldNotify) {
              bookingToNotify = paymentRecord.booking_id;
            }
          }
        }

        // Update pharmacy order if linked
        if (paymentRecord.pharmacy_order_id) {
          await client.query(
            `UPDATE pharmacy_orders SET 
              payment_status = 'paid',
              razorpay_payment_id = COALESCE(razorpay_payment_id, $1),
              status = 'payment_confirmed',
              updated_at = NOW()
            WHERE id = $2 AND payment_status != 'paid'`,
            [razorpayPaymentId, paymentRecord.pharmacy_order_id]
          );
        }

        if (paymentRecord.order_id && !paymentRecord.booking_id && !paymentRecord.pharmacy_order_id) {
          const orderUpdate = await client.query(
            `UPDATE orders SET
              payment_status = 'paid',
              order_status = CASE
                WHEN order_status = 'pending_payment' THEN 'pending'
                ELSE order_status
              END,
              payment_id = COALESCE(payment_id, $2),
              payment_hold_expires_at = NULL,
              updated_at = NOW()
            WHERE id = $1::uuid
              AND payment_status != 'paid'
              AND LOWER(COALESCE(order_status, '')) NOT IN ('cancelled', 'returned')
            RETURNING id, vendor_id, order_status`,
            [paymentRecord.order_id, paymentRecord.id]
          );
          if (orderUpdate.rows.length > 0) {
            const orderId = String(paymentRecord.order_id);
            const vendorId = String(
              orderUpdate.rows[0].vendor_id ?? paymentRecord.vendor_id ?? ''
            );
            ecommerceOrderForShipment = orderId;
            ecommerceOrderToNotify = orderId;
            if (vendorId) {
              ecommerceVendorIdForCommission = vendorId;
            }
          } else {
            const { rows: lateCancelRows } = await client.query(
              `SELECT o.id::text, o.customer_id::text, o.vendor_id::text, p.amount::text
               FROM orders o
               JOIN payments p ON p.id = $2::uuid
               WHERE o.id = $1::uuid
                 AND o.order_status = 'cancelled'
                 AND LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop', 'shop_order')
                 AND p.razorpay_payment_id IS NOT NULL
                 AND NOT EXISTS (
                   SELECT 1 FROM refunds r
                   WHERE r.order_id = o.id
                     AND r.refund_status NOT IN ('failed', 'rejected')
                 )
               LIMIT 1`,
              [paymentRecord.order_id, paymentRecord.id],
            );
            const lateRow = lateCancelRows[0];
            if (lateRow) {
              cancelledShopOrderLateRefund = {
                orderId: String(lateRow.id),
                amount: parseFloat(String(lateRow.amount)) || 0,
                customerId: lateRow.customer_id ? String(lateRow.customer_id) : undefined,
                vendorId: lateRow.vendor_id ? String(lateRow.vendor_id) : undefined,
              };
            }
          }
        }
      });

      // Post-transaction: logging, notifications, settlements
      if (bookingStatusChange) {
        await logBookingStatusChange(
          (bookingStatusChange as BookingStatusChange).bookingId,
          (bookingStatusChange as BookingStatusChange).from,
          (bookingStatusChange as BookingStatusChange).to as string,
          'system',
          'system',
          'Payment captured (webhook)'
        ).catch((e) => console.error('[RAZORPAY-WEBHOOK] Audit log failed:', e));
        if ((bookingStatusChange as BookingStatusChange).to === 'confirmed') {
          const { publishVendorReferralBookingConfirmedAction } = await import(
            '../../../lib/services/loyalty-action-publisher'
          );
          await publishVendorReferralBookingConfirmedAction((bookingStatusChange as BookingStatusChange).bookingId).catch((e) =>
            console.error('[RAZORPAY-WEBHOOK] Loyalty action publish failed:', e)
          );
        }
      }

      if (bookingToNotify) {
        await notifyBookingCreated(bookingToNotify, (context as HandlerContext & { requestId?: string }).requestId)
          .catch((e) => console.error('[RAZORPAY-WEBHOOK] Notification failed:', e));
      }

      if (paymentRecord?.booking_id) {
        scheduleBookingStartOtpIfNeeded(String(paymentRecord.booking_id), '[RAZORPAY-WEBHOOK]');
      }

      // ✅ Trigger automatic settlement if marketplace mode is enabled
      if (paymentRecord?.booking_id) {
        try {
          const vendors = await select('vendors', { id: paymentRecord.vendor_id });
          const vendor = vendors.length > 0 ? vendors[0] : null;
          
          if (vendor?.razorpay_account_id && vendor.bank_verified) {
            const { sendToSQS } = await import('../../../utils/aws/aws-clients');
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

      if (ecommerceOrderForShipment) {
        triggerAutoShipment(ecommerceOrderForShipment, 'ecommerce').catch((e) =>
          console.error('[RAZORPAY-WEBHOOK] Auto-shipment trigger failed:', e)
        );
        // After commit only — avoid pool UPDATE racing the txn row lock.
        const orderIdForPostCommit = ecommerceOrderForShipment;
        const vendorIdForPostCommit = ecommerceVendorIdForCommission;
        const writeSettlement = () =>
          writeEcommerceOrderSettlementLedgerRow(orderIdForPostCommit).catch((e) =>
            console.warn('[RAZORPAY-WEBHOOK] Settlement ledger write failed:', e)
          );
        if (vendorIdForPostCommit) {
          void applyOrderCommissionAudit(orderIdForPostCommit, vendorIdForPostCommit)
            .then(() => writeSettlement())
            .catch((e) => {
              console.warn('[RAZORPAY-WEBHOOK] Commission audit failed (settlement still attempted):', e);
              return writeSettlement();
            });
        } else {
          void writeSettlement();
        }
      }

      if (ecommerceOrderToNotify) {
        void notifyShopOrderPaid(ecommerceOrderToNotify).catch((e) =>
          console.error('[RAZORPAY-WEBHOOK] Shop order notification failed:', e)
        );
      }

      if (cancelledShopOrderLateRefund && cancelledShopOrderLateRefund.amount > 0.009) {
        const late = cancelledShopOrderLateRefund;
        const { initiateShopOrderRazorpayRefund } = await import('../../../utils/payments/shop-order-refund');
        void initiateShopOrderRazorpayRefund({
          orderId: late.orderId,
          amount: late.amount,
          reason: 'Late payment capture on cancelled shop order',
          customerId: late.customerId,
          vendorId: late.vendorId,
        }).catch((e) =>
          console.error('[RAZORPAY-WEBHOOK] Late-cancel shop refund failed:', late.orderId, e),
        );
      }
    } else if (event === 'payment.failed') {
      const payment = payload_data.payment.entity;
      const failedRazorpayOrderId = payment.order_id;
      let shopOrderToDiscard: string | null = null;

      await withTransaction(async (client) => {
        await client.query(
          `UPDATE payments SET 
            payment_status = 'failed',
            failure_reason = $1,
            updated_at = NOW()
          WHERE razorpay_payment_id = $2 OR razorpay_order_id = $3`,
          [
            payment.error_description || 'Payment failed',
            payment.id,
            failedRazorpayOrderId || null,
          ]
        );

        const { rows: payments } = await client.query(
          `SELECT booking_id, order_id FROM payments
           WHERE razorpay_payment_id = $1 OR razorpay_order_id = $2
           FOR UPDATE`,
          [payment.id, failedRazorpayOrderId || null]
        );

        if (payments.length > 0) {
          const row = payments[0];
          if (row.order_id && !row.booking_id) {
            shopOrderToDiscard = String(row.order_id);
          } else if (row.booking_id) {
            const bookingId = row.booking_id;

            const { rows: bookingRows } = await client.query(
              `SELECT status, payment_status FROM bookings WHERE id = $1 FOR UPDATE`,
              [bookingId]
            );

            if (bookingRows.length > 0) {
              const booking = bookingRows[0];
              if (
                booking.payment_status !== 'paid' &&
                (booking.status === 'pending' || booking.status === 'pending_payment')
              ) {
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
        }
      });

      if (shopOrderToDiscard) {
        try {
          const { rows: shopHoldRows } = await query(
            `SELECT order_status, payment_status, payment_method, payment_hold_expires_at, created_at
             FROM orders WHERE id = $1::uuid LIMIT 1`,
            [shopOrderToDiscard]
          );
          const shopHold = shopHoldRows[0];
          const holdStillActive =
            shopHold &&
            isShopOrderPaymentHoldActive({
              order_status: shopHold.order_status,
              payment_status: shopHold.payment_status,
              payment_method: shopHold.payment_method,
              payment_hold_expires_at: shopHold.payment_hold_expires_at,
            });
          if (holdStillActive) {
            console.log(
              '[PAYMENT-FAILED] Shop order hold still active — skipping discard:',
              shopOrderToDiscard
            );
          } else {
            await discardUnpaidShopOrder(shopOrderToDiscard, 'razorpay_payment_failed', {
              paymentStatus: 'failed',
            }).catch((e) => console.warn('[PAYMENT-FAILED] discardUnpaidShopOrder failed:', e));
            console.log('[PAYMENT-FAILED] ✅ Ecommerce order discarded:', shopOrderToDiscard);
          }
        } catch (discardErr) {
          console.warn('[PAYMENT-FAILED] shop order discard check failed:', discardErr);
        }
      }
    } else if (event === 'refund.created' || event === 'refund.processed') {
      const refund = payload_data.refund.entity;
      const reconcileResult = await reconcileRazorpayRefundWebhook({
        razorpayRefundId: refund.id,
        razorpayPaymentId: refund.payment_id,
        refundAmountInr: refund.amount / 100,
        razorpayStatus: refund.status,
        refundReason: refund.notes?.reason || null,
      });
      if (reconcileResult) {
        console.log(
          `[RAZORPAY-WEBHOOK] ✅ Refund ${event} processed: ${refund.id}, full=${reconcileResult.isFullRefund}`,
        );
      } else {
        return this.success({ message: 'Webhook processed (payment not found)' });
      }
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
        const { sendToSettlementQueue } = await import('../../../utils/sqs-client');
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

    // ✅ SQL: Get payment with booking_id
    const payments = await select('payments', { razorpay_payment_id: paymentId });
    if (payments.length === 0) {
      return this.error('Payment not found', 404);
    }

    const payment = payments[0];

    // Validate refund amount
    const refundAmount = parseFloat(amount);
    const paymentAmount = parseFloat(payment.amount || '0');
    
    if (refundAmount <= 0 || refundAmount > paymentAmount) {
      return this.error('Invalid refund amount', 400);
    }

    // Calculate total already refunded
    const { rows: refundedRows } = await query(
      `SELECT COALESCE(SUM(refund_amount), 0) AS total_refunded
       FROM refunds
       WHERE payment_id = $1::uuid
         AND ${ACTIVE_REFUND_STATUS_FILTER}`,
      [payment.id]
    );

    const totalRefunded = parseFloat(refundedRows[0]?.total_refunded || '0');
    const availableToRefund = paymentAmount - totalRefunded;

    if (refundAmount > availableToRefund + 0.009) {
      return this.error(
        `Only ₹${availableToRefund} available to refund. Requested: ₹${refundAmount}`,
        400
      );
    }

    // ✅ Create Razorpay refund
    const refund = await razorpayRequest(
      `/payments/${paymentId}/refund`,
      'POST',
      {
        amount: Math.round(refundAmount * 100), // Convert to paise
        notes: {
          reason: reason || 'Customer request',
        },
      }
    );

    // Determine if full or partial refund
    const isFullRefund = refundAmount >= availableToRefund - 0.009;
    const dbRefundStatus = mapRazorpayRefundEventStatus(refund.status);
    const newPaymentStatus = isFullRefund 
      ? PaymentTransactionStatus.REFUNDED 
      : PaymentTransactionStatus.PARTIALLY_REFUNDED;

    // ✅ SQL: Process refund in transaction to ensure consistency
    await withTransaction(async (client) => {
      if (!payment.customer_id) {
        throw new Error('Payment missing customer_id');
      }
      await client.query(
        `INSERT INTO refunds (
          payment_id, booking_id, order_id, customer_id, refund_amount, refund_reason,
          refund_status, razorpay_refund_id, requested_at, processed_at,
          completed_at
        ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, NOW(), NOW(),
          CASE WHEN $7 = 'completed' THEN NOW() ELSE NULL END)`,
        [
          payment.id,
          payment.booking_id || null,
          payment.order_id || null,
          payment.customer_id,
          refundAmount,
          reason || 'Customer request',
          dbRefundStatus,
          refund.id,
        ]
      );

      // ✅ Update payments table payment_status
      await client.query(
        `UPDATE payments 
         SET payment_status = $1, updated_at = NOW()
         WHERE id = $2`,
        [newPaymentStatus, payment.id]
      );

      // ✅ Update booking payment status if booking exists
      if (payment.booking_id) {
        const bookingPaymentStatus = isFullRefund 
          ? BookingPaymentStatus.REFUNDED 
          : BookingPaymentStatus.PARTIAL;
        
        await client.query(
          `UPDATE bookings 
           SET payment_status = $1, updated_at = NOW()
           WHERE id = $2`,
          [bookingPaymentStatus, payment.booking_id]
        );
      }

      if (payment.order_id && isFullRefund) {
        await markShopOrderPaymentRefundedIfFull(String(payment.order_id), client);
      }
    });

    return this.success({
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      paymentStatus: newPaymentStatus,
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
        const fromReq = await c.req.json().catch(() => ({}));
        let requestBody = normalizeCreateOrderRequestBody(mergeRazorpayCreateOrderBody(c, fromReq));
        if (!String(requestBody.customerId || '').trim() && requestBody.customerPhone) {
          const rid = await resolveCustomerId(String(requestBody.customerPhone).trim());
          if (rid) {
            requestBody = normalizeCreateOrderRequestBody({
              ...requestBody,
              customerId: rid,
            });
          }
        }
        console.log('📥 [RAZORPAY-CREATE-ORDER] Merged/normalized body:', JSON.stringify(requestBody));
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
    console.log('📥 [VERIFY-PAYMENT] Received verify-payment request:', {
      razorpay_order_id: requestBody?.razorpay_order_id,
      razorpay_payment_id: requestBody?.razorpay_payment_id,
      has_signature: !!requestBody?.razorpay_signature,
      timestamp: new Date().toISOString(),
    });
    const event = createApiGatewayEventWithBody(c.req, requestBody);
    const context = createLambdaContext();
    const result = await verifyHandler.execute(event, context);
    const responseBody = JSON.parse(result.body);
    console.log('📤 [VERIFY-PAYMENT] Response:', {
      statusCode: result.statusCode,
      success: responseBody?.success,
      error: responseBody?.error,
    });
    return c.json(responseBody, result.statusCode);
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

      const bankData = (await response.json()) as RazorpayIfscApiResponse;
      
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
      const ifscData = (await ifscResponse.json()) as RazorpayIfscApiResponse;

      // Strict: account number 9–18 digits only
      if (!/^\d{9,18}$/.test(account_number)) {
        return c.json({
          success: false,
          valid: false,
          error: 'Invalid account number',
          details: 'Account number must be 9–18 digits.',
        }, 400);
      }

      // When Razorpay Banking payout source + API keys are configured, use Razorpay Fund Account Validation API
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

      // Format-only response when Razorpay Banking validation is not configured or API unavailable
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
        message:
          'Format validation passed. For full verification, configure the Razorpay Banking payout source account (Admin → Payment gateways or RAZORPAY_PAYOUT_SOURCE_ACCOUNT_NUMBER) and allowlist your server IPs in the Razorpay Dashboard.',
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

/**
 * Merge API Gateway–parsed body (c.env.parsedBody) with Hono c.req.json().
 * If the Request stream was already consumed or empty, env still has the real JSON.
 */
function mergeRazorpayCreateOrderBody(c: any, reqJson: unknown): Record<string, any> {
  const env = c?.env as { parsedBody?: Record<string, unknown> | null } | undefined;
  const fromEnv =
    env?.parsedBody && typeof env.parsedBody === 'object' && !Array.isArray(env.parsedBody)
      ? { ...(env.parsedBody as Record<string, any>) }
      : {};
  const fromReq =
    reqJson && typeof reqJson === 'object' && !Array.isArray(reqJson)
      ? { ...(reqJson as Record<string, any>) }
      : {};
  return { ...fromEnv, ...fromReq };
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

// getVendorTierCommission is exported from ../../../utils/vendor-tier-commission
