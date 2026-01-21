'use client';

/**
 * Promotions Engine - Handles BOGO, Bundle, Auto-Apply logic
 * 
 * Supports:
 * - Buy X Get Y (BOGO) - e.g., Buy 2 Get 1 Free
 * - Bundle/Combo Deals - Multiple products at discount
 * - Percentage & Fixed discounts
 * - Auto-apply best promotion
 * - Stacking rules
 */

export interface CartItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  vendorId?: string;
  vendorName?: string;
  category?: string;
  categoryId?: string;
  [key: string]: any;
}

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  code?: string;
  promotion_type: 'flash_sale' | 'seasonal' | 'buy_x_get_y' | 'bundle' | 'first_order' | 'category_discount' | 'loyalty' | 'service_specific';
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  
  // Validity
  start_date: string;
  end_date: string;
  is_active: boolean;
  
  // Conditions
  min_order_value?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_count?: number;
  
  // Targeting
  applicable_products?: string[];
  applicable_categories?: string[];
  vendor_id?: string;
  
  // BOGO specific
  buy_quantity?: number;
  get_quantity?: number;
  get_discount_percent?: number;
  
  // Bundle specific
  bundle_products?: string[];
  bundle_discount?: number;
}

export interface AppliedPromotion {
  promotion: Promotion;
  discountAmount: number;
  affectedItems: string[]; // Item IDs
  freeItems?: { itemId: string; quantity: number }[];
  type: 'percentage' | 'fixed' | 'bogo' | 'bundle';
  description: string;
}

export interface CartPromotionResult {
  originalTotal: number;
  discountedTotal: number;
  totalSavings: number;
  appliedPromotions: AppliedPromotion[];
  suggestedPromotions: Promotion[]; // Promotions that could apply with more items
  freeItemsAdded: { itemId: string; itemName: string; quantity: number }[];
}

/**
 * Check if a promotion is currently valid (date-wise)
 */
export function isPromotionValid(promo: Promotion): boolean {
  if (!promo.is_active) return false;
  
  const now = new Date();
  const startDate = new Date(promo.start_date);
  const endDate = new Date(promo.end_date);
  
  return now >= startDate && now <= endDate;
}

/**
 * Check if promotion applies to a specific item
 */
export function promotionAppliesToItem(promo: Promotion, item: CartItem): boolean {
  // If no restrictions, applies to all
  if (!promo.applicable_products?.length && !promo.applicable_categories?.length) {
    // Check vendor match if vendor-specific
    if (promo.vendor_id && item.vendorId !== promo.vendor_id) return false;
    return true;
  }
  
  // Check product match
  if (promo.applicable_products?.length) {
    const productId = item.productId || item.id;
    if (promo.applicable_products.includes(productId)) return true;
  }
  
  // Check category match
  if (promo.applicable_categories?.length) {
    const categoryId = item.categoryId || item.category;
    if (categoryId && promo.applicable_categories.includes(categoryId)) return true;
  }
  
  return false;
}

/**
 * Calculate BOGO discount
 * Example: Buy 2 Get 1 at 100% off (free)
 */
export function calculateBogoDiscount(
  promo: Promotion,
  items: CartItem[]
): AppliedPromotion | null {
  if (promo.promotion_type !== 'buy_x_get_y') return null;
  
  const buyQty = promo.buy_quantity || 2;
  const getQty = promo.get_quantity || 1;
  const discountPercent = promo.get_discount_percent || 100;
  
  // Find applicable items
  const applicableItems = items.filter(item => promotionAppliesToItem(promo, item));
  
  if (applicableItems.length === 0) return null;
  
  // Total quantity of applicable items
  const totalQty = applicableItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // How many "sets" can be formed? (buy X + get Y = 1 set)
  const setSize = buyQty + getQty;
  const completeSets = Math.floor(totalQty / setSize);
  
  if (completeSets === 0) return null;
  
  // Calculate discount: free items = completeSets * getQty
  // Use lowest priced items as "free" for customer benefit
  const sortedByPrice = [...applicableItems].sort((a, b) => a.price - b.price);
  
  let freeItemsRemaining = completeSets * getQty;
  let discountAmount = 0;
  const freeItems: { itemId: string; quantity: number }[] = [];
  
  for (const item of sortedByPrice) {
    if (freeItemsRemaining <= 0) break;
    
    const freeFromThis = Math.min(freeItemsRemaining, item.quantity);
    const itemDiscount = (item.price * freeFromThis * discountPercent) / 100;
    discountAmount += itemDiscount;
    freeItemsRemaining -= freeFromThis;
    
    if (freeFromThis > 0) {
      freeItems.push({ itemId: item.id, quantity: freeFromThis });
    }
  }
  
  if (discountAmount === 0) return null;
  
  // Apply max discount cap if set
  if (promo.max_discount_amount && discountAmount > promo.max_discount_amount) {
    discountAmount = promo.max_discount_amount;
  }
  
  return {
    promotion: promo,
    discountAmount,
    affectedItems: applicableItems.map(i => i.id),
    freeItems,
    type: 'bogo',
    description: discountPercent === 100 
      ? `Buy ${buyQty} Get ${getQty} FREE!` 
      : `Buy ${buyQty} Get ${getQty} at ${discountPercent}% OFF!`,
  };
}

/**
 * Calculate Bundle/Combo discount
 */
export function calculateBundleDiscount(
  promo: Promotion,
  items: CartItem[]
): AppliedPromotion | null {
  if (promo.promotion_type !== 'bundle') return null;
  if (!promo.bundle_products?.length) return null;
  
  // Check if all bundle products are in cart
  const bundleProductIds = new Set(promo.bundle_products);
  const cartProductIds = new Set(items.map(i => i.productId || i.id));
  
  const hasAllBundleItems = promo.bundle_products.every(pid => cartProductIds.has(pid));
  
  if (!hasAllBundleItems) return null;
  
  // Calculate bundle discount
  const bundleItems = items.filter(item => 
    bundleProductIds.has(item.productId || item.id)
  );
  
  const bundleTotal = bundleItems.reduce(
    (sum, item) => sum + item.price * item.quantity, 
    0
  );
  
  const bundleDiscount = promo.bundle_discount || 15; // Default 15% off bundle
  let discountAmount = (bundleTotal * bundleDiscount) / 100;
  
  // Apply max cap
  if (promo.max_discount_amount && discountAmount > promo.max_discount_amount) {
    discountAmount = promo.max_discount_amount;
  }
  
  return {
    promotion: promo,
    discountAmount,
    affectedItems: bundleItems.map(i => i.id),
    type: 'bundle',
    description: `Bundle Deal: ${bundleDiscount}% OFF on combo!`,
  };
}

/**
 * Calculate standard percentage/fixed discount
 */
export function calculateStandardDiscount(
  promo: Promotion,
  items: CartItem[],
  cartTotal: number
): AppliedPromotion | null {
  if (promo.promotion_type === 'buy_x_get_y' || promo.promotion_type === 'bundle') {
    return null;
  }
  
  // Check min order value
  if (promo.min_order_value && cartTotal < promo.min_order_value) {
    return null;
  }
  
  // Find applicable items
  const applicableItems = items.filter(item => promotionAppliesToItem(promo, item));
  
  if (applicableItems.length === 0) return null;
  
  const applicableTotal = applicableItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  
  let discountAmount = 0;
  
  if (promo.discount_type === 'percentage') {
    discountAmount = (applicableTotal * promo.discount_value) / 100;
  } else {
    discountAmount = promo.discount_value;
  }
  
  // Apply max cap
  if (promo.max_discount_amount && discountAmount > promo.max_discount_amount) {
    discountAmount = promo.max_discount_amount;
  }
  
  // Cannot exceed applicable total
  discountAmount = Math.min(discountAmount, applicableTotal);
  
  if (discountAmount === 0) return null;
  
  return {
    promotion: promo,
    discountAmount,
    affectedItems: applicableItems.map(i => i.id),
    type: promo.discount_type,
    description: promo.discount_type === 'percentage'
      ? `${promo.discount_value}% OFF - ${promo.name}`
      : `₹${promo.discount_value} OFF - ${promo.name}`,
  };
}

/**
 * Main function: Apply all promotions and find the best combination
 */
export function calculateCartPromotions(
  items: CartItem[],
  availablePromotions: Promotion[],
  options: {
    autoApplyBest?: boolean;
    stackPromotions?: boolean;
    manualCouponCode?: string;
  } = {}
): CartPromotionResult {
  const { 
    autoApplyBest = true, 
    stackPromotions = false,
    manualCouponCode 
  } = options;
  
  const originalTotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity, 
    0
  );
  
  if (items.length === 0 || availablePromotions.length === 0) {
    return {
      originalTotal,
      discountedTotal: originalTotal,
      totalSavings: 0,
      appliedPromotions: [],
      suggestedPromotions: [],
      freeItemsAdded: [],
    };
  }
  
  // Filter valid promotions
  const validPromotions = availablePromotions.filter(isPromotionValid);
  
  // Calculate all possible discounts
  const allDiscounts: AppliedPromotion[] = [];
  
  for (const promo of validPromotions) {
    // BOGO check
    const bogoDiscount = calculateBogoDiscount(promo, items);
    if (bogoDiscount) allDiscounts.push(bogoDiscount);
    
    // Bundle check
    const bundleDiscount = calculateBundleDiscount(promo, items);
    if (bundleDiscount) allDiscounts.push(bundleDiscount);
    
    // Standard discount check
    const standardDiscount = calculateStandardDiscount(promo, items, originalTotal);
    if (standardDiscount) allDiscounts.push(standardDiscount);
  }
  
  // If manual coupon code provided, prioritize it
  if (manualCouponCode) {
    const manualPromo = allDiscounts.find(
      d => d.promotion.code?.toUpperCase() === manualCouponCode.toUpperCase()
    );
    if (manualPromo) {
      return {
        originalTotal,
        discountedTotal: originalTotal - manualPromo.discountAmount,
        totalSavings: manualPromo.discountAmount,
        appliedPromotions: [manualPromo],
        suggestedPromotions: [],
        freeItemsAdded: manualPromo.freeItems?.map(f => ({
          itemId: f.itemId,
          itemName: items.find(i => i.id === f.itemId)?.name || 'Item',
          quantity: f.quantity,
        })) || [],
      };
    }
  }
  
  // Sort by discount amount (best first)
  allDiscounts.sort((a, b) => b.discountAmount - a.discountAmount);
  
  let appliedPromotions: AppliedPromotion[] = [];
  let totalDiscount = 0;
  
  if (stackPromotions) {
    // Apply all non-conflicting promotions
    const usedItems = new Set<string>();
    
    for (const discount of allDiscounts) {
      const hasConflict = discount.affectedItems.some(id => usedItems.has(id));
      if (!hasConflict) {
        appliedPromotions.push(discount);
        totalDiscount += discount.discountAmount;
        discount.affectedItems.forEach(id => usedItems.add(id));
      }
    }
  } else if (autoApplyBest && allDiscounts.length > 0) {
    // Apply only the best promotion
    appliedPromotions = [allDiscounts[0]];
    totalDiscount = allDiscounts[0].discountAmount;
  }
  
  // Find suggestions (promotions that almost qualify)
  const suggestedPromotions = validPromotions.filter(promo => {
    if (appliedPromotions.some(ap => ap.promotion.id === promo.id)) return false;
    
    // Check if adding more items would qualify
    if (promo.promotion_type === 'buy_x_get_y') {
      const buyQty = promo.buy_quantity || 2;
      const getQty = promo.get_quantity || 1;
      const applicableItems = items.filter(item => promotionAppliesToItem(promo, item));
      const totalQty = applicableItems.reduce((sum, item) => sum + item.quantity, 0);
      const setSize = buyQty + getQty;
      
      // If they're close to completing a set
      return totalQty > 0 && totalQty < setSize && totalQty >= buyQty - 1;
    }
    
    if (promo.min_order_value && originalTotal < promo.min_order_value) {
      const remaining = promo.min_order_value - originalTotal;
      return remaining < 500; // Suggest if within ₹500 of qualifying
    }
    
    return false;
  });
  
  // Collect free items info
  const freeItemsAdded = appliedPromotions
    .filter(ap => ap.freeItems && ap.freeItems.length > 0)
    .flatMap(ap => 
      ap.freeItems!.map(f => ({
        itemId: f.itemId,
        itemName: items.find(i => i.id === f.itemId)?.name || 'Item',
        quantity: f.quantity,
      }))
    );
  
  return {
    originalTotal,
    discountedTotal: Math.max(0, originalTotal - totalDiscount),
    totalSavings: totalDiscount,
    appliedPromotions,
    suggestedPromotions,
    freeItemsAdded,
  };
}

/**
 * Format savings for display
 */
export function formatSavings(amount: number): string {
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(0)}`;
}

/**
 * Get promotion badge text
 */
export function getPromotionBadgeText(promo: Promotion): string {
  switch (promo.promotion_type) {
    case 'buy_x_get_y':
      const buy = promo.buy_quantity || 2;
      const get = promo.get_quantity || 1;
      const off = promo.get_discount_percent || 100;
      return off === 100 
        ? `Buy ${buy} Get ${get} FREE` 
        : `Buy ${buy} Get ${get} @ ${off}% OFF`;
    case 'bundle':
      return `Combo: ${promo.bundle_discount || 15}% OFF`;
    case 'flash_sale':
      return `⚡ Flash: ${promo.discount_value}${promo.discount_type === 'percentage' ? '%' : '₹'} OFF`;
    case 'first_order':
      return `New User: ${promo.discount_value}% OFF`;
    default:
      return `${promo.discount_value}${promo.discount_type === 'percentage' ? '%' : '₹'} OFF`;
  }
}
