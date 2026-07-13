/**
 * Normalize meal_plans API rows for customer UI (listing + checkout).
 * Catalog lives in dietary_requirements JSON from the vendor meal product form.
 */

import { ALLERGEN_LABEL, MEAL_CATEGORY_LABEL } from '@/lib/meal-product-display';
import { formatPackWeightLabel, resolvePackWeightGrams } from '@/lib/meal-pack-weight';
import {
  customerBenefitBullets,
  customerPricingLine,
  customerPurchaseHeadline,
  normalizeCustomerPurchaseType,
  type CustomerPurchaseType,
} from '@/lib/meal-purchase-customer';

export const DELIVERY_TYPE_LABEL: Record<string, string> = {
  ONE_TIME: 'One-time purchase',
  WEEKLY_SUBSCRIPTION: 'Weekly meal plan',
  MONTHLY_SUBSCRIPTION: 'Monthly nutrition plan',
  WEEKLY_PLAN: 'Weekly meal plan',
  MONTHLY_PLAN: 'Monthly nutrition plan',
};

export const PREPARATION_TYPE_LABEL: Record<string, string> = {
  FRESH_COOKED: 'Fresh cooked',
  FREEZE_DRIED: 'Freeze dried',
  RAW: 'Raw',
  DEHYDRATED: 'Dehydrated',
  HOMEMADE: 'Homemade',
};

export function parsePlanDietary(plan: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!plan) return {};
  const raw = plan.dietary_requirements;
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

export interface MealPlanCatalogDisplay {
  mealCategories: string[];
  petTypes: string[];
  ingredients: string[];
  allergens: string[];
  dietTypeLabel: string;
  preparationLabel: string;
  deliveryLabel: string;
  shelfLifeDays: number | null;
  packWeightGrams: number | null;
  packWeightLabel: string | null;
  purchaseType: CustomerPurchaseType;
  customerPurchaseHeadline: string;
  customerPricingLine: string;
  customerBenefits: string[];
}

export function getMealPlanCatalogDisplay(plan: Record<string, unknown> | null | undefined): MealPlanCatalogDisplay {
  const d = parsePlanDietary(plan);
  const mealCategories = Array.isArray(d.mealCategories)
    ? (d.mealCategories as unknown[]).map((x) => String(x))
    : [];
  const petTypes = Array.isArray(d.petTypes) ? (d.petTypes as unknown[]).map((x) => String(x)) : [];
  let ingredients: string[] = [];
  if (Array.isArray(d.ingredients)) {
    ingredients = (d.ingredients as unknown[]).map((x) => String(x).trim()).filter(Boolean);
  }
  if (ingredients.length === 0 && plan?.ingredients != null) {
    const ing = plan.ingredients as unknown;
    if (Array.isArray(ing)) {
      ingredients = ing.map((x) => String(x).trim()).filter(Boolean);
    } else if (typeof ing === 'string') {
      try {
        const arr = JSON.parse(ing) as unknown;
        if (Array.isArray(arr)) ingredients = arr.map((x) => String(x).trim()).filter(Boolean);
      } catch {
        ingredients = ing.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  const allergens = Array.isArray(d.allergens)
    ? (d.allergens as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const dietTypeLabel = typeof d.dietType === 'string' && d.dietType.trim() ? d.dietType.trim() : '';

  const prepKey = String(d.preparationType || '').toUpperCase();
  const delKey = String(d.deliveryType || '').toUpperCase();
  const preparationLabel = PREPARATION_TYPE_LABEL[prepKey] || (prepKey ? prepKey.replace(/_/g, ' ') : '');
  const purchaseType = normalizeCustomerPurchaseType(d);
  const purchaseKey = String(d.purchaseType || '').toUpperCase();
  const deliveryLabel =
    DELIVERY_TYPE_LABEL[purchaseKey] ||
    DELIVERY_TYPE_LABEL[delKey] ||
    (purchaseType === 'WEEKLY_PLAN'
      ? 'Weekly meal plan'
      : purchaseType === 'MONTHLY_PLAN'
        ? 'Monthly nutrition plan'
        : delKey
          ? delKey.replace(/_/g, ' ')
          : '');

  const shelfRaw =
    plan?.shelf_life_days ??
    d.shelfLifeDays ??
    d.shelfLife ??
    plan?.duration_days ??
    plan?.durationDays;
  let shelfLifeDays: number | null = null;
  if (shelfRaw != null && shelfRaw !== '') {
    const n = typeof shelfRaw === 'number' ? shelfRaw : parseInt(String(shelfRaw), 10);
    if (Number.isFinite(n) && n > 0) shelfLifeDays = n;
  }

  const packWeightGrams = resolvePackWeightGrams(plan ?? undefined, {
    ...d,
    packWeightGrams: plan?.pack_weight_grams ?? d.packWeightGrams,
    mealsPerDelivery: plan?.meals_per_delivery ?? d.mealsPerDelivery,
    deliveryDays: plan?.delivery_days ?? d.deliveryDays,
    deliveryFrequency: plan?.delivery_frequency ?? d.deliveryFrequency,
    purchaseType: plan?.purchase_type ?? d.purchaseType,
    mealsPerDay: plan?.purchase_type === 'WEEKLY_PLAN' ? undefined : (plan?.meals_per_day ?? d.mealsPerDay),
  });
  const packWeightLabel = formatPackWeightLabel(packWeightGrams);

  return {
    mealCategories,
    petTypes,
    ingredients,
    allergens,
    dietTypeLabel,
    preparationLabel,
    deliveryLabel,
    shelfLifeDays,
    packWeightGrams,
    packWeightLabel,
    purchaseType,
    customerPurchaseHeadline: customerPurchaseHeadline(purchaseType),
    customerPricingLine: customerPricingLine(plan ?? {}, d),
    customerBenefits: customerBenefitBullets(purchaseType, d),
  };
}

export function formatCategoryLabel(code: string): string {
  const u = code.toUpperCase();
  return MEAL_CATEGORY_LABEL[u] || code.replace(/_/g, ' ');
}

export function formatAllergenLabel(code: string): string {
  const u = code.toUpperCase();
  return ALLERGEN_LABEL[u as keyof typeof ALLERGEN_LABEL] || code.replace(/_/g, ' ');
}
