export const PRICING_DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
} as const;

export type PricingDiscountType =
  (typeof PRICING_DISCOUNT_TYPE)[keyof typeof PRICING_DISCOUNT_TYPE];

export const PRICING_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export type PricingStatus = (typeof PRICING_STATUS)[keyof typeof PRICING_STATUS];

export const PRICING_AUDIT_ENTITY_TYPE = 'warmpawz_pay_merchant_pricing' as const;

export const PricingAuditAction = {
  CREATE: 'create',
  UPDATE: 'update',
  ENABLE: 'enable',
  DISABLE: 'disable',
  DELETE: 'delete',
} as const;

export type PricingAuditAction =
  (typeof PricingAuditAction)[keyof typeof PricingAuditAction];

export const ALLOWED_PRICING_DISCOUNT_TYPES = [PRICING_DISCOUNT_TYPE.PERCENTAGE] as const;

export const ALLOWED_PRICING_STATUSES = [
  PRICING_STATUS.ACTIVE,
  PRICING_STATUS.DISABLED,
] as const;

export const ALLOWED_PRICING_STATUS_FILTERS = ['active', 'disabled', 'all'] as const;

export type PricingStatusFilter = (typeof ALLOWED_PRICING_STATUS_FILTERS)[number];

export const ALLOWED_PRICING_DISCOUNT_TYPE_FILTERS = ['percentage', 'all'] as const;

export type PricingDiscountTypeFilter =
  (typeof ALLOWED_PRICING_DISCOUNT_TYPE_FILTERS)[number];

export const ALLOWED_PRICING_SORT_FIELDS = ['updatedAt', 'effectiveFrom', 'businessName'] as const;

export type PricingSortField = (typeof ALLOWED_PRICING_SORT_FIELDS)[number];

export const DEFAULT_PRICING_SORT_FIELD: PricingSortField = 'updatedAt';
