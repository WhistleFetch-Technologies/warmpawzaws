/**
 * ============================================================================
 * PACKAGE BOOKING ENDPOINTS
 * ============================================================================
 * 
 * Handles package-aware booking flows:
 * - Check active packages before booking
 * - Book using package credits
 * - Convert trial to package
 * - Schedule package sessions
 * - Track package usage
 * 
 * Date: 2026-01-15
 * ============================================================================
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import { query, insert, update, select } from '../database/rds-connection';
import { resolvePostgresCustomerIdFromAuthHeaders } from './customer/customerEndpoint/customer-password';
import { resolveVendorsTableIdFromAuthHeaders } from './vendor/vendor-auth-password';
import {
  seedPackageScheduledSessionsIfMissing,
  seedFinitePackagesMissingSessionsForScope,
  seedFinitePackagesMissingSessionsForVendor,
  reconcileRemainingSessionsForFinitePackage,
  pickNextPendingSessionNumber,
  pickNextUnlimitedPackageSessionNumber,
  linkPackageScheduledSessionToBooking,
  type SqlClient,
} from '../utils/package-session-sync';
import {
  sqlPackagePurchaseActiveForListing,
  sqlPackagePurchaseComputedStatus,
  sqlPackagePurchaseHasBookableSlot,
} from '../utils/package-session-eligibility';
import {
  isServicePackageUnlimited,
  resolveFiniteSessionCountFromServicePackage,
  resolveServicePackageDisplayName,
} from '../utils/service-package-sessions';
import { resolveVendorId } from '../utils/vendor-resolve';
import { getRazorpayConfig } from '../utils/payments/razorpay-client';
import {
  computeVendorPackagePurchase,
  insertVendorServiceCatalogPackage,
  insertPackagePurchaseRows,
  createRazorpayOrderForVendorPackage,
  verifyRazorpayPaymentSignature,
  vendorPackagePurchaseIdForRazorpayOrder,
  type VendorPackageComputation,
} from '../utils/vendor-package-razorpay-flow';
import { quotePackagePricing, resolvePackagePolicySnapshot } from '../utils/package-pricing';
import { createPackageBookingsAfterPayment } from '../utils/package-bookings';

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

async function resolveCustomerUuidForPackage(customerRef: string): Promise<string | null> {
  const ref = String(customerRef || '').trim();
  if (!ref) return null;
  const r = await query(
    `SELECT id FROM customers
     WHERE id::text = $1
        OR LOWER(REGEXP_REPLACE(TRIM(phone), '\\s', '', 'g')) = LOWER(REGEXP_REPLACE(TRIM($1), '\\s', '', 'g'))
     LIMIT 1`,
    [ref]
  ).catch(() => ({ rows: [] as any[] }));
  return r.rows?.[0]?.id ? String(r.rows[0].id) : null;
}

function isLikelyCustomerUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

function uuidOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return isLikelyCustomerUuid(s) ? s : null;
}

/** Map vendor_services.service_style to bookings.service_type CHECK values. */
function bookingServiceTypeForPackageStyle(style: string): string {
  const s = String(style || '').toLowerCase();
  if (s === 'tele' || s === 'online') return 'tele';
  if (s === 'at_home') return 'at_home';
  if (s === 'at_center') return 'at_center';
  return 'at_vendor';
}

function normalizeScheduleDateInput(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function normalizeScheduleTimeInput(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return '';
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  const ss = m[3] != null ? Math.max(0, Math.min(59, parseInt(m[3], 10))) : 0;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = normalizeScheduleDateInput(isoDate);
  if (!base) return '';
  const d = new Date(`${base}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function resolvePackageCadenceConfig(
  db: SqlClient,
  pkg: Record<string, unknown>
): Promise<{ sessionsPerDay: number; sessionIntervalDays: number }> {
  const snapshot = parseJsonObject(pkg.package_snapshot);
  const snapshotPackageDetails = parseJsonObject(snapshot?.packageDetails);
  const snapSpd = Number(
    snapshot?.sessionsPerDay ??
      snapshot?.sessions_per_day ??
      snapshotPackageDetails?.sessionsPerDay ??
      snapshotPackageDetails?.sessions_per_day
  );
  const snapInterval = Number(
    snapshot?.sessionIntervalDays ??
      snapshot?.session_interval_days ??
      snapshotPackageDetails?.sessionIntervalDays ??
      snapshotPackageDetails?.session_interval_days
  );
  if (Number.isFinite(snapSpd) && snapSpd > 0) {
    return {
      sessionsPerDay: Math.max(1, Math.min(24, Math.floor(snapSpd))),
      sessionIntervalDays:
        Number.isFinite(snapInterval) && snapInterval > 0
          ? Math.max(1, Math.min(366, Math.floor(snapInterval)))
          : 7,
    };
  }

  const serviceId = await resolveCanonicalServiceIdForPackage(db, pkg);
  if (!serviceId) {
    return { sessionsPerDay: 1, sessionIntervalDays: 7 };
  }
  const vs = await db.query(
    `SELECT metadata FROM vendor_services WHERE id = $1::uuid LIMIT 1`,
    [serviceId]
  );
  const meta = parseJsonObject(vs.rows?.[0]?.metadata);
  const details = parseJsonObject(meta?.packageDetails);
  const spd = Number(
    details?.sessionsPerDay ?? details?.sessions_per_day ?? meta?.sessionsPerDay ?? meta?.sessions_per_day
  );
  const interval = Number(
    details?.sessionIntervalDays ??
      details?.session_interval_days ??
      meta?.sessionIntervalDays ??
      meta?.session_interval_days
  );
  return {
    sessionsPerDay: Number.isFinite(spd) && spd > 0 ? Math.max(1, Math.min(24, Math.floor(spd))) : 1,
    sessionIntervalDays:
      Number.isFinite(interval) && interval > 0 ? Math.max(1, Math.min(366, Math.floor(interval))) : 7,
  };
}

async function resolveCanonicalServiceIdForPackage(
  db: SqlClient,
  pkg: Record<string, unknown>
): Promise<string | null> {
  const vendorId = String(pkg.vendor_id || '').trim();
  const direct = uuidOrNull(pkg.package_id);
  if (direct) {
    const vr = await db.query(
      `SELECT id FROM vendor_services WHERE id = $1::uuid AND vendor_id = $2::uuid LIMIT 1`,
      [direct, vendorId]
    );
    if (vr.rows?.[0]?.id) return String(vr.rows[0].id);
  }

  const snapshot = parseJsonObject(pkg.package_snapshot);
  const fromSnapshot = uuidOrNull(
    snapshot?.vendorServiceId ??
      snapshot?.vendor_service_id ??
      snapshot?.serviceId ??
      snapshot?.service_id
  );
  if (fromSnapshot) {
    const vr = await db.query(
      `SELECT id FROM vendor_services WHERE id = $1::uuid AND vendor_id = $2::uuid LIMIT 1`,
      [fromSnapshot, vendorId]
    );
    if (vr.rows?.[0]?.id) return String(vr.rows[0].id);
  }

  if (direct) {
    const sp = await db.query(
      `SELECT description
       FROM service_packages
       WHERE id = $1::uuid
       LIMIT 1`,
      [direct]
    );
    if (sp.rows?.[0]) {
      const row = sp.rows[0] as Record<string, unknown>;
      const desc = String(row.description || '').trim();
      const m = desc.match(/vendor_service:([0-9a-fA-F-]{36})/);
      const fromDesc = m?.[1] ? uuidOrNull(m[1]) : null;
      const candidate = fromDesc;
      if (candidate) {
        const vr = await db.query(
          `SELECT id FROM vendor_services WHERE id = $1::uuid AND vendor_id = $2::uuid LIMIT 1`,
          [candidate, vendorId]
        );
        if (vr.rows?.[0]?.id) return String(vr.rows[0].id);
      }
    }
  }

  // Strict: no silent fallback to "first vendor_services row". Caller must surface
  // a 400 with a clear error so the package row never points at an arbitrary service.
  return null;
}

async function resolveCanonicalPackageBookingId(
  db: SqlClient,
  pkg: Record<string, unknown>,
  firstScheduled?: { scheduled_date?: unknown; scheduled_time?: unknown }
): Promise<string> {
  const packagePurchaseId = String(pkg.id || '').trim();
  if (!packagePurchaseId) return '';

  const existing = await db.query(
    `SELECT id
     FROM bookings
     WHERE package_purchase_id = $1::uuid
     ORDER BY CASE WHEN COALESCE(is_package_session, false) = false THEN 0 ELSE 1 END ASC,
              created_at ASC NULLS LAST,
              updated_at ASC NULLS LAST
     LIMIT 1`,
    [packagePurchaseId]
  );
  const existingId =
    existing.rows?.[0]?.id != null ? String(existing.rows[0].id).trim() : '';
  if (existingId) return existingId;

  const serviceStyle = String(pkg.service_style || '').toLowerCase();
  const serviceType = bookingServiceTypeForPackageStyle(serviceStyle);
  const serviceId = await resolveCanonicalServiceIdForPackage(db, pkg);
  if (!serviceId) {
    throw new Error('Unable to resolve vendor service for canonical package booking');
  }
  const bookingDate =
    normalizeScheduleDateInput(firstScheduled?.scheduled_date) ||
    normalizeScheduleDateInput(pkg.purchased_at) ||
    new Date().toISOString().slice(0, 10);
  const bookingTime =
    normalizeScheduleTimeInput(firstScheduled?.scheduled_time) || '09:00:00';
  const totalAmount = Number(pkg.package_price ?? pkg.amount ?? 0) || 0;
  const paymentStatus =
    String(pkg.payment_status || '').toLowerCase() === 'completed' ? 'paid' : 'pending';

  const ins = await db.query(
    `INSERT INTO bookings (
       customer_id, vendor_id, service_id,
       booking_date, booking_time, service_type,
       status, payment_status,
       base_price, discount_amount, tax_amount, total_amount,
       is_package, package_id, package_details, package_purchase_id,
       is_package_session, notes
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid,
       $4::date, $5::time, $6,
       'confirmed', $7,
       $8::numeric, 0, 0, $8::numeric,
       true, $9::uuid, $10::jsonb, $11::uuid,
       false, $12
     )
     RETURNING id`,
    [
      String(pkg.customer_id),
      String(pkg.vendor_id),
      serviceId,
      bookingDate,
      bookingTime.length === 5 ? `${bookingTime}:00` : bookingTime,
      serviceType,
      paymentStatus,
      totalAmount,
      serviceId,
      JSON.stringify({
        kind: 'package_purchase_backfill',
        packagePurchaseId,
      }),
      packagePurchaseId,
      'Auto-linked canonical booking for package sessions',
    ]
  );
  return ins.rows?.[0]?.id != null ? String(ins.rows[0].id).trim() : '';
}

/**
 * Package-only checkout creates package_purchases but no bookings row — vendor UIs list `bookings`.
 * Creates one confirmed "package purchase" booking + vendor notification (best-effort).
 */
async function syncVendorPackagePurchaseToBookingAndNotify(params: {
  customerId: string;
  vendorId: string;
  vendorServiceId: string;
  comp: VendorPackageComputation;
  purchase: Record<string, unknown>;
  catalogPackageId: string;
  sessionSchedule: Array<{ sessionNumber?: number; date?: string; time?: string }>;
  paymentId: string | null;
  petId: string | null;
}): Promise<string | null> {
  const {
    customerId,
    vendorId,
    vendorServiceId,
    comp,
    purchase,
    catalogPackageId,
    sessionSchedule,
    paymentId,
    petId,
  } = params;
  const purchaseRowId = String(purchase.id || '').trim();
  if (!purchaseRowId) return null;

  try {
    const dup = await query(`SELECT id FROM bookings WHERE package_purchase_id = $1::uuid LIMIT 1`, [
      purchaseRowId,
    ]);
    if (dup.rows?.length) {
      return String((dup.rows[0] as { id: string }).id);
    }

    const first = (sessionSchedule || []).find((s) => s?.date && String(s.date).trim());
    const bookingDate =
      first?.date && String(first.date).trim()
        ? String(first.date).trim().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const rawTime = String(first?.time || '09:00').trim();
    const bookingTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;

    const serviceType = bookingServiceTypeForPackageStyle(comp.serviceStyle);
    const amt = Number(comp.priceNum) || 0;
    const sessionsLabel = comp.unlimitedPurchase
      ? 'unlimited sessions'
      : `${comp.totalSessionsForPurchase || comp.totalSessionsNum} session(s)`;

    const notes = `Package purchased — ${sessionsLabel}. Book individual visits from package credits.`;

    const pkgDetails = JSON.stringify({
      kind: 'vendor_service_package_purchase',
      vendorServiceId,
      catalogPackageId,
      packagePurchaseId: purchaseRowId,
      unlimited: comp.unlimitedPurchase,
    });

    const petUuid = uuidOrNull(petId);
    const payUuid = uuidOrNull(paymentId);

    const ins = await query(
      `INSERT INTO bookings (
         customer_id, vendor_id, pet_id, service_id,
         booking_date, booking_time, service_type,
         status, payment_status,
         base_price, discount_amount, tax_amount, total_amount,
         is_package, package_id, package_details, package_purchase_id,
         is_package_session, notes, payment_id
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5::date, $6::time, $7,
         'confirmed', 'paid',
         $8::numeric, 0, 0, $8::numeric,
         true, $9::uuid, $10::jsonb, $11::uuid,
         false, $12, $13::uuid
       )
       RETURNING id`,
      [
        customerId,
        vendorId,
        petUuid,
        vendorServiceId,
        bookingDate,
        bookingTime,
        serviceType,
        amt,
        catalogPackageId,
        pkgDetails,
        purchaseRowId,
        notes,
        payUuid,
      ]
    );
    const bookingId = ins.rows?.[0]?.id != null ? String((ins.rows[0] as { id: string }).id) : null;

    if (bookingId && payUuid) {
      await query(`UPDATE payments SET booking_id = $1::uuid WHERE id = $2::uuid AND booking_id IS NULL`, [
        bookingId,
        payUuid,
      ]).catch(() => undefined);
    }

    let customerName = 'Customer';
    try {
      const cr = await query(`SELECT name FROM customers WHERE id = $1::uuid LIMIT 1`, [customerId]);
      const n = (cr.rows?.[0] as { name?: string } | undefined)?.name;
      if (n && String(n).trim()) customerName = String(n).trim();
    } catch {
      /* ignore */
    }

    try {
      await insert('notifications', {
        recipient_id: vendorId,
        recipient_type: 'vendor',
        notification_type: 'new_booking',
        title: 'New package purchase',
        message: `${customerName} bought package "${comp.packageDisplayName}" • ${sessionsLabel} • paid ₹${amt}`,
        channels: { email: false, sms: false, inApp: true, push: false },
        data: JSON.stringify({
          bookingId,
          packagePurchaseId: purchaseRowId,
          customerId,
          customerName,
          kind: 'package_purchase',
          vendorServiceId,
          totalSessions: comp.totalSessionsForPurchase || comp.totalSessionsNum,
        }),
        is_read: false,
        created_at: new Date(),
      });
    } catch (notifErr) {
      console.warn('[purchase-from-vendor-service] vendor notification failed:', notifErr);
    }

    return bookingId;
  } catch (e) {
    console.error('[purchase-from-vendor-service] syncVendorPackagePurchaseToBookingAndNotify:', e);
    return null;
  }
}

function mapSessionRow(
  s: any,
  endOtpByBooking?: Map<string, string>,
  packageBookingId?: string
) {
  const st = String(s.status || '');
  const bst = s.booking_status != null ? String(s.booking_status) : '';
  let displayStatus = st;
  if (st === 'scheduled' && bst === 'in_progress') {
    displayStatus = 'in_progress';
  } else if (st === 'scheduled' && bst === 'completed') {
    displayStatus = 'completed';
  }

  /** Slot row may be missing `booking_id` when sessions were pre-scheduled; booking still matches by package + session #. */
  const resolvedBookingId =
    s.resolved_booking_id != null && String(s.resolved_booking_id).trim()
      ? String(s.resolved_booking_id).trim()
      : s.booking_id != null
        ? String(s.booking_id).trim()
        : packageBookingId != null && String(packageBookingId).trim()
          ? String(packageBookingId).trim()
          : '';
  const fromToken =
    resolvedBookingId && endOtpByBooking ? endOtpByBooking.get(resolvedBookingId) : undefined;
  // completion_otp on bookings is not migrated everywhere; use otp_end_code + otp_tokens only.
  const completionFromRow =
    s.booking_otp_end_code ??
    (fromToken != null && String(fromToken).trim() ? String(fromToken).trim() : null);
  const otpCodeRaw = s.booking_otp_code != null ? String(s.booking_otp_code).trim() : '';
  const startRaw =
    (s.booking_otp_start_code != null && String(s.booking_otp_start_code).trim()) || '';
  const completionRaw = completionFromRow != null ? String(completionFromRow).trim() : '';

  const otpVerified = Boolean(s.booking_otp_verified);
  const otpStartVerified = Boolean(s.booking_otp_start_verified);
  const otpEndVerified = Boolean(s.booking_otp_end_verified);
  const serviceType = s.booking_service_type != null ? String(s.booking_service_type) : '';
  const serviceStyle = serviceType || '';

  const parentBookingId =
    s.booking_parent_id != null && String(s.booking_parent_id).trim()
      ? String(s.booking_parent_id).trim()
      : packageBookingId != null && String(packageBookingId).trim()
        ? String(packageBookingId).trim()
        : undefined;
  const packagePurchaseIdOnRow =
    s.package_purchase_id != null && String(s.package_purchase_id).trim()
      ? String(s.package_purchase_id).trim()
      : s.booking_package_purchase_id != null && String(s.booking_package_purchase_id).trim()
        ? String(s.booking_package_purchase_id).trim()
        : undefined;

  return {
    id: s.id,
    session_number: s.session_number,
    sessionNumber: s.session_number,
    status: st,
    display_status: displayStatus,
    scheduled_date: s.scheduled_date,
    scheduledDate: s.scheduled_date,
    scheduled_time: s.scheduled_time,
    scheduledTime: s.scheduled_time,
    booking_id: resolvedBookingId || undefined,
    bookingId: resolvedBookingId || undefined,
    parent_booking_id: parentBookingId,
    parentBookingId,
    package_purchase_id: packagePurchaseIdOnRow,
    packagePurchaseId: packagePurchaseIdOnRow,
    booking_status: bst || undefined,
    booking_date: s.booking_date,
    bookingDate: s.booking_date,
    booking_time: s.booking_time,
    bookingTime: s.booking_time,
    /** ISO datetime convenience for vendor calendars. */
    session_date_time:
      s.scheduled_date && s.scheduled_time
        ? `${String(s.scheduled_date).slice(0, 10)}T${String(s.scheduled_time)}`
        : undefined,
    sessionDateTime:
      s.scheduled_date && s.scheduled_time
        ? `${String(s.scheduled_date).slice(0, 10)}T${String(s.scheduled_time)}`
        : undefined,
    completed_at: s.completed_at,
    completedAt: s.completed_at,
    /** Linked visit: OTPs for check-in / start / end (customer-only in GET /packages/.../sessions). */
    service_type: serviceType || undefined,
    serviceType: serviceType || undefined,
    service_style: serviceStyle || undefined,
    serviceStyle: serviceStyle || undefined,
    otp_code: otpCodeRaw || undefined,
    otpCode: otpCodeRaw || undefined,
    start_otp: startRaw || undefined,
    startOTP: startRaw || undefined,
    completion_otp: completionRaw || undefined,
    completionOTP: completionRaw || undefined,
    otp_verified: otpVerified,
    otpVerified,
    otp_start_verified: otpStartVerified,
    otpStartVerified: otpStartVerified,
    otp_end_verified: otpEndVerified,
    otpEndVerified: otpEndVerified,
  };
}

/** Remove booking OTP fields (vendor / anonymous must not receive customer codes). */
function stripPackageSessionOtpsFromBody(body: { sessions?: unknown[] }) {
  const sessions = body?.sessions;
  if (!Array.isArray(sessions)) return;
  const keys = [
    'otpCode',
    'otp_code',
    'startOTP',
    'start_otp',
    'completionOTP',
    'completion_otp',
    'otpVerified',
    'otp_verified',
    'otpStartVerified',
    'otp_start_verified',
    'otpEndVerified',
    'otp_end_verified',
  ];
  for (const row of sessions) {
    if (!row || typeof row !== 'object') continue;
    const s = row as Record<string, unknown>;
    for (const k of keys) delete s[k];
  }
}

/** Standard read model for customer, vendor, and admin UIs. */
export async function buildPackageSessionsResponse(packagePurchaseId: string) {
  const db = { query } as SqlClient;
  await seedPackageScheduledSessionsIfMissing(db, packagePurchaseId);
  await reconcileRemainingSessionsForFinitePackage(db, packagePurchaseId);

  const loadRawSessions = async () =>
    (
      await query(
        `
        SELECT 
          pss.*,
          b.id AS resolved_booking_id,
          b.status as booking_status,
          b.booking_date,
          b.booking_time,
          b.completed_at,
          b.otp_code as booking_otp_code,
          b.otp_verified as booking_otp_verified,
          b.otp_start_code as booking_otp_start_code,
          b.otp_end_code as booking_otp_end_code,
          b.otp_start_verified as booking_otp_start_verified,
          b.otp_end_verified as booking_otp_end_verified,
          b.service_type as booking_service_type,
          b.parent_booking_id as booking_parent_id,
          b.package_purchase_id as booking_package_purchase_id
        FROM package_scheduled_sessions pss
        LEFT JOIN bookings b ON b.id = COALESCE(
          pss.booking_id,
          (
            SELECT b2.id
            FROM bookings b2
            WHERE b2.package_purchase_id = pss.package_purchase_id
              AND COALESCE(b2.is_package_session, false) = true
              AND b2.package_session_number IS NOT NULL
              AND b2.package_session_number = pss.session_number
              AND b2.parent_booking_id IS NOT NULL
            ORDER BY b2.created_at DESC NULLS LAST, b2.updated_at DESC NULLS LAST
            LIMIT 1
          ),
          (
            SELECT b3.id
            FROM bookings b3
            WHERE b3.package_purchase_id = pss.package_purchase_id
            ORDER BY b3.created_at DESC NULLS LAST, b3.updated_at DESC NULLS LAST
            LIMIT 1
          )
        )
        WHERE pss.package_purchase_id = $1
        ORDER BY pss.session_number ASC
      `,
        [packagePurchaseId]
      )
    ).rows as Array<Record<string, unknown>>;

  let rawSessions = await loadRawSessions();

  const packageResult = await query(
    `
        SELECT pp.*, v.business_name as vendor_name
             , (
                 SELECT b0.id
                 FROM bookings b0
                 WHERE b0.package_purchase_id = pp.id
                   AND COALESCE(b0.is_package_session, false) = false
                   AND b0.parent_booking_id IS NULL
                 ORDER BY b0.created_at ASC NULLS LAST, b0.updated_at ASC NULLS LAST
                 LIMIT 1
               ) AS package_booking_id
        FROM package_purchases pp
        LEFT JOIN vendors v ON pp.vendor_id = v.id
        WHERE pp.id = $1
      `,
    [packagePurchaseId]
  );

  const pkg = packageResult.rows[0];
  if (!pkg) return null;
  const seededSessions = rawSessions
    .filter(
      (r) =>
        r?.scheduled_date != null &&
        String(r.scheduled_date).trim() &&
        r?.scheduled_time != null &&
        String(r.scheduled_time).trim()
    )
    .map((r) => ({
      sessionNumber: Number(r.session_number ?? 0),
      date: normalizeScheduleDateInput(r.scheduled_date),
      time: normalizeScheduleTimeInput(r.scheduled_time),
    }))
    .filter((r) => Number.isFinite(r.sessionNumber) && r.sessionNumber >= 1 && r.date && r.time)
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

  const firstScheduled = seededSessions[0];
  if (firstScheduled) {
    const firstDate = firstScheduled.date;
    const sameDaySlots = seededSessions.filter((r) => r.date === firstDate);
    if (sameDaySlots.length < 2) {
      // Do not propagate a single anchor time to all missing sessions.
      // Multi-slot patterns should come from explicit scheduling input.
      const packageBookingId = await resolveCanonicalPackageBookingId(
        db,
        pkg as Record<string, unknown>,
        firstScheduled
          ? { scheduled_date: firstScheduled.date, scheduled_time: firstScheduled.time }
          : undefined
      );

      if (packageBookingId) {
        (pkg as Record<string, unknown>).package_booking_id = packageBookingId;
        await query(
          `UPDATE package_scheduled_sessions
           SET booking_id = $2::uuid, updated_at = NOW()
           WHERE package_purchase_id = $1::uuid
             AND booking_id IS DISTINCT FROM $2::uuid`,
          [packagePurchaseId, packageBookingId]
        ).catch(() => undefined);
      }

      const bookingIds = [
        ...new Set(
          rawSessions
            .map((r: { booking_id?: string; resolved_booking_id?: string }) => {
              const id =
                r?.resolved_booking_id != null && String(r.resolved_booking_id).trim()
                  ? String(r.resolved_booking_id).trim()
                  : r?.booking_id != null
                    ? String(r.booking_id).trim()
                    : '';
              return id;
            })
            .filter(Boolean)
        ),
      ];
      const endOtpByBooking = new Map<string, string>();
      if (bookingIds.length > 0) {
        const endRes = await query(
          `SELECT DISTINCT ON (metadata->>'bookingId')
             metadata->>'bookingId' AS bid,
             otp_code
           FROM otp_tokens
           WHERE metadata->>'action' = 'end'
             AND COALESCE(is_used, false) = false
             AND (expires_at IS NULL OR expires_at > NOW())
             AND metadata->>'bookingId' = ANY($1::text[])
           ORDER BY metadata->>'bookingId', created_at DESC`,
          [bookingIds]
        ).catch(() => ({ rows: [] as { bid?: string; otp_code?: string }[] }));
        for (const row of endRes.rows || []) {
          const id = row.bid != null ? String(row.bid) : '';
          const code = row.otp_code != null ? String(row.otp_code).trim() : '';
          if (id && code) endOtpByBooking.set(id, code);
        }
      }
      const sessions = rawSessions.map((r: any) =>
        mapSessionRow(r, endOtpByBooking, packageBookingId)
      );
      const completedCount = sessions.filter((s: any) => s.display_status === 'completed' || s.status === 'completed').length;
      const inProgressCount = sessions.filter((s: any) => s.display_status === 'in_progress' || s.status === 'in_progress').length;
      const scheduledCount = sessions.filter((s: any) => s.status === 'scheduled').length;
      const pendingCount = sessions.filter((s: any) => s.status === 'pending').length;
      const totalSessions = pkg?.total_sessions != null ? Number(pkg.total_sessions) : rawSessions.length;
      const denom = totalSessions > 0 ? totalSessions : 1;
      const remainingSessions =
        pkg?.remaining_sessions != null ? Number(pkg.remaining_sessions) : Math.max(0, totalSessions - completedCount);

      return {
        success: true,
        package: pkg,
        sessions,
        summary: {
          total: totalSessions,
          completed: completedCount,
          in_progress: inProgressCount,
          scheduled: scheduledCount,
          pending: pendingCount,
          remaining: remainingSessions,
          progressPercent: Math.round((completedCount / denom) * 100),
        },
      };
    }
    const slotTimes =
      sameDaySlots.length > 0
        ? sameDaySlots.map((s) => s.time)
        : [firstScheduled.time];
    const slotsPerDay = Math.max(1, slotTimes.length);
    const anchorNumber = firstScheduled.sessionNumber;
    const anchorDayIndex = Math.floor((anchorNumber - 1) / slotsPerDay);

    for (const row of rawSessions) {
      const hasDate = row?.scheduled_date != null && String(row.scheduled_date).trim();
      const hasTime = row?.scheduled_time != null && String(row.scheduled_time).trim();
      if (hasDate && hasTime) continue;
      const sessionNumber = Number(row?.session_number ?? 0);
      if (!Number.isFinite(sessionNumber) || sessionNumber < 1) continue;
      const dayIndex = Math.floor((sessionNumber - 1) / slotsPerDay);
      const dayOffset = dayIndex - anchorDayIndex;
      const slotIndex = (sessionNumber - 1) % slotsPerDay;
      const derivedDate = addDaysToIsoDate(firstDate, dayOffset);
      const derivedTime = slotTimes[slotIndex] || slotTimes[0] || '';
      if (!derivedDate || !derivedTime) continue;

      await query(
        `UPDATE package_scheduled_sessions
         SET scheduled_date = COALESCE(scheduled_date, $2::date),
             scheduled_time = COALESCE(scheduled_time, $3::time),
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [String(row.id), derivedDate, derivedTime]
      );
    }
    rawSessions = await loadRawSessions();
  }

  const packageBookingId = await resolveCanonicalPackageBookingId(
    db,
    pkg as Record<string, unknown>,
    firstScheduled
      ? { scheduled_date: firstScheduled.date, scheduled_time: firstScheduled.time }
      : undefined
  );

  if (packageBookingId) {
    (pkg as Record<string, unknown>).package_booking_id = packageBookingId;
    await query(
      `UPDATE package_scheduled_sessions
       SET booking_id = $2::uuid, updated_at = NOW()
       WHERE package_purchase_id = $1::uuid
         AND booking_id IS DISTINCT FROM $2::uuid`,
      [packagePurchaseId, packageBookingId]
    ).catch(() => undefined);
  }

  const bookingIds = [
    ...new Set(
      rawSessions
        .map((r: { booking_id?: string; resolved_booking_id?: string }) => {
          const id =
            r?.resolved_booking_id != null && String(r.resolved_booking_id).trim()
              ? String(r.resolved_booking_id).trim()
              : r?.booking_id != null
                ? String(r.booking_id).trim()
                : '';
          return id;
        })
        .filter(Boolean)
    ),
  ];
  const endOtpByBooking = new Map<string, string>();
  if (bookingIds.length > 0) {
    const endRes = await query(
      `SELECT DISTINCT ON (metadata->>'bookingId')
         metadata->>'bookingId' AS bid,
         otp_code
       FROM otp_tokens
       WHERE metadata->>'action' = 'end'
         AND COALESCE(is_used, false) = false
         AND (expires_at IS NULL OR expires_at > NOW())
         AND metadata->>'bookingId' = ANY($1::text[])
       ORDER BY metadata->>'bookingId', created_at DESC`,
      [bookingIds]
    ).catch(() => ({ rows: [] as { bid?: string; otp_code?: string }[] }));
    for (const row of endRes.rows || []) {
      const id = row.bid != null ? String(row.bid) : '';
      const code = row.otp_code != null ? String(row.otp_code).trim() : '';
      if (id && code) endOtpByBooking.set(id, code);
    }
  }
  const sessions = rawSessions.map((r: any) =>
    mapSessionRow(r, endOtpByBooking, packageBookingId)
  );
  const completedCount = sessions.filter((s: any) => s.display_status === 'completed' || s.status === 'completed').length;
  const inProgressCount = sessions.filter((s: any) => s.display_status === 'in_progress' || s.status === 'in_progress').length;
  const scheduledCount = sessions.filter((s: any) => s.status === 'scheduled').length;
  const pendingCount = sessions.filter((s: any) => s.status === 'pending').length;
  const totalSessions = pkg?.total_sessions != null ? Number(pkg.total_sessions) : rawSessions.length;
  const denom = totalSessions > 0 ? totalSessions : 1;
  const remainingSessions =
    pkg?.remaining_sessions != null ? Number(pkg.remaining_sessions) : Math.max(0, totalSessions - completedCount);

  return {
    success: true,
    package: pkg,
    sessions,
    summary: {
      total: totalSessions,
      completed: completedCount,
      in_progress: inProgressCount,
      scheduled: scheduledCount,
      pending: pendingCount,
      remaining: remainingSessions,
      progressPercent: Math.round((completedCount / denom) * 100),
    },
  };
}

async function packageSessionsAuthForRequest(
  c: Context,
  pkg: { customer_id?: string; vendor_id?: string }
): Promise<'customer' | 'vendor' | 'anonymous' | 'forbidden'> {
  const authRaw = c.req.header('Authorization') || c.req.header('authorization') || '';
  if (!authRaw.trim()) return 'anonymous';

  const headers: Record<string, string | undefined> = {
    authorization: authRaw,
    'x-uat-mode': c.req.header('x-uat-mode') || c.req.header('X-UAT-Mode'),
    'X-UAT-Mode': c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode'),
  };

  const [custId, vendId] = await Promise.all([
    resolvePostgresCustomerIdFromAuthHeaders(headers),
    resolveVendorsTableIdFromAuthHeaders(headers),
  ]);

  const custOk =
    custId &&
    pkg.customer_id != null &&
    String(custId).toLowerCase() === String(pkg.customer_id).toLowerCase();
  const vendOk =
    vendId &&
    pkg.vendor_id != null &&
    String(vendId).toLowerCase() === String(pkg.vendor_id).toLowerCase();
  if (custOk) return 'customer';
  if (vendOk) return 'vendor';
  return 'forbidden';
}

export function registerPackageBookingEndpoints(app: Hono) {
  
  /**
   * GET /customer/:customerId/packages/active
   * Get customer's active packages, optionally filtered by vendor/service type
   */
  app.get("/customer/:customerId/packages/active", async (c) => {
    try {
      const { customerId } = c.req.param();
      const vendorId = c.req.query('vendorId');
      const serviceType = c.req.query('serviceType');

      await seedFinitePackagesMissingSessionsForScope({ query } as SqlClient, {
        customerId,
        ...(vendorId ? { vendorId } : {}),
      });

      let packageQuery = `
        SELECT 
          pp.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.city as vendor_city,
          (pp.total_sessions - pp.remaining_sessions) as sessions_used,
          ${sqlPackagePurchaseComputedStatus('pp')} as computed_status
        FROM package_purchases pp
        LEFT JOIN vendors v ON pp.vendor_id = v.id
        WHERE pp.customer_id = $1
        AND pp.status = 'active'
        AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
        AND (${sqlPackagePurchaseActiveForListing('pp')})
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (vendorId) {
        packageQuery += ` AND pp.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (serviceType) {
        packageQuery += ` AND pp.package_type = $${paramIndex}`;
        params.push(serviceType);
        paramIndex++;
      }

      packageQuery += ` ORDER BY pp.expires_at ASC NULLS LAST, pp.created_at DESC`;

      const result = await query(packageQuery, params);

      // Get scheduled sessions for each package
      const packagesWithSessions = await Promise.all(
        result.rows.map(async (pkg: any) => {
          const sessionsResult = await query(`
            SELECT * FROM package_scheduled_sessions
            WHERE package_purchase_id = $1
            ORDER BY session_number ASC
          `, [pkg.id]);

          return {
            ...pkg,
            scheduledSessions: sessionsResult.rows,
            nextSession: sessionsResult.rows.find((s: any) => s.status === 'pending' || s.status === 'scheduled')
          };
        })
      );

      return c.json({
        success: true,
        packages: packagesWithSessions,
        total: packagesWithSessions.length,
        hasActivePackages: packagesWithSessions.length > 0
      });
    } catch (error: any) {
      console.error('Error fetching active packages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Note: GET /packages/check-for-booking is now in packages.ts
   * to avoid route conflicts with /packages/:packageId
   */

  /**
   * POST /bookings/create-from-package
   * Create a booking using package credits instead of new payment
   */
  app.post("/bookings/create-from-package", async (c) => {
    try {
      const body = await c.req.json();
      const {
        packagePurchaseId,
        customerId,
        vendorId,
        petId,
        serviceId,
        scheduledDate,
        scheduledTime,
        serviceType = 'at_center',
        notes,
        address
      } = body;

      if (!packagePurchaseId || !customerId || !vendorId) {
        return c.json({ 
          error: 'packagePurchaseId, customerId, and vendorId are required' 
        }, 400);
      }

      // ✅ FIX GAP-11.1: Check for active subscription first (zero payment)
      let isSubscriptionBooking = false;
      let subscriptionId = null;
      let finalAmount = 0;

      try {
        const subscriptionCheck = await query(
          `SELECT cs.id, cs.subscription_type, cs.is_unlimited, cs.usage_limit, cs.end_date
           FROM customer_subscriptions cs
           WHERE cs.customer_id = $1
             AND cs.status = 'active'
             AND (cs.end_date IS NULL OR cs.end_date > NOW())
             AND (cs.is_unlimited = true OR (cs.usage_limit IS NOT NULL AND cs.used_count < cs.usage_limit))
           ORDER BY cs.created_at DESC
           LIMIT 1`,
          [customerId]
        );

        if (subscriptionCheck.rows.length > 0) {
          const subscription = subscriptionCheck.rows[0];
          subscriptionId = subscription.id;
          isSubscriptionBooking = true;
          finalAmount = 0; // Zero payment for active subscription
          console.log(`[PACKAGE-BOOKING] ✅ Active subscription found: ${subscriptionId}. Setting amount to ₹0.`);
        }
      } catch (subError: any) {
        console.warn('[PACKAGE-BOOKING] Subscription check failed, proceeding with package:', subError);
      }

      const db = { query } as SqlClient;

      await seedPackageScheduledSessionsIfMissing(db, packagePurchaseId);

      // Verify package is active and has a bookable session slot (pending slot or unlimited)
      const packageResult = await query(`
        SELECT * FROM package_purchases
        WHERE id = $1 AND customer_id = $2
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (${sqlPackagePurchaseHasBookableSlot('package_purchases')})
      `, [packagePurchaseId, customerId]);

      if (packageResult.rows.length === 0) {
        return c.json({ 
          error: 'Package not found, expired, or has no remaining sessions' 
        }, 400);
      }

      const pkg = packageResult.rows[0];

      let nextSessionNumber: number;
      if (pkg.unlimited_usage) {
        nextSessionNumber = await pickNextUnlimitedPackageSessionNumber(db, packagePurchaseId);
      } else {
        const slot = await pickNextPendingSessionNumber(db, packagePurchaseId);
        if (slot == null) {
          return c.json(
            { error: 'No package session slots available', code: 'NO_SESSION_SLOTS' },
            400
          );
        }
        nextSessionNumber = slot;
      }

      // Check for slot conflicts
      const conflictCheck = await query(`
        SELECT id FROM bookings
        WHERE vendor_id = $1
        AND booking_date = $2
        AND booking_time = $3
        AND status NOT IN ('cancelled', 'rejected')
      `, [vendorId, scheduledDate, scheduledTime]);

      if (conflictCheck.rows.length > 0) {
        return c.json({ 
          error: 'This time slot is already booked',
          code: 'SLOT_CONFLICT'
        }, 409);
      }

      // Create the booking
      const bookingResult = await query(`
        INSERT INTO bookings (
          customer_id, vendor_id, pet_id, service_id,
          booking_date, booking_time, service_type,
          notes, address,
          package_purchase_id, is_package_session, package_session_number,
          subscription_id, subscription_booking,
          status, payment_status, total_amount
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9,
          $10, true, $11,
          $12, $13,
          'confirmed', $14, $15
        )
        RETURNING *
      `, [
        customerId, vendorId, petId, serviceId,
        scheduledDate, scheduledTime, serviceType,
        notes, address ? JSON.stringify(address) : null,
        packagePurchaseId, nextSessionNumber,
        subscriptionId, isSubscriptionBooking,
        isSubscriptionBooking ? 'paid' : 'completed', // ✅ Mark as paid for subscription
        finalAmount // ✅ Zero payment for subscription
      ]);

      const booking = bookingResult.rows[0];

      if (!pkg.unlimited_usage) {
        const linked = await linkPackageScheduledSessionToBooking(db, {
          packagePurchaseId,
          sessionNumber: nextSessionNumber,
          bookingId: booking.id,
          bookingDate: String(scheduledDate),
          bookingTime: String(scheduledTime),
        });
        if (!linked) {
          await query(`DELETE FROM bookings WHERE id = $1::uuid`, [booking.id]);
          return c.json(
            { error: 'Could not reserve package session slot', code: 'PACKAGE_SESSION_LINK_FAILED' },
            409
          );
        }
      }

      // Update customer provider history
      await query(`
        INSERT INTO customer_provider_history (
          customer_id, vendor_id, service_type, total_bookings,
          last_booking_id, last_booking_date
        ) VALUES ($1, $2, $3, 1, $4, NOW())
        ON CONFLICT (customer_id, vendor_id, service_type)
        DO UPDATE SET
          total_bookings = customer_provider_history.total_bookings + 1,
          last_booking_id = EXCLUDED.last_booking_id,
          last_booking_date = NOW(),
          updated_at = NOW()
      `, [customerId, vendorId, pkg.package_type || 'general', booking.id]);

      return c.json({
        success: true,
        booking: {
          id: booking.id,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          status: booking.status,
          isPackageSession: true,
          sessionNumber: nextSessionNumber,
          remainingSessions: pkg.unlimited_usage ? 'unlimited' : Number(pkg.remaining_sessions ?? 0)
        },
        package: {
          id: packagePurchaseId,
          remainingSessions: pkg.unlimited_usage ? 'unlimited' : Number(pkg.remaining_sessions ?? 0),
          totalSessions: pkg.total_sessions
        },
        message: `Booking created using package session ${nextSessionNumber}/${pkg.total_sessions}`
      });
    } catch (error: any) {
      console.error('Error creating booking from package:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /packages/post-trial-offers
   * Get package offers to show after a trial/first session
   */
  app.get("/packages/post-trial-offers", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const serviceType = c.req.query('serviceType');
      const bookingId = c.req.query('bookingId');

      if (!vendorId) {
        return c.json({ error: 'vendorId required' }, 400);
      }

      // Get vendor's available packages
      const packagesResult = await query(`
        SELECT 
          sp.*,
          v.business_name as vendor_name,
          v.rating as vendor_rating
        FROM service_packages sp
        LEFT JOIN vendors v ON sp.vendor_id = v.id
        WHERE sp.vendor_id = $1
        AND sp.is_active = true
        ORDER BY sp.total_sessions ASC, sp.price ASC
      `, [vendorId]);

      // Get booking details if provided
      let trialBooking = null;
      if (bookingId) {
        const bookingResult = await query(`
          SELECT b.*, s.name as service_name, v.business_name as vendor_name
          FROM bookings b
          LEFT JOIN services s ON b.service_id = s.id
          LEFT JOIN vendors v ON b.vendor_id = v.id
          WHERE b.id = $1
        `, [bookingId]);
        trialBooking = bookingResult.rows[0] || null;
      }

      // Calculate savings for each package
      const packagesWithSavings = packagesResult.rows.map((pkg: any) => {
        const ts = resolveFiniteSessionCountFromServicePackage(pkg);
        const denom = ts > 0 ? ts : 1;
        const regularPrice = (trialBooking?.total_amount || pkg.price / denom) * denom;
        const savings = regularPrice - pkg.price;
        const savingsPercent = Math.round((savings / regularPrice) * 100);

        return {
          ...pkg,
          total_sessions: ts,
          totalSessions: ts,
          pricePerSession: Math.round(Number(pkg.price) / denom),
          regularPrice,
          savings: savings > 0 ? savings : 0,
          savingsPercent: savingsPercent > 0 ? savingsPercent : 0,
          isRecommended: ts >= 5 && ts <= 10
        };
      });

      return c.json({
        success: true,
        packages: packagesWithSavings,
        trialBooking,
        vendorName: packagesResult.rows[0]?.vendor_name,
        message: packagesWithSavings.length > 0 
          ? 'Save with a package!' 
          : 'No packages available from this vendor'
      });
    } catch (error: any) {
      console.error('Error fetching post-trial offers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /packages/convert-from-trial
   * Convert a trial booking to a package purchase
   */
  app.post("/packages/convert-from-trial", async (c) => {
    try {
      const body = await c.req.json();
      const {
        trialBookingId,
        packageId, // service_packages.id
        customerId,
        preferSameProvider = true,
        paymentMethodId,
        scheduleAllSessions = false,
        sessionSchedule = [] // Array of {sessionNumber, date, time}
      } = body;

      if (!packageId || !customerId) {
        return c.json({ error: 'packageId and customerId required' }, 400);
      }

      const resolvedCustomerId =
        (await resolveCustomerUuidForPackage(String(customerId))) ||
        (isLikelyCustomerUuid(String(customerId)) ? String(customerId).trim() : null);
      if (!resolvedCustomerId) {
        return c.json({ error: 'Customer not found for this account' }, 404);
      }

      // Get package details
      const packageResult = await query(`
        SELECT sp.*, v.business_name as vendor_name
        FROM service_packages sp
        LEFT JOIN vendors v ON sp.vendor_id = v.id
        WHERE sp.id = $1 AND sp.is_active = true
      `, [packageId]);

      if (packageResult.rows.length === 0) {
        return c.json({ error: 'Package not found or inactive' }, 404);
      }

      const pkg = packageResult.rows[0];

      const unlimitedPurchase = isServicePackageUnlimited(pkg);
      const finiteSessions = resolveFiniteSessionCountFromServicePackage(pkg);
      const totalSessionsForPurchase = unlimitedPurchase ? 0 : finiteSessions;
      const packageDisplayName = resolveServicePackageDisplayName(pkg);

      // Get trial booking details if provided
      let trialBooking = null;
      let staffId = null;
      if (trialBookingId) {
        const bookingResult = await query(`
          SELECT * FROM bookings WHERE id = $1
        `, [trialBookingId]);
        trialBooking = bookingResult.rows[0];
        staffId = trialBooking?.staff_id;
      }

      // Calculate expiry date
      const expiresAt = new Date();
      if (pkg.validity_days) {
        expiresAt.setDate(expiresAt.getDate() + pkg.validity_days);
      } else if (pkg.validity_months) {
        expiresAt.setMonth(expiresAt.getMonth() + pkg.validity_months);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 3); // Default 3 months
      }

      // Create package purchase
      const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const purchaseResult = await query(`
        INSERT INTO package_purchases (
          purchase_id, package_id, customer_id, vendor_id,
          package_name, package_type, package_price,
          total_sessions, remaining_sessions, unlimited_usage,
          amount, payment_status, status,
          preferred_vendor_id, preferred_staff_id, auto_assign_same_provider,
          expires_at, activated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $8, $9,
          $7, 'completed', 'active',
          $10, $11, $12,
          $13, NOW()
        )
        RETURNING *
      `, [
        purchaseId, packageId, resolvedCustomerId, pkg.vendor_id,
        packageDisplayName,
        ['bundle', 'time_based', 'appointment', 'membership', 'subscription'].includes(
          String(pkg.service_type || '').toLowerCase()
        )
          ? String(pkg.service_type).toLowerCase()
          : 'bundle',
        pkg.price,
        totalSessionsForPurchase, unlimitedPurchase,
        preferSameProvider ? pkg.vendor_id : null,
        preferSameProvider ? staffId : null,
        preferSameProvider,
        expiresAt.toISOString()
      ]);

      const purchase = purchaseResult.rows[0];

      // Mark trial as converted if provided
      if (trialBookingId) {
        await update('bookings',
          { id: trialBookingId },
          { converted_to_package_id: purchase.id }
        );
      }

      const db = { query } as SqlClient;
      await seedPackageScheduledSessionsIfMissing(db, purchase.id);
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

      return c.json({
        success: true,
        purchase: {
          id: purchase.id,
          purchaseId: purchase.purchase_id,
          packageName: purchase.package_name,
          totalSessions: purchase.total_sessions,
          remainingSessions: purchase.remaining_sessions,
          expiresAt: purchase.expires_at,
          vendorName: pkg.vendor_name,
          preferSameProvider: purchase.auto_assign_same_provider
        },
        sessionsScheduled: sessionSchedule.length,
        message: unlimitedPurchase
          ? 'Package purchased! Unlimited sessions for this plan.'
          : `Package purchased! ${finiteSessions} sessions available.`
      });
    } catch (error: any) {
      console.error('Error converting trial to package:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /packages/purchase-from-vendor-service
   * Create service_packages + package_purchases + package_scheduled_sessions from a vendor_services
   * row that has metadata.isPackage + metadata.packageDetails (custom walker/training bundles).
   */
  app.post('/packages/purchase-from-vendor-service', async (c) => {
    try {
      const body = await c.req.json();
      const bodyObj = body as Record<string, unknown>;
      const customerRef = bodyObj.customerId as string | undefined;
      const vendorRef = bodyObj.vendorId as string | undefined;
      const vendorServiceId = bodyObj.vendorServiceId as string | undefined;
      const preferSameProvider = bodyObj.preferSameProvider != null ? Boolean(bodyObj.preferSameProvider) : true;
      const sessionSchedule = (Array.isArray(bodyObj.sessionSchedule)
        ? bodyObj.sessionSchedule
        : []) as Array<{ sessionNumber?: number; date?: string; time?: string }>;
      const razorpayOrderIdRaw = bodyObj.razorpay_order_id;
      const razorpayPaymentIdRaw = bodyObj.razorpay_payment_id;
      const razorpaySignatureRaw = bodyObj.razorpay_signature;
      const paymentIdRaw = bodyObj.paymentId;
      const petIdBody = bodyObj.petId;
      const policyAcceptedRaw = bodyObj.policyAccepted;
      const policyVersionRaw = bodyObj.policyVersion;
      const petIdForBooking = uuidOrNull(petIdBody);

      if (!customerRef || !vendorRef || !vendorServiceId) {
        return c.json(
          { error: 'customerId, vendorId, and vendorServiceId are required' },
          400
        );
      }

      const resolvedPurchaseCustomer =
        (await resolveCustomerUuidForPackage(String(customerRef))) ||
        (isLikelyCustomerUuid(String(customerRef)) ? String(customerRef).trim() : null);
      if (!resolvedPurchaseCustomer) {
        return c.json({ error: 'Customer not found' }, 404);
      }
      const customerId = resolvedPurchaseCustomer;

      const computed = await computeVendorPackagePurchase({
        customerId,
        vendorIdRaw: String(vendorRef),
        vendorServiceId: String(vendorServiceId),
      });
      if (!computed.ok) {
        return c.json({ error: computed.error }, computed.status as 400 | 403 | 404);
      }
      const comp = computed.comp;

      // Strict: no silent service fallback. The vendor_services row used for the
      // package MUST exist and resolve to a real id (it's the same id we already
      // computed in `computeVendorPackagePurchase`, but assert anyway).
      if (!uuidOrNull(comp.vendorServiceId)) {
        return c.json(
          { error: 'Vendor service for this package could not be resolved (no fallback allowed).' },
          400
        );
      }

      if (!comp.unlimitedPurchase && comp.totalSessionsForPurchase > 0) {
        const schedArr = Array.isArray(sessionSchedule) ? sessionSchedule : [];
        const normalized = schedArr
          .map((s: { sessionNumber?: number; date?: string; time?: string }) => ({
            sessionNumber: Number(s?.sessionNumber),
            date: normalizeScheduleDateInput(s?.date),
            time: normalizeScheduleTimeInput(s?.time),
          }))
          .filter((s) => Number.isFinite(s.sessionNumber) && s.sessionNumber >= 1 && s.date && s.time)
          .sort((a, b) => a.sessionNumber - b.sessionNumber);
        const firstSlot = normalized.find((s) => s.sessionNumber === 1);
        if (!firstSlot) {
          return c.json(
            {
              error:
                'For this package, session 1 requires a scheduled date and time.',
            },
            400
          );
        }
        if (comp.sessionsPerDay > 1) {
          const firstDaySlots = normalized.filter(
            (s) => s.sessionNumber >= 1 && s.sessionNumber <= comp.sessionsPerDay && s.date === firstSlot.date
          );
          if (firstDaySlots.length < comp.sessionsPerDay) {
            return c.json(
              {
                error: `This package has ${comp.sessionsPerDay} sessions per day. Please provide all first-day time slots (sessions 1 to ${comp.sessionsPerDay}) on the same date.`,
              },
              400
            );
          }
        }
      }

      const razorpayOrderId = String(razorpayOrderIdRaw || '').trim();
      const razorpayPaymentId = String(razorpayPaymentIdRaw || '').trim();
      const razorpaySignature = String(razorpaySignatureRaw || '').trim();
      const hasRazorpayProof = Boolean(razorpayOrderId && razorpayPaymentId && razorpaySignature);
      const anyRazorpayField = Boolean(razorpayOrderId || razorpayPaymentId || razorpaySignature);
      if (anyRazorpayField && !hasRazorpayProof) {
        return c.json(
          {
            error:
              'To confirm payment, send razorpay_order_id, razorpay_payment_id, and razorpay_signature together',
          },
          400
        );
      }

      const unlimitedPurchase = comp.unlimitedPurchase;
      const finiteSessions = unlimitedPurchase ? 0 : comp.finiteSessions;

      const purchaseJson = (
        purchase: Record<string, unknown>,
        catalogPackageId: string,
        vendorBookingId?: string | null
      ) => ({
        success: true,
        purchase: {
          id: purchase.id,
          purchaseId: purchase.purchase_id,
          packageName: purchase.package_name,
          totalSessions: purchase.total_sessions,
          remainingSessions: purchase.remaining_sessions,
          expiresAt: purchase.expires_at,
          servicePackageId: catalogPackageId,
          vendorServiceId: String(vendorServiceId),
          ...(vendorBookingId ? { vendorBookingId } : {}),
        },
        message: unlimitedPurchase
          ? 'Package purchased! Unlimited sessions for this plan.'
          : `Package purchased! ${finiteSessions} sessions available.`,
      });

      // Server-computed totals using the SAME pipeline as normal bookings
      // (taxCalculationService + calculateFinalFees). This is what we charge.
      let pricing: Awaited<ReturnType<typeof quotePackagePricing>> | null = null;
      try {
        pricing = comp.priceNum > 0 ? await quotePackagePricing(comp) : null;
      } catch (e: any) {
        console.error('[purchase-from-vendor-service] pricing failed:', e);
        return c.json({ error: e?.message || 'Failed to compute package pricing' }, 400);
      }

      const policy = resolvePackagePolicySnapshot(comp);
      const policyAcceptedFlag = Boolean(policyAcceptedRaw);
      const policyVersionFromClient =
        typeof policyVersionRaw === 'string' && policyVersionRaw.trim()
          ? policyVersionRaw.trim()
          : null;

      const buildOrderResponse = (
        order: { orderId: string; keyId: string; amount: number; currency: string; paymentId: string }
      ) => ({
        success: true,
        requiresPayment: true,
        razorpayOrderId: order.orderId,
        razorpayKeyId: order.keyId,
        amount: order.amount,
        currency: order.currency,
        paymentId: order.paymentId,
        vendorId: comp.vendorId,
        vendorServiceId: String(vendorServiceId),
        pricing: pricing
          ? {
              basePrice: pricing.basePrice,
              gstAmount: pricing.gstAmount,
              taxBreakdown: pricing.taxBreakdown,
              platformFee: pricing.platformFee,
              convenienceFee: pricing.convenienceFee,
              deliveryFee: pricing.deliveryFee,
              packagingFee: pricing.packagingFee,
              totalAmount: pricing.totalAmount,
              businessServiceType: pricing.businessServiceType,
            }
          : null,
        policy: {
          cancellationPolicy: policy.cancellationPolicy,
          refundPolicy: policy.refundPolicy,
          version: policy.version,
        },
      });

      if (comp.priceNum > 0 && !hasRazorpayProof) {
        // Acceptance gate: never start a Razorpay order without explicit consent.
        if (!policyAcceptedFlag) {
          return c.json(
            {
              success: false,
              error: 'POLICY_NOT_ACCEPTED',
              message:
                'Customer must accept cancellation and refund policy before initiating payment.',
              policy: {
                cancellationPolicy: policy.cancellationPolicy,
                refundPolicy: policy.refundPolicy,
                version: policy.version,
              },
            },
            400
          );
        }
        if (policyVersionFromClient && policyVersionFromClient !== policy.version) {
          return c.json(
            {
              success: false,
              error: 'POLICY_VERSION_MISMATCH',
              message: 'Policy text has changed since you read it. Please review again.',
              policy: {
                cancellationPolicy: policy.cancellationPolicy,
                refundPolicy: policy.refundPolicy,
                version: policy.version,
              },
            },
            400
          );
        }

        try {
          const order = await createRazorpayOrderForVendorPackage({
            customerId,
            vendorId: comp.vendorId,
            vendorServiceId: String(vendorServiceId),
            amount: pricing ? pricing.totalAmount : comp.priceNum,
            ...(pricing
              ? {
                  feeBreakdown: {
                    basePrice: pricing.basePrice,
                    gstAmount: pricing.gstAmount,
                    platformFee: pricing.platformFee,
                    convenienceFee: pricing.convenienceFee,
                    deliveryFee: pricing.deliveryFee,
                    packagingFee: pricing.packagingFee,
                  },
                }
              : {}),
          });
          return c.json(buildOrderResponse(order));
        } catch (e: any) {
          console.error('vendor package Razorpay create-order:', e);
          return c.json({ error: e?.message || 'Failed to start payment' }, 502);
        }
      }

      const policyInputForFinalize = {
        cancellationPolicy: policy.cancellationPolicy,
        refundPolicy: policy.refundPolicy,
        policyVersion: policy.version,
        policyAcceptedAt: new Date().toISOString(),
        policyAcceptedMeta: {
          source: 'package_purchase',
          via: hasRazorpayProof ? 'razorpay_finalize' : 'free_finalize',
          userAgent: c.req.header('user-agent') || null,
        },
      };

      if (comp.priceNum > 0 && hasRazorpayProof) {
        const cfg = await getRazorpayConfig();
        if (!cfg?.keySecret) {
          return c.json({ error: 'Razorpay is not configured' }, 500);
        }
        if (
          !verifyRazorpayPaymentSignature(
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            cfg.keySecret
          )
        ) {
          return c.json({ error: 'Invalid Razorpay signature' }, 400);
        }

        const expectedTotal = pricing ? pricing.totalAmount : comp.priceNum;

        const deterministicPurchaseId = vendorPackagePurchaseIdForRazorpayOrder(razorpayOrderId);
        const existing = await query(
          `SELECT pp.* FROM package_purchases pp WHERE pp.purchase_id = $1 LIMIT 1`,
          [deterministicPurchaseId]
        );
        if (existing.rows[0]?.id) {
          const existingPurchase = existing.rows[0] as Record<string, unknown>;
          const catId = String(existingPurchase.package_id || '').trim();
          await query(
            `UPDATE payments SET payment_status = 'completed', razorpay_payment_id = $2, razorpay_signature = $3,
                 completed_at = NOW(), updated_at = NOW()
             WHERE razorpay_order_id = $1 AND customer_id = $4::uuid`,
            [razorpayOrderId, razorpayPaymentId, razorpaySignature, customerId]
          );

          const payByOrder = await query(
            `SELECT id
             FROM payments
             WHERE razorpay_order_id = $1 AND customer_id = $2::uuid
             ORDER BY created_at DESC NULLS LAST
             LIMIT 1`,
            [razorpayOrderId, customerId]
          ).catch(() => ({ rows: [] as Array<{ id?: string }> }));
          const paymentIdForExisting =
            payByOrder.rows?.[0]?.id != null ? String(payByOrder.rows[0].id).trim() : null;

          // Re-apply schedule payload for idempotent payment confirmations so submitted times are not ignored.
          const { purchase } = await insertPackagePurchaseRows(comp, catId, {
            paymentStatus: 'completed',
            preferSameProvider: Boolean(preferSameProvider),
            sessionSchedule,
            razorpayOrderId,
            paymentId: paymentIdForExisting,
            policy: policyInputForFinalize,
            totalCharged: expectedTotal,
          });

          const { parentBookingId } = await createPackageBookingsAfterPayment({
            customerId,
            vendorId: comp.vendorId,
            vendorServiceId: String(vendorServiceId),
            comp,
            purchase: purchase as Record<string, unknown>,
            catalogPackageId: catId,
            paymentId: paymentIdForExisting,
            petId: petIdForBooking,
          });
          return c.json(
            purchaseJson(purchase as Record<string, unknown>, catId, parentBookingId)
          );
        }

        let payRow: Record<string, unknown> | undefined;
        if (paymentIdRaw && isLikelyCustomerUuid(String(paymentIdRaw))) {
          const pr = await query(
            `SELECT * FROM payments WHERE id = $1::uuid AND customer_id = $2::uuid LIMIT 1`,
            [String(paymentIdRaw).trim(), customerId]
          );
          payRow = pr.rows[0] as Record<string, unknown> | undefined;
        }
        if (!payRow) {
          const pr2 = await query(
            `SELECT * FROM payments WHERE razorpay_order_id = $1 AND customer_id = $2::uuid
             ORDER BY created_at DESC NULLS LAST LIMIT 1`,
            [razorpayOrderId, customerId]
          );
          payRow = pr2.rows[0] as Record<string, unknown> | undefined;
        }
        if (!payRow?.id) {
          return c.json({ error: 'Payment record not found for this order' }, 404);
        }
        if (String(payRow.vendor_id || '').toLowerCase() !== String(comp.vendorId).toLowerCase()) {
          return c.json({ error: 'Payment does not match this vendor' }, 400);
        }
        // Validate against the captured TOTAL on the payments row
        // (`amount` keeps base-price semantics; the order itself was for `total_amount`).
        const payTotal = Number(payRow.total_amount ?? payRow.amount);
        if (!Number.isFinite(payTotal) || Math.abs(payTotal - expectedTotal) > 0.02) {
          return c.json({ error: 'Payment amount mismatch' }, 400);
        }

        const catalogPackageId = await insertVendorServiceCatalogPackage(comp);
        const { purchase } = await insertPackagePurchaseRows(comp, catalogPackageId, {
          paymentStatus: 'completed',
          preferSameProvider: Boolean(preferSameProvider),
          sessionSchedule,
          razorpayOrderId,
          paymentId: String(payRow.id),
          policy: policyInputForFinalize,
          totalCharged: expectedTotal,
        });

        await query(
          `UPDATE payments SET payment_status = 'completed', razorpay_payment_id = $2, razorpay_signature = $3,
               completed_at = NOW(), updated_at = NOW()
           WHERE id = $1::uuid`,
          [payRow.id, razorpayPaymentId, razorpaySignature]
        );

        const { parentBookingId } = await createPackageBookingsAfterPayment({
          customerId,
          vendorId: comp.vendorId,
          vendorServiceId: String(vendorServiceId),
          comp,
          purchase: purchase as Record<string, unknown>,
          catalogPackageId,
          paymentId: String(payRow.id),
          petId: petIdForBooking,
        });
        return c.json(
          purchaseJson(purchase as Record<string, unknown>, catalogPackageId, parentBookingId)
        );
      }

      // Free package path — same model: parent + per-session children, but no payment.
      const catalogPackageId = await insertVendorServiceCatalogPackage(comp);
      const { purchase } = await insertPackagePurchaseRows(comp, catalogPackageId, {
        paymentStatus: 'completed',
        preferSameProvider: Boolean(preferSameProvider),
        sessionSchedule,
        policy: policyInputForFinalize,
        totalCharged: 0,
      });

      const { parentBookingId: parentBookingIdFree } = await createPackageBookingsAfterPayment({
        customerId,
        vendorId: comp.vendorId,
        vendorServiceId: String(vendorServiceId),
        comp,
        purchase: purchase as Record<string, unknown>,
        catalogPackageId,
        paymentId: null,
        petId: petIdForBooking,
      });
      return c.json(
        purchaseJson(purchase as Record<string, unknown>, catalogPackageId, parentBookingIdFree)
      );
    } catch (error: any) {
      console.error('Error in purchase-from-vendor-service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /packages/:packagePurchaseId/schedule-sessions
   * Bulk schedule multiple sessions for a package
   */
  app.post("/packages/:packagePurchaseId/schedule-sessions", async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();
      const body = await c.req.json();
      const { sessions } = body; // Array of {sessionNumber, date, time}

      if (!sessions || !Array.isArray(sessions)) {
        return c.json({ error: 'sessions array required' }, 400);
      }

      const db = { query } as SqlClient;
      await seedPackageScheduledSessionsIfMissing(db, packagePurchaseId);

      // Verify package exists
      const packageResult = await query(`SELECT * FROM package_purchases WHERE id = $1::uuid`, [
        packagePurchaseId,
      ]);

      if (packageResult.rows.length === 0) {
        return c.json({ error: 'Package not found' }, 404);
      }

      const pkg = packageResult.rows[0];
      const cadence = await resolvePackageCadenceConfig(db, pkg as Record<string, unknown>);
      const scheduledSessions: Record<string, unknown>[] = [];
      const normalizedInput = (sessions as Array<Record<string, unknown>>)
        .map((session) => ({
          sessionNumber: Number(session?.sessionNumber),
          date: normalizeScheduleDateInput(session?.date),
          time: normalizeScheduleTimeInput(session?.time),
        }))
        .filter(
          (s) =>
            Number.isFinite(s.sessionNumber) &&
            s.sessionNumber >= 1 &&
            Boolean(s.date) &&
            Boolean(s.time)
        ) as Array<{ sessionNumber: number; date: string; time: string }>;

      let effectiveSessions = normalizedInput;
      const totalSessions = Number(pkg.total_sessions ?? 0);
      const firstInput = normalizedInput[0];
      if (totalSessions > 1 && firstInput) {
        if (cadence.sessionsPerDay > 1) {
          const firstDaySeeds = normalizedInput
            .filter(
              (s) =>
                s.sessionNumber >= 1 &&
                s.sessionNumber <= cadence.sessionsPerDay &&
                s.date === firstInput.date
            )
            .sort((a, b) => a.sessionNumber - b.sessionNumber);
          if (
            normalizedInput.length === totalSessions
          ) {
            effectiveSessions = normalizedInput;
          } else if (firstDaySeeds.length >= cadence.sessionsPerDay) {
            const slotTimes = firstDaySeeds
              .slice(0, cadence.sessionsPerDay)
              .map((s) => s.time);
            effectiveSessions = Array.from({ length: totalSessions }, (_, idx) => {
              const sessionNumber = idx + 1;
              const dayIndex = Math.floor(idx / cadence.sessionsPerDay);
              const slotIndex = idx % cadence.sessionsPerDay;
              return {
                sessionNumber,
                date: addDaysToIsoDate(firstInput.date, dayIndex),
                time: slotTimes[slotIndex] || slotTimes[0],
              };
            });
          } else if (normalizedInput.length < totalSessions) {
            return c.json(
              {
                error: `This package requires ${cadence.sessionsPerDay} session slots per day. Provide sessions 1..${cadence.sessionsPerDay} for the first date.`,
              },
              400
            );
          }
        } else if (normalizedInput.length === 1 && firstInput.sessionNumber === 1) {
          effectiveSessions = Array.from({ length: totalSessions }, (_, idx) => ({
            sessionNumber: idx + 1,
            date: addDaysToIsoDate(firstInput.date, idx * cadence.sessionIntervalDays),
            time: firstInput.time,
          }));
        } else if (normalizedInput.length === totalSessions) {
          effectiveSessions = normalizedInput;
        }
      }
      const firstIncoming = (sessions as Array<Record<string, unknown>>)
        .map((s) => ({
          scheduled_date: normalizeScheduleDateInput(s?.date),
          scheduled_time: normalizeScheduleTimeInput(s?.time),
        }))
        .find((s) => s.scheduled_date && s.scheduled_time);
      const canonicalBookingId = await resolveCanonicalPackageBookingId(
        db,
        pkg as Record<string, unknown>,
        firstIncoming
      );

      for (const session of effectiveSessions) {
        const sessionNumber = Number(session.sessionNumber);
        const date = normalizeScheduleDateInput(session.date);
        const time = normalizeScheduleTimeInput(session.time);

        if (!Number.isFinite(sessionNumber) || sessionNumber < 1) {
          continue;
        }
        if (pkg.total_sessions != null && Number(sessionNumber) > Number(pkg.total_sessions)) {
          continue; // Skip invalid session numbers
        }
        if (!date || !time) {
          continue; // Skip invalid session numbers
        }

        const result = await query(
          `
          INSERT INTO package_scheduled_sessions (
            package_purchase_id, session_number, scheduled_date, scheduled_time, booking_id, status
          ) VALUES ($1::uuid, $2::int, $3::date, $4::time, $5::uuid, 'scheduled')
          ON CONFLICT (package_purchase_id, session_number)
          DO UPDATE SET
            scheduled_date = EXCLUDED.scheduled_date,
            scheduled_time = EXCLUDED.scheduled_time,
            booking_id = EXCLUDED.booking_id,
            status = 'scheduled',
            updated_at = NOW()
          RETURNING *
        `,
          [packagePurchaseId, sessionNumber, date, time, canonicalBookingId || null]
        );

        scheduledSessions.push({
          ...result.rows[0],
          booking_id: canonicalBookingId || null,
          bookingId: canonicalBookingId || null,
          sessionNumber,
          scheduledDate: date,
          scheduledTime: time,
        });
      }
      await reconcileRemainingSessionsForFinitePackage(db, packagePurchaseId);

      return c.json({
        success: true,
        scheduledSessions,
        totalScheduled: scheduledSessions.length,
        message: `${scheduledSessions.length} sessions scheduled`
      });
    } catch (error: any) {
      console.error('Error scheduling sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/packages/:packagePurchaseId/sessions
   * Staff view of all scheduled sessions for a purchase (vendor must own the package).
   */
  app.get('/vendor/packages/:packagePurchaseId/sessions', async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();
      const headers: Record<string, string | undefined> = {
        authorization: c.req.header('Authorization') || c.req.header('authorization'),
        'x-uat-mode': c.req.header('x-uat-mode') || c.req.header('X-UAT-Mode'),
        'X-UAT-Mode': c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode'),
      };
      const vendId = await resolveVendorsTableIdFromAuthHeaders(headers);
      if (!vendId) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
      }
      const body = await buildPackageSessionsResponse(packagePurchaseId);
      if (!body) {
        return c.json({ error: 'Package not found' }, 404);
      }
      const pkg = body.package as { vendor_id?: string };
      if (!pkg?.vendor_id || String(pkg.vendor_id).toLowerCase() !== String(vendId).toLowerCase()) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
      stripPackageSessionOtpsFromBody(body);
      return c.json(body);
    } catch (error: any) {
      console.error('Error fetching vendor package sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/package-purchases/lookup/sessions
   * Resolve package purchase by id or by latest row for customer+vendor; same JSON as sessions read model.
   */
  app.get('/admin/package-purchases/lookup/sessions', async (c) => {
    try {
      const packagePurchaseId = c.req.query('packagePurchaseId')?.trim();
      const customerId = c.req.query('customerId')?.trim();
      const vendorId = c.req.query('vendorId')?.trim();
      let id = packagePurchaseId || '';
      if (!id && customerId && vendorId) {
        const r = await query(
          `SELECT id FROM package_purchases
           WHERE customer_id = $1::uuid AND vendor_id = $2::uuid
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1`,
          [customerId, vendorId]
        );
        id = r.rows?.[0]?.id || '';
      }
      if (!id) {
        return c.json(
          { error: 'Provide packagePurchaseId or both customerId and vendorId' },
          400
        );
      }
      const body = await buildPackageSessionsResponse(id);
      if (!body) {
        return c.json({ error: 'Package not found' }, 404);
      }
      return c.json(body);
    } catch (error: any) {
      console.error('Error in admin package session lookup:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/package-purchases/:packagePurchaseId/sessions
   * Read-only session list (same payload as customer/vendor); requires admin auth via /admin/* middleware.
   */
  app.get('/admin/package-purchases/:packagePurchaseId/sessions', async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();
      const body = await buildPackageSessionsResponse(packagePurchaseId);
      if (!body) {
        return c.json({ error: 'Package not found' }, 404);
      }
      return c.json(body);
    } catch (error: any) {
      console.error('Error fetching admin package sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /packages/:packagePurchaseId/sessions
   * Get all sessions for a package purchase.
   * When Authorization is sent, customer or vendor must own the row; unauthenticated calls remain allowed for backward compatibility.
   */
  app.get("/packages/:packagePurchaseId/sessions", async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();

      const body = await buildPackageSessionsResponse(packagePurchaseId);
      if (!body) {
        return c.json({ error: 'Package not found' }, 404);
      }

      const pkg = body.package as { customer_id?: string; vendor_id?: string };
      const authz = await packageSessionsAuthForRequest(c, pkg);
      if (authz === 'forbidden') {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
      if (authz !== 'customer') {
        stripPackageSessionOtpsFromBody(body);
      }

      return c.json(body);
    } catch (error: any) {
      console.error('Error fetching package sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/previous-providers
   * Get customer's previous service providers for quick rebooking.
   * customerId can be UUID or phone number (frontend often passes phone).
   */
  app.get("/customer/:customerId/previous-providers", async (c) => {
    try {
      let { customerId: rawId } = c.req.param();
      const serviceType = c.req.query('serviceType');

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
      let customerId = rawId;
      if (!isUUID) {
        const normalizedPhone = rawId.replace(/\D/g, '').slice(-10);
        const custResult = await query(
          `SELECT id FROM customers WHERE phone = $1 OR phone = $2 OR phone LIKE $3 LIMIT 1`,
          [rawId, normalizedPhone, `%${normalizedPhone}`]
        );
        if (!custResult.rows?.length) {
          return c.json({ success: true, providers: [], total: 0 });
        }
        customerId = custResult.rows[0].id;
      }

      let providerQuery = `
        SELECT 
          cph.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.address,
          v.city,
          v.rating as vendor_rating,
          (
            SELECT COUNT(*) FROM reviews r 
            WHERE r.vendor_id = v.id AND r.is_approved = true
          ) as review_count
        FROM customer_provider_history cph
        LEFT JOIN vendors v ON cph.vendor_id = v.id
        WHERE cph.customer_id = $1
        AND v.is_active = true
      `;

      const params: any[] = [customerId];
      if (serviceType) {
        providerQuery += ` AND cph.service_type = $2`;
        params.push(serviceType);
      }

      providerQuery += ` ORDER BY cph.last_booking_date DESC LIMIT 10`;

      const result = await query(providerQuery, params);

      await seedFinitePackagesMissingSessionsForScope({ query } as SqlClient, { customerId });

      // Check for active packages with each provider
      const providersWithPackages = await Promise.all(
        result.rows.map(async (provider: any) => {
          const packageResult = await query(`
            SELECT id, package_name, remaining_sessions, expires_at
            FROM package_purchases
            WHERE customer_id = $1 AND vendor_id = $2
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (${sqlPackagePurchaseActiveForListing('package_purchases')})
            LIMIT 1
          `, [customerId, provider.vendor_id]);

          return {
            ...provider,
            profile_image_url: provider.profile_image_url ?? null,
            hasActivePackage: packageResult.rows.length > 0,
            activePackage: packageResult.rows[0] || null
          };
        })
      );

      return c.json({
        success: true,
        providers: providersWithPackages,
        total: providersWithPackages.length
      });
    } catch (error: any) {
      console.error('Error fetching previous providers:', error);
      // Return 200 with empty list so customer home loads gracefully (non-critical)
      return c.json({ success: true, providers: [], total: 0 });
    }
  });

  /**
   * GET /vendor/:vendorId/package-customers
   * Get vendor's customers who have active packages
   */
  app.get("/vendor/:vendorId/package-customers", async (c) => {
    try {
      const { vendorId } = c.req.param();

      await seedFinitePackagesMissingSessionsForVendor({ query } as SqlClient, vendorId);

      const result = await query(`
        SELECT 
          pp.*,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          c.profile_image_url as customer_image,
          (pp.total_sessions - pp.remaining_sessions) as sessions_used,
          (
            SELECT json_agg(json_build_object(
              'id', pss.id,
              'sessionNumber', pss.session_number,
              'scheduledDate', pss.scheduled_date,
              'scheduledTime', pss.scheduled_time,
              'status', pss.status
            ) ORDER BY pss.session_number)
            FROM package_scheduled_sessions pss
            WHERE pss.package_purchase_id = pp.id
            AND pss.status IN ('pending', 'scheduled')
          ) as upcoming_sessions
        FROM package_purchases pp
        LEFT JOIN customers c ON pp.customer_id = c.id
        WHERE pp.vendor_id = $1
        AND pp.status = 'active'
        AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
        AND (${sqlPackagePurchaseActiveForListing('pp')})
        ORDER BY pp.expires_at ASC NULLS LAST
      `, [vendorId]);

      return c.json({
        success: true,
        customers: result.rows,
        total: result.rows.length
      });
    } catch (error: any) {
      console.error('Error fetching package customers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /package-sessions
   * Create a new package session (used when booking with package)
   */
  app.post("/package-sessions", async (c) => {
    try {
      const body = await c.req.json();
      const {
        packagePurchaseId,
        scheduledStartTime,
        petId,
        staffId,
        location,
        notes
      } = body;

      if (!packagePurchaseId || !scheduledStartTime) {
        return c.json({ 
          error: 'packagePurchaseId and scheduledStartTime are required' 
        }, 400);
      }

      const pdb = { query } as SqlClient;

      await seedPackageScheduledSessionsIfMissing(pdb, packagePurchaseId);

      // Verify package exists and is active (bookable = unlimited or pending slot)
      const packageResult = await query(`
        SELECT * FROM package_purchases
        WHERE id = $1
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (${sqlPackagePurchaseHasBookableSlot('package_purchases')})
      `, [packagePurchaseId]);

      if (packageResult.rows.length === 0) {
        return c.json({ 
          error: 'Package not found, expired, or has no remaining sessions' 
        }, 400);
      }

      const pkg = packageResult.rows[0];
      let nextSessionNumber: number;
      if (pkg.unlimited_usage) {
        nextSessionNumber = await pickNextUnlimitedPackageSessionNumber(pdb, packagePurchaseId);
      } else {
        const slot = await pickNextPendingSessionNumber(pdb, packagePurchaseId);
        if (slot == null) {
          return c.json({ error: 'No package session slots available' }, 400);
        }
        nextSessionNumber = slot;
      }

      // Parse scheduled start time
      const scheduledDate = new Date(scheduledStartTime);
      if (isNaN(scheduledDate.getTime())) {
        return c.json({ error: 'Invalid scheduledStartTime format' }, 400);
      }

      // Create package session
      const sessionResult = await query(`
        INSERT INTO package_sessions (
          package_purchase_id,
          scheduled_start_time,
          pet_id,
          staff_id,
          location,
          notes,
          status,
          session_number
        ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)
        RETURNING *
      `, [
        packagePurchaseId,
        scheduledDate.toISOString(),
        petId || null,
        staffId || null,
        location ? JSON.stringify(location) : null,
        notes || null,
        nextSessionNumber
      ]);

      const session = sessionResult.rows[0];

      return c.json({
        success: true,
        session: {
          id: session.id,
          packagePurchaseId: session.package_purchase_id,
          scheduledStartTime: session.scheduled_start_time,
          status: session.status,
          sessionNumber: session.session_number
        }
      });
    } catch (error: any) {
      console.error('Error creating package session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /packages/quote
   * Server-of-truth pricing for a vendor-service package. Returns the SAME
   * fee/tax/breakdown shape as `/customer/pricing/quote` for normal bookings,
   * and the policy snapshot the customer must accept before pay. The Razorpay
   * order amount is derived from this exact pipeline.
   *
   * Request: { customerId?, vendorId, vendorServiceId }
   */
  app.post('/packages/quote', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const customerRef = body.customerId || body.customer_id || '';
      const vendorRef = body.vendorId || body.vendor_id;
      const vendorServiceId = body.vendorServiceId || body.vendor_service_id;

      if (!vendorRef || !vendorServiceId) {
        return c.json(
          { success: false, error: 'vendorId and vendorServiceId are required' },
          400
        );
      }

      const customerId =
        (customerRef &&
          ((await resolveCustomerUuidForPackage(String(customerRef))) ||
            (isLikelyCustomerUuid(String(customerRef)) ? String(customerRef).trim() : null))) ||
        null;

      const computed = await computeVendorPackagePurchase({
        customerId: customerId || '00000000-0000-0000-0000-000000000000',
        vendorIdRaw: String(vendorRef),
        vendorServiceId: String(vendorServiceId),
      });
      if (!computed.ok) {
        return c.json(
          { success: false, error: computed.error },
          computed.status as 400 | 403 | 404
        );
      }
      const comp = computed.comp;

      let pricing: Awaited<ReturnType<typeof quotePackagePricing>> | null = null;
      try {
        pricing = await quotePackagePricing(comp);
      } catch (e: any) {
        return c.json(
          { success: false, error: e?.message || 'Failed to compute pricing' },
          400
        );
      }

      const policy = resolvePackagePolicySnapshot(comp);

      return c.json({
        success: true,
        package: {
          vendorServiceId: comp.vendorServiceId,
          vendorId: comp.vendorId,
          name: comp.packageDisplayName,
          serviceStyle: comp.serviceStyle,
          serviceType: comp.serviceType,
          totalSessions: comp.unlimitedPurchase ? 'unlimited' : comp.totalSessionsForPurchase,
          sessionsPerDay: comp.sessionsPerDay,
          sessionIntervalDays: comp.sessionIntervalDays,
          validityDays: comp.validityDays,
        },
        // Mirrors `/customer/pricing/quote` shape for UniversalPaymentPage.
        basePrice: pricing.basePrice,
        tax: pricing.gstAmount,
        gstAmount: pricing.gstAmount,
        cgstAmount: pricing.cgstAmount,
        sgstAmount: pricing.sgstAmount,
        igstAmount: pricing.igstAmount,
        taxBreakdown: pricing.taxBreakdown,
        platformFee: pricing.platformFee,
        convenienceFee: pricing.convenienceFee,
        deliveryFee: pricing.deliveryFee,
        packagingFee: pricing.packagingFee,
        finalPrice: pricing.totalAmount,
        totalAmount: pricing.totalAmount,
        businessServiceType: pricing.businessServiceType,
        policy: {
          cancellationPolicy: policy.cancellationPolicy,
          refundPolicy: policy.refundPolicy,
          version: policy.version,
        },
      });
    } catch (error: any) {
      console.error('Error in /packages/quote:', error);
      return c.json(
        { success: false, error: error?.message || 'Pricing quote failed' },
        500
      );
    }
  });

  /**
   * GET /packages/:packagePurchaseId/policies
   * Returns the policy snapshot persisted at purchase time for display in
   * tracking / cancellation flows.
   */
  app.get('/packages/:packagePurchaseId/policies', async (c) => {
    try {
      const { packagePurchaseId } = c.req.param();
      const r = await query(
        `SELECT cancellation_policy, refund_policy, policy_version, policy_accepted_at
         FROM package_purchases
         WHERE id = $1::uuid LIMIT 1`,
        [packagePurchaseId]
      );
      const row = r.rows?.[0];
      if (!row) {
        return c.json({ success: false, error: 'Package not found' }, 404);
      }
      return c.json({
        success: true,
        cancellationPolicy: row.cancellation_policy || '',
        refundPolicy: row.refund_policy || '',
        version: row.policy_version || null,
        acceptedAt: row.policy_accepted_at || null,
      });
    } catch (error: any) {
      console.error('Error fetching package policies:', error);
      return c.json({ success: false, error: error?.message || 'Failed' }, 500);
    }
  });

  console.log('✅ Package booking endpoints registered');
}
