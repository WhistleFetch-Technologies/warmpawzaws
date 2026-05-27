import type { MealsPerDayPreset, PurchaseType } from '../constants/meal-product-enums';
import { legacyDeliveryTypeMirror } from './meal-purchase-metadata';

export function normalizeIngredientList(input: unknown): string[] {
  const raw: unknown[] = [];
  if (Array.isArray(input)) {
    for (const item of input) {
      if (item != null && item !== '') raw.push(item);
    }
  } else if (typeof input === 'string') {
    for (const part of input.split(',')) {
      const t = part.trim();
      if (t) raw.push(t);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function resolveMealsPerDayPreset(
  body: Record<string, unknown>,
  existing?: Record<string, unknown>,
): MealsPerDayPreset {
  const preset = body.mealsPerDayPreset ?? existing?.mealsPerDayPreset;
  if (preset === '1' || preset === '2' || preset === '3' || preset === 'CUSTOM') return preset;
  const n =
    body.mealsPerDay !== undefined && body.mealsPerDay !== null
      ? Number(body.mealsPerDay)
      : existing?.mealsPerDay !== undefined && existing?.mealsPerDay !== null
        ? Number(existing.mealsPerDay)
        : NaN;
  if (n === 1) return '1';
  if (n === 2) return '2';
  if (n === 3) return '3';
  return '2';
}

export function mealsPerDayColumnFromPreset(preset: MealsPerDayPreset): number {
  if (preset === '1') return 1;
  if (preset === '2') return 2;
  if (preset === '3') return 3;
  return 2;
}

export function resolveMealsPerDeliveryNumeric(parsed: {
  mealsPerDelivery?: number | string;
  mealsPerDeliveryPreset: string;
  mealsPerDeliveryCustom?: string;
}): number {
  const rawMd = parsed.mealsPerDelivery;
  if (rawMd != null && !(typeof rawMd === 'string' && rawMd.trim() === '')) {
    const n = typeof rawMd === 'number' ? rawMd : parseInt(String(rawMd), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  const preset = String(parsed.mealsPerDeliveryPreset || '').toUpperCase();
  if (preset === '1') return 1;
  if (preset === '3') return 3;
  if (preset === 'CUSTOM') {
    const n = parseInt(String(parsed.mealsPerDeliveryCustom || '').trim(), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  return 2;
}

function compactSubscriptionConfig(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/** Input shape matches `MealProductRequestParsed` from Zod (kept inline to avoid circular imports). */
export type MealProductDietaryInput = {
  petTypes: string[];
  dietType: string;
  suitableFor: string[];
  ingredients: string[];
  nutritionalValue: Record<string, unknown>;
  preparationLeadTime: number;
  leadTimeHours?: number;
  orderCutoffTime?: string;
  storageInstructions?: string;
  shelfLifeDays: number;
  mealCategories: string[];
  medicalConditionTags: string[];
  feedingInstructions?: string;
  deliveryType: string;
  purchaseType: PurchaseType;
  subscriptionEnabled?: boolean;
  deliveryFrequency?: string;
  deliveryDays: string[];
  mealsPerDelivery?: number | string;
  mealsPerDeliveryPreset: string;
  mealsPerDeliveryCustom?: string;
  recommendedPlanLengthWeeks?: 1 | 2 | 4;
  subscriptionPrice?: number;
  pauseAllowed?: boolean;
  cancelAnytime?: boolean;
  mealsPerDayPreset: string;
  mealsPerDayCustom?: string;
  allergens: string[];
  preparationType: string;
  packSize?: string;
  packWeightGrams: number;
};

/** Builds persisted JSON for meal_plans.dietary_requirements / products.metadata. */
export function mealProductParsedToDietaryJson(
  parsed: MealProductDietaryInput,
  opts: { mealImageUrl?: string },
): Record<string, unknown> {
  const pt = parsed.purchaseType;
  const subscriptionEnabled = pt !== 'ONE_TIME';
  const mirrorDelivery = legacyDeliveryTypeMirror(pt);
  const mealsPerDeliveryNum = resolveMealsPerDeliveryNumeric(parsed);

  let mealsPerDayJson: number | undefined;
  if (pt === 'MONTHLY_PLAN') {
    mealsPerDayJson = mealsPerDayColumnFromPreset(parsed.mealsPerDayPreset as MealsPerDayPreset);
  } else if (pt === 'ONE_TIME') {
    const preset = parsed.mealsPerDayPreset as MealsPerDayPreset;
    if (preset !== 'CUSTOM') {
      mealsPerDayJson = mealsPerDayColumnFromPreset(preset);
    }
  }

  const subscriptionConfig = compactSubscriptionConfig({
    deliveryFrequency: pt === 'MONTHLY_PLAN' ? parsed.deliveryFrequency : undefined,
    deliveryDays: pt === 'WEEKLY_PLAN' && parsed.deliveryDays?.length ? [...parsed.deliveryDays] : undefined,
    mealsPerDelivery: pt === 'WEEKLY_PLAN' ? mealsPerDeliveryNum : undefined,
    mealsPerDay: pt === 'MONTHLY_PLAN' ? mealsPerDayColumnFromPreset(parsed.mealsPerDayPreset as MealsPerDayPreset) : undefined,
    recommendedPlanLengthWeeks: parsed.recommendedPlanLengthWeeks,
    subscriptionPrice: parsed.subscriptionPrice,
    pauseAllowed: parsed.pauseAllowed,
    cancelAnytime: parsed.cancelAnytime,
  });

  const base: Record<string, unknown> = {
    petTypes: parsed.petTypes,
    dietType: parsed.dietType,
    suitableFor: parsed.suitableFor,
    ingredients: parsed.ingredients,
    nutritionalValue: parsed.nutritionalValue,
    preparationLeadTime: parsed.preparationLeadTime,
    prepTimeMinutes: parsed.preparationLeadTime,
    ...(parsed.leadTimeHours != null ? { leadTimeHours: parsed.leadTimeHours } : {}),
    ...(parsed.orderCutoffTime ? { orderCutoffTime: parsed.orderCutoffTime } : {}),
    storageInstructions: parsed.storageInstructions,
    shelfLifeDays: parsed.shelfLifeDays,
    shelfLife: parsed.shelfLifeDays,
    mealCategories: parsed.mealCategories,
    medicalConditionTags: parsed.medicalConditionTags,
    feedingInstructions: parsed.feedingInstructions,
    purchaseType: pt,
    subscriptionEnabled,
    deliveryType: mirrorDelivery,
    deliveryFrequency: pt === 'MONTHLY_PLAN' ? parsed.deliveryFrequency : undefined,
    deliveryDays: pt === 'WEEKLY_PLAN' ? [...parsed.deliveryDays] : [],
    mealsPerDelivery: pt === 'WEEKLY_PLAN' ? mealsPerDeliveryNum : undefined,
    mealsPerDeliveryPreset: parsed.mealsPerDeliveryPreset,
    mealsPerDeliveryCustom:
      parsed.mealsPerDeliveryPreset === 'CUSTOM' ? parsed.mealsPerDeliveryCustom : undefined,
    recommendedPlanLengthWeeks: parsed.recommendedPlanLengthWeeks,
    subscriptionPrice: parsed.subscriptionPrice,
    pauseAllowed: parsed.pauseAllowed ?? true,
    cancelAnytime: parsed.cancelAnytime ?? true,
    subscriptionConfig,
    mealsPerDayPreset: parsed.mealsPerDayPreset,
    mealsPerDayCustom: parsed.mealsPerDayPreset === 'CUSTOM' ? parsed.mealsPerDayCustom : undefined,
    allergens: parsed.allergens,
    preparationType: parsed.preparationType,
    ...(mealsPerDayJson != null ? { mealsPerDay: mealsPerDayJson } : {}),
    packWeightGrams: parsed.packWeightGrams,
  };
  if (opts.mealImageUrl) base.mealImageUrl = opts.mealImageUrl;
  if (parsed.packSize) base.packSize = parsed.packSize;
  return base;
}
