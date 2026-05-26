/**
 * Central enums for nutritionist meal products (vendor catalog + API).
 * Keep in sync with vendor-web `lib/meal-product-catalog.ts` labels.
 */

export const MEAL_CATEGORY_VALUES = [
  'WEIGHT_LOSS',
  'WEIGHT_GAIN',
  'KIDNEY_SUPPORT',
  'ALLERGY_FRIENDLY',
  'PUPPY_GROWTH',
  'SENIOR_CARE',
  'DIABETIC_SUPPORT',
  'HIGH_PROTEIN',
  'GUT_HEALTH',
  'HOMEMADE_DIET',
] as const;

export type MealCategory = (typeof MEAL_CATEGORY_VALUES)[number];

export const MEDICAL_CONDITION_TAG_VALUES = [
  'OBESITY',
  'KIDNEY_ISSUES',
  'SKIN_ALLERGIES',
  'DIABETES',
  'DIGESTIVE_ISSUES',
  'JOINT_PAIN',
  'SENSITIVE_STOMACH',
] as const;

export type MedicalConditionTag = (typeof MEDICAL_CONDITION_TAG_VALUES)[number];

/** @deprecated Legacy API/catalog field; mirror of purchaseType for backward compatibility */
export const MEAL_DELIVERY_TYPE_VALUES = ['ONE_TIME', 'WEEKLY_SUBSCRIPTION', 'MONTHLY_SUBSCRIPTION'] as const;

export type MealDeliveryType = (typeof MEAL_DELIVERY_TYPE_VALUES)[number];

export const PURCHASE_TYPE_VALUES = ['ONE_TIME', 'WEEKLY_PLAN', 'MONTHLY_PLAN'] as const;

export type PurchaseType = (typeof PURCHASE_TYPE_VALUES)[number];

export const DELIVERY_FREQUENCY_VALUES = ['DAILY', 'ALTERNATE_DAYS', 'TWICE_WEEKLY', 'WEEKLY'] as const;

export type DeliveryFrequency = (typeof DELIVERY_FREQUENCY_VALUES)[number];

export const DAY_OF_WEEK_VALUES = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type DayOfWeek = (typeof DAY_OF_WEEK_VALUES)[number];

/** Meals dropped off per weekly route visit */
export const MEALS_PER_DELIVERY_PRESET_VALUES = ['1', '2', '3', 'CUSTOM'] as const;

export type MealsPerDeliveryPreset = (typeof MEALS_PER_DELIVERY_PRESET_VALUES)[number];

export const MEALS_PER_DAY_PRESET_VALUES = ['1', '2', '3', 'CUSTOM'] as const;

export type MealsPerDayPreset = (typeof MEALS_PER_DAY_PRESET_VALUES)[number];

export const ALLERGEN_TAG_VALUES = [
  'CHICKEN',
  'DAIRY',
  'GRAINS',
  'FISH',
  'EGG',
  'PEANUT',
  'SOY',
] as const;

export type AllergenTag = (typeof ALLERGEN_TAG_VALUES)[number];

export const PREPARATION_TYPE_VALUES = [
  'FRESH_COOKED',
  'FREEZE_DRIED',
  'RAW',
  'DEHYDRATED',
  'HOMEMADE',
] as const;

export type PreparationType = (typeof PREPARATION_TYPE_VALUES)[number];
