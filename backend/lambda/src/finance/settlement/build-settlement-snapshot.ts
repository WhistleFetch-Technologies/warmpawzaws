/**
 * Build funding-aware settlement snapshot at checkout or completion.
 */
import { resolveVendorCommissionPolicy } from '../commission/resolve-vendor-commission-policy';
import { computeFundingAwareSettlement } from './compute-funding-aware-settlement';
import {
  resolveWinningOfferFromFinancialMeta,
  type FinancialMetaDiscountInput,
} from './derive-winning-offer';
import type { SettlementSnapshot, WinningOfferSnapshot } from './types';
import {
  isFinanceFundingAwareSettlementShadow,
  isFinanceFundingAwareSettlementAuthoritative,
} from './finance-settlement-mode';
import { attachSettlementSnapshotToFinancialMeta } from './persist-settlement-snapshot';

export type BuildSettlementSnapshotParams = FinancialMetaDiscountInput & {
  vendorId: string;
  policyVersion?: string;
  policyFingerprint?: string;
};

export async function buildFundingAwareSettlementSnapshot(
  params: BuildSettlementSnapshotParams
): Promise<SettlementSnapshot> {
  const policy = await resolveVendorCommissionPolicy(params.vendorId);
  const winningOffer = resolveWinningOfferFromFinancialMeta(params);

  return computeFundingAwareSettlement({
    vendorBasePrice: params.vendorBasePrice,
    winningOffer,
    commissionRate: policy.commissionRate,
    commissionPolicy: policy,
    policyVersion: params.policyVersion,
    policyFingerprint: params.policyFingerprint,
  });
}

export async function buildSettlementSnapshotWithShadowLog(
  params: BuildSettlementSnapshotParams,
  legacyCommissionBase: number,
  legacyCommissionRate: number
): Promise<SettlementSnapshot> {
  const snapshot = await buildFundingAwareSettlementSnapshot(params);

  if (isFinanceFundingAwareSettlementShadow()) {
    const legacyCommission = Math.round((legacyCommissionBase * legacyCommissionRate) / 100 * 100) / 100;
    console.info('[FINANCE-S2-SHADOW] settlement snapshot compare', {
      vendorId: params.vendorId,
      vendorBasePrice: params.vendorBasePrice,
      legacy: {
        commissionBase: legacyCommissionBase,
        commissionRate: legacyCommissionRate,
        commissionAmount: legacyCommission,
        vendorSettlement: legacyCommissionBase - legacyCommission,
      },
      fundingAware: {
        commissionBase: snapshot.commissionBase,
        commissionRate: snapshot.commissionRate,
        commissionAmount: snapshot.commissionAmount,
        vendorSettlement: snapshot.vendorSettlement,
        winningOffer: snapshot.winningOffer?.offerType,
      },
    });
  }

  return snapshot;
}

export function shouldPersistFundingAwareSnapshot(): boolean {
  return (
    isFinanceFundingAwareSettlementAuthoritative() || isFinanceFundingAwareSettlementShadow()
  );
}

export type EnrichFinancialMetaParams = {
  vendorId: string;
  servicePrice: number;
  vendorDiscount?: number;
  platformDiscount?: number;
  couponDiscount?: number;
  vendorPromotionId?: string;
  platformPromotionId?: string;
  couponFundingType?: 'VENDOR' | 'PLATFORM';
  policyFingerprint?: string;
};

/** Attach settlement snapshot to financial meta object before persisting wp_financial_meta. */
export async function enrichFinancialMetaWithSettlement(
  params: EnrichFinancialMetaParams
): Promise<Record<string, unknown>> {
  if (!shouldPersistFundingAwareSnapshot()) {
    return { ...params };
  }

  const snapshot = await buildFundingAwareSettlementSnapshot({
    vendorId: params.vendorId,
    vendorBasePrice: params.servicePrice,
    vendorDiscount: params.vendorDiscount,
    platformDiscount: params.platformDiscount,
    couponDiscount: params.couponDiscount,
    vendorPromotionId: params.vendorPromotionId,
    platformPromotionId: params.platformPromotionId,
    couponFundingType: params.couponFundingType,
    policyFingerprint: params.policyFingerprint,
  });

  return attachSettlementSnapshotToFinancialMeta(
    {
      servicePrice: params.servicePrice,
      vendorDiscount: params.vendorDiscount,
      platformDiscount: params.platformDiscount,
      couponDiscount: params.couponDiscount,
      vendorPromotionId: params.vendorPromotionId,
      platformPromotionId: params.platformPromotionId,
      couponFundingType: params.couponFundingType,
    },
    snapshot
  );
}

export type { WinningOfferSnapshot };
