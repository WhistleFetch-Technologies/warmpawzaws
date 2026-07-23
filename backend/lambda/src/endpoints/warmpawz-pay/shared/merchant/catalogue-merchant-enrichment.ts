import type { PricingDiscountType, PricingStatus } from '../../constants/merchant-pricing';
import type { PublishStatus } from '../../constants/publish-status';
import type { MerchantBusinessType } from './merchant-business-type.resolver';
import type { PlatformStatus } from './merchant-platform-status.resolver';
import {
  evaluateMerchant,
  type MerchantReadinessDTO,
} from './merchant-readiness.service';
import type { WarmpawzPayStatus } from './merchant-warmpawz-pay-status.resolver';
import { isPricingConfigured, type PricingEffectiveInput } from '../pricing/pricing-effective';

export interface CatalogueMerchantEnrichmentInput {
  readonly publishStatus: PublishStatus;
  readonly vendorStatus: string;
  readonly isActive: boolean;
  readonly isOnline: boolean;
  readonly bankVerified: boolean;
  readonly payBillEnabled: boolean;
  readonly isDeleted: boolean;
  readonly vendorType?: string | null;
  readonly isSoloProvider?: boolean | null;
  readonly roleName?: string | null;
  readonly roleCategory?: string | null;
  readonly customerService?: string | null;
  readonly roleConfig?: unknown;
  readonly legacyCategory?: string | null;
}

export interface CataloguePricingSummaryDTO {
  readonly configured: boolean;
  readonly pricingId?: string;
  readonly discountType?: PricingDiscountType;
  readonly discountValue?: number;
  readonly status?: PricingStatus;
  readonly effectiveFrom?: string;
  readonly effectiveUntil?: string | null;
}

export interface CatalogueMerchantEnrichmentDTO {
  readonly category: string;
  readonly businessType: MerchantBusinessType;
  readonly platformStatus: PlatformStatus;
  readonly warmpawzPayStatus: WarmpawzPayStatus;
  readonly customerVisible: boolean;
  readonly readiness: MerchantReadinessDTO;
  readonly pricing: CataloguePricingSummaryDTO;
}

export interface CataloguePricingRowInput {
  readonly pricingId: string;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
}

export function buildCataloguePricingSummary(
  pricing: CataloguePricingRowInput | null | undefined,
): CataloguePricingSummaryDTO {
  if (!pricing) {
    return { configured: false };
  }

  const effectiveInput: PricingEffectiveInput = {
    status: pricing.status,
    effectiveFrom: pricing.effectiveFrom,
    effectiveUntil: pricing.effectiveUntil,
    discountValue: pricing.discountValue,
  };

  return {
    configured: isPricingConfigured(effectiveInput),
    pricingId: pricing.pricingId,
    discountType: pricing.discountType,
    discountValue: pricing.discountValue,
    status: pricing.status,
    effectiveFrom: pricing.effectiveFrom.toISOString(),
    effectiveUntil: pricing.effectiveUntil ? pricing.effectiveUntil.toISOString() : null,
  };
}

export function enrichCatalogueMerchant(
  input: CatalogueMerchantEnrichmentInput,
  pricing?: CataloguePricingRowInput | null,
): CatalogueMerchantEnrichmentDTO {
  const pricingSummary = buildCataloguePricingSummary(pricing ?? null);
  const evaluation = evaluateMerchant({
    ...input,
    pricingConfigured: pricingSummary.configured,
  });

  return {
    category: evaluation.category,
    businessType: evaluation.businessType,
    platformStatus: evaluation.platformStatus,
    warmpawzPayStatus: evaluation.warmpawzPayStatus,
    customerVisible: evaluation.customerVisible,
    readiness: evaluation.readiness,
    pricing: pricingSummary,
  };
}
