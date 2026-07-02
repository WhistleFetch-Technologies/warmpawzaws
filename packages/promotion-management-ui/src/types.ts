/** UI-only promotion management model — maps to existing API payloads at save time. */

export type CreateKind = 'promotion' | 'coupon';

export type VisualLifecycle =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'expired'
  | 'archived';

export type PromotionDomain =
  | 'platform'
  | 'service'
  | 'package'
  | 'meal'
  | 'product'
  | 'booking';

export type PromotionTypeId =
  | 'percentage'
  | 'flat'
  | 'buy_x_get_y'
  | 'bundle'
  | 'combo'
  | 'loyalty'
  | 'first_order'
  | 'first_booking'
  | 'flash_sale'
  | 'seasonal'
  | 'category_discount';

export type AudienceId = 'all' | 'new_users' | 'returning_users' | 'vip' | 'segments';

export type TargetScopeId =
  | 'entire_platform'
  | 'vendors'
  | 'categories'
  | 'services'
  | 'packages'
  | 'meal_plans'
  | 'products'
  | 'styles';

export type TargetOption = {
  id: string;
  label: string;
  subtitle?: string;
  group?: string;
};

export type PromotionTargetCatalog = {
  vendors?: TargetOption[];
  services?: TargetOption[];
  packages?: TargetOption[];
  mealPlans?: TargetOption[];
  products?: TargetOption[];
  categories?: TargetOption[];
  styles?: TargetOption[];
};

export type PromotionWizardForm = {
  createKind: CreateKind;
  name: string;
  description: string;
  /** Visual lifecycle — draft maps to is_active false until publish */
  uiStatus: VisualLifecycle;
  promotionType: PromotionTypeId;
  audience: AudienceId;
  targetScopes: TargetScopeId[];
  selectedTargets: Partial<Record<TargetScopeId, string[]>>;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount?: number;
  minAmount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  code?: string;
  startDate: string;
  endDate: string;
  timezone: string;
  autoApply: boolean;
  /** BOGO / bundle UI fields */
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercent?: number;
  bundleItemIds?: string[];
  bundleDiscount?: number;
};

export type NormalizedPromotionItem = {
  id: string;
  kind: CreateKind;
  name: string;
  description?: string;
  code?: string;
  promotionType: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount?: number;
  minAmount?: number;
  usageLimit?: number;
  usageCount?: number;
  usageLimitPerUser?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  published?: boolean;
  audience?: string;
  domain?: PromotionDomain;
  owner?: 'platform' | 'vendor';
  targetSummary?: string;
  raw?: Record<string, unknown>;
  createdAt?: string;
};

export type NormalizedCouponItem = {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount?: number;
  minAmount?: number;
  usageLimit?: number;
  usageCount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  raw?: Record<string, unknown>;
  createdAt?: string;
};

export type PromotionManagementScope = {
  mode: 'platform' | 'vendor_services' | 'vendor_seller';
  title: string;
  subtitle?: string;
  canManageCoupons: boolean;
  canManagePlatformTargets: boolean;
  domains: PromotionDomain[];
  /** When set, limits target tabs in the wizard (vendor business type / capabilities). */
  enabledTargetScopes?: TargetScopeId[];
};

export const DEFAULT_WIZARD_FORM = (): PromotionWizardForm => ({
  createKind: 'promotion',
  name: '',
  description: '',
  uiStatus: 'draft',
  promotionType: 'percentage',
  audience: 'all',
  targetScopes: ['entire_platform'],
  selectedTargets: {},
  discountType: 'percentage',
  discountValue: 10,
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  timezone: 'Asia/Kolkata',
  autoApply: true,
});
