import type { DiscountDomain } from '../enums/discount-domain';
import type { DiscountFunding } from '../enums/discount-funding';
import type { DiscountOwner } from '../enums/discount-owner';
import type { DiscountSource } from '../enums/discount-source';
import type { DiscountStatus } from '../enums/discount-status';
import type { DiscountTrigger } from '../enums/discount-trigger';

/** Eligibility / targeting payload — consumed by Rule Engine via bridge. */
export interface DiscountCandidateRules {
  targetAudience?: string;
  applicableProducts?: string[];
  applicableCategories?: string[];
  /** all | own_brand | third_party */
  listingOwnershipScope?: string;
  applicableServices?: string[];
  applicableServiceStyles?: string[];
  serviceCategory?: string;
  vendorId?: string;
  published?: boolean;
  minOrderValue?: number | null;
  minBookingValue?: number | null;
  /** Platform row category / style columns */
  rowServiceCategory?: string;
  rowServiceStyle?: string;
}

/** Benefit calculation payload — consumed by Benefit Engine via bridge. */
export interface DiscountCandidateBenefits {
  /** promotion_type or benefit strategy key (e.g. buy_x_get_y, combo) */
  type: string;
  discountType?: 'percentage' | 'fixed';
  value: number;
  maxDiscount?: number | null;
  minOrderAmount?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  getDiscountPercent?: number | null;
  bundleProductIds?: string[];
  bundleDiscountPercent?: number | null;
  comboServiceIds?: string[];
  comboDiscountPercent?: number | null;
  visitsRequired?: number | null;
  loyaltyDiscountPercent?: number | null;
}

export interface DiscountCandidateUsage {
  limit?: number | null;
  count?: number;
  /** Per-customer cap (max_uses_per_user). */
  perUserLimit?: number | null;
  /** Prior redemptions by this customer. */
  perUserCount?: number;
}

/**
 * Canonical discount definition — table-agnostic.
 * Rule and Benefit engines must only depend on this type (+ runtime context).
 */
export interface DiscountCandidate {
  id: string;
  name: string;
  code?: string | null;
  source: DiscountSource;
  owner: DiscountOwner;
  domain: DiscountDomain;
  trigger: DiscountTrigger;
  status: DiscountStatus;
  priority?: number;
  stackable?: boolean;
  exclusive?: boolean;
  rules: DiscountCandidateRules;
  benefits: DiscountCandidateBenefits;
  startDate?: string;
  endDate?: string;
  usage?: DiscountCandidateUsage;
  funding?: DiscountFunding;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  /** Original DB row for audit / shadow / Phase 4 settlement */
  originalEntity: Record<string, unknown>;
}
