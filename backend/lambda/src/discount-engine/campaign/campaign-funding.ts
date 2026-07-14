import { DiscountFunding } from '../enums/discount-funding';
import type { CampaignFundingPolicy, CampaignFundingSplit } from './types';

export interface FundingValidationResult {
  valid: boolean;
  errors: string[];
  normalized: CampaignFundingPolicy;
}

const PRESET_SPLITS: Record<string, CampaignFundingSplit> = {
  '50_50': { platformPercent: 50, vendorPercent: 50 },
  '70_30': { platformPercent: 70, vendorPercent: 30 },
  '20_80': { platformPercent: 20, vendorPercent: 80 },
};

/**
 * Validates and normalizes campaign funding policy.
 * Does NOT calculate settlement — passes policy to Settlement Engine only.
 */
export function normalizeCampaignFunding(input?: Partial<CampaignFundingPolicy>): FundingValidationResult {
  const errors: string[] = [];
  const type = input?.type ?? DiscountFunding.PLATFORM;

  if (type === DiscountFunding.PLATFORM || type === DiscountFunding.VENDOR) {
    return {
      valid: true,
      errors: [],
      normalized: { type },
    };
  }

  if (type === DiscountFunding.SHARED || type === 'CUSTOM') {
    const split = input?.split ?? PRESET_SPLITS['50_50'];
    const platform = Number(split.platformPercent);
    const vendor = Number(split.vendorPercent);
    if (!Number.isFinite(platform) || !Number.isFinite(vendor)) {
      errors.push('Funding split must be numeric');
    } else if (platform + vendor !== 100) {
      errors.push('Funding split must sum to 100');
    } else if (platform < 0 || vendor < 0) {
      errors.push('Funding split percentages must be non-negative');
    }
    return {
      valid: errors.length === 0,
      errors,
      normalized: { type: type === 'CUSTOM' ? 'CUSTOM' : DiscountFunding.SHARED, split: { platformPercent: platform, vendorPercent: vendor } },
    };
  }

  errors.push(`Unknown funding type: ${type}`);
  return { valid: false, errors, normalized: { type: DiscountFunding.PLATFORM } };
}

export function resolvePresetSplit(preset: string): CampaignFundingSplit | null {
  return PRESET_SPLITS[preset] ?? null;
}

/** Maps campaign funding to settlement attribution payload (no payout math). */
export function toSettlementFundingPayload(
  campaignId: string,
  funding: CampaignFundingPolicy
): Record<string, unknown> {
  return {
    campaignId,
    fundingType: funding.type,
    fundingSplit: funding.split ?? null,
    source: 'commercial_campaign_engine',
  };
}
