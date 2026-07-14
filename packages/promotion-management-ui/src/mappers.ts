import type { PromotionWizardForm } from './types';
import { buildApplicableServicesFromForm, normalizeStyleToken } from './targeting';

export type DiscountDomainOption = 'SERVICE' | 'ECOMMERCE';

export type WizardAdminPayloadOptions = {
  discountDomain?: DiscountDomainOption;
};

function autoCode(form: PromotionWizardForm): string {
  if (form.code?.trim()) return form.code.trim().toUpperCase();
  const prefix = form.name.replace(/\s+/g, '').slice(0, 6).toUpperCase() || 'PROMO';
  return `${prefix}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function mapPromotionTypeToLegacy(type: string): string {
  const map: Record<string, string> = {
    percentage: 'flash_sale',
    flat: 'flash_sale',
    first_booking: 'first_booking',
    first_order: 'first_order',
    loyalty: 'loyalty',
    combo: 'combo',
    buy_x_get_y: 'buy_x_get_y',
    bundle: 'bundle',
  };
  return map[type] ?? type;
}

function applicableTo(
  form: PromotionWizardForm,
  discountDomain: DiscountDomainOption = 'SERVICE'
): string {
  if (form.targetScopes.includes('all_products')) return 'products';
  if (form.targetScopes.includes('entire_platform')) {
    return discountDomain === 'ECOMMERCE' ? 'products' : 'all';
  }
  if (form.targetScopes.includes('products')) return 'products';
  if (form.targetScopes.includes('services')) return 'services';
  if (form.targetScopes.includes('packages')) return 'services';
  if (form.targetScopes.includes('meal_plans')) return 'services';
  // Ecommerce category / seller scopes still map to products domain
  if (discountDomain === 'ECOMMERCE') return 'products';
  return 'bookings';
}

/** Admin `/admin/promotions` payload — canonical create/update shape for Sprint A. */
export function wizardToAdminPromotionPayload(
  form: PromotionWizardForm,
  options?: WizardAdminPayloadOptions
) {
  const discountDomain = options?.discountDomain ?? 'SERVICE';
  const isCoupon = form.createKind === 'coupon';
  const applicableServices = buildApplicableServicesFromForm(form);
  const primaryCategory = form.selectedTargets.categories?.[0];
  const primaryStyle = form.selectedTargets.styles?.[0];

  return {
    code: isCoupon ? form.code!.trim().toUpperCase() : undefined,
    name: form.name.trim(),
    description: form.description.trim(),
    discount_type: form.discountType,
    discount_value: form.discountValue,
    min_order_value: form.minAmount ?? 0,
    max_discount: form.discountType === 'percentage' ? form.maxDiscount : undefined,
    valid_from: form.startDate,
    valid_until: form.endDate,
    usage_limit: form.usageLimit,
    usage_limit_per_user: form.usageLimitPerUser,
    applicable_to: applicableTo(form, discountDomain),
    applicable_service_ids: form.selectedTargets.services ?? [],
    applicable_category_ids: form.selectedTargets.categories ?? [],
    applicable_products: form.selectedTargets.products ?? [],
    vendor_ids: form.selectedTargets.vendors ?? [],
    listing_ownership_scope: form.listingOwnershipScope ?? 'all',
    target_scopes: form.targetScopes,
    selected_targets: form.selectedTargets,
    service_category: primaryCategory && primaryCategory !== 'all' ? primaryCategory : undefined,
    service_style: primaryStyle ? normalizeStyleToken(primaryStyle) : undefined,
    is_active: form.uiStatus !== 'draft' && form.uiStatus !== 'paused',
    type: mapPromotionTypeToLegacy(form.promotionType),
    promotionType: mapPromotionTypeToLegacy(form.promotionType),
    discountType: form.discountType,
    discountValue: form.discountValue,
    validFrom: form.startDate,
    validUntil: form.endDate,
    targetAudience: form.audience,
    active: form.uiStatus === 'active' || form.uiStatus === 'scheduled',
    published: form.uiStatus !== 'draft',
    applicable_services: applicableServices,
    is_spotlight: form.audience === 'vip',
    priority: 0,
    discount_domain: discountDomain,
  };
}

/** Admin `/admin/coupons/create` payload — includes optional service targeting. */
export function wizardToAdminCouponPayload(
  form: PromotionWizardForm,
  options?: WizardAdminPayloadOptions
) {
  const discountDomain = options?.discountDomain ?? 'SERVICE';
  const applicableServices = buildApplicableServicesFromForm(form);
  const primaryCategory = form.selectedTargets.categories?.[0];

  return {
    code: form.code!.trim().toUpperCase(),
    name: form.name.trim() || form.code!.trim().toUpperCase(),
    description: form.description.trim(),
    type: form.discountType,
    value: form.discountValue,
    minOrderAmount: form.minAmount ?? 0,
    maxDiscountAmount: form.maxDiscount ?? 0,
    validFrom: form.startDate,
    validUntil: form.endDate,
    usageLimit: form.usageLimit ?? 0,
    isActive: form.uiStatus !== 'draft' && form.uiStatus !== 'paused',
    applicable_to: applicableTo(form, discountDomain),
    applicable_services: applicableServices,
    service_category: primaryCategory && primaryCategory !== 'all' ? primaryCategory : undefined,
    target_scopes: form.targetScopes,
    selected_targets: form.selectedTargets,
    discount_domain: discountDomain,
  };
}

/** Vendor service promotions */
export function wizardToVendorServicePayload(form: PromotionWizardForm, vendorId: string) {
  const applicableServices = [
    ...new Set([
      ...(form.selectedTargets.services ?? []),
      ...(form.selectedTargets.packages ?? []),
      ...(form.selectedTargets.meal_plans ?? []),
    ]),
  ];
  const applicableStyles = form.selectedTargets.styles?.length
    ? form.selectedTargets.styles
    : ['all'];

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    code: form.createKind === 'coupon' ? form.code?.trim().toUpperCase() : undefined,
    promotion_type: mapPromotionTypeToLegacy(form.promotionType),
    discount_type: form.discountType,
    discount_value: form.discountValue,
    min_booking_value: form.minAmount ?? 0,
    max_discount_amount: form.maxDiscount ?? 0,
    start_date: form.startDate,
    end_date: form.endDate,
    is_active: form.uiStatus !== 'draft' && form.uiStatus !== 'paused',
    usage_limit: form.usageLimit ?? 0,
    target_audience: form.audience,
    applicable_services: applicableServices,
    applicable_service_styles: applicableStyles,
    combo_services: form.bundleItemIds ?? [],
    combo_discount: form.bundleDiscount,
    visits_required: form.promotionType === 'loyalty' ? 5 : undefined,
    loyalty_discount: form.promotionType === 'loyalty' ? form.discountValue : undefined,
    vendor_id: vendorId,
  };
}

/** Vendor seller hub promotions */
export function wizardToVendorSellerPayload(form: PromotionWizardForm, sellerId: string) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    code: form.createKind === 'coupon' ? form.code?.trim().toUpperCase() : undefined,
    promotion_type: mapPromotionTypeToLegacy(form.promotionType),
    discount_type: form.discountType,
    discount_value:
      form.promotionType === 'bundle' ? form.bundleDiscount ?? form.discountValue : form.discountValue,
    min_order_value: form.minAmount ?? 0,
    max_discount_amount: form.maxDiscount ?? 0,
    start_date: form.startDate,
    end_date: form.endDate,
    is_active: form.uiStatus !== 'draft' && form.uiStatus !== 'paused',
    usage_limit: form.usageLimit && form.usageLimit > 0 ? form.usageLimit : null,
    target_audience: form.audience,
    applicable_products: form.selectedTargets.products ?? [],
    applicable_categories: form.selectedTargets.categories ?? [],
    listing_ownership_scope: form.listingOwnershipScope ?? 'all',
    buy_quantity: form.buyQuantity,
    get_quantity: form.getQuantity,
    get_discount_percent: form.getDiscountPercent,
    bundle_products: form.bundleItemIds ?? [],
    bundle_discount: form.bundleDiscount,
    vendor_id: sellerId,
  };
}
