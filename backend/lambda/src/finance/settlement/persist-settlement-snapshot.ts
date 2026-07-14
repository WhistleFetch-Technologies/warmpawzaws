/**
 * Persist and parse settlement snapshot in wp_financial_meta / order metadata.
 */
import type { SettlementSnapshot } from './types';
import { parseBookingFinancialMeta } from '../../discount-engine/settlement/settlement-hook-bridge';

export const SETTLEMENT_SNAPSHOT_META_KEY = 'settlementSnapshot';

export function attachSettlementSnapshotToFinancialMeta(
  financialMeta: Record<string, unknown>,
  snapshot: SettlementSnapshot
): Record<string, unknown> {
  return {
    ...financialMeta,
    [SETTLEMENT_SNAPSHOT_META_KEY]: snapshot,
    vendorBasePrice: snapshot.vendorBasePrice,
    winningOffer: snapshot.winningOffer,
    offerType: snapshot.winningOffer?.offerType ?? null,
    fundingType: snapshot.winningOffer?.fundingType ?? null,
    vendorDiscount: snapshot.vendorCost,
    platformDiscount: snapshot.platformCost,
    commissionBase: snapshot.commissionBase,
    commissionRate: snapshot.commissionRate,
    commissionAmount: snapshot.commissionAmount,
    vendorSettlement: snapshot.vendorSettlement,
    platformCost: snapshot.platformCost,
    vendorCost: snapshot.vendorCost,
    fundingSummary: snapshot.fundingSummary,
    policyVersion: snapshot.policyVersion,
    policyFingerprint: snapshot.policyFingerprint,
  };
}

export function extractSettlementSnapshotFromBooking(
  booking: Record<string, unknown>
): SettlementSnapshot | undefined {
  const financial = parseBookingFinancialMeta(booking);
  if (financial) {
    const fromKey = financial[SETTLEMENT_SNAPSHOT_META_KEY];
    if (fromKey && typeof fromKey === 'object') {
      return fromKey as SettlementSnapshot;
    }
    if (
      financial.commissionBase != null &&
      financial.vendorBasePrice != null &&
      financial.commissionRate != null
    ) {
      return reconstructSnapshotFromFlatMeta(financial);
    }
  }

  const meta = booking.metadata ?? booking.settlement_metadata;
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>;
    const snap = m[SETTLEMENT_SNAPSHOT_META_KEY];
    if (snap && typeof snap === 'object') return snap as SettlementSnapshot;
  }

  return undefined;
}

function reconstructSnapshotFromFlatMeta(meta: Record<string, unknown>): SettlementSnapshot {
  const winningOffer = meta.winningOffer;
  return {
    version: String(meta.version ?? '2.0.0'),
    vendorBasePrice: Number(meta.vendorBasePrice) || 0,
    winningOffer:
      winningOffer && typeof winningOffer === 'object'
        ? (winningOffer as SettlementSnapshot['winningOffer'])
        : null,
    commissionBase: Number(meta.commissionBase) || 0,
    commissionRate: Number(meta.commissionRate) || 0,
    commissionAmount: Number(meta.commissionAmount) || 0,
    vendorSettlement: Number(meta.vendorSettlement) || 0,
    platformCost: Number(meta.platformCost) || 0,
    vendorCost: Number(meta.vendorCost) || 0,
    fundingSummary:
      meta.fundingSummary && typeof meta.fundingSummary === 'object'
        ? (meta.fundingSummary as SettlementSnapshot['fundingSummary'])
        : {
            vendorPaid: Number(meta.vendorCost) || 0,
            platformPaid: Number(meta.platformCost) || 0,
            sharedVendorPaid: 0,
            sharedPlatformPaid: 0,
            campaignPaid: 0,
          },
    commissionPolicy: {
      tierName: meta.tierName != null ? String(meta.tierName) : null,
      subscriptionActive: Boolean(meta.subscriptionActive),
      tierSource: 'vendor_tier',
      subscriptionSource: 'none',
      fallbackSource: null,
    },
    policyVersion: meta.policyVersion != null ? String(meta.policyVersion) : undefined,
    policyFingerprint: meta.policyFingerprint != null ? String(meta.policyFingerprint) : undefined,
    computedAt: String(meta.computedAt ?? new Date().toISOString()),
  };
}

export function settlementSnapshotToVendorEarningsMetadata(
  snapshot: SettlementSnapshot
): Record<string, unknown> {
  return {
    settlementSnapshot: snapshot,
    commissionBase: snapshot.commissionBase,
    vendorSettlement: snapshot.vendorSettlement,
    fundingSummary: snapshot.fundingSummary,
    winningOffer: snapshot.winningOffer,
    tierSource: snapshot.commissionPolicy.tierSource,
    subscriptionActive: snapshot.commissionPolicy.subscriptionActive,
    policyFingerprint: snapshot.policyFingerprint,
    integrationVersion: snapshot.version,
  };
}
