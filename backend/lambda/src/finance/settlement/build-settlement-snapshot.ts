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
  /** Pricing / payment fields that must survive settlement snapshot attach. */
  subtotalAfterDiscounts?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax?: number;
  platformFee?: number;
  convenienceFee?: number;
  deliveryFee?: number;
  walletAmount?: number;
  finalPaid?: number;
};

/** Attach settlement snapshot to financial meta object before persisting wp_financial_meta. */
export async function enrichFinancialMetaWithSettlement(
  params: EnrichFinancialMetaParams
): Promise<Record<string, unknown>> {
  if (!shouldPersistFundingAwareSnapshot()) {
    return { ...params };
  }

  const legacyRate = (await resolveVendorCommissionPolicy(params.vendorId)).commissionRate;
  const legacyBase =
    params.servicePrice -
    (params.vendorDiscount ?? 0) -
    (params.platformDiscount ?? 0) -
    (params.couponDiscount ?? 0);
  const legacyCommissionBase = Math.max(0, legacyBase > 0 ? legacyBase : params.servicePrice);

  const snapshot = await buildSettlementSnapshotWithShadowLog(
    {
      vendorId: params.vendorId,
      vendorBasePrice: params.servicePrice,
      vendorDiscount: params.vendorDiscount,
      platformDiscount: params.platformDiscount,
      couponDiscount: params.couponDiscount,
      vendorPromotionId: params.vendorPromotionId,
      platformPromotionId: params.platformPromotionId,
      couponFundingType: params.couponFundingType,
      policyFingerprint: params.policyFingerprint,
    },
    legacyCommissionBase,
    legacyRate
  );

  const derivedSubtotal =
    params.subtotalAfterDiscounts != null && params.subtotalAfterDiscounts > 0
      ? params.subtotalAfterDiscounts
      : Math.max(0, legacyCommissionBase);

  return attachSettlementSnapshotToFinancialMeta(
    {
      servicePrice: params.servicePrice,
      vendorDiscount: params.vendorDiscount,
      platformDiscount: params.platformDiscount,
      couponDiscount: params.couponDiscount,
      vendorPromotionId: params.vendorPromotionId,
      platformPromotionId: params.platformPromotionId,
      couponFundingType: params.couponFundingType,
      subtotalAfterDiscounts: derivedSubtotal,
      cgst: params.cgst,
      sgst: params.sgst,
      igst: params.igst,
      totalTax: params.totalTax,
      platformFee: params.platformFee,
      convenienceFee: params.convenienceFee,
      deliveryFee: params.deliveryFee,
      walletAmount: params.walletAmount,
      finalPaid: params.finalPaid,
    },
    snapshot
  );
}

export type { WinningOfferSnapshot };
