import { isPromotionLiveInIst } from '../../../utils/promotion-date-bounds';
import { promotionCategoriesMatch } from '../../../utils/platform-promotion-matching';
import type { CartLineItem } from '../../../utils/vendor-promotion-engine';
import type { DiscountRule, RuleContext, RuleResult } from '../types';

function isFullEvaluation(ctx: RuleContext): boolean {
  return ctx.metadata?.evaluationMode === 'full';
}

function pass(ruleName: string, metadata?: Record<string, unknown>): RuleResult {
  return { passed: true, ruleName, metadata };
}

function fail(ruleName: string, reason: string, metadata?: Record<string, unknown>): RuleResult {
  return { passed: false, ruleName, reason, metadata };
}

export class ActiveRule implements DiscountRule {
  readonly ruleName = 'ActiveRule';
  readonly group = 'general';
  applies(): boolean {
    return true;
  }
  evaluate(ctx: RuleContext): RuleResult {
    if (ctx.isActive === false) {
      return fail(this.ruleName, 'Promotion is not active');
    }
    return pass(this.ruleName);
  }
}

export class DateRangeIstRule implements DiscountRule {
  readonly ruleName = 'DateRangeRule';
  readonly group = 'general';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product' || ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const now = ctx.now ?? new Date();
    if (!ctx.startDate || !ctx.endDate) {
      return pass(this.ruleName, { mode: 'ist', skipped: true });
    }
    if (!isPromotionLiveInIst(ctx.startDate, ctx.endDate, now)) {
      return fail(this.ruleName, 'Promotion is not valid for the current date');
    }
    return pass(this.ruleName, { mode: 'ist' });
  }
}

export class DateRangeUtcRule implements DiscountRule {
  readonly ruleName = 'DateRangeRule';
  readonly group = 'general';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'platform' || ctx.domain === 'platform_inline' || ctx.domain === 'coupon';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const now = ctx.now ?? new Date();
    const start = ctx.startDate ? new Date(ctx.startDate) : null;
    const end = ctx.endDate ? new Date(ctx.endDate) : null;
    if (start && now < start) {
      return fail(this.ruleName, 'Promotion not started yet', { mode: 'utc' });
    }
    if (end && now > end) {
      return fail(this.ruleName, 'Promotion has expired', { mode: 'utc' });
    }
    if (ctx.domain === 'coupon' && start && end && (now < start || now > end)) {
      return fail(this.ruleName, 'Coupon has expired', { mode: 'utc' });
    }
    return pass(this.ruleName, { mode: 'utc' });
  }
}

export class PublishedRule implements DiscountRule {
  readonly ruleName = 'PublishedRule';
  readonly group = 'general';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'platform' || ctx.domain === 'platform_inline';
  }
  evaluate(ctx: RuleContext): RuleResult {
    if (ctx.published === false) {
      return fail(this.ruleName, 'Promotion is not published');
    }
    return pass(this.ruleName);
  }
}

export class VendorRule implements DiscountRule {
  readonly ruleName = 'VendorRule';
  readonly group = 'promotion';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product' || ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    if (ctx.contextVendorId && ctx.vendorId && ctx.vendorId !== ctx.contextVendorId) {
      const msg =
        ctx.domain === 'vendor_product'
          ? 'Promotion does not apply to this seller'
          : 'Promotion does not apply to this vendor';
      return fail(this.ruleName, msg);
    }
    return pass(this.ruleName);
  }
}

export class MaximumUsageRule implements DiscountRule {
  readonly ruleName = 'MaximumUsageRule';
  readonly group = 'promotion';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product' || ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    if (ctx.usageLimit != null && (ctx.usageCount ?? 0) >= ctx.usageLimit) {
      return fail(this.ruleName, 'This promotion has reached its usage limit');
    }
    return pass(this.ruleName);
  }
}

export class CouponMaxUsesRule implements DiscountRule {
  readonly ruleName = 'MaximumUsageRule';
  readonly group = 'promotion';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'coupon';
  }
  evaluate(ctx: RuleContext): RuleResult {
    if (ctx.maxUses != null && (ctx.couponUsageCount ?? 0) >= ctx.maxUses) {
      return fail(this.ruleName, 'Coupon usage limit reached');
    }
    return pass(this.ruleName);
  }
}

export class AudienceRule implements DiscountRule {
  readonly ruleName = 'AudienceRule';
  readonly group = 'customer';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product' || ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const audience = ctx.targetAudience || 'all';
    const prior =
      ctx.domain === 'vendor_service'
        ? (ctx.priorVendorBookingCount ?? 0)
        : (ctx.priorVendorOrderCount ?? 0);
    if (audience === 'returning_users' && prior === 0) {
      return fail(this.ruleName, 'This promotion is for returning customers only');
    }
    return pass(this.ruleName);
  }
}

export class FirstOrderRule implements DiscountRule {
  readonly ruleName = 'FirstOrderRule';
  readonly group = 'customer';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const audience = ctx.targetAudience || 'all';
    const prior = ctx.priorVendorOrderCount ?? 0;
    if ((audience === 'new_users' || ctx.promotionType === 'first_order') && prior > 0) {
      return fail(this.ruleName, 'This promotion is for new customers only');
    }
    return pass(this.ruleName);
  }
}

export class FirstBookingRule implements DiscountRule {
  readonly ruleName = 'FirstBookingRule';
  readonly group = 'customer';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const audience = ctx.targetAudience || 'all';
    const prior = ctx.priorVendorBookingCount ?? 0;
    if ((audience === 'new_users' || ctx.promotionType === 'first_booking') && prior > 0) {
      return fail(this.ruleName, 'This promotion is for new customers only');
    }
    return pass(this.ruleName);
  }
}

export class MinimumAmountRule implements DiscountRule {
  readonly ruleName = 'MinimumAmountRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return (
      (ctx.domain === 'vendor_product' && isFullEvaluation(ctx)) ||
      ctx.domain === 'platform' ||
      ctx.domain === 'platform_inline' ||
      ctx.domain === 'coupon'
    );
  }
  evaluate(ctx: RuleContext): RuleResult {
    const amount = ctx.amount ?? 0;
    const min =
      ctx.minOrderValue ??
      ctx.minOrderAmount ??
      (ctx.domain === 'vendor_service' ? ctx.minBookingValue : null);
    if (min != null && min > 0) {
      if (ctx.domain === 'platform' || ctx.domain === 'platform_inline') {
        if (amount > 0 && amount < min) {
          return fail(this.ruleName, `Minimum order amount of ₹${min} required`);
        }
      } else if (ctx.domain === 'coupon') {
        if (amount < min) {
          return fail(this.ruleName, `Minimum order amount of ₹${min} required`);
        }
      } else if (ctx.domain === 'vendor_product') {
        if (amount < min) {
          return fail(this.ruleName, `Minimum order value of ₹${min} required`);
        }
      }
    }
    return pass(this.ruleName);
  }
}

export class MinimumBookingRule implements DiscountRule {
  readonly ruleName = 'MinimumAmountRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const amount = ctx.amount ?? 0;
    if (ctx.minBookingValue != null && amount < ctx.minBookingValue) {
      return fail(
        this.ruleName,
        `Minimum booking value of ₹${ctx.minBookingValue} required`
      );
    }
    return pass(this.ruleName);
  }
}

export class ServiceStyleRule implements DiscountRule {
  readonly ruleName = 'ServiceStyleRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const styles = ctx.applicableServiceStyles || [];
    const style = normalizeStyle(ctx.serviceStyle);
    if (styles.length > 0 && !styles.includes('all') && style) {
      if (!styles.map(normalizeStyle).includes(style)) {
        return fail(this.ruleName, 'Promotion does not apply to this service style');
      }
    }
    return pass(this.ruleName);
  }
}

export class ServiceRule implements DiscountRule {
  readonly ruleName = 'ServiceRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const serviceIds = (ctx.serviceIds || []).map(String).filter(Boolean);
    const applicable = ctx.applicableServices || [];
    if (applicable.length > 0 && serviceIds.length > 0) {
      const match = serviceIds.some((id) => applicable.includes(id));
      if (!match) {
        return fail(this.ruleName, 'Promotion does not apply to selected services');
      }
    }
    return pass(this.ruleName);
  }
}

export class ProductScopeRule implements DiscountRule {
  readonly ruleName = 'ProductRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return (
      ctx.domain === 'vendor_product' &&
      isFullEvaluation(ctx) &&
      ctx.promotionType !== 'category_discount'
    );
  }
  evaluate(ctx: RuleContext): RuleResult {
    if (ctx.promotionType === 'bundle' || ctx.promotionType === 'buy_x_get_y') {
      return pass(this.ruleName, { delegated: ctx.promotionType });
    }
    const items = ctx.items ?? [];
    if (items.length === 0) return pass(this.ruleName, { skipped: 'no items' });
    const products = ctx.applicableProducts || [];
    const categories = ctx.applicableCategories || [];
    const ownershipScoped = (() => {
      const scope = String(ctx.listingOwnershipScope || 'all').trim().toLowerCase();
      return Boolean(scope && scope !== 'all' && scope !== 'both');
    })();
    if (products.length === 0 && categories.length === 0 && !ownershipScoped) {
      return pass(this.ruleName);
    }
    const hasApplicable = items.some((item) => productAppliesToLine(ctx, item));
    if (!hasApplicable) {
      return fail(this.ruleName, 'No applicable products in cart');
    }
    return pass(this.ruleName);
  }
}

export class CategoryRule implements DiscountRule {
  readonly ruleName = 'CategoryRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return (
      ctx.domain === 'vendor_product' &&
      isFullEvaluation(ctx) &&
      ctx.promotionType === 'category_discount'
    );
  }
  evaluate(ctx: RuleContext): RuleResult {
    const items = ctx.items ?? [];
    const cats = ctx.applicableCategories || [];
    if (cats.length === 0) {
      const scope = String(ctx.listingOwnershipScope || 'all').trim().toLowerCase();
      if (!scope || scope === 'all' || scope === 'both') return pass(this.ruleName);
      const hasOwnedMatch = items.some((i) => productAppliesToLine(ctx, i));
      return hasOwnedMatch
        ? pass(this.ruleName)
        : fail(this.ruleName, 'No products match ownership scope');
    }
    const has = items.some((i) => productAppliesToLine(ctx, i));
    if (!has) return fail(this.ruleName, 'No products in applicable categories');
    return pass(this.ruleName);
  }
}

export class CartItemsRule implements DiscountRule {
  readonly ruleName = 'ProductRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product' && isFullEvaluation(ctx);
  }
  evaluate(ctx: RuleContext): RuleResult {
    if ((ctx.items?.length ?? 0) === 0) {
      return fail(this.ruleName, 'Cart has no items');
    }
    return pass(this.ruleName);
  }
}

export class BogoRule implements DiscountRule {
  readonly ruleName = 'BOGORule';
  readonly group = 'promotion';
  applies(ctx: RuleContext): boolean {
    return (
      ctx.domain === 'vendor_product' &&
      isFullEvaluation(ctx) &&
      ctx.promotionType === 'buy_x_get_y'
    );
  }
  evaluate(ctx: RuleContext): RuleResult {
    const items = ctx.items ?? [];
    const buyQty = ctx.buyQuantity || 2;
    const getQty = ctx.getQuantity || 1;
    const applicable = items.filter((i) => productAppliesToLine(ctx, i));
    if (applicable.length === 0) {
      return fail(this.ruleName, 'No applicable items for BOGO');
    }
    const totalQty = applicable.reduce((s, i) => s + i.quantity, 0);
    const completeSets = Math.floor(totalQty / (buyQty + getQty));
    if (completeSets === 0) {
      return fail(this.ruleName, 'Insufficient quantity for BOGO sets');
    }
    return pass(this.ruleName, { completeSets });
  }
}

export class BundleRule implements DiscountRule {
  readonly ruleName = 'BundleRule';
  readonly group = 'promotion';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product' && isFullEvaluation(ctx) && ctx.promotionType === 'bundle';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const bundleIds = ctx.bundleProducts || [];
    if (bundleIds.length === 0) {
      return fail(this.ruleName, 'Bundle products not configured');
    }
    const cartIds = new Set((ctx.items ?? []).map((i) => String(i.productId || i.id || '')));
    if (!bundleIds.every((id) => cartIds.has(id))) {
      return fail(this.ruleName, 'Not all bundle products in cart');
    }
    return pass(this.ruleName);
  }
}

export class ComboRule implements DiscountRule {
  readonly ruleName = 'ComboRule';
  readonly group = 'promotion';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_service' && isFullEvaluation(ctx) && ctx.promotionType === 'combo';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const comboIds = ctx.comboServices || [];
    const selected = (ctx.serviceIds || []).map(String);
    if (comboIds.length === 0 || selected.length === 0) {
      return fail(this.ruleName, 'Combo services not satisfied');
    }
    if (!comboIds.every((id) => selected.includes(id))) {
      return fail(this.ruleName, 'Not all combo services selected');
    }
    return pass(this.ruleName);
  }
}

export class LoyaltyRule implements DiscountRule {
  readonly ruleName = 'LoyaltyRule';
  readonly group = 'promotion';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_service' && isFullEvaluation(ctx) && ctx.promotionType === 'loyalty';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const required = ctx.visitsRequired ?? 0;
    const prior = ctx.priorVendorBookingCount ?? 0;
    if (required <= 0 || prior + 1 < required) {
      return fail(this.ruleName, 'Loyalty visit threshold not met');
    }
    return pass(this.ruleName, { required, prior });
  }
}

export class PlatformMatchRule implements DiscountRule {
  readonly ruleName = 'PlatformRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'platform';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const row = ctx.platformRow;
    if (!row) return pass(this.ruleName, { skipped: true });
    const params = {
      category: ctx.serviceCategory,
      serviceStyle: ctx.serviceStyle,
      serviceIds: ctx.serviceIds || [],
      amount: ctx.amount ?? 0,
    };
    const matched = platformPromoMatchesContext(row, params);
    if (!matched) {
      return fail(this.ruleName, 'Platform promotion does not match context');
    }
    return pass(this.ruleName);
  }
}

export class PlatformInlineCategoryRule implements DiscountRule {
  readonly ruleName = 'CategoryRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'platform_inline';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const category = String(ctx.serviceCategory || '').trim().toLowerCase();
    const configured = (ctx.applicableServices || []).filter((x) => !x.startsWith('style:'));
    if (category && category !== 'all' && configured.length > 0) {
      const matches = configured.some((token) =>
        promotionCategoriesMatch(category, token)
      );
      if (!matches) {
        return fail(this.ruleName, 'Promotion not applicable for this category');
      }
    }
    return pass(this.ruleName);
  }
}

export class PlatformInlineStyleRule implements DiscountRule {
  readonly ruleName = 'ServiceStyleRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'platform_inline';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const style = normalizeStyle(ctx.serviceStyle || '');
    const configuredStyles = (ctx.applicableServices || [])
      .filter((x) => x.startsWith('style:'))
      .map((x) => normalizeStyle(x.replace(/^style:/, '')));
    if (style && style !== 'all' && configuredStyles.length > 0) {
      if (!configuredStyles.includes(style)) {
        return fail(this.ruleName, 'Promotion not applicable for this service style');
      }
    }
    return pass(this.ruleName);
  }
}

export class PlatformInlineServiceRule implements DiscountRule {
  readonly ruleName = 'ServiceRule';
  readonly group = 'domain';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'platform_inline';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const serviceIds = (ctx.serviceIds || []).map((x) => String(x).trim()).filter(Boolean);
    const configuredIds = (ctx.applicableServices || []).filter((x) =>
      /^[0-9a-f-]{36}$/i.test(String(x))
    );
    if (serviceIds.length > 0 && configuredIds.length > 0) {
      if (!serviceIds.some((sid) => configuredIds.includes(sid))) {
        return fail(this.ruleName, 'Promotion not applicable for selected service');
      }
    }
    return pass(this.ruleName);
  }
}

function normalizeStyle(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return '';
  if (value === 'home' || value === 'at_home' || value === 'home_visit') return 'at_home';
  if (value === 'clinic' || value === 'center' || value === 'at_center') return 'at_center';
  if (value === 'online' || value === 'tele') return 'tele';
  return value;
}

function listingOwnershipAllowed(ctx: RuleContext, item: CartLineItem): boolean {
  const scope = String(ctx.listingOwnershipScope || 'all').trim().toLowerCase();
  if (!scope || scope === 'all' || scope === 'both') return true;
  return item.listingOwnership === scope;
}

function productAppliesToLine(ctx: RuleContext, item: CartLineItem): boolean {
  const productId = String(item.productId || item.id || '');
  const categoryId = item.categoryId || item.category || '';
  if (!listingOwnershipAllowed(ctx, item)) return false;
  if (ctx.promotionType === 'category_discount') {
    const cats = ctx.applicableCategories || [];
    if (cats.length === 0) return true;
    return Boolean(categoryId && cats.includes(categoryId));
  }
  const products = ctx.applicableProducts || [];
  const categories = ctx.applicableCategories || [];
  if (products.length === 0 && categories.length === 0) return true;
  if (products.includes(productId)) return true;
  if (categoryId && categories.includes(categoryId)) return true;
  return false;
}

function parseServicesList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
}

function platformPromoMatchesContext(
  row: Record<string, unknown>,
  params: { category?: string; serviceStyle?: string; serviceIds: string[]; amount: number }
): boolean {
  const now = new Date();
  const start = row.start_date ? new Date(String(row.start_date)) : null;
  const end = row.end_date ? new Date(String(row.end_date)) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  if (row.published === false) return false;

  const minOrder = row.min_order_amount != null ? parseFloat(String(row.min_order_amount)) : 0;
  if (minOrder > 0 && params.amount > 0 && params.amount < minOrder) return false;

  const category = String(params.category || '').trim().toLowerCase();
  const style = normalizeStyle(params.serviceStyle);
  const services = parseServicesList(row.applicable_services);
  const rowCategory = String(row.service_category ?? row.target_category ?? '')
    .trim()
    .toLowerCase();
  const rowStyle = normalizeStyle(row.service_style ?? row.target_service_style ?? '');

  if (rowCategory && category && rowCategory !== 'all') {
    if (!promotionCategoriesMatch(category, rowCategory)) {
      const inServices = services.some(
        (s) => !s.startsWith('style:') && promotionCategoriesMatch(category, s)
      );
      if (!inServices) return false;
    }
  }

  if (rowStyle && style && rowStyle !== 'all' && rowStyle !== style) {
    const styleToken = services.find((s) => s.startsWith('style:'));
    if (styleToken) {
      const fromToken = normalizeStyle(styleToken.replace(/^style:/, ''));
      if (fromToken && fromToken !== style) return false;
    } else if (rowStyle !== style) {
      return false;
    }
  }

  if (services.length > 0 && params.serviceIds.length > 0) {
    const nonStyle = services.filter((s) => !s.startsWith('style:'));
    if (nonStyle.length > 0) {
      const match = params.serviceIds.some((id) => nonStyle.includes(id));
      if (
        !match &&
        category &&
        !nonStyle.some((token) => promotionCategoriesMatch(category, token))
      ) {
        return false;
      }
    }
  }

  return true;
}
