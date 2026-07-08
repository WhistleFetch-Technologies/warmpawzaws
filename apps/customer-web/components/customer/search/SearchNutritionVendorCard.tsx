'use client';

import {
  NutritionVendorDetailsCard,
  type NutritionVendorCardModel,
} from '@/components/customer/nutrition/NutritionVendorDetailsCard';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';

export interface SearchNutritionVendorCardProps {
  vendor: NutritionVendorCardModel;
  onViewMealPlans: () => void;
  onViewServices: () => void;
  className?: string;
}

/** Search listing — reuses Services Expert Nutritionists card surface. */
export function SearchNutritionVendorCard({
  vendor,
  onViewMealPlans,
  onViewServices,
  className = '',
}: SearchNutritionVendorCardProps) {
  const mealPlansLive = isCustomerMealPlansEnabled();

  return (
    <NutritionVendorDetailsCard
      vendor={vendor}
      className={className}
      showViewMealPlans={mealPlansLive}
      onViewMealPlans={onViewMealPlans}
      showBookConsultation
      onBookConsultation={onViewServices}
    />
  );
}
