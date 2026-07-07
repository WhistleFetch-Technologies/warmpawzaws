import { DiscountDomain } from '../enums/discount-domain';
import { DiscountFunding } from '../enums/discount-funding';
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountSource } from '../enums/discount-source';
import { DiscountStatus } from '../enums/discount-status';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { PromotionRow } from '../../utils/vendor-promotion-engine';
import type { ServicePromotionRow } from '../../utils/service-promotion-engine';
import {
  parseIntSafe,
  parseJsonbStringArray,
  parseNum,
  parseOptionalString,
  parseServicesList,
  resolveTriggerFromCode,
  rowToRecord,
} from './parse-utils';

function optionalInt(value: unknown): number | null | undefined {
  if (value == null) return null;
  return parseIntSafe(value);
}
import type { DiscountCandidate } from './types';

function mapActiveStatus(isActive: unknown): DiscountStatus {
  return isActive === false ? DiscountStatus.PAUSED : DiscountStatus.ACTIVE;
}

function mapTrigger(code: unknown): DiscountTrigger {
  return resolveTriggerFromCode(code) === 'CODE' ? DiscountTrigger.CODE : DiscountTrigger.AUTO;
}

function mapVendorSource(code: unknown): DiscountSource {
  return resolveTriggerFromCode(code) === 'CODE'
    ? DiscountSource.VENDOR_COUPON
    : DiscountSource.VENDOR_PROMOTION;
}

export class CandidateNormalizer {
  fromPlatformPromotion(row: Record<string, unknown>): DiscountCandidate {
    const code = parseOptionalString(row.code);
    // Platform promotions are auto-applied; optional code is for manual entry only.
    const trigger = DiscountTrigger.AUTO;

    return {
      id: String(row.id),
      name: String(row.name || row.title || 'Offer'),
      code: code ?? null,
      source: DiscountSource.PLATFORM_PROMOTION,
      owner: DiscountOwner.PLATFORM,
      domain: DiscountDomain.SERVICE,
      trigger,
      status: mapActiveStatus(row.is_active),
      priority: row.priority != null ? parseIntSafe(row.priority) : undefined,
      stackable: row.stackable === true,
      exclusive: row.exclusive === true,
      rules: {
        published: row.published !== false,
        minOrderValue:
          row.min_order_amount != null ? parseNum(row.min_order_amount) : null,
        applicableServices: parseServicesList(row.applicable_services),
        serviceCategory: parseOptionalString(
          row.service_category ?? row.target_category
        ),
        rowServiceCategory: parseOptionalString(
          row.service_category ?? row.target_category
        ),
        rowServiceStyle: parseOptionalString(
          row.service_style ?? row.target_service_style
        ),
      },
      benefits: {
        type: String(row.promotion_type || 'flash_sale'),
        discountType:
          String(row.discount_type || 'percentage').toLowerCase() === 'percentage'
            ? 'percentage'
            : 'fixed',
        value: parseNum(row.discount_value),
        maxDiscount: row.max_discount_amount != null ? parseNum(row.max_discount_amount) : null,
        minOrderAmount:
          row.min_order_amount != null ? parseNum(row.min_order_amount) : null,
      },
      startDate: row.start_date != null ? String(row.start_date) : undefined,
      endDate: row.end_date != null ? String(row.end_date) : undefined,
      usage: {
        limit: row.usage_limit != null ? parseIntSafe(row.usage_limit) : row.max_uses != null ? parseIntSafe(row.max_uses) : null,
        count: row.usage_count != null ? parseIntSafe(row.usage_count) : 0,
      },
      funding: DiscountFunding.PLATFORM,
      metadata: {
        isSpotlight: row.is_spotlight === true,
        description: row.description,
      },
      originalEntity: row,
    };
  }

  fromVendorProductPromotion(row: PromotionRow | Record<string, unknown>): DiscountCandidate {
    const r = rowToRecord(row);
    const code = parseOptionalString(r.code ?? (row as PromotionRow).code);
    const promotionType = String(r.promotion_type ?? (row as PromotionRow).promotion_type ?? 'flash_sale');

    return {
      id: String(r.id ?? (row as PromotionRow).id),
      name: String(r.name ?? (row as PromotionRow).name ?? ''),
      code: code ?? null,
      source: mapVendorSource(code),
      owner: DiscountOwner.VENDOR,
      domain: DiscountDomain.ECOMMERCE,
      trigger: mapTrigger(code),
      status: mapActiveStatus(r.is_active ?? (row as PromotionRow).is_active),
      rules: {
        targetAudience: String(r.target_audience ?? (row as PromotionRow).target_audience ?? 'all'),
        vendorId: parseOptionalString(r.vendor_id ?? (row as PromotionRow).vendor_id),
        applicableProducts:
          (row as PromotionRow).applicable_products ??
          parseJsonbStringArray(r.applicable_products),
        applicableCategories:
          (row as PromotionRow).applicable_categories ??
          parseJsonbStringArray(r.applicable_categories),
        minOrderValue:
          r.min_order_value != null
            ? parseNum(r.min_order_value)
            : (row as PromotionRow).min_order_value ?? null,
      },
      benefits: {
        type: promotionType,
        discountType:
          String(r.discount_type ?? (row as PromotionRow).discount_type) === 'percentage'
            ? 'percentage'
            : 'fixed',
        value: parseNum(r.discount_value ?? (row as PromotionRow).discount_value),
        maxDiscount:
          r.max_discount_amount != null
            ? parseNum(r.max_discount_amount)
            : (row as PromotionRow).max_discount_amount ?? null,
        buyQuantity: optionalInt(r.buy_quantity ?? (row as PromotionRow).buy_quantity),
        getQuantity: optionalInt(r.get_quantity ?? (row as PromotionRow).get_quantity),
        getDiscountPercent: optionalInt(
          r.get_discount_percent ?? (row as PromotionRow).get_discount_percent
        ),
        bundleProductIds:
          (row as PromotionRow).bundle_products ?? parseJsonbStringArray(r.bundle_products),
        bundleDiscountPercent:
          r.bundle_discount != null
            ? parseNum(r.bundle_discount)
            : (row as PromotionRow).bundle_discount ?? null,
      },
      startDate: String(r.start_date ?? (row as PromotionRow).start_date),
      endDate: String(r.end_date ?? (row as PromotionRow).end_date),
      usage: {
        limit: optionalInt(r.usage_limit ?? (row as PromotionRow).usage_limit),
        count: parseIntSafe(r.usage_count ?? (row as PromotionRow).usage_count ?? 0),
      },
      funding: DiscountFunding.VENDOR,
      originalEntity: r.id ? r : (row as Record<string, unknown>),
    };
  }

  fromVendorServicePromotion(
    row: ServicePromotionRow | Record<string, unknown>
  ): DiscountCandidate {
    const r = rowToRecord(row);
    const code = parseOptionalString(r.code ?? (row as ServicePromotionRow).code);
    const promotionType = String(
      r.promotion_type ?? (row as ServicePromotionRow).promotion_type ?? 'flash_sale'
    );

    return {
      id: String(r.id ?? (row as ServicePromotionRow).id),
      name: String(r.name ?? (row as ServicePromotionRow).name ?? ''),
      code: code ?? null,
      source: mapVendorSource(code),
      owner: DiscountOwner.VENDOR,
      domain: DiscountDomain.SERVICE,
      trigger: mapTrigger(code),
      status: mapActiveStatus(r.is_active ?? (row as ServicePromotionRow).is_active),
      rules: {
        targetAudience: String(
          r.target_audience ?? (row as ServicePromotionRow).target_audience ?? 'all'
        ),
        vendorId: parseOptionalString(r.vendor_id ?? (row as ServicePromotionRow).vendor_id),
        applicableServices:
          (row as ServicePromotionRow).applicable_services ??
          parseJsonbStringArray(r.applicable_services),
        applicableServiceStyles:
          (row as ServicePromotionRow).applicable_service_styles ??
          parseJsonbStringArray(r.applicable_service_styles),
        minBookingValue:
          r.min_booking_value != null
            ? parseNum(r.min_booking_value)
            : (row as ServicePromotionRow).min_booking_value ?? null,
      },
      benefits: {
        type: promotionType,
        discountType:
          String(r.discount_type ?? (row as ServicePromotionRow).discount_type) === 'percentage'
            ? 'percentage'
            : 'fixed',
        value: parseNum(r.discount_value ?? (row as ServicePromotionRow).discount_value),
        maxDiscount:
          r.max_discount_amount != null
            ? parseNum(r.max_discount_amount)
            : (row as ServicePromotionRow).max_discount_amount ?? null,
        comboServiceIds:
          (row as ServicePromotionRow).combo_services ?? parseJsonbStringArray(r.combo_services),
        comboDiscountPercent:
          r.combo_discount != null
            ? parseNum(r.combo_discount)
            : (row as ServicePromotionRow).combo_discount ?? null,
        visitsRequired: optionalInt(
          r.visits_required ?? (row as ServicePromotionRow).visits_required
        ),
        loyaltyDiscountPercent:
          r.loyalty_discount != null
            ? parseNum(r.loyalty_discount)
            : (row as ServicePromotionRow).loyalty_discount ?? null,
      },
      startDate: String(r.start_date ?? (row as ServicePromotionRow).start_date),
      endDate: String(r.end_date ?? (row as ServicePromotionRow).end_date),
      usage: {
        limit: optionalInt(r.usage_limit ?? (row as ServicePromotionRow).usage_limit),
        count: parseIntSafe(r.usage_count ?? (row as ServicePromotionRow).usage_count ?? 0),
      },
      funding: DiscountFunding.VENDOR,
      originalEntity: r.id ? r : (row as Record<string, unknown>),
    };
  }

  fromCoupon(row: Record<string, unknown>): DiscountCandidate {
    const code = parseOptionalString(row.code) ?? '';

    return {
      id: String(row.id),
      name: String(row.name || row.title || code || 'Coupon'),
      code,
      source: DiscountSource.PLATFORM_COUPON,
      owner: DiscountOwner.PLATFORM,
      domain: DiscountDomain.ECOMMERCE,
      trigger: DiscountTrigger.CODE,
      status: mapActiveStatus(row.is_active),
      rules: {
        minOrderValue:
          row.min_order_amount != null ? parseNum(row.min_order_amount) : null,
      },
      benefits: {
        type: 'coupon',
        discountType:
          String(row.discount_type || 'percentage').toLowerCase() === 'percentage'
            ? 'percentage'
            : 'fixed',
        value: parseNum(row.discount_value),
        maxDiscount: row.max_discount_amount != null ? parseNum(row.max_discount_amount) : null,
        minOrderAmount:
          row.min_order_amount != null ? parseNum(row.min_order_amount) : null,
      },
      startDate: row.start_date != null ? String(row.start_date) : undefined,
      endDate: row.end_date != null ? String(row.end_date) : undefined,
      usage: {
        limit: row.max_uses != null ? parseIntSafe(row.max_uses) : null,
        count: 0,
      },
      funding: DiscountFunding.PLATFORM,
      createdBy: parseOptionalString(row.created_by),
      metadata: {
        description: row.description,
      },
      originalEntity: row,
    };
  }

  normalize(source: DiscountSource, raw: unknown): DiscountCandidate {
    const row = rowToRecord(raw);
    switch (source) {
      case DiscountSource.PLATFORM_PROMOTION:
      case DiscountSource.PLATFORM_COUPON:
        if (row.discount_type != null && row.is_active != null && !row.promotion_type && !row.published) {
          return this.fromCoupon(row);
        }
        return this.fromPlatformPromotion(row);
      case DiscountSource.VENDOR_PROMOTION:
      case DiscountSource.VENDOR_COUPON:
        if (row.min_booking_value != null || row.applicable_service_styles != null) {
          return this.fromVendorServicePromotion(row);
        }
        return this.fromVendorProductPromotion(row);
      default:
        throw new Error(`Unsupported discount source for normalization: ${source}`);
    }
  }
}

let defaultNormalizer: CandidateNormalizer | null = null;

export function getCandidateNormalizer(): CandidateNormalizer {
  if (!defaultNormalizer) {
    defaultNormalizer = new CandidateNormalizer();
  }
  return defaultNormalizer;
}

export function resetCandidateNormalizerForTests(): void {
  defaultNormalizer = new CandidateNormalizer();
}
