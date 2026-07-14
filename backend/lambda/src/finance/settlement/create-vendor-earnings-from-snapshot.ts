/**
 * Finance S2 — insert vendor_earnings from persisted or computed settlement snapshot.
 */
import { query } from '../../database/rds-connection';
import { resolveVendorCommissionPolicy } from '../commission/resolve-vendor-commission-policy';
import { buildFundingAwareSettlementSnapshot } from './build-settlement-snapshot';
import { computeFundingAwareSettlement } from './compute-funding-aware-settlement';
import { resolveWinningOfferFromFinancialMeta } from './derive-winning-offer';
import {
  extractSettlementSnapshotFromBooking,
  settlementSnapshotToVendorEarningsMetadata,
} from './persist-settlement-snapshot';
import { parseBookingFinancialMeta } from '../../discount-engine/settlement/settlement-hook-bridge';
import {
  isFinanceFundingAwareSettlementShadow,
  useFundingAwareVendorEarnings,
} from './finance-settlement-mode';
import type { SettlementSnapshot } from './types';

export type VendorEarningsInsertResult = {
  inserted: boolean;
  snapshot: SettlementSnapshot;
  usedFundingAware: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function resolveSettlementSnapshotForBooking(
  booking: Record<string, unknown>,
  bookingId: string,
  vendorId: string,
  vendorBasePrice: number
): Promise<SettlementSnapshot> {
  const existing = extractSettlementSnapshotFromBooking(booking);
  if (existing?.commissionBase != null && existing.commissionRate != null) {
    return existing;
  }

  const financial = parseBookingFinancialMeta(booking) ?? {};
  const policy = await resolveVendorCommissionPolicy(vendorId);

  const winningOffer = resolveWinningOfferFromFinancialMeta({
    vendorBasePrice,
    vendorDiscount: parseFloat(String(financial.vendorDiscount ?? 0)) || 0,
    platformDiscount: parseFloat(String(financial.platformDiscount ?? 0)) || 0,
    couponDiscount: parseFloat(String(financial.couponDiscount ?? 0)) || 0,
    couponFundingType:
      financial.couponFundingType === 'VENDOR' ? 'VENDOR' : 'PLATFORM',
    vendorPromotionId: financial.vendorPromotionId
      ? String(financial.vendorPromotionId)
      : undefined,
    platformPromotionId: financial.platformPromotionId
      ? String(financial.platformPromotionId)
      : undefined,
    winningOffer:
      financial.winningOffer && typeof financial.winningOffer === 'object'
        ? (financial.winningOffer as SettlementSnapshot['winningOffer'])
        : undefined,
  });

  return computeFundingAwareSettlement({
    vendorBasePrice,
    winningOffer,
    commissionRate: policy.commissionRate,
    commissionPolicy: policy,
    policyFingerprint:
      financial.policyFingerprint != null ? String(financial.policyFingerprint) : undefined,
  });
}

export async function insertVendorEarningsFromSettlementSnapshot(
  params: {
    vendorId: string;
    bookingId: string;
    snapshot: SettlementSnapshot;
    realizedAt: string;
  }
): Promise<boolean> {
  const metadata = settlementSnapshotToVendorEarningsMetadata(params.snapshot);

  const inserted = await query(
    `INSERT INTO vendor_earnings (
       vendor_id, booking_id, amount, commission_amount, total_amount,
       commission_rate, status, realized_at, metadata
     )
     SELECT $1::uuid, $2::uuid, $3::numeric, $4::numeric, $5::numeric, $6::numeric,
            'pending', $7::timestamptz, $8::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM vendor_earnings WHERE booking_id = $2::uuid)
       AND $3::numeric > 0
     RETURNING id`,
    [
      params.vendorId,
      params.bookingId,
      params.snapshot.vendorSettlement,
      params.snapshot.commissionAmount,
      params.snapshot.commissionBase,
      params.snapshot.commissionRate,
      params.realizedAt,
      JSON.stringify(metadata),
    ]
  ).catch(async () => {
    return query(
      `INSERT INTO vendor_earnings (
         vendor_id, booking_id, amount, commission_amount, total_amount,
         commission_rate, status, realized_at
       )
       SELECT $1::uuid, $2::uuid, $3::numeric, $4::numeric, $5::numeric, $6::numeric,
              'pending', $7::timestamptz
       WHERE NOT EXISTS (SELECT 1 FROM vendor_earnings WHERE booking_id = $2::uuid)
         AND $3::numeric > 0
       RETURNING id`,
      [
        params.vendorId,
        params.bookingId,
        params.snapshot.vendorSettlement,
        params.snapshot.commissionAmount,
        params.snapshot.commissionBase,
        params.snapshot.commissionRate,
        params.realizedAt,
      ]
    );
  });

  return Boolean(inserted.rows?.length);
}

export async function createFundingAwareVendorEarnings(
  booking: Record<string, unknown>,
  bookingId: string,
  vendorId: string,
  vendorBasePrice: number,
  realizedAt: string,
  logPrefix: string
): Promise<VendorEarningsInsertResult> {
  const snapshot = await resolveSettlementSnapshotForBooking(
    booking,
    bookingId,
    vendorId,
    vendorBasePrice
  );

  if (isFinanceFundingAwareSettlementShadow()) {
    const policy = await resolveVendorCommissionPolicy(vendorId);
    console.info(`${logPrefix} [FINANCE-S2-SHADOW] earnings snapshot`, {
      bookingId,
      vendorBasePrice,
      snapshot: {
        commissionBase: snapshot.commissionBase,
        commissionRate: snapshot.commissionRate,
        vendorSettlement: snapshot.vendorSettlement,
        winningOffer: snapshot.winningOffer?.offerType,
      },
      legacyRate: policy.commissionRate,
    });
  }

  if (!useFundingAwareVendorEarnings()) {
    return { inserted: false, snapshot, usedFundingAware: false };
  }

  if (snapshot.vendorSettlement <= 0) {
    console.warn(
      `${logPrefix} Skip funding-aware earnings ${bookingId}: base=${snapshot.commissionBase} net=${snapshot.vendorSettlement}`
    );
    return { inserted: false, snapshot, usedFundingAware: true };
  }

  const inserted = await insertVendorEarningsFromSettlementSnapshot({
    vendorId,
    bookingId,
    snapshot,
    realizedAt,
  });

  return { inserted, snapshot, usedFundingAware: true };
}

export { round2 };
