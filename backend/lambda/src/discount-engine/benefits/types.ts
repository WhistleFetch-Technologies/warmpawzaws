import type { DiscountDomain } from '../enums/discount-domain';

export interface BenefitLineItem {
  id?: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Input for benefit calculation only — no eligibility fields.
 */
export interface BenefitContext {
  originalAmount: number;
  currentAmount: number;
  /** Base amount for percentage / cap (defaults to currentAmount). */
  eligibleAmount?: number;
  quantity?: number;
  items?: BenefitLineItem[];
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  maxDiscount?: number | null;
  benefitType?: string;
  promotionType?: string;
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercent?: number;
  bundleProductIds?: string[];
  bundleDiscountPercent?: number;
  comboDiscountPercent?: number;
  domain?: DiscountDomain;
  metadata?: Record<string, unknown>;
}

export interface BenefitResult {
  discountAmount: number;
  finalAmount: number;
  appliedBenefit: string;
  calculationMetadata?: Record<string, unknown>;
}

export interface BenefitStrategy {
  readonly benefitType: string;
  supports(context: BenefitContext): boolean;
  calculate(context: BenefitContext): BenefitResult;
}

export interface BenefitCalculator {
  readonly strategies: BenefitStrategy[];
  calculate(context: BenefitContext): BenefitResult;
  calculateWithStrategy(context: BenefitContext, benefitType: string): BenefitResult;
}

/** Phase 2 contract alias — calculation-only benefit. */
export type DiscountBenefit = BenefitStrategy;
