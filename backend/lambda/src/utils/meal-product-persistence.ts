/**
 * Maps vendor meal product form → meal_plans columns + dietary_requirements JSON.
 * Purchase-type rules:
 *   ONE_TIME   — optional meals_per_day hint only
 *   WEEKLY_PLAN — delivery_days + meals_per_delivery (not meals_per_day for delivery qty)
 *   MONTHLY_PLAN — delivery_frequency + meals_per_day
 */

import type { MealsPerDayPreset, PurchaseType } from '../constants/meal-product-enums';
import {
  mealsPerDayColumnFromPreset,
  resolveMealsPerDeliveryNumeric,
  type MealProductDietaryInput,
} from './meal-product-dietary';
import {
  parseMealPlanDietaryJson,
  resolvePackWeightGramsFromDietary,
  resolvePackWeightGramsFromPlanRow,
} from './meal-pack-weight';

export { resolvePackWeightGramsFromPlanRow };

export type MealPlanColumnSet = Set<string>;

/** meals_per_day column value; null for weekly (use meals_per_delivery). */
export function resolveMealsPerDayColumn(
  purchaseType: PurchaseType,
  parsed: Pick<MealProductDietaryInput, 'mealsPerDayPreset' | 'mealsPerDayCustom'>,
): number | null {
  if (purchaseType === 'WEEKLY_PLAN') return null;
  if (purchaseType === 'MONTHLY_PLAN') {
    return mealsPerDayColumnFromPreset(parsed.mealsPerDayPreset as MealsPerDayPreset);
  }
  const preset = parsed.mealsPerDayPreset as MealsPerDayPreset;
  if (preset === 'CUSTOM') return null;
  return mealsPerDayColumnFromPreset(preset);
}

export function resolveMealsPerDeliveryColumn(
  purchaseType: PurchaseType,
  parsed: Pick<
    MealProductDietaryInput,
    'mealsPerDelivery' | 'mealsPerDeliveryPreset' | 'mealsPerDeliveryCustom'
  >,
): number | null {
  if (purchaseType !== 'WEEKLY_PLAN') return null;
  return resolveMealsPerDeliveryNumeric(parsed);
}

export function resolveDeliveryDaysColumn(
  purchaseType: PurchaseType,
  deliveryDays: string[],
): string[] | null {
  if (purchaseType !== 'WEEKLY_PLAN' || !deliveryDays?.length) return null;
  return [...deliveryDays];
}

export function resolveDeliveryFrequencyColumn(
  purchaseType: PurchaseType,
  deliveryFrequency?: string,
): string | null {
  if (purchaseType !== 'MONTHLY_PLAN' || !deliveryFrequency) return null;
  return String(deliveryFrequency).trim().toUpperCase();
}

export function buildSubscriptionConfigColumn(
  purchaseType: PurchaseType,
  dietaryPayload: Record<string, unknown>,
): Record<string, unknown> | null {
  if (purchaseType === 'ONE_TIME') return null;
  const sc = dietaryPayload.subscriptionConfig;
  if (sc && typeof sc === 'object' && !Array.isArray(sc)) {
    return sc as Record<string, unknown>;
  }
  return {};
}

export type MealProductParsedCore = MealProductDietaryInput & {
  name: string;
  description: string;
  price: number;
};

export function buildMealPlanRowFromProduct(
  vendorId: string,
  parsed: MealProductParsedCore,
  dietaryPayload: Record<string, unknown>,
  mpCols: MealPlanColumnSet,
  opts: { mealImageUrl?: string },
): Record<string, unknown> {
  const pt = parsed.purchaseType;
  const mealsPerDay = resolveMealsPerDayColumn(pt, parsed);
  const mealsPerDelivery = resolveMealsPerDeliveryColumn(pt, parsed);
  const deliveryDays = resolveDeliveryDaysColumn(pt, parsed.deliveryDays);
  const deliveryFrequency = resolveDeliveryFrequencyColumn(pt, parsed.deliveryFrequency);

  const row: Record<string, unknown> = {
    vendor_id: vendorId,
    plan_name: parsed.name,
    description: parsed.description,
    price_per_meal: parsed.price,
    price: parsed.price,
    duration_days: parsed.shelfLifeDays,
    dietary_requirements: JSON.stringify(dietaryPayload),
    is_active: true,
  };

  if (mealsPerDay != null && mpCols.has('meals_per_day')) {
    row.meals_per_day = mealsPerDay;
  } else if (pt === 'WEEKLY_PLAN' && mpCols.has('meals_per_day')) {
    row.meals_per_day = null;
  }

  if (mpCols.has('purchase_type')) row.purchase_type = pt;
  if (mpCols.has('subscription_config')) {
    row.subscription_config = buildSubscriptionConfigColumn(pt, dietaryPayload) ?? {};
  }
  if (mpCols.has('prep_time_minutes')) row.prep_time_minutes = parsed.preparationLeadTime;
  if (mpCols.has('lead_time_hours')) row.lead_time_hours = parsed.leadTimeHours;
  if (mpCols.has('order_cutoff_time')) row.order_cutoff_time = parsed.orderCutoffTime;
  if (mpCols.has('shelf_life_days')) row.shelf_life_days = parsed.shelfLifeDays;
  if (mpCols.has('storage_instructions')) row.storage_instructions = parsed.storageInstructions ?? null;
  if (mpCols.has('serving_instructions')) row.serving_instructions = parsed.feedingInstructions ?? null;
  if (mpCols.has('allergens') && parsed.allergens?.length) row.allergens = parsed.allergens;
  if (mpCols.has('ingredients')) row.ingredients = JSON.stringify(parsed.ingredients);

  if (mpCols.has('pack_weight_grams')) row.pack_weight_grams = parsed.packWeightGrams;
  if (mpCols.has('meals_per_delivery') && mealsPerDelivery != null) {
    row.meals_per_delivery = mealsPerDelivery;
  }
  if (mpCols.has('delivery_days') && deliveryDays) row.delivery_days = deliveryDays;
  if (mpCols.has('delivery_frequency') && deliveryFrequency) {
    row.delivery_frequency = deliveryFrequency;
  }
  if (mpCols.has('subscription_price') && parsed.subscriptionPrice != null) {
    row.subscription_price = parsed.subscriptionPrice;
  }
  if (mpCols.has('recommended_plan_weeks') && parsed.recommendedPlanLengthWeeks) {
    row.recommended_plan_weeks = parsed.recommendedPlanLengthWeeks;
  }
  if (mpCols.has('preparation_type')) row.preparation_type = parsed.preparationType;
  if (mpCols.has('diet_type')) row.diet_type = parsed.dietType;
  if (mpCols.has('pet_types') && parsed.petTypes?.length) row.pet_types = parsed.petTypes;
  if (mpCols.has('meal_categories') && parsed.mealCategories?.length) {
    row.meal_categories = parsed.mealCategories;
  }
  if (mpCols.has('medical_condition_tags') && parsed.medicalConditionTags?.length) {
    row.medical_condition_tags = parsed.medicalConditionTags;
  }
  const imageUrl = opts.mealImageUrl?.trim();
  if (mpCols.has('meal_image_url') && imageUrl) row.meal_image_url = imageUrl;

  return row;
}

/** Appends parameterized SET clauses for meal_plans PUT (after core $1–$6). */
export function pushMealPlanStructuredUpdates(
  mpCols: MealPlanColumnSet,
  parsed: MealProductParsedCore,
  dietaryPayload: Record<string, unknown>,
  opts: { mealImageUrl?: string },
  ctx: { nextPh: number; extras: string; mpParams: unknown[] },
): void {
  let { nextPh, extras, mpParams } = ctx;
  const pt = parsed.purchaseType;

  const push = (col: string, value: unknown, coalesce = false) => {
    if (!mpCols.has(col)) return;
    nextPh += 1;
    extras += coalesce
      ? `, ${col} = COALESCE($${nextPh}, ${col})`
      : `, ${col} = $${nextPh}`;
    mpParams.push(value);
  };

  push('prep_time_minutes', parsed.preparationLeadTime, true);
  push('lead_time_hours', parsed.leadTimeHours, true);
  push('order_cutoff_time', parsed.orderCutoffTime, true);
  push('shelf_life_days', parsed.shelfLifeDays, true);
  push('storage_instructions', parsed.storageInstructions ?? null, true);
  push('serving_instructions', parsed.feedingInstructions ?? null, true);
  if (mpCols.has('allergens')) push('allergens', parsed.allergens ?? []);
  if (mpCols.has('ingredients')) {
    nextPh += 1;
    extras += `, ingredients = $${nextPh}::jsonb`;
    mpParams.push(JSON.stringify(parsed.ingredients));
  }
  push('purchase_type', pt);
  if (mpCols.has('subscription_config')) {
    nextPh += 1;
    extras += `, subscription_config = $${nextPh}::jsonb`;
    mpParams.push(JSON.stringify(buildSubscriptionConfigColumn(pt, dietaryPayload) ?? {}));
  }
  push('pack_weight_grams', parsed.packWeightGrams);
  const mealsPerDelivery = resolveMealsPerDeliveryColumn(pt, parsed);
  if (mealsPerDelivery != null) push('meals_per_delivery', mealsPerDelivery);
  const deliveryDays = resolveDeliveryDaysColumn(pt, parsed.deliveryDays);
  if (deliveryDays) push('delivery_days', deliveryDays);
  const deliveryFrequency = resolveDeliveryFrequencyColumn(pt, parsed.deliveryFrequency);
  if (deliveryFrequency) push('delivery_frequency', deliveryFrequency);
  if (parsed.subscriptionPrice != null) push('subscription_price', parsed.subscriptionPrice);
  if (parsed.recommendedPlanLengthWeeks) {
    push('recommended_plan_weeks', parsed.recommendedPlanLengthWeeks);
  }
  push('preparation_type', parsed.preparationType);
  push('diet_type', parsed.dietType);
  if (parsed.petTypes?.length) push('pet_types', parsed.petTypes);
  if (parsed.mealCategories?.length) push('meal_categories', parsed.mealCategories);
  if (parsed.medicalConditionTags?.length) {
    push('medical_condition_tags', parsed.medicalConditionTags);
  }
  const imageUrl = opts.mealImageUrl?.trim();
  if (imageUrl) push('meal_image_url', imageUrl);

  if (pt === 'WEEKLY_PLAN' && mpCols.has('meals_per_day')) {
    nextPh += 1;
    extras += `, meals_per_day = $${nextPh}`;
    mpParams.push(null);
  }

  ctx.nextPh = nextPh;
  ctx.extras = extras;
  ctx.mpParams = mpParams;
}

/** Merge DB row + dietary JSON for vendor/customer API (column wins over JSON). */
export function mergeMealPlanCatalogForApi(
  mp: Record<string, unknown>,
  dietaryRaw: unknown,
): Record<string, unknown> {
  const d = parseMealPlanDietaryJson(dietaryRaw);
  const prepMins =
    mp.prep_time_minutes != null
      ? Number(mp.prep_time_minutes)
      : (d.prepTimeMinutes ?? d.preparationLeadTime);
  const leadHrs = mp.lead_time_hours != null ? Number(mp.lead_time_hours) : d.leadTimeHours;
  const cutoff =
    typeof mp.order_cutoff_time === 'string' && mp.order_cutoff_time
      ? mp.order_cutoff_time
      : d.orderCutoffTime;
  const packFromCol =
    mp.pack_weight_grams != null ? Number(mp.pack_weight_grams) : null;
  const packWeightGrams =
    packFromCol != null && Number.isFinite(packFromCol) && packFromCol >= 1
      ? packFromCol
      : resolvePackWeightGramsFromDietary(d);

  const purchaseType = String(mp.purchase_type || d.purchaseType || 'ONE_TIME').toUpperCase();

  const mealsPerDelivery =
    mp.meals_per_delivery != null
      ? Number(mp.meals_per_delivery)
      : d.mealsPerDelivery != null
        ? Number(d.mealsPerDelivery)
        : undefined;

  const deliveryDays = Array.isArray(mp.delivery_days)
    ? (mp.delivery_days as string[])
    : Array.isArray(d.deliveryDays)
      ? (d.deliveryDays as string[])
      : [];

  const deliveryFrequency =
    (typeof mp.delivery_frequency === 'string' && mp.delivery_frequency) ||
    (typeof d.deliveryFrequency === 'string' && d.deliveryFrequency) ||
    undefined;

  const mealsPerDay =
    purchaseType === 'WEEKLY_PLAN'
      ? undefined
      : mp.meals_per_day != null
        ? Number(mp.meals_per_day)
        : d.mealsPerDay;

  return {
    ...d,
    purchaseType,
    purchase_type: purchaseType,
    packWeightGrams: packWeightGrams ?? d.packWeightGrams,
    prepTimeMinutes: prepMins,
    preparationLeadTime: prepMins,
    leadTimeHours: leadHrs,
    orderCutoffTime: cutoff,
    mealImageUrl:
      (typeof mp.meal_image_url === 'string' && mp.meal_image_url) ||
      d.mealImageUrl,
    preparationType: mp.preparation_type || d.preparationType,
    dietType: mp.diet_type || d.dietType,
    petTypes: Array.isArray(mp.pet_types) ? mp.pet_types : d.petTypes,
    mealCategories: Array.isArray(mp.meal_categories) ? mp.meal_categories : d.mealCategories,
    medicalConditionTags: Array.isArray(mp.medical_condition_tags)
      ? mp.medical_condition_tags
      : d.medicalConditionTags,
    deliveryDays,
    mealsPerDelivery,
    deliveryFrequency,
    mealsPerDay,
    subscriptionPrice:
      mp.subscription_price != null ? Number(mp.subscription_price) : d.subscriptionPrice,
    recommendedPlanLengthWeeks:
      mp.recommended_plan_weeks != null
        ? Number(mp.recommended_plan_weeks)
        : d.recommendedPlanLengthWeeks,
    shelfLifeDays:
      mp.shelf_life_days != null
        ? Number(mp.shelf_life_days)
        : mp.duration_days != null
          ? Number(mp.duration_days)
          : d.shelfLifeDays,
  };
}

