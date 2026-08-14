/**
 * Apply active discovery promotions to service rows (grooming list expand).
 */

export type GroomingPromotion = {
  id: string;
  applicable_services?: string[];
  applicable_roles?: string[];
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
  discount_type: 'percentage' | 'fixed' | string;
  discount_value?: string;
  max_discount_amount?: string;
};

export function applyGroomingPromotionsToServices(
  services: Record<string, unknown>[],
  promotions: GroomingPromotion[],
  category: string
): Record<string, unknown>[] {
  if (!promotions.length) return services;

  return services.map((s) => {
    const basePrice = Number(s.price ?? 0);
    let finalPrice = basePrice;
    let originalPrice = basePrice;
    let discountPercentage: number | undefined;
    let discountAmount: number | undefined;
    let promotionId: string | undefined;

    const applicablePromo = promotions.find((promo) => {
      const appliesToService =
        !promo.applicable_services ||
        promo.applicable_services.length === 0 ||
        promo.applicable_services.includes(String(s.id ?? s.serviceId ?? ''));

      const appliesToCategory =
        !promo.applicable_roles ||
        promo.applicable_roles.length === 0 ||
        promo.applicable_roles.includes(category);

      const now = new Date();
      const startDate = new Date(promo.start_date);
      const endDate = promo.end_date ? new Date(promo.end_date) : null;
      const isActive = now >= startDate && (!endDate || now <= endDate);

      return appliesToService && appliesToCategory && isActive && promo.is_active !== false;
    });

    if (applicablePromo && basePrice > 0) {
      originalPrice = basePrice;
      promotionId = applicablePromo.id;

      if (applicablePromo.discount_type === 'percentage') {
        discountPercentage = parseFloat(applicablePromo.discount_value || '0');
        discountAmount = (basePrice * discountPercentage) / 100;
        if (applicablePromo.max_discount_amount) {
          discountAmount = Math.min(
            discountAmount,
            parseFloat(applicablePromo.max_discount_amount)
          );
        }
        finalPrice = Math.max(0, basePrice - discountAmount);
      } else if (applicablePromo.discount_type === 'fixed') {
        discountAmount = parseFloat(applicablePromo.discount_value || '0');
        finalPrice = Math.max(0, basePrice - discountAmount);
        discountPercentage = Math.round((discountAmount / basePrice) * 100);
      }
    }

    return {
      ...s,
      // Keep catalog/list in `price` so checkout baseAmount is not promo-baked.
      price: basePrice,
      originalPrice: originalPrice !== finalPrice ? originalPrice : undefined,
      discountPercentage,
      discountAmount,
      promotionId,
    };
  });
}
