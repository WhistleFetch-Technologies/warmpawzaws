/**
 * Package booking model — parent + per-session children (migration 740).
 *
 * Lifecycle:
 *   1. Razorpay order created via `createRazorpayOrderForVendorPackage`.
 *   2. After signature verification, `package_purchases` row is upserted by
 *      `insertPackagePurchaseRows` (idempotent on `purchase_id`).
 *   3. THIS module creates the parent canonical booking + one child booking
 *      per `package_scheduled_sessions` row, generates per-session OTPs,
 *      and links each child back to its scheduled-session slot.
 *
 * Hard rules:
 *   - Both parent and children are written ONLY after payment verification.
 *   - Idempotent: re-finalize for the same (purchase_id, session_number)
 *     reuses existing rows; uniqueness is enforced by migration 740's index.
 *   - No silent fallbacks — caller must already have resolved a real
 *     `vendor_services.id`. This module does not synthesize one.
 */

import { query, insert, withTransaction } from '../database/rds-connection';
import { fireVendorAppointmentScheduledSms } from '../lib/vendor-appointment-sms';
import type { VendorPackageComputation } from './vendor-package-razorpay-flow';
import {
  assertSlotAvailableInTx,
  SlotConflictError,
  resolveDurationMinutes,
} from './slot-occupancy';

/** Same generator used by `bookings-enhanced.booking.ts` so format matches normal bookings. */
function generateBookingOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function uuidOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

function bookingServiceTypeForPackageStyle(style: string): string {
  const s = String(style || '').toLowerCase();
  if (s === 'tele' || s === 'online') return 'tele';
  if (s === 'at_home') return 'at_home';
  if (s === 'at_center') return 'at_center';
  return 'at_vendor';
}

function isTeleStyle(style: string): boolean {
  const s = String(style || '').toLowerCase();
  return s === 'tele' || s === 'online' || s === 'video_consultation' || s === 'tele_consultation';
}

export type CreatePackageBookingsParams = {
  customerId: string;
  vendorId: string;
  vendorServiceId: string;
  /** Result of `computeVendorPackagePurchase`. */
  comp: VendorPackageComputation;
  /** `package_purchases` row freshly upserted via `insertPackagePurchaseRows`. */
  purchase: Record<string, unknown>;
  catalogPackageId: string;
  paymentId: string | null;
  petId: string | null;
};

export type CreatePackageBookingsResult = {
  parentBookingId: string;
  sessionBookingIds: string[];
};

/**
 * Create the parent canonical booking + per-session child bookings.
 * Children inherit price = 0 (already paid via package), get their own OTP code
 * (matching the format used by `bookings-enhanced.booking.ts`), and are linked
 * back to the corresponding `package_scheduled_sessions` row.
 */
export async function createPackageBookingsAfterPayment(
  params: CreatePackageBookingsParams
): Promise<CreatePackageBookingsResult> {
  const { customerId, vendorId, vendorServiceId, comp, purchase, catalogPackageId, paymentId, petId } =
    params;

  const purchaseRowId = String(purchase.id || '').trim();
  if (!purchaseRowId) {
    throw new Error('createPackageBookingsAfterPayment: missing package_purchase id');
  }
  if (!uuidOrNull(vendorServiceId)) {
    throw new Error('createPackageBookingsAfterPayment: invalid vendorServiceId');
  }

  const serviceStyle = String(comp.serviceStyle || '').toLowerCase();
  const serviceType = bookingServiceTypeForPackageStyle(serviceStyle);
  const tele = isTeleStyle(serviceStyle);
  const totalAmt = Number(comp.priceNum) || 0;
  const petUuid = uuidOrNull(petId);
  const payUuid = uuidOrNull(paymentId);

  // 1. Find or create the parent canonical booking ----------------------------
  // A parent canonical row is identified by (package_purchase_id, parent_booking_id IS NULL,
  // is_package_session = false). Migration 739 keeps a fast lookup index on this shape.
  const parentExisting = await query(
    `SELECT id FROM bookings
     WHERE package_purchase_id = $1::uuid
       AND parent_booking_id IS NULL
       AND COALESCE(is_package_session, false) = false
     ORDER BY created_at ASC NULLS LAST
     LIMIT 1`,
    [purchaseRowId]
  );

  let parentBookingId =
    parentExisting.rows?.[0]?.id != null ? String(parentExisting.rows[0].id) : '';

  // First scheduled slot anchors the parent booking date/time
  const slots = await query(
    `SELECT session_number, scheduled_date, scheduled_time
     FROM package_scheduled_sessions
     WHERE package_purchase_id = $1::uuid
     ORDER BY session_number ASC`,
    [purchaseRowId]
  );

  const slotRows = (slots.rows || []) as Array<{
    session_number: number | string | null;
    scheduled_date: string | Date | null;
    scheduled_time: string | null;
  }>;

  const firstWithSchedule = slotRows.find((r) => r.scheduled_date != null && r.scheduled_time != null);

  const parentDate =
    firstWithSchedule?.scheduled_date instanceof Date
      ? firstWithSchedule.scheduled_date.toISOString().slice(0, 10)
      : (firstWithSchedule?.scheduled_date as string | null | undefined) || new Date().toISOString().slice(0, 10);
  const parentTimeRaw = (firstWithSchedule?.scheduled_time as string | null) || '09:00:00';
  const parentTime = parentTimeRaw.length === 5 ? `${parentTimeRaw}:00` : parentTimeRaw;

  if (!parentBookingId) {
    const sessionsLabel = comp.unlimitedPurchase
      ? 'unlimited sessions'
      : `${comp.totalSessionsForPurchase || comp.totalSessionsNum} session(s)`;

    const pkgDetails = JSON.stringify({
      kind: 'vendor_service_package_purchase',
      vendorServiceId,
      catalogPackageId,
      packagePurchaseId: purchaseRowId,
      unlimited: comp.unlimitedPurchase,
    });
    const notes = `Package purchased — ${sessionsLabel}. See linked session bookings for individual visits.`;

    const ins = await query(
      `INSERT INTO bookings (
         customer_id, vendor_id, pet_id, service_id,
         booking_date, booking_time, service_type,
         status, payment_status,
         base_price, discount_amount, tax_amount, total_amount,
         is_package, package_id, package_details, package_purchase_id,
         is_package_session, parent_booking_id,
         notes, payment_id
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5::date, $6::time, $7,
         'confirmed', 'paid',
         $8::numeric, 0, 0, $8::numeric,
         true, $9::uuid, $10::jsonb, $11::uuid,
         false, NULL,
         $12, $13::uuid
       )
       RETURNING id`,
      [
        customerId,
        vendorId,
        petUuid,
        vendorServiceId,
        parentDate,
        parentTime,
        serviceType,
        totalAmt,
        catalogPackageId,
        pkgDetails,
        purchaseRowId,
        notes,
        payUuid,
      ]
    );
    parentBookingId = ins.rows?.[0]?.id != null ? String(ins.rows[0].id) : '';
    if (!parentBookingId) {
      throw new Error('createPackageBookingsAfterPayment: failed to create parent booking');
    }

    if (payUuid) {
      await query(
        `UPDATE payments SET booking_id = $1::uuid WHERE id = $2::uuid AND booking_id IS NULL`,
        [parentBookingId, payUuid]
      ).catch(() => undefined);
    }

    // Vendor notification — package-level
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
        message: `${customerName} bought package "${comp.packageDisplayName}" • ${sessionsLabel} • paid ₹${totalAmt}`,
        channels: { email: false, sms: false, inApp: true, push: false },
        data: JSON.stringify({
          parentBookingId,
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
      console.warn('[package-bookings] vendor notification failed:', notifErr);
    }
  }

  // 2. For each scheduled session, create / locate a child booking ------------
  const sessionBookingIds: string[] = [];

  for (const slot of slotRows) {
    const sessionNumber = Number(slot.session_number);
    if (!Number.isFinite(sessionNumber) || sessionNumber < 1) continue;

    const dateStr =
      slot.scheduled_date instanceof Date
        ? slot.scheduled_date.toISOString().slice(0, 10)
        : (slot.scheduled_date as string | null | undefined) || null;
    const timeStrRaw = (slot.scheduled_time as string | null | undefined) || null;
    if (!dateStr || !timeStrRaw) continue; // unscheduled rows handled later by schedule-sessions
    const timeStr = timeStrRaw.length === 5 ? `${timeStrRaw}:00` : timeStrRaw;

    // Skip if a child already exists for this session
    const existing = await query(
      `SELECT id FROM bookings
       WHERE package_purchase_id = $1::uuid
         AND parent_booking_id = $2::uuid
         AND COALESCE(is_package_session, false) = true
         AND package_session_number = $3
       LIMIT 1`,
      [purchaseRowId, parentBookingId, sessionNumber]
    );
    if (existing.rows?.[0]?.id) {
      const id = String(existing.rows[0].id);
      sessionBookingIds.push(id);
      // Ensure scheduled-session slot links to the child
      await query(
        `UPDATE package_scheduled_sessions
         SET booking_id = $1::uuid,
             scheduled_date = COALESCE(scheduled_date, $2::date),
             scheduled_time = COALESCE(scheduled_time, $3::time),
             status = CASE WHEN status = 'pending' THEN 'scheduled' ELSE status END,
             updated_at = NOW()
         WHERE package_purchase_id = $4::uuid AND session_number = $5`,
        [id, dateStr, timeStr, purchaseRowId, sessionNumber]
      ).catch(() => undefined);
      continue;
    }

    // Generate per-session OTP for non-tele services. Children are price 0 since
    // payment was settled at the parent level.
    const otp = tele ? null : generateBookingOTP();
    const otpExpiresAt = new Date();
    otpExpiresAt.setHours(otpExpiresAt.getHours() + 24);

    const childPkgDetails = JSON.stringify({
      kind: 'vendor_service_package_session',
      vendorServiceId,
      catalogPackageId,
      packagePurchaseId: purchaseRowId,
      sessionNumber,
      parentBookingId,
    });

    const sessionDuration = resolveDurationMinutes(comp.vs?.duration_minutes);
    let ins: { rows?: Array<{ id?: unknown }> };
    try {
      ins = await withTransaction(async (client) => {
        await assertSlotAvailableInTx(client, {
          vendorId: String(vendorId),
          date: String(dateStr),
          startTime: String(timeStr),
          durationMinutes: sessionDuration,
          staffId: null,
        });
        return client.query(
      `INSERT INTO bookings (
         customer_id, vendor_id, pet_id, service_id,
         booking_date, booking_time, service_type,
         status, payment_status,
         base_price, discount_amount, tax_amount, total_amount,
         is_package, package_id, package_details, package_purchase_id,
         is_package_session, package_session_number, parent_booking_id,
         notes,
         otp_code, otp_expires_at, duration_minutes
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5::date, $6::time, $7,
         'confirmed', 'paid',
         0, 0, 0, 0,
         true, $8::uuid, $9::jsonb, $10::uuid,
         true, $11::int, $12::uuid,
         $13,
         $14, $15, $16
       )
       ON CONFLICT (package_purchase_id, package_session_number)
         WHERE parent_booking_id IS NOT NULL
           AND package_session_number IS NOT NULL
           AND COALESCE(is_package_session, false) = true
         DO NOTHING
       RETURNING id`,
      [
        customerId,
        vendorId,
        petUuid,
        vendorServiceId,
        dateStr,
        timeStr,
        serviceType,
        catalogPackageId,
        childPkgDetails,
        purchaseRowId,
        sessionNumber,
        parentBookingId,
        `Session ${sessionNumber} of package "${comp.packageDisplayName}"`,
        otp,
        otp ? otpExpiresAt.toISOString() : null,
        sessionDuration,
      ]
        );
      });
    } catch (slotErr: unknown) {
      if (slotErr instanceof SlotConflictError) {
        console.warn(
          `[package-bookings] session ${sessionNumber} slot conflict after payment; skipping child insert`
        );
        continue;
      }
      throw slotErr;
    }

    let childId =
      ins.rows?.[0]?.id != null ? String(ins.rows[0].id) : '';
    if (!childId) {
      const re = await query(
        `SELECT id FROM bookings
         WHERE package_purchase_id = $1::uuid
           AND parent_booking_id = $2::uuid
           AND COALESCE(is_package_session, false) = true
           AND package_session_number = $3
         LIMIT 1`,
        [purchaseRowId, parentBookingId, sessionNumber]
      );
      childId = re.rows?.[0]?.id != null ? String(re.rows[0].id) : '';
    }
    if (!childId) {
      throw new Error(
        `createPackageBookingsAfterPayment: failed to create child booking for session ${sessionNumber}`
      );
    }
    sessionBookingIds.push(childId);

    fireVendorAppointmentScheduledSms({
      vendorId,
      bookingId: childId,
      bookingDate: dateStr,
      bookingTime: timeStr,
    });

    await query(
      `UPDATE package_scheduled_sessions
       SET booking_id = $1::uuid,
           scheduled_date = $2::date,
           scheduled_time = $3::time,
           status = CASE WHEN status IN ('pending') THEN 'scheduled' ELSE status END,
           updated_at = NOW()
       WHERE package_purchase_id = $4::uuid AND session_number = $5`,
      [childId, dateStr, timeStr, purchaseRowId, sessionNumber]
    ).catch(() => undefined);
  }

  if (sessionBookingIds.length === 0 && parentBookingId) {
    fireVendorAppointmentScheduledSms({
      vendorId,
      bookingId: parentBookingId,
      bookingDate: parentDate,
      bookingTime: parentTime,
    });
  }

  return { parentBookingId, sessionBookingIds };
}
