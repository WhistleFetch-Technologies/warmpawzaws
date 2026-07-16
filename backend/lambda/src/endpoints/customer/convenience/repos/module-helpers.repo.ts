/**
 * ============================================================================
 * CUSTOMER PHONE-BASED CONVENIENCE ENDPOINTS
 * ============================================================================
 * 
 * Provides convenience endpoints that accept phone numbers instead of customer IDs
 * These endpoints resolve phone to customer ID internally and forward to main endpoints
 * 
 * Endpoints:
 * - GET /customer/bookings?phone=... - Get bookings by phone
 * - GET /customer/cart/:phone - Get cart by phone
 * - PUT /customer/cart/:phone/items/:itemId - Update cart item by phone
 * - DELETE /customer/cart/:phone/items/:itemId - Remove cart item by phone
 * - GET /customer/saved/:phone - Get saved items by phone
 * - DELETE /customer/saved/:phone/items/:itemId - Remove saved item by phone
 * - GET /customer/wallet?phone=... - Get wallet by phone
 * - GET /customer/wallet/transactions?phone=... - Get wallet transactions by phone
 * - GET /customer/notifications/:phone - Inbox + notification channel settings (preferences.notificationSettings)
 * - PUT /customer/notifications/:phone - Save notification channel settings
 * - POST /customer/payments/:phone - Create payment by phone
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { select, query, insert } from '../../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { reconcileBookingPayments } from '../../../../utils/payments/payment-reconciliation';
import { resolveBookingPaymentSourcesBatch } from '../../../../utils/payments/booking-payment-sources';
import {
  DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
  fetchCustomerNotificationSettings,
  normalizeCustomerNotificationSettings,
  persistCustomerNotificationSettings,
} from '../../../../utils/customer-notification-settings';
import { presignProductImagesJsonb } from '../../../../utils/s3-media-presign';
import { bookingUsesDedicatedEndSessionOtp } from '../../../../lib/booking-dedicated-end-otp';
import {
  packageFieldsFromBookingRow,
  SQL_PACKAGE_PURCHASE_JOIN,
  SQL_PACKAGE_PURCHASE_SELECT,
} from '../../../../utils/customer-booking-package-fields';
import { expirePaymentHolds } from '../../../../utils/payment-hold';
import {
  seedFinitePackagesMissingSessionsForScope,
  type SqlClient,
} from '../../../../utils/package-session-sync';
import {
  sqlPackagePurchaseActiveForListing,
  sqlPackagePurchaseComputedStatus,
} from '../../../../utils/package-session-eligibility';

/** Module helpers (move-only). */

/** First image URL from products.images JSONB (array of strings or { url } objects). */
export function firstProductImageUrl(images: unknown): string | undefined {
  if (images == null) return undefined;
  let arr: unknown;
  try {
    arr = typeof images === 'string' ? JSON.parse(images) : images;
  } catch {
    return undefined;
  }
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const first = arr[0];
  if (typeof first === 'string' && first.trim()) return first;
  if (first && typeof first === 'object') {
    const o = first as Record<string, unknown>;
    const u = o.url ?? o.src ?? o.image_url;
    return typeof u === 'string' && u.trim() ? u : undefined;
  }
  return undefined;
}

/**
 * Helper to resolve phone to customer ID
 * Tries multiple stored shapes: 10-digit, +91XXXXXXXXXX, 91XXXXXXXXXX in DB, etc.
 */
export async function resolveCustomerIdFromPhone(phone: string): Promise<string | null> {
  const trimmed = String(phone || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits || digits.length < 10) {
    return null;
  }

  const candidates: string[] = [];
  const add = (v: string) => {
    if (v && !candidates.includes(v)) candidates.push(v);
  };

  add(trimmed);
  add(digits);
  if (digits.length === 10) {
    add(`+91${digits}`);
  }
  // IN mobile with country code in UI/storage: 919XXXXXXXXX (12 digits)
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    add(last10);
    add(`+91${last10}`);
    if (digits.startsWith('91') && digits.length >= 12) {
      add(digits);
    }
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    const rest = digits.slice(1);
    add(rest);
    add(`+91${rest}`);
  }

  for (const candidate of candidates) {
    const rows = await select('customers', { phone: candidate });
    if (rows.length > 0) return rows[0].id;
  }

  return null;
}

/** Ledger-based lifetime totals (aligned with GET /wallet/:customerId). */
export async function getWalletLedgerTotalsByCustomerId(
  customerId: string
): Promise<{ totalEarned: number; totalSpent: number }> {
  try {
    const result = await query(
      `SELECT
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(COALESCE(wt.transaction_type::text, ''))) IN (
                'credit','c','refund','r','topup','top_up','cashback','credit_adjustment'
              )
              THEN ABS(wt.amount::numeric)
              ELSE 0::numeric
            END
          ),
          0
        )::text AS total_earned,
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(COALESCE(wt.transaction_type::text, ''))) IN (
                'debit','d','payout','payment','purchase','withdraw','debit_adjustment'
              )
              THEN ABS(wt.amount::numeric)
              ELSE 0::numeric
            END
          ),
          0
        )::text AS total_spent
       FROM wallet_transactions wt
       WHERE wt.customer_id = $1::uuid
          OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1::uuid)`,
      [customerId]
    );
    if (!result.rows.length) {
      return { totalEarned: 0, totalSpent: 0 };
    }
    const r = result.rows[0] as { total_earned?: string; total_spent?: string };
    return {
      totalEarned: parseFloat(String(r.total_earned ?? '0')) || 0,
      totalSpent: parseFloat(String(r.total_spent ?? '0')) || 0,
    };
  } catch {
    return { totalEarned: 0, totalSpent: 0 };
  }
}

/** Include row in list unless explicitly deactivated (soft-delete). NULL/missing is_active = show (legacy rows). */
export function isPaymentMethodRowVisible(row: Record<string, unknown>): boolean {
  const v = row.is_active;
  if (v === null || v === undefined) return true;
  if (v === false || v === 'f' || v === 'false' || v === 0 || v === '0') return false;
  return true;
}

/** Decode `:phone` path or query param (handles encodeURIComponent from client). */
export function decodePhoneParam(phone: string): string {
  try {
    return decodeURIComponent(phone);
  } catch {
    return phone;
  }
}

/** Normalize DB `payment_type` + row fields → customer-web union. */
export function clientPaymentTypeFromRow(m: Record<string, unknown>): 'card' | 'upi' | 'netbanking' {
  const upiVal = m.upi_id != null ? String(m.upi_id).trim() : '';
  const bankVal = m.bank_name != null ? String(m.bank_name).trim() : '';
  const last4Val = m.card_last4 != null ? String(m.card_last4).replace(/\D/g, '') : '';
  if (upiVal.length > 0) return 'upi';
  if (bankVal.length > 0 && last4Val.length < 4) return 'netbanking';
  if (last4Val.length >= 4) return 'card';

  const raw = String(m.payment_type ?? m.type ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const c = raw.replace(/_/g, '');
  if (raw === 'upi' || c === 'upi' || raw.includes('upi')) return 'upi';
  if (
    c === 'netbanking' ||
    raw === 'net_banking' ||
    c === 'banktransfer' ||
    raw === 'bank_transfer' ||
    c === 'nb' ||
    raw === 'nb'
  ) {
    return 'netbanking';
  }
  if (
    c === 'card' ||
    c === 'debitcard' ||
    c === 'creditcard' ||
    raw === 'debit_card' ||
    raw === 'credit_card'
  ) {
    return 'card';
  }

  return 'card';
}

/** Body → stored payment_type (must match what we can read back). */
export function normalizeIncomingPaymentType(body: Record<string, any>): 'card' | 'upi' | 'netbanking' {
  const req = String(body.type ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const collapsed = req.replace(/_/g, '');
  if (req === 'upi' || collapsed === 'upi') return 'upi';
  if (
    collapsed === 'netbanking' ||
    req === 'net_banking' ||
    collapsed === 'banktransfer' ||
    req === 'bank_transfer'
  ) {
    return 'netbanking';
  }
  if (req === 'card' || collapsed === 'debitcard' || collapsed === 'creditcard') return 'card';

  const hasCardDigits =
    typeof (body.cardNumber ?? body.card_number) === 'string' &&
    (body.cardNumber ?? body.card_number).replace(/\D/g, '').length >= 4;
  const upi = body.upiId ?? body.upi_id;
  const bank = body.bankName ?? body.bank_name;
  if (upi != null && String(upi).trim() !== '' && !hasCardDigits) return 'upi';
  if (bank != null && String(bank).trim() !== '' && !hasCardDigits && !(upi && String(upi).trim())) {
    return 'netbanking';
  }
  return 'card';
}

/** Map `customer_payment_methods` row → shape expected by customer-web Payment Settings (UserAccountSidebar). */
export function mapPaymentMethodRowForCustomerWeb(m: Record<string, unknown>) {
  const last4 = m.card_last4 != null ? String(m.card_last4) : '';
  const resolvedType = clientPaymentTypeFromRow(m);
  return {
    id: String(m.id),
    type: resolvedType,
    payment_type: resolvedType,
    cardNumber: last4,
    cardHolderName:
      m.card_holder_name != null ? String(m.card_holder_name) : undefined,
    expiryMonth:
      m.card_expiry_month != null ? String(m.card_expiry_month) : undefined,
    expiryYear:
      m.card_expiry_year != null ? String(m.card_expiry_year) : undefined,
    cardType: (m.card_brand as string) || undefined,
    upiId: m.upi_id != null ? String(m.upi_id) : undefined,
    bankName: m.bank_name != null ? String(m.bank_name) : undefined,
    isDefault: Boolean(m.is_default),
    createdAt: m.created_at != null ? String(m.created_at) : '',
    updatedAt: m.updated_at != null ? String(m.updated_at) : '',
  };
}

export async function seedPackagesForCustomer(customerId: string): Promise<void> {
  await seedFinitePackagesMissingSessionsForScope({ query } as SqlClient, { customerId });
}
