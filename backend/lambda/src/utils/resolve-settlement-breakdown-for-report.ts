/**
 * Read-only settlement breakdown for Finance reporting (S3).
 * Uses persisted metadata only — never recomputes settlement.
 */
import type { SettlementSnapshot } from '../finance/settlement/types';
import { extractSettlementSnapshotFromBooking } from '../finance/settlement/persist-settlement-snapshot';
import { readSettlementPreviewFromMetadata } from '../discount-engine/settlement/settlement-hook-bridge';

export type SettlementBreakdownDataSource =
  | 'ledger_metadata'
  | 'booking_meta'
  | 'settlement_preview'
  | 'unavailable';

export type SettlementBreakdownForReport = {
  available: boolean;
  dataSource: SettlementBreakdownDataSource;
  vendorBasePrice: number;
  vendorPromotion: number;
  platformPromotion: number;
  vendorCoupon: number;
  platformCoupon: number;
  winningOfferType: string | null;
  winningOfferName: string | null;
  fundingType: string | null;
  commissionBase: number;
  commissionRate: number;
  commissionAmount: number;
  vendorSettlement: number;
  platformRevenue: number;
  vendorPaid: number;
  platformPaid: number;
  sharedVendorPaid: number;
  sharedPlatformPaid: number;
  campaignPaid: number;
  appliedPolicy: string | null;
  priorityRule: string | null;
  stackRule: string | null;
  fundingRule: string | null;
  tierName: string | null;
  tierSource: string | null;
  subscriptionActive: boolean;
  policyFingerprint: string | null;
  policyVersion: string | null;
  settlementId: string | null;
  settlementStatus: string | null;
  payoutId: string | null;
  payoutStatus: string | null;
  snapshotVersion: string | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function str(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v);
}

function parseMetadataObject(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function offerAmountsFromSnapshot(snapshot: SettlementSnapshot): {
  vendorPromotion: number;
  platformPromotion: number;
  vendorCoupon: number;
  platformCoupon: number;
} {
  const offer = snapshot.winningOffer;
  const amount = num(offer?.discountAmount);
  const vendorCost = num(snapshot.vendorCost);
  const platformCost = num(snapshot.platformCost);
  const base = {
    vendorPromotion: 0,
    platformPromotion: 0,
    vendorCoupon: 0,
    platformCoupon: 0,
  };
  if (!offer) {
    if (vendorCost > 0) base.vendorPromotion = vendorCost;
    if (platformCost > 0) base.platformPromotion = platformCost;
    return base;
  }
  switch (offer.offerType) {
    case 'VENDOR_PROMOTION':
      base.vendorPromotion = amount || vendorCost;
      break;
    case 'PLATFORM_PROMOTION':
      base.platformPromotion = amount || platformCost;
      break;
    case 'VENDOR_COUPON':
      base.vendorCoupon = amount || vendorCost;
      break;
    case 'PLATFORM_COUPON':
      base.platformCoupon = amount || platformCost;
      break;
    case 'SHARED':
    case 'CAMPAIGN':
    case 'OTHER':
    default:
      if (vendorCost > 0) base.vendorPromotion = vendorCost;
      if (platformCost > 0) base.platformPromotion = platformCost;
      break;
  }
  return base;
}

function breakdownFromSnapshot(
  snapshot: SettlementSnapshot,
  dataSource: SettlementBreakdownDataSource,
  status: {
    settlementId?: string | null;
    settlementStatus?: string | null;
    payoutId?: string | null;
    payoutStatus?: string | null;
  },
): SettlementBreakdownForReport {
  const offers = offerAmountsFromSnapshot(snapshot);
  const funding = snapshot.fundingSummary;
  const policy = snapshot.commissionPolicy;
  const winning = snapshot.winningOffer;

  return {
    available: true,
    dataSource,
    vendorBasePrice: num(snapshot.vendorBasePrice),
    ...offers,
    winningOfferType: winning?.offerType ?? null,
    winningOfferName: winning?.offerName ?? null,
    fundingType: winning?.fundingType ?? null,
    commissionBase: num(snapshot.commissionBase),
    commissionRate: num(snapshot.commissionRate),
    commissionAmount: num(snapshot.commissionAmount),
    vendorSettlement: num(snapshot.vendorSettlement),
    platformRevenue: num(snapshot.commissionAmount),
    vendorPaid: num(funding?.vendorPaid),
    platformPaid: num(funding?.platformPaid),
    sharedVendorPaid: num(funding?.sharedVendorPaid),
    sharedPlatformPaid: num(funding?.sharedPlatformPaid),
    campaignPaid: num(funding?.campaignPaid),
    appliedPolicy: snapshot.policyVersion ?? null,
    priorityRule: winning?.offerType ? `Winning offer: ${winning.offerType}` : null,
    stackRule: null,
    fundingRule: winning?.fundingType ? `${winning.fundingType} funding` : null,
    tierName: policy?.tierName ?? null,
    tierSource: policy?.tierSource ?? null,
    subscriptionActive: Boolean(policy?.subscriptionActive),
    policyFingerprint: snapshot.policyFingerprint ?? null,
    policyVersion: snapshot.policyVersion ?? null,
    settlementId: status.settlementId ?? null,
    settlementStatus: status.settlementStatus ?? null,
    payoutId: status.payoutId ?? null,
    payoutStatus: status.payoutStatus ?? null,
    snapshotVersion: snapshot.version ?? null,
  };
}

function breakdownFromPreview(
  preview: Record<string, unknown>,
  financialMeta: Record<string, unknown>,
  dataSource: SettlementBreakdownDataSource,
  status: {
    settlementId?: string | null;
    settlementStatus?: string | null;
    payoutId?: string | null;
    payoutStatus?: string | null;
  },
): SettlementBreakdownForReport {
  const vendorDiscount = num(preview.vendorDiscountShare ?? preview.vendorCost);
  const platformDiscount = num(preview.platformDiscountShare ?? preview.platformCost);
  return {
    available: true,
    dataSource,
    vendorBasePrice: num(financialMeta.servicePrice ?? financialMeta.vendorBasePrice),
    vendorPromotion: vendorDiscount,
    platformPromotion: platformDiscount,
    vendorCoupon: 0,
    platformCoupon: 0,
    winningOfferType: str(financialMeta.offerType ?? preview.appliedFunding),
    winningOfferName: null,
    fundingType: str(financialMeta.fundingType ?? preview.appliedFunding),
    commissionBase: num(financialMeta.commissionBase),
    commissionRate: num(financialMeta.commissionRate),
    commissionAmount: num(financialMeta.commissionAmount),
    vendorSettlement: num(preview.vendorReceivable ?? preview.netSettlement ?? financialMeta.vendorSettlement),
    platformRevenue: num(financialMeta.commissionAmount),
    vendorPaid: vendorDiscount,
    platformPaid: platformDiscount,
    sharedVendorPaid: num((preview.sharedDiscountShare as Record<string, unknown>)?.vendor),
    sharedPlatformPaid: num((preview.sharedDiscountShare as Record<string, unknown>)?.platform),
    campaignPaid: 0,
    appliedPolicy: str(preview.settlementVersion ?? financialMeta.policyVersion),
    priorityRule: null,
    stackRule: null,
    fundingRule: str(preview.appliedFunding),
    tierName: null,
    tierSource: null,
    subscriptionActive: false,
    policyFingerprint: str(preview.policyFingerprint ?? financialMeta.policyFingerprint),
    policyVersion: str(financialMeta.policyVersion),
    settlementId: status.settlementId ?? null,
    settlementStatus: status.settlementStatus ?? null,
    payoutId: status.payoutId ?? null,
    payoutStatus: status.payoutStatus ?? null,
    snapshotVersion: str(preview.settlementVersion),
  };
}

export function emptySettlementBreakdown(status?: {
  settlementId?: string | null;
  settlementStatus?: string | null;
  payoutId?: string | null;
  payoutStatus?: string | null;
}): SettlementBreakdownForReport {
  return {
    available: false,
    dataSource: 'unavailable',
    vendorBasePrice: 0,
    vendorPromotion: 0,
    platformPromotion: 0,
    vendorCoupon: 0,
    platformCoupon: 0,
    winningOfferType: null,
    winningOfferName: null,
    fundingType: null,
    commissionBase: 0,
    commissionRate: 0,
    commissionAmount: 0,
    vendorSettlement: 0,
    platformRevenue: 0,
    vendorPaid: 0,
    platformPaid: 0,
    sharedVendorPaid: 0,
    sharedPlatformPaid: 0,
    campaignPaid: 0,
    appliedPolicy: null,
    priorityRule: null,
    stackRule: null,
    fundingRule: null,
    tierName: null,
    tierSource: null,
    subscriptionActive: false,
    policyFingerprint: null,
    policyVersion: null,
    settlementId: status?.settlementId ?? null,
    settlementStatus: status?.settlementStatus ?? null,
    payoutId: status?.payoutId ?? null,
    payoutStatus: status?.payoutStatus ?? null,
    snapshotVersion: null,
  };
}

export type ResolveSettlementBreakdownInput = {
  earningsMetadata?: unknown;
  bookingNotes?: unknown;
  bookingFinancialMeta?: unknown;
  settlementId?: string | null;
  settlementStatus?: string | null;
  payoutId?: string | null;
  payoutStatus?: string | null;
};

/**
 * Priority: ledger metadata → booking financial meta → settlement_preview → unavailable
 */
export function resolveSettlementBreakdownForReport(
  input: ResolveSettlementBreakdownInput,
): SettlementBreakdownForReport {
  const status = {
    settlementId: input.settlementId ?? null,
    settlementStatus: input.settlementStatus ?? null,
    payoutId: input.payoutId ?? null,
    payoutStatus: input.payoutStatus ?? null,
  };

  const ledgerMeta = parseMetadataObject(input.earningsMetadata);
  if (ledgerMeta) {
    const snapRaw = ledgerMeta.settlementSnapshot;
    if (snapRaw && typeof snapRaw === 'object') {
      return breakdownFromSnapshot(snapRaw as SettlementSnapshot, 'ledger_metadata', status);
    }
    if (ledgerMeta.commissionBase != null && ledgerMeta.vendorBasePrice != null) {
      const pseudoBooking = {
        financial_meta: ledgerMeta,
        notes: '',
      };
      const snap = extractSettlementSnapshotFromBooking(pseudoBooking);
      if (snap) return breakdownFromSnapshot(snap, 'ledger_metadata', status);
    }
  }

  const bookingRecord: Record<string, unknown> = {
    notes: input.bookingNotes,
    financial_meta: input.bookingFinancialMeta,
  };
  const fromBooking = extractSettlementSnapshotFromBooking(bookingRecord);
  if (fromBooking) {
    return breakdownFromSnapshot(fromBooking, 'booking_meta', status);
  }

  const financial = parseMetadataObject(input.bookingFinancialMeta);
  if (financial) {
    const preview = readSettlementPreviewFromMetadata(financial);
    if (preview) {
      return breakdownFromPreview(
        preview as unknown as Record<string, unknown>,
        financial,
        'settlement_preview',
        status,
      );
    }
  }

  if (ledgerMeta?.settlement_preview && typeof ledgerMeta.settlement_preview === 'object') {
    return breakdownFromPreview(
      ledgerMeta.settlement_preview as Record<string, unknown>,
      ledgerMeta,
      'settlement_preview',
      status,
    );
  }

  return emptySettlementBreakdown(status);
}

export async function fetchFundingDiscountTotalsForIstRange(
  periodStartYmd: string,
  periodEndExclusiveYmd: string,
): Promise<{ platformFundedTotal: number; vendorFundedTotal: number }> {
  const { query } = await import('../database/rds-connection');
  const res = await query(
    `WITH bounds AS (
       SELECT
         (to_timestamp($1::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS start_ts,
         (to_timestamp($2::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS end_ts
     )
     SELECT
       COALESCE(SUM(
         COALESCE(
           (ve.metadata->'fundingSummary'->>'platformPaid')::numeric,
           (ve.metadata->'settlementSnapshot'->'fundingSummary'->>'platformPaid')::numeric,
           (ve.metadata->'settlementSnapshot'->>'platformCost')::numeric,
           0
         )
       ), 0)::float AS platform_funded,
       COALESCE(SUM(
         COALESCE(
           (ve.metadata->'fundingSummary'->>'vendorPaid')::numeric,
           (ve.metadata->'fundingSummary'->>'sharedVendorPaid')::numeric,
           (ve.metadata->'settlementSnapshot'->'fundingSummary'->>'vendorPaid')::numeric,
           (ve.metadata->'settlementSnapshot'->>'vendorCost')::numeric,
           0
         )
       ), 0)::float AS vendor_funded
     FROM vendor_earnings ve
     CROSS JOIN bounds bnd
     WHERE ve.realized_at >= bnd.start_ts
       AND ve.realized_at < bnd.end_ts
       AND (ve.status IS DISTINCT FROM 'cancelled')`,
    [periodStartYmd, periodEndExclusiveYmd],
  ).catch(() => ({ rows: [{ platform_funded: 0, vendor_funded: 0 }] }));

  const row = res.rows?.[0] ?? {};
  return {
    platformFundedTotal: num(row.platform_funded),
    vendorFundedTotal: num(row.vendor_funded),
  };
}
