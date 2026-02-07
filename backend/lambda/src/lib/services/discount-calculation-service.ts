/**
 * ============================================================================
 * DISCOUNT CALCULATION SERVICE
 * ============================================================================
 * 
 * Handles the correct ordering and application of discounts:
 * 1. Vendor discounts apply FIRST (directly on service price)
 * 2. Platform discounts/coupons apply SECOND (at payment page)
 * 
 * Fixes GAPs:
 * - PM-2: Vendor discount vs platform discount logic
 * - PM-3: Buy X Get Y combo display
 * 
 * Date: 2026-01-21
 * ============================================================================
 */

import { query, select } from '../../database/rds-connection';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DiscountResult {
  originalAmount: number;
  vendorDiscountAmount: number;
  platformDiscountAmount: number;
  couponDiscountAmount: number;
  totalDiscountAmount: number;
  finalAmount: number;
  appliedDiscounts: AppliedDiscount[];
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

export interface VendorDiscount {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed' | 'buy_x_get_y' | 'bundle' | 'first_time' | 'loyalty';
  discountValue: number;
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercentage?: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  applicableServices?: string[];
  autoApply: boolean;
}

export interface PlatformPromotion {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  isSpotlight: boolean;
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class DiscountCalculationServiceImpl {
  
  /**
   * Calculate all applicable discounts in the correct order
   * Order: 1. Vendor discounts, 2. Platform promotions, 3. Coupons
   */
  async calculateDiscounts(params: {
    vendorId: string;
    serviceIds: string[];
    originalAmount: number;
    customerId?: string;
    couponCode?: string;
    serviceCategory?: string;
  }): Promise<DiscountResult> {
    const { vendorId, serviceIds, originalAmount, customerId, couponCode, serviceCategory } = params;
    
    let currentAmount = originalAmount;
    const appliedDiscounts: AppliedDiscount[] = [];
    
    let vendorDiscountAmount = 0;
    let platformDiscountAmount = 0;
    let couponDiscountAmount = 0;

    // STEP 1: Apply vendor discounts FIRST
    const vendorDiscounts = await this.getVendorDiscounts(vendorId, serviceIds, customerId);
    
    for (const discount of vendorDiscounts) {
      if (!discount.autoApply) continue;
      
      const discountAmt = this.calculateSingleDiscount(
        currentAmount,
        discount.discountType,
        discount.discountValue,
        discount.minOrderValue,
        discount.maxDiscountAmount
      );
      
      if (discountAmt > 0) {
        vendorDiscountAmount += discountAmt;
        currentAmount -= discountAmt;
        
        appliedDiscounts.push({
          id: discount.id,
          type: 'vendor',
          name: discount.name,
          discountType: discount.discountType,
          discountValue: discount.discountValue,
          discountAmount: discountAmt,
          order: appliedDiscounts.length + 1,
        });
      }
    }

    // STEP 2: Apply platform promotions SECOND
    const platformPromotions = await this.getPlatformPromotions(serviceCategory);
    
    // Only apply one platform promotion (highest value spotlight or first applicable)
    const bestPromotion = this.selectBestPromotion(platformPromotions, currentAmount);
    
    if (bestPromotion) {
      const discountAmt = this.calculateSingleDiscount(
        currentAmount,
        bestPromotion.discountType,
        bestPromotion.discountValue,
        bestPromotion.minOrderValue,
        bestPromotion.maxDiscountAmount
      );
      
      if (discountAmt > 0) {
        platformDiscountAmount = discountAmt;
        currentAmount -= discountAmt;
        
        appliedDiscounts.push({
          id: bestPromotion.id,
          type: 'platform',
          name: bestPromotion.name,
          discountType: bestPromotion.discountType,
          discountValue: bestPromotion.discountValue,
          discountAmount: discountAmt,
          order: appliedDiscounts.length + 1,
        });
      }
    }

    // STEP 3: Apply coupon code LAST (if provided)
    if (couponCode) {
      const couponResult = await this.applyCoupon(couponCode, currentAmount, customerId, vendorId);
      
      if (couponResult.valid && couponResult.discountAmount > 0) {
        couponDiscountAmount = couponResult.discountAmount;
        currentAmount -= couponResult.discountAmount;
        
        appliedDiscounts.push({
          id: couponResult.couponId || couponCode,
          type: 'coupon',
          name: `Coupon: ${couponCode}`,
          discountType: couponResult.discountType,
          discountValue: couponResult.discountValue,
          discountAmount: couponResult.discountAmount,
          order: appliedDiscounts.length + 1,
        });
      }
    }

    return {
      originalAmount,
      vendorDiscountAmount,
      platformDiscountAmount,
      couponDiscountAmount,
      totalDiscountAmount: vendorDiscountAmount + platformDiscountAmount + couponDiscountAmount,
      finalAmount: Math.max(0, currentAmount),
      appliedDiscounts,
    };
  }

  /**
   * Get applicable vendor discounts
   */
  async getVendorDiscounts(
    vendorId: string, 
    serviceIds: string[], 
    customerId?: string
  ): Promise<VendorDiscount[]> {
    try {
      const result = await query(
        `SELECT * FROM vendor_discounts 
         WHERE vendor_id = $1 
         AND is_active = true
         AND (start_date IS NULL OR start_date <= CURRENT_DATE)
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND (usage_limit IS NULL OR usage_count < usage_limit)
         ORDER BY discount_type, discount_value DESC`,
        [vendorId]
      );

      const discounts = ((result as any).rows || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        discountType: row.discount_type,
        discountValue: parseFloat(row.discount_value || '0'),
        buyQuantity: row.buy_quantity,
        getQuantity: row.get_quantity,
        getDiscountPercentage: row.get_discount_percentage,
        minOrderValue: row.min_order_value ? parseFloat(row.min_order_value) : undefined,
        maxDiscountAmount: row.max_discount_amount ? parseFloat(row.max_discount_amount) : undefined,
        applicableServices: row.applicable_services,
        autoApply: row.auto_apply !== false,
      }));

      // Filter by applicable services if specified
      return discounts.filter((d: VendorDiscount) => {
        if (!d.applicableServices || d.applicableServices.length === 0) return true;
        return serviceIds.some(sid => d.applicableServices!.includes(sid));
      });

    } catch (error) {
      console.warn('Error fetching vendor discounts:', error);
      return [];
    }
  }

  /**
   * Get platform promotions (spotlights, category discounts)
   */
  async getPlatformPromotions(serviceCategory?: string): Promise<PlatformPromotion[]> {
    try {
      let queryText = `
        SELECT * FROM promotions 
        WHERE is_active = true
        AND published = true
        AND (start_date IS NULL OR start_date <= CURRENT_DATE)
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      `;
      const params: any[] = [];

      if (serviceCategory) {
        queryText += ` AND (target_category IS NULL OR target_category = $1)`;
        params.push(serviceCategory);
      }

      queryText += ` ORDER BY is_spotlight DESC, discount_value DESC`;

      const result = await query(queryText, params);

      return ((result as any).rows || []).map((row: any) => ({
        id: row.id,
        name: row.name || row.title,
        discountType: row.discount_type,
        discountValue: parseFloat(row.discount_value || '0'),
        minOrderValue: row.min_order_value ? parseFloat(row.min_order_value) : undefined,
        maxDiscountAmount: row.max_discount_amount ? parseFloat(row.max_discount_amount) : undefined,
        isSpotlight: row.is_spotlight === true,
      }));

    } catch (error) {
      console.warn('Error fetching platform promotions:', error);
      return [];
    }
  }

  /**
   * Select the best platform promotion to apply
   */
  private selectBestPromotion(
    promotions: PlatformPromotion[], 
    amount: number
  ): PlatformPromotion | null {
    // Prefer spotlight promotions
    const spotlights = promotions.filter(p => p.isSpotlight);
    const eligibleSpotlight = spotlights.find(p => 
      !p.minOrderValue || amount >= p.minOrderValue
    );
    
    if (eligibleSpotlight) return eligibleSpotlight;

    // Otherwise, select the promotion with highest discount value
    const eligible = promotions.filter(p => !p.minOrderValue || amount >= p.minOrderValue);
    
    if (eligible.length === 0) return null;

    // Calculate actual discount for each and return the best
    let best = eligible[0];
    let bestDiscount = this.calculateSingleDiscount(
      amount, 
      best.discountType, 
      best.discountValue, 
      best.minOrderValue, 
      best.maxDiscountAmount
    );

    for (let i = 1; i < eligible.length; i++) {
      const discount = this.calculateSingleDiscount(
        amount, 
        eligible[i].discountType, 
        eligible[i].discountValue, 
        eligible[i].minOrderValue, 
        eligible[i].maxDiscountAmount
      );
      if (discount > bestDiscount) {
        best = eligible[i];
        bestDiscount = discount;
      }
    }

    return best;
  }

  /**
   * Apply a coupon code
   */
  async applyCoupon(
    code: string, 
    amount: number, 
    customerId?: string, 
    vendorId?: string
  ): Promise<{
    valid: boolean;
    couponId?: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
    message?: string;
  }> {
    try {
      const coupons = await query(
        `SELECT * FROM coupons 
         WHERE UPPER(code) = UPPER($1) 
         AND is_active = true
         AND (start_date IS NULL OR start_date <= CURRENT_DATE)
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND (usage_limit IS NULL OR usage_count < usage_limit)
         LIMIT 1`,
        [code]
      );

      const couponRows = (coupons as any).rows || [];
      
      if (couponRows.length === 0) {
        return { valid: false, discountType: 'fixed', discountValue: 0, discountAmount: 0, message: 'Invalid or expired coupon' };
      }

      const coupon = couponRows[0];

      // Check minimum amount
      if (coupon.min_amount && amount < parseFloat(coupon.min_amount)) {
        return { 
          valid: false, 
          discountType: 'fixed', 
          discountValue: 0, 
          discountAmount: 0, 
          message: `Minimum order amount of ₹${coupon.min_amount} required` 
        };
      }

      // Check vendor restriction
      if (coupon.vendor_id && vendorId && coupon.vendor_id !== vendorId) {
        return { valid: false, discountType: 'fixed', discountValue: 0, discountAmount: 0, message: 'Coupon not valid for this vendor' };
      }

      // Check customer usage if customer-specific or one-time
      if (customerId && coupon.one_time_per_customer) {
        const usageResult = await query(
          `SELECT id FROM coupon_usage WHERE coupon_id = $1 AND customer_id = $2`,
          [coupon.id, customerId]
        );
        if ((usageResult as any).rows.length > 0) {
          return { valid: false, discountType: 'fixed', discountValue: 0, discountAmount: 0, message: 'Coupon already used' };
        }
      }

      const discountType = coupon.discount_type || 'percentage';
      const discountValue = parseFloat(coupon.discount_value || '0');
      const maxDiscount = coupon.max_discount ? parseFloat(coupon.max_discount) : undefined;

      const discountAmount = this.calculateSingleDiscount(
        amount,
        discountType,
        discountValue,
        parseFloat(coupon.min_amount || '0'),
        maxDiscount
      );

      return {
        valid: true,
        couponId: coupon.id,
        discountType,
        discountValue,
        discountAmount,
      };

    } catch (error) {
      console.error('Error applying coupon:', error);
      return { valid: false, discountType: 'fixed', discountValue: 0, discountAmount: 0, message: 'Error applying coupon' };
    }
  }

  /**
   * Calculate discount amount based on type
   */
  private calculateSingleDiscount(
    amount: number,
    discountType: string,
    discountValue: number,
    minOrderValue?: number,
    maxDiscount?: number
  ): number {
    // Check minimum order value
    if (minOrderValue && amount < minOrderValue) {
      return 0;
    }

    let discount = 0;

    if (discountType === 'percentage') {
      discount = (amount * discountValue) / 100;
    } else if (discountType === 'fixed') {
      discount = discountValue;
    } else {
      // For buy_x_get_y and other types, would need item-level calculation
      return 0;
    }

    // Apply max discount cap
    if (maxDiscount && discount > maxDiscount) {
      discount = maxDiscount;
    }

    // Discount cannot exceed amount
    if (discount > amount) {
      discount = amount;
    }

    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate Buy X Get Y discount for items
   * ✅ FIX GAP PM-3
   */
  calculateBuyXGetYDiscount(
    items: { id: string; quantity: number; price: number }[],
    buyQuantity: number,
    getQuantity: number,
    getDiscountPercentage: number = 100
  ): { discountAmount: number; freeItems: number } {
    // Calculate how many "sets" of buy X we have
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const sets = Math.floor(totalQuantity / buyQuantity);
    const freeItems = sets * getQuantity;
    
    // Find the lowest priced items to make free
    const sortedItems = [...items].sort((a, b) => a.price - b.price);
    
    let freeItemsRemaining = freeItems;
    let discountAmount = 0;
    
    for (const item of sortedItems) {
      if (freeItemsRemaining <= 0) break;
      
      const itemsToDiscount = Math.min(item.quantity, freeItemsRemaining);
      discountAmount += (item.price * itemsToDiscount * getDiscountPercentage) / 100;
      freeItemsRemaining -= itemsToDiscount;
    }

    return { discountAmount, freeItems };
  }

  /**
   * Get vendor discounts for display on service listings
   * Shows vendor-configured discounts on the service cards
   */
  async getVendorDiscountsForDisplay(vendorId: string): Promise<VendorDiscount[]> {
    return await this.getVendorDiscounts(vendorId, [], undefined);
  }
}

// Export singleton
export const discountCalculationService = new DiscountCalculationServiceImpl();

// Export convenience functions
export const calculateDiscounts = (params: Parameters<typeof discountCalculationService.calculateDiscounts>[0]) =>
  discountCalculationService.calculateDiscounts(params);

export const getVendorDiscountsForDisplay = (vendorId: string) =>
  discountCalculationService.getVendorDiscountsForDisplay(vendorId);
