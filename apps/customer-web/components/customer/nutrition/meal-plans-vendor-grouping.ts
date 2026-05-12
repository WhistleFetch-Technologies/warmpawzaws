import type { NutritionVendorCardModel } from './NutritionVendorDetailsCard';

export type MealPlanVendorGroup = {
  vendorId: string;
  vendorMeta: NutritionVendorCardModel;
};

/** Build one entry per vendor from search results (for vendor-first browse). */
export function uniqueVendorsFromMealPlans(mealPlans: any[]): MealPlanVendorGroup[] {
  const byId = new Map<string, NutritionVendorCardModel>();
  for (const p of mealPlans) {
    const vendorId = String(p.vendor_id ?? p.vendorId ?? '').trim();
    if (!vendorId) continue;
    if (byId.has(vendorId)) continue;
    byId.set(vendorId, {
      id: vendorId,
      vendorId,
      businessName: p.vendor_name ?? p.vendorName,
      name: p.vendor_name ?? p.vendorName,
      vendor_name: p.vendor_name ?? p.vendorName,
      rating: p.vendor_rating ?? p.vendorRating,
      vendor_rating: p.vendor_rating ?? p.vendorRating,
      reviewCount: p.vendor_review_count ?? p.vendorReviewCount,
      review_count: p.vendor_review_count ?? p.vendorReviewCount,
      address: p.vendor_address ?? p.vendorAddress,
      vendor_address: p.vendor_address ?? p.vendorAddress,
      city: p.vendor_city ?? p.vendorCity,
      photo: p.vendor_photo ?? p.vendorPhoto ?? p.vendor_image_url,
    });
  }
  return Array.from(byId.entries()).map(([vendorId, vendorMeta]) => ({
    vendorId,
    vendorMeta,
  }));
}
