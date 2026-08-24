/**

 * Create vendor_earnings + bump vendor totals when a booking is marked completed.

 * Used by vendor complete, staff complete, and any other completion path so the

 * dashboard (which prefers vendor_earnings) stays in sync.

 */

import { query, select } from '../database/rds-connection';

import {

  backfillPackageSessionEarningsForCompletedBookings,

  completePackageSessionForBooking,

  type SqlClient,

} from './package-session-sync';

import { resolveVendorId } from './vendor-resolve';

import { getVendorCommissionRate, isCanonicalPackageParentBooking, isPackageSessionChildBooking } from './vendor-commission-rate';

import { applySettlementPreviewToCommissionableGross, extractSettlementPreviewFromBooking } from '../discount-engine/settlement/settlement-hook-bridge';

import {
  createFundingAwareVendorEarnings,
} from '../finance/settlement/create-vendor-earnings-from-snapshot';

import {
  isFinanceFundingAwareSettlementEnabled,
  useFundingAwareVendorEarnings,
} from '../finance/settlement/finance-settlement-mode';

import {
  extractSettlementSnapshotFromBooking,
  settlementSnapshotToVendorEarningsMetadata,
} from '../finance/settlement/persist-settlement-snapshot';
import { buildFundingAwareSettlementSnapshot } from '../finance/settlement/build-settlement-snapshot';
import { parseBookingFinancialMeta } from '../discount-engine/settlement/settlement-hook-bridge';

import { loadBookingServiceSnapshot } from './booking-service-snapshot';
import {
  shouldSkipVendorEarningsForWappt,
  SQL_EXCLUDE_WAPPT_BOOKING_EARNINGS,
} from '../endpoints/warmpawz-appointments/shared/wappt-earnings-policy';

import { resolveVendorVisibleBookingAmount } from './entity-extractor';

import type { SettlementSnapshot } from '../finance/settlement/types';



function pickBookingRealizedAtIso(booking: Record<string, unknown>): string | undefined {

  const raw = booking.completed_at ?? booking.completedAt ?? booking.updated_at ?? booking.updatedAt;

  if (raw == null || raw === '') return undefined;

  const d = new Date(String(raw));

  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();

}



/** Gross booking value used for tier commission (prefer total_amount, then base_price). */

export function resolveBookingGrossForVendorEarnings(booking: Record<string, unknown>): number {

  const total = parseFloat(String(booking.total_amount ?? booking.totalAmount ?? ''));

  const base = parseFloat(String(booking.base_price ?? booking.basePrice ?? ''));

  const amount = parseFloat(String(booking.amount ?? ''));

  if (Number.isFinite(total) && total > 0) return total;

  if (Number.isFinite(base) && base > 0) return base;

  if (Number.isFinite(amount) && amount > 0) return amount;

  return 0;

}

export function resolveUsableSettlementSnapshot(
  booking: Record<string, unknown>
): SettlementSnapshot | null {
  const snapshot = extractSettlementSnapshotFromBooking(booking);
  if (!snapshot) return null;

  const commissionBase = Number(snapshot.commissionBase);
  const commissionRate = Number(snapshot.commissionRate);
  const commissionAmount = Number(snapshot.commissionAmount);
  const vendorSettlement = Number(snapshot.vendorSettlement);
  const values = [commissionBase, commissionRate, commissionAmount, vendorSettlement];

  if (
    values.some((value) => !Number.isFinite(value) || value < 0) ||
    commissionBase <= 0 ||
    commissionRate > 100 ||
    vendorSettlement <= 0 ||
    Math.abs(commissionAmount + vendorSettlement - commissionBase) > 0.02
  ) {
    return null;
  }
  return snapshot;
}

/**
 * Gross used for tier commission: vendor list / configured service price when known,
 * not customer checkout total (GST, platform fee, etc. on top of list price).
 */
export async function resolveLedgerGrossForVendorCommission(
  booking: Record<string, unknown>,
  bookingId: string
): Promise<number> {
  const bookingRow = await syncBookingGrossFromPaidSources(bookingId);
  const merged = { ...booking, ...bookingRow };
  const checkoutGross = resolveBookingGrossForVendorEarnings(merged);

  const rawVendorId = String(merged.vendor_id ?? merged.vendorId ?? '');
  const serviceId = String(merged.service_id ?? merged.serviceId ?? '');
  let visible = 0;
  if (rawVendorId && serviceId) {
    const snap = await loadBookingServiceSnapshot(rawVendorId, serviceId);
    visible = resolveVendorVisibleBookingAmount(merged, { serviceSnap: snap ?? undefined });
  } else {
    visible = resolveVendorVisibleBookingAmount(merged, {});
  }

  if (visible > 0) {
    if (checkoutGross <= 0 || visible <= checkoutGross + 0.01) {
      return Math.round(visible * 100) / 100;
    }
  }
  return checkoutGross > 0 ? Math.round(checkoutGross * 100) / 100 : 0;
}

/**

 * Persist gross on the booking row from completed payment when checkout left total_amount at 0.

 * Earnings and settlements must read the same source of truth as finance (payments), not UI list price.

 */

export async function syncBookingGrossFromPaidSources(

  bookingId: string

): Promise<Record<string, unknown>> {

  const rows = await select('bookings', { id: bookingId });

  if (!rows.length) return {};

  const existing = rows[0] as Record<string, unknown>;

  if (resolveBookingGrossForVendorEarnings(existing) > 0) return existing;



  const payRes = await query(

    `SELECT COALESCE(total_amount, amount, 0)::numeric AS amt

     FROM payments

     WHERE booking_id = $1::uuid

       AND payment_status IN ('completed', 'paid', 'partially_refunded')

     ORDER BY created_at DESC

     LIMIT 1`,

    [bookingId]

  ).catch(() => ({ rows: [] as { amt?: string | number }[] }));



  const fromPay = Number(payRes.rows?.[0]?.amt);

  if (!Number.isFinite(fromPay) || fromPay <= 0) return existing;



  await query(

    `UPDATE bookings

     SET total_amount = $1::numeric,

         base_price = CASE WHEN COALESCE(base_price, 0) <= 0 THEN $1::numeric ELSE base_price END,

         updated_at = NOW()

     WHERE id = $2::uuid`,

    [fromPay, bookingId]

  ).catch(() => undefined);



  return {

    ...existing,

    total_amount: fromPay,

    base_price: fromPay,

  };

}



async function resolveCenterIdForVendorIds(vendorIds: string[]): Promise<string | null> {

  if (vendorIds.length === 0) return null;

  const r = await query(

    `SELECT center_id FROM vendors WHERE id = ANY($1::uuid[]) AND center_id IS NOT NULL LIMIT 1`,

    [vendorIds]

  ).catch(() => ({ rows: [] as { center_id?: string }[] }));

  const cid = r.rows?.[0]?.center_id;

  return cid ? String(cid) : null;

}



export async function ensureVendorEarningsForCompletedBooking(

  booking: Record<string, unknown>,

  bookingId: string,

  logPrefix = '[EARNINGS]',

  options?: { realizedAt?: string }

): Promise<boolean> {

  if (shouldSkipVendorEarningsForWappt(booking)) {
    return false;
  }
  if (isCanonicalPackageParentBooking(booking)) return false;
  if (isPackageSessionChildBooking(booking)) return false;



  try {

    const rawVendorId = String(booking.vendor_id ?? booking.vendorId ?? '');

    if (!rawVendorId) return false;



    const earningsVendorId = await resolveVendorId(rawVendorId);

    let totalAmount = await resolveLedgerGrossForVendorCommission(booking, bookingId);

    const merged = { ...booking, ...(await syncBookingGrossFromPaidSources(bookingId)) };

    const realizedAt =

      options?.realizedAt ?? pickBookingRealizedAtIso(merged) ?? new Date().toISOString();

    if (isFinanceFundingAwareSettlementEnabled()) {
      const financialForBase = parseBookingFinancialMeta(merged) ?? {};
      const servicePriceBase =
        parseFloat(String(financialForBase.servicePrice ?? financialForBase.vendorBasePrice ?? 0)) ||
        0;
      const fundingAwareBase =
        servicePriceBase > 0
          ? servicePriceBase
          : parseFloat(String(merged.base_price ?? merged.basePrice ?? totalAmount)) || totalAmount;
      const faResult = await createFundingAwareVendorEarnings(
        merged,
        bookingId,
        earningsVendorId,
        fundingAwareBase,
        realizedAt,
        logPrefix
      );
      if (useFundingAwareVendorEarnings() && faResult.inserted) {
        await query(
          `UPDATE vendors 
           SET pending_payout = COALESCE(pending_payout, 0) + $1,
               total_earnings = COALESCE(total_earnings, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [faResult.snapshot.vendorSettlement, earningsVendorId]
        ).catch((err: unknown) =>
          console.warn(`${logPrefix} vendor totals update:`, (err as Error)?.message)
        );
        return true;
      }
      if (useFundingAwareVendorEarnings()) {
        return false;
      }
    }

    const persistedSnapshot = resolveUsableSettlementSnapshot(merged);
    let commissionRate: number;
    let commissionAmount: number;
    let vendorAmount: number;

    if (persistedSnapshot) {
      // The checkout snapshot is authoritative for who funded the winning offer.
      // Platform-funded discounts preserve commissionBase; vendor-funded discounts reduce it.
      totalAmount = persistedSnapshot.commissionBase;
      commissionRate = persistedSnapshot.commissionRate;
      commissionAmount = persistedSnapshot.commissionAmount;
      vendorAmount = persistedSnapshot.vendorSettlement;
    } else {
      commissionRate = await getVendorCommissionRate(earningsVendorId);
      const settlementPreviewLegacy = extractSettlementPreviewFromBooking(merged);
      totalAmount = applySettlementPreviewToCommissionableGross(
        totalAmount,
        settlementPreviewLegacy
      );
      commissionAmount = Math.round((totalAmount * commissionRate) / 100 * 100) / 100;
      vendorAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;
    }



    if (vendorAmount <= 0) {

      console.warn(

        `${logPrefix} Skip earnings booking ${bookingId}: gross=${totalAmount} commission=${commissionRate}% vendorNet=${vendorAmount}`

      );

      return false;

    }



    const inserted = await query(

      `INSERT INTO vendor_earnings (

         vendor_id, booking_id, amount, commission_amount, total_amount, commission_rate, status, realized_at

       )

       SELECT $1::uuid, $2::uuid, $3::numeric, $4::numeric, $5::numeric, $6::numeric, 'pending', $7::timestamptz

       WHERE NOT EXISTS (SELECT 1 FROM vendor_earnings WHERE booking_id = $2::uuid)

         AND $3::numeric > 0

       RETURNING id`,

      [

        earningsVendorId,

        bookingId,

        vendorAmount,

        commissionAmount,

        totalAmount,

        commissionRate,

        realizedAt,

      ]

    ).catch(() => ({ rows: [] as { id: string }[] }));



    if (!inserted.rows?.length) return false;



    await query(

      `UPDATE vendors 

       SET pending_payout = COALESCE(pending_payout, 0) + $1,

           total_earnings = COALESCE(total_earnings, 0) + $1,

           updated_at = NOW()

       WHERE id = $2`,

      [vendorAmount, earningsVendorId]

    ).catch((err: unknown) =>

      console.warn(`${logPrefix} vendor totals update:`, (err as Error)?.message)

    );

    return true;

  } catch (error: unknown) {

    console.error(`${logPrefix} Failed to create earnings after booking completion:`, error);

    return false;

  }

}



const DEFAULT_BACKFILL_LIMIT = 200;



export async function backfillMissingVendorEarningsForVendorIds(

  vendorIds: string[],

  logPrefix = '[EARNINGS-BACKFILL]',

  limit = DEFAULT_BACKFILL_LIMIT

): Promise<number> {

  const unique = [...new Set((vendorIds || []).filter(Boolean))];

  if (unique.length === 0) return 0;



  const hasTable = await query(

    `SELECT EXISTS (

       SELECT 1 FROM information_schema.tables

       WHERE table_schema = 'public' AND table_name = 'vendor_earnings'

     ) as ex`

  )

    .then((r) => Boolean(r.rows[0]?.ex))

    .catch(() => false);

  if (!hasTable) return 0;



  const centerId = await resolveCenterIdForVendorIds(unique);

  const cappedLimit = Math.min(Math.max(1, limit), 500);



  const missing = centerId

    ? await query(

        `SELECT b.*

         FROM bookings b

         LEFT JOIN vendors v ON v.id = b.vendor_id

         WHERE b.status = 'completed'

           AND (

             b.vendor_id = ANY($1::uuid[])

             OR (v.center_id = $2::uuid AND v.center_id IS NOT NULL)

           )

           AND NOT EXISTS (SELECT 1 FROM vendor_earnings ve WHERE ve.booking_id = b.id)

           AND ${SQL_EXCLUDE_WAPPT_BOOKING_EARNINGS}

         ORDER BY COALESCE(b.completed_at::timestamptz, b.updated_at::timestamptz) DESC NULLS LAST

         LIMIT $3`,

        [unique, centerId, cappedLimit]

      ).catch(() => ({ rows: [] as Record<string, unknown>[] }))

    : await query(

        `SELECT b.*

         FROM bookings b

         WHERE b.status = 'completed'

           AND b.vendor_id = ANY($1::uuid[])

           AND NOT EXISTS (SELECT 1 FROM vendor_earnings ve WHERE ve.booking_id = b.id)

           AND ${SQL_EXCLUDE_WAPPT_BOOKING_EARNINGS}

         ORDER BY COALESCE(b.completed_at::timestamptz, b.updated_at::timestamptz) DESC NULLS LAST

         LIMIT $2`,

        [unique, cappedLimit]

      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));



  const rows = missing.rows || [];

  let created = 0;

  for (const b of rows) {

    const id = String(b.id ?? '');

    if (!id) continue;

    const realizedAt = pickBookingRealizedAtIso(b);

    if (

      await ensureVendorEarningsForCompletedBooking(b, id, logPrefix, {

        realizedAt,

      })

    ) {

      created += 1;

    }

  }



  let packageCreated = 0;

  try {

    packageCreated = await backfillPackageSessionEarningsForCompletedBookings(

      { query } as SqlClient,

      unique,

      logPrefix,

      cappedLimit

    );

  } catch (pkgErr: unknown) {

    console.warn(`${logPrefix} package session earnings backfill:`, (pkgErr as Error)?.message);

  }



  const totalCreated = created + packageCreated;

  if (totalCreated > 0) {

    console.log(

      `${logPrefix} Created ${totalCreated} vendor_earnings row(s) (${created} booking, ${packageCreated} package session)`

    );

  }

  return totalCreated;

}



export async function syncPackageSessionEarningsAfterBookingComplete(

  bookingId: string,

  logPrefix = '[EARNINGS-PACKAGE-SYNC]'

): Promise<void> {

  try {

    const db: SqlClient = { query };

    await completePackageSessionForBooking(db, bookingId);

  } catch (err: unknown) {

    console.warn(`${logPrefix} package session sync for ${bookingId}:`, (err as Error)?.message);

  }

}



/** Idempotent: create vendor_earnings when booking is already completed but ledger row is missing. */

/** Adjust pending ledger row when commission was taken on checkout total instead of list price. */
export async function realignPendingVendorEarningsForBooking(
  bookingId: string,
  booking: Record<string, unknown>,
  logPrefix = '[EARNINGS-REALIGN]'
): Promise<boolean> {
  // Package children store a 1/N slice. Realigning to parent settlement / list price
  // rewrites ₹238.35 back to ₹11,440.80 every time the vendor opens Earnings.
  if (isPackageSessionChildBooking(booking) || isCanonicalPackageParentBooking(booking)) {
    return false;
  }

  const veRes = await query(
    `SELECT id, vendor_id, amount, commission_amount, total_amount, commission_rate, status, metadata
     FROM vendor_earnings WHERE booking_id = $1::uuid LIMIT 1`,
    [bookingId]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const ve = veRes.rows?.[0];
  if (!ve || String(ve.status ?? '') !== 'pending') return false;

  const earningsVendorId = String(ve.vendor_id ?? '');
  let snapshot = resolveUsableSettlementSnapshot(booking);

  // Rebuild from financial meta when checkout never persisted settlementSnapshot
  // (common when FINANCE_FUNDING_AWARE_SETTLEMENT was LEGACY).
  if (!snapshot && earningsVendorId) {
    const financial = parseBookingFinancialMeta(booking) ?? {};
    const vendorBase =
      parseFloat(String(financial.servicePrice ?? financial.vendorBasePrice ?? booking.base_price ?? 0)) ||
      0;
    const hasFundingMeta =
      vendorBase > 0 &&
      (parseFloat(String(financial.couponDiscount ?? 0)) > 0 ||
        parseFloat(String(financial.platformDiscount ?? 0)) > 0 ||
        parseFloat(String(financial.vendorDiscount ?? 0)) > 0 ||
        financial.couponFundingType != null ||
        financial.settlementSnapshot != null ||
        financial.winningOffer != null);
    if (hasFundingMeta) {
      snapshot = await buildFundingAwareSettlementSnapshot({
        vendorId: earningsVendorId,
        vendorBasePrice: vendorBase,
        vendorDiscount: parseFloat(String(financial.vendorDiscount ?? 0)) || 0,
        platformDiscount: parseFloat(String(financial.platformDiscount ?? 0)) || 0,
        couponDiscount: parseFloat(String(financial.couponDiscount ?? 0)) || 0,
        vendorPromotionId: financial.vendorPromotionId
          ? String(financial.vendorPromotionId)
          : undefined,
        platformPromotionId: financial.platformPromotionId
          ? String(financial.platformPromotionId)
          : undefined,
        couponFundingType:
          financial.couponFundingType === 'VENDOR' ? 'VENDOR' : 'PLATFORM',
        winningOffer:
          financial.winningOffer && typeof financial.winningOffer === 'object'
            ? (financial.winningOffer as SettlementSnapshot['winningOffer'])
            : undefined,
      });
    }
  }

  if (snapshot) {
    const prevVendorAmount = Number(ve.amount ?? 0);
    const vendorAmount = snapshot.vendorSettlement;
    const delta = Math.round((vendorAmount - prevVendorAmount) * 100) / 100;
    if (Math.abs(delta) < 0.01 &&
        Math.abs(Number(ve.commission_rate ?? 0) - snapshot.commissionRate) < 0.01 &&
        Math.abs(Number(ve.total_amount ?? 0) - snapshot.commissionBase) < 0.01) {
      return false;
    }

    const metadata = settlementSnapshotToVendorEarningsMetadata(snapshot);
    await query(
      `UPDATE vendor_earnings
       SET amount = $1::numeric,
           commission_amount = $2::numeric,
           total_amount = $3::numeric,
           commission_rate = $4::numeric,
           metadata = $5::jsonb
       WHERE id = $6::uuid`,
      [
        vendorAmount,
        snapshot.commissionAmount,
        snapshot.commissionBase,
        snapshot.commissionRate,
        JSON.stringify(metadata),
        ve.id,
      ]
    ).catch(async () => {
      await query(
        `UPDATE vendor_earnings
         SET amount = $1::numeric,
             commission_amount = $2::numeric,
             total_amount = $3::numeric,
             commission_rate = $4::numeric
         WHERE id = $5::uuid`,
        [
          vendorAmount,
          snapshot.commissionAmount,
          snapshot.commissionBase,
          snapshot.commissionRate,
          ve.id,
        ]
      );
    });

    if (Math.abs(delta) >= 0.01) {
      await query(
        `UPDATE vendors
         SET pending_payout = GREATEST(COALESCE(pending_payout, 0) + $1, 0),
             total_earnings = GREATEST(COALESCE(total_earnings, 0) + $1, 0),
             updated_at = NOW()
         WHERE id = $2::uuid`,
        [delta, earningsVendorId]
      ).catch((err: unknown) =>
        console.warn(`${logPrefix} vendor totals realign:`, (err as Error)?.message)
      );
    }

    console.log(
      `${logPrefix} booking ${bookingId}: funding-aware realign → base ${snapshot.commissionBase}, rate ${snapshot.commissionRate}%, vendor ${vendorAmount}`
    );
    return true;
  }

  const gross = await resolveLedgerGrossForVendorCommission(booking, bookingId);
  const prevGross = Number(ve.total_amount ?? 0);
  if (!Number.isFinite(gross) || gross <= 0 || Math.abs(prevGross - gross) < 0.01) return false;

  const commissionRate = await getVendorCommissionRate(earningsVendorId);
  const commissionAmount = Math.round((gross * commissionRate) / 100 * 100) / 100;
  const vendorAmount = Math.round((gross - commissionAmount) * 100) / 100;
  const prevVendorAmount = Number(ve.amount ?? 0);
  const delta = Math.round((vendorAmount - prevVendorAmount) * 100) / 100;
  if (Math.abs(delta) < 0.01) return false;

  await query(
    `UPDATE vendor_earnings
     SET amount = $1::numeric, commission_amount = $2::numeric, total_amount = $3::numeric, commission_rate = $4::numeric
     WHERE id = $5::uuid`,
    [vendorAmount, commissionAmount, gross, commissionRate, ve.id]
  ).catch(() => undefined);

  await query(
    `UPDATE vendors
     SET pending_payout = GREATEST(COALESCE(pending_payout, 0) + $1, 0),
         total_earnings = GREATEST(COALESCE(total_earnings, 0) + $1, 0),
         updated_at = NOW()
     WHERE id = $2::uuid`,
    [delta, earningsVendorId]
  ).catch((err: unknown) =>
    console.warn(`${logPrefix} vendor totals realign:`, (err as Error)?.message)
  );

  console.log(
    `${logPrefix} booking ${bookingId}: gross ${prevGross} → ${gross}, vendor ${prevVendorAmount} → ${vendorAmount}`
  );
  return true;
}

export async function realignPendingVendorEarningsForVendorIds(
  vendorIds: string[],
  limit = 80,
  logPrefix = '[EARNINGS-REALIGN]'
): Promise<number> {
  const unique = [...new Set((vendorIds || []).filter(Boolean))];
  if (unique.length === 0) return 0;

  const rows = await query(
    `SELECT b.*
     FROM vendor_earnings ve
     JOIN bookings b ON b.id = ve.booking_id
     WHERE ve.vendor_id = ANY($1::uuid[])
       AND ve.status = 'pending'
       AND b.status = 'completed'
       AND b.package_purchase_id IS NULL
     ORDER BY ve.realized_at DESC NULLS LAST
     LIMIT $2`,
    [unique, Math.min(Math.max(1, limit), 200)]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

  let n = 0;
  for (const b of rows.rows || []) {
    const id = String(b.id ?? '');
    if (!id) continue;
    if (await realignPendingVendorEarningsForBooking(id, b, logPrefix)) n += 1;
  }
  return n;
}

export async function repairVendorEarningsIfCompletedBookingMissing(

  bookingId: string,

  logPrefix = '[EARNINGS-REPAIR]'

): Promise<boolean> {

  const rows = await select('bookings', { id: bookingId });

  if (!rows.length) return false;

  const booking = rows[0] as Record<string, unknown>;

  if (String(booking.status ?? '') !== 'completed') return false;

  const existing = await query(

    `SELECT 1 FROM vendor_earnings WHERE booking_id = $1::uuid LIMIT 1`,

    [bookingId]

  ).catch(() => ({ rows: [] }));

  if ((existing.rows?.length ?? 0) > 0) {
    await realignPendingVendorEarningsForBooking(bookingId, booking, logPrefix);
    return false;
  }

  const created = await ensureVendorEarningsForCompletedBooking(booking, bookingId, logPrefix);

  if (created) {

    await syncPackageSessionEarningsAfterBookingComplete(bookingId, logPrefix);

  }

  return created;

}


