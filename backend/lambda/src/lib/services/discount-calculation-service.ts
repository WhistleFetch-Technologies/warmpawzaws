/**
 * Refactored discount calculation — delegates to booking promotion service.
 */
import {
  resolveBookingPromotions,
  type ResolveBookingPromotionsParams,
} from './booking-promotion-service';

export interface DiscountResult {
  originalAmount: number;
  vendorDiscountAmount: number;
  platformDiscountAmount: number;
  couponDiscountAmount: number;
  totalDiscountAmount: number;
  finalAmount: number;
  appliedDiscounts: AppliedDiscount[];
  vendorPromotionId?: string;
  platformPromotionId?: string;
}

export interface AppliedDiscount {
  id: string;
  type: 'vendor' | 'platform' | 'coupon';
  name: string;
  discountType: 'percentage' | 'fixed' | 'buy_x_get_y';
  discountValue: number;
  discountAmount: number;
  order: number;
}

class DiscountCalculationServiceImpl {
  async calculateDiscounts(params: {
    vendorId: string;
    serviceIds: string[];
    originalAmount: number;
    customerId?: string;
    couponCode?: string;
    serviceCategory?: string;
    serviceStyle?: string;
  }): Promise<DiscountResult> {
    const bookingResult = await resolveBookingPromotions({
      vendorId: params.vendorId,
      serviceIds: params.serviceIds,
      amount: params.originalAmount,
      customerId: params.customerId,
      serviceCategory: params.serviceCategory,
      serviceStyle: params.serviceStyle,
      couponCode: params.couponCode,
    });

    const splitCoupon = bookingResult.applied.find((a) => a.promotionType === 'coupon');
    const couponDiscountAmount = splitCoupon?.discountAmount ?? 0;

    const appliedDiscounts: AppliedDiscount[] = bookingResult.applied.map((a, idx) => ({
      id: a.id,
      type: a.source,
      name: a.name,
      discountType: 'percentage',
      discountValue: 0,
      discountAmount: a.discountAmount,
      order: idx + 1,
    }));

    return {
      originalAmount: bookingResult.originalAmount,
      vendorDiscountAmount: bookingResult.vendorDiscountAmount,
      platformDiscountAmount: bookingResult.platformDiscountAmount,
      couponDiscountAmount,
      totalDiscountAmount: bookingResult.totalSavings,
      finalAmount: bookingResult.finalAmount,
      appliedDiscounts,
      vendorPromotionId: bookingResult.vendorPromotionId,
      platformPromotionId: bookingResult.platformPromotionId,
    };
  }

  async getVendorDiscountsForDisplay(vendorId: string) {
    const { query } = await import('../../database/rds-connection');
    try {
      const res = await query(
        `SELECT id, name, discount_type, discount_value, promotion_type
         FROM vendor_service_promotions
         WHERE vendor_id = $1::uuid AND is_active = true
           AND start_date <= NOW() AND end_date >= NOW()
         ORDER BY discount_value DESC LIMIT 10`,
        [vendorId]
      );
      return (res.rows || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name),
        discountType: String(row.discount_type || 'percentage'),
        discountValue: parseFloat(String(row.discount_value ?? 0)),
      }));
    } catch {
      return [];
    }
  }
}

export const discountCalculationService = new DiscountCalculationServiceImpl();

export const calculateDiscounts = (params: Parameters<typeof discountCalculationService.calculateDiscounts>[0]) =>
  discountCalculationService.calculateDiscounts(params);

export const getVendorDiscountsForDisplay = (vendorId: string) =>
  discountCalculationService.getVendorDiscountsForDisplay(vendorId);

export type { ResolveBookingPromotionsParams };
