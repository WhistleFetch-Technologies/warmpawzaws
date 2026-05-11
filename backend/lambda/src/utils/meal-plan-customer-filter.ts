/**
 * Map customer meal-plan search chips (purpose / mealType) to vendor catalog
 * stored in meal_plans.dietary_requirements JSON (mealCategories, medicalConditionTags,
 * preparationType, purchaseType / legacy deliveryType) with fallback to legacy purpose / meal_type columns.
 */

import { normalizePurchaseType } from './meal-purchase-metadata';

export function parseMealPlanDietaryJson(mp: Record<string, unknown>): Record<string, unknown> {
  const raw = mp.dietary_requirements;
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

/** Customer chip: weight_management, allergy_management, … */
export function mealPlanMatchesCustomerPurpose(mp: Record<string, unknown>, purpose: string): boolean {
  const key = purpose.trim().toLowerCase().replace(/\s+/g, '_');
  const purposeCol = String(mp.purpose || '').toLowerCase();
  if (purposeCol.includes(key.replace(/_/g, ' ')) || purposeCol.includes(key.replace(/_/g, ''))) {
    return true;
  }

  const diet = parseMealPlanDietaryJson(mp);
  const cats = new Set(
    Array.isArray(diet.mealCategories) ? diet.mealCategories.map((x) => String(x).toUpperCase()) : [],
  );
  const meds = new Set(
    Array.isArray(diet.medicalConditionTags)
      ? diet.medicalConditionTags.map((x) => String(x).toUpperCase())
      : [],
  );

  switch (key) {
    case 'weight_management':
      return cats.has('WEIGHT_LOSS') || meds.has('OBESITY');
    case 'muscle_gain':
      return cats.has('WEIGHT_GAIN') || cats.has('HIGH_PROTEIN');
    case 'senior_care':
      return cats.has('SENIOR_CARE');
    case 'allergy_management':
      return (
        cats.has('ALLERGY_FRIENDLY') ||
        meds.has('SKIN_ALLERGIES') ||
        meds.has('SENSITIVE_STOMACH') ||
        meds.has('DIGESTIVE_ISSUES')
      );
    case 'maintenance':
      return (
        cats.has('HOMEMADE_DIET') ||
        cats.has('GUT_HEALTH') ||
        cats.has('DIABETIC_SUPPORT') ||
        cats.has('KIDNEY_SUPPORT') ||
        cats.has('PUPPY_GROWTH')
      );
    default:
      return false;
  }
}

/** Customer chip: fresh_daily, frozen, … */
export function mealPlanMatchesCustomerMealType(mp: Record<string, unknown>, mealType: string): boolean {
  const key = mealType.trim().toLowerCase().replace(/\s+/g, '_');
  const col = String(mp.meal_type || '').toLowerCase().replace(/-/g, '_');
  if (col === key || col.includes(key)) return true;

  const diet = parseMealPlanDietaryJson(mp);
  const prep = String(diet.preparationType || '').toUpperCase();
  const del = String(diet.deliveryType || '').toUpperCase();
  const purchase = normalizePurchaseType(diet);

  switch (key) {
    case 'frozen':
      return col.includes('frozen') || prep === 'FREEZE_DRIED';
    case 'fresh_daily':
      return col === 'fresh_daily' || (prep === 'FRESH_COOKED' && del === 'ONE_TIME');
    case 'fresh_weekly':
      return (
        col === 'fresh_weekly' ||
        del === 'WEEKLY_SUBSCRIPTION' ||
        purchase === 'WEEKLY_PLAN'
      );
    case 'preserved_monthly':
      return (
        col === 'preserved_monthly' ||
        del === 'MONTHLY_SUBSCRIPTION' ||
        purchase === 'MONTHLY_PLAN' ||
        prep === 'DEHYDRATED'
      );
    case 'instant':
      return col === 'instant' || prep === 'RAW';
    default:
      return false;
  }
}
