/**
 * Vendor custom-service package: Razorpay order + catalog / package_purchases / PSS seeding.
 */

import { createHmac } from 'crypto';
import { query, insert } from '../database/rds-connection';
import { getRazorpayConfig, razorpayRequest } from './payments/razorpay-client';
import { seedPackageScheduledSessionsIfMissing, type SqlClient } from './package-session-sync';
import {
  isServicePackageUnlimited,
  resolveFiniteSessionCountFromServicePackage,
  resolveServicePackageDisplayName,
} from './service-package-sessions';
import { resolveVendorId } from './vendor-resolve';

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export type VendorPackageSessionScheduleItem = {
  sessionNumber?: number;
  date?: string;
  time?: string;
};

/** Computed purchase shape (no DB writes). */
export type VendorPackageComputation = {
  customerId: string;
  vendorId: string;
  vendorServiceId: string;
  vs: Record<string, unknown>;
  meta: Record<string, unknown>;
  details: Record<string, unknown>;
  priceNum: number;
  displayName: string;
  serviceType: string;
  serviceStyle: string;
  validityDays: number;
  unlimited: boolean;
  totalSessionsNum: number;
  unlimitedPurchase: boolean;
  finiteSessions: number;
  totalSessionsForPurchase: number;
  packageDisplayName: string;
  expiresAt: Date;
};

export async function computeVendorPackagePurchase(params: {
  customerId: string;
  vendorIdRaw: string;
  vendorServiceId: string;
}): Promise<{ ok: true; comp: VendorPackageComputation } | { ok: false; status: number; error: string }> {
  const { customerId, vendorServiceId } = params;
  const vendorId = await resolveVendorId(String(params.vendorIdRaw));

  const vsRows = await query(
    `SELECT vs.id, vs.vendor_id, vs.service_id, vs.service_name, vs.metadata, vs.service_style,
            vs.price, vs.duration_minutes, vs.category
     FROM vendor_services vs
     WHERE vs.id = $1::uuid`,
    [vendorServiceId]
  );
  if (vsRows.rows.length === 0) {
    return { ok: false, status: 404, error: 'Vendor service not found' };
  }
  const vs = vsRows.rows[0] as Record<string, unknown>;
  if (String(vs.vendor_id).toLowerCase() !== String(vendorId).toLowerCase()) {
    return { ok: false, status: 403, error: 'Vendor service does not belong to this vendor' };
  }

  const meta = parseJsonObject(vs.metadata);
  if (!meta || !Boolean(meta.isPackage)) {
    return {
      ok: false,
      status: 400,
      error: 'This vendor service must have metadata.isPackage = true to purchase as a package',
    };
  }
  const details = parseJsonObject(meta.packageDetails) || {};
  const totalSessionsRaw =
    details.totalSessions ??
    details.total_sessions ??
    details.sessionCount ??
    meta.totalSessions;
  const totalSessionsNum = Math.max(1, Math.min(365, Number(totalSessionsRaw) || 1));
  const unlimited =
    Boolean(details.unlimited) ||
    Boolean(meta.unlimitedUsage) ||
    (Number(details.totalSessions) < 0 && Number.isFinite(Number(details.totalSessions))) ||
    (Number(meta.sessionCount) < 0 && Number.isFinite(Number(meta.sessionCount)));

  const priceNum = Math.max(
    0,
    Number(details.price ?? details.packagePrice ?? vs.price ?? vs.custom_price ?? 0) || 0
  );
  const displayName = String(vs.service_name || meta.serviceName || 'Package').trim() || 'Package';
  const serviceType = String(vs.category || meta.serviceType || 'walking')
    .toLowerCase()
    .replace(/\s+/g, '_');
  const serviceStyle = String(vs.service_style || meta.serviceStyle || 'at_home').toLowerCase();

  const validityDays = Math.max(
    1,
    Number(details.validityDays ?? details.packageDuration ?? details.package_duration) || 30
  );

  const shadowCatalog = {
    vendor_id: vendorId,
    name: displayName,
    description: `vendor_service:${vendorServiceId}`,
    service_type: serviceType,
    price: priceNum,
    session_count: unlimited ? -1 : totalSessionsNum,
    total_sessions: unlimited ? -1 : totalSessionsNum,
    sessions_included: unlimited ? -1 : totalSessionsNum,
    validity_days: validityDays,
    service_style: serviceStyle,
    is_active: true,
  };
  const unlimitedPurchase = unlimited || isServicePackageUnlimited(shadowCatalog);
  const finiteSessions = unlimitedPurchase ? 0 : resolveFiniteSessionCountFromServicePackage(shadowCatalog);
  const totalSessionsForPurchase = unlimitedPurchase ? 0 : finiteSessions;
  const packageDisplayName = resolveServicePackageDisplayName(shadowCatalog);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  return {
    ok: true,
    comp: {
      customerId,
      vendorId,
      vendorServiceId,
      vs,
      meta,
      details,
      priceNum,
      displayName,
      serviceType,
      serviceStyle,
      validityDays,
      unlimited,
      totalSessionsNum,
      unlimitedPurchase,
      finiteSessions,
      totalSessionsForPurchase,
      packageDisplayName,
      expiresAt,
    },
  };
}

export async function insertVendorServiceCatalogPackage(comp: VendorPackageComputation): Promise<string> {
  const { vendorId, displayName, vendorServiceId, serviceType, priceNum, unlimited, totalSessionsNum, validityDays, serviceStyle } = comp;
  const catalogInsert = await query(
    `INSERT INTO service_packages (
       vendor_id, name, package_name, description, service_type, price,
       session_count, total_sessions, sessions_included, validity_days, is_active, service_style,
       created_at, updated_at
     ) VALUES (
       $1::uuid, $2, $2, $3, $4, $5::numeric,
       $6, $6, $6, $7::int, true, $8,
       NOW(), NOW()
     ) RETURNING id`,
    [
      vendorId,
      displayName,
      `vendor_service:${vendorServiceId}`,
      serviceType,
      priceNum,
      unlimited ? -1 : totalSessionsNum,
      validityDays,
      serviceStyle,
    ]
  );
  const id = catalogInsert.rows[0]?.id;
  if (!id) throw new Error('Failed to create catalog package row');
  return String(id);
}

function deterministicPurchaseIdFromOrder(razorpayOrderId: string): string {
  const safe = String(razorpayOrderId || '').replace(/[^a-zA-Z0-9_]/g, '_');
  const base = `pur_vpkg_${safe}`;
  return base.length > 200 ? base.slice(0, 200) : base;
}

/** Stable `package_purchases.purchase_id` for a Razorpay order (idempotent finalize). */
export function vendorPackagePurchaseIdForRazorpayOrder(razorpayOrderId: string): string {
  return deterministicPurchaseIdFromOrder(razorpayOrderId);
}

export async function insertPackagePurchaseRows(
  comp: VendorPackageComputation,
  catalogPackageId: string,
  opts: {
    paymentStatus: 'pending' | 'completed';
    preferSameProvider: boolean;
    sessionSchedule: VendorPackageSessionScheduleItem[];
    razorpayOrderId?: string | null;
    paymentId?: string | null;
  }
): Promise<{ purchase: Record<string, unknown> }> {
  const {
    customerId,
    vendorId,
    packageDisplayName,
    priceNum,
    totalSessionsForPurchase,
    unlimitedPurchase,
    expiresAt,
  } = comp;
  const { paymentStatus, preferSameProvider, sessionSchedule, razorpayOrderId, paymentId } = opts;

  const purchaseId = razorpayOrderId
    ? deterministicPurchaseIdFromOrder(razorpayOrderId)
    : `pur_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const existing = await query(`SELECT * FROM package_purchases WHERE purchase_id = $1 LIMIT 1`, [purchaseId]);
  let purchase = existing.rows[0] as Record<string, unknown> | undefined;

  if (!purchase?.id) {
    const cols: string[] = [
      'purchase_id',
      'package_id',
      'customer_id',
      'vendor_id',
      'package_name',
      'package_type',
      'package_price',
      'total_sessions',
      'remaining_sessions',
      'unlimited_usage',
      'amount',
      'payment_status',
      'status',
      'preferred_vendor_id',
      'preferred_staff_id',
      'auto_assign_same_provider',
      'expires_at',
      'activated_at',
    ];
    const vals: unknown[] = [
      purchaseId,
      catalogPackageId,
      customerId,
      vendorId,
      packageDisplayName,
      'bundle',
      priceNum,
      totalSessionsForPurchase,
      totalSessionsForPurchase,
      unlimitedPurchase,
      priceNum,
      paymentStatus,
      'active',
      preferSameProvider ? vendorId : null,
      null,
      preferSameProvider,
      expiresAt.toISOString(),
      new Date().toISOString(),
    ];

    if (paymentId && isValidUuid(paymentId)) {
      cols.push('payment_id');
      vals.push(paymentId);
    }

    const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
    const ins = await query(
      `INSERT INTO package_purchases (${cols.join(', ')})
       VALUES (${ph})
       ON CONFLICT (purchase_id) DO NOTHING
       RETURNING *`,
      vals
    );
    purchase = ins.rows[0] as Record<string, unknown> | undefined;
  }

  if (!purchase?.id) {
    const again = await query(`SELECT * FROM package_purchases WHERE purchase_id = $1 LIMIT 1`, [purchaseId]);
    purchase = again.rows[0] as Record<string, unknown>;
  }
  if (!purchase?.id) {
    throw new Error('Failed to create or load package purchase');
  }

  const db = { query } as SqlClient;
  await seedPackageScheduledSessionsIfMissing(db, String(purchase.id));

  for (const sched of sessionSchedule || []) {
    const sn = Number((sched as any).sessionNumber);
    if (!Number.isFinite(sn) || sn < 1) continue;
    await query(
      `UPDATE package_scheduled_sessions
       SET scheduled_date = $1::date,
           scheduled_time = $2::time,
           status = 'scheduled',
           updated_at = NOW()
       WHERE package_purchase_id = $3::uuid AND session_number = $4`,
      [(sched as any).date || null, (sched as any).time || null, purchase.id, sn]
    );
  }

  return { purchase };
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function createRazorpayOrderForVendorPackage(params: {
  customerId: string;
  vendorId: string;
  vendorServiceId: string;
  amount: number;
  currency?: string;
}): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  paymentId: string;
}> {
  const { customerId, vendorId, vendorServiceId, amount, currency = 'INR' } = params;
  const config = await getRazorpayConfig();
  if (!config?.keyId || !config?.keySecret) {
    throw new Error('Razorpay is not configured');
  }

  const amt = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('Invalid amount for Razorpay order');
  }

  const receipt = `vp_${String(Date.now())}`.slice(0, 40);
  const notes: Record<string, string> = {
    type: 'vendor_package',
    vendorServiceId: String(vendorServiceId),
    customerId: String(customerId),
    vendorId: String(vendorId),
  };

  const orderData = {
    amount: Math.round(amt * 100),
    currency,
    receipt,
    notes,
  };

  const razorpayOrder = (await razorpayRequest('/orders', 'POST', orderData, 20000)) as {
    id?: string;
    amount?: number;
    currency?: string;
  };
  if (!razorpayOrder?.id) {
    throw new Error('Failed to create Razorpay order');
  }

  const payRows = await insert('payments', {
    booking_id: null,
    customer_id: customerId,
    vendor_id: vendorId,
    razorpay_order_id: razorpayOrder.id,
    amount: amt,
    currency,
    payment_method: 'razorpay',
    payment_status: 'pending',
  });

  const row = Array.isArray(payRows) ? payRows[0] : payRows;
  const paymentId = row?.id != null ? String(row.id) : '';
  if (!paymentId) {
    throw new Error('Failed to create payment row');
  }

  return {
    orderId: razorpayOrder.id,
    amount: (razorpayOrder.amount ?? Math.round(amt * 100)) / 100,
    currency: razorpayOrder.currency || currency,
    keyId: config.keyId,
    paymentId,
  };
}

export function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  keySecret: string
): boolean {
  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  const generated = createHmac('sha256', keySecret).update(text).digest('hex');
  return generated === String(razorpaySignature || '').trim();
}
