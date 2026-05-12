/** Labels for vendor meal product enums — keep aligned with backend meal-product-enums.ts */

export const MEAL_CATEGORY_OPTIONS = [
  { value: 'WEIGHT_LOSS', label: 'Weight loss' },
  { value: 'WEIGHT_GAIN', label: 'Weight gain' },
  { value: 'KIDNEY_SUPPORT', label: 'Kidney support' },
  { value: 'ALLERGY_FRIENDLY', label: 'Allergy friendly' },
  { value: 'PUPPY_GROWTH', label: 'Puppy growth' },
  { value: 'SENIOR_CARE', label: 'Senior care' },
  { value: 'DIABETIC_SUPPORT', label: 'Diabetic support' },
  { value: 'HIGH_PROTEIN', label: 'High protein' },
  { value: 'GUT_HEALTH', label: 'Gut health' },
  { value: 'HOMEMADE_DIET', label: 'Homemade diet' },
] as const;

export const MEDICAL_TAG_OPTIONS = [
  { value: 'OBESITY', label: 'Obesity' },
  { value: 'KIDNEY_ISSUES', label: 'Kidney issues' },
  { value: 'SKIN_ALLERGIES', label: 'Skin allergies' },
  { value: 'DIABETES', label: 'Diabetes' },
  { value: 'DIGESTIVE_ISSUES', label: 'Digestive issues' },
  { value: 'JOINT_PAIN', label: 'Joint pain' },
  { value: 'SENSITIVE_STOMACH', label: 'Sensitive stomach' },
] as const;

/** Vendor catalog purchase modes — aligned with backend PURCHASE_TYPE_VALUES */
export const PURCHASE_TYPE_OPTIONS = [
  { value: 'ONE_TIME', label: 'Buy Once' },
  { value: 'WEEKLY_PLAN', label: 'Weekly Meal Plan' },
  { value: 'MONTHLY_PLAN', label: 'Monthly Nutrition Plan' },
] as const;

export const DAY_OF_WEEK_OPTIONS = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
] as const;

export const DELIVERY_FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'ALTERNATE_DAYS', label: 'Alternate Days' },
  { value: 'TWICE_WEEKLY', label: 'Twice Weekly' },
  { value: 'WEEKLY', label: 'Weekly' },
] as const;

export const MEALS_PER_DELIVERY_PRESET_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const RECOMMENDED_PLAN_WEEKS_OPTIONS = [
  { value: '1', label: '1 week' },
  { value: '2', label: '2 weeks' },
  { value: '4', label: '4 weeks' },
] as const;

/** @deprecated Use PURCHASE_TYPE_OPTIONS */
export const DELIVERY_TYPE_OPTIONS = PURCHASE_TYPE_OPTIONS;

export const ALLERGEN_OPTIONS = [
  { value: 'CHICKEN', label: 'Chicken' },
  { value: 'DAIRY', label: 'Dairy' },
  { value: 'GRAINS', label: 'Grains' },
  { value: 'FISH', label: 'Fish' },
  { value: 'EGG', label: 'Egg' },
  { value: 'PEANUT', label: 'Peanut' },
  { value: 'SOY', label: 'Soy' },
] as const;

export const PREPARATION_TYPE_OPTIONS = [
  { value: 'FRESH_COOKED', label: 'Fresh cooked', hint: 'Made to order' },
  { value: 'FREEZE_DRIED', label: 'Freeze dried', hint: 'Lightweight & shelf-stable' },
  { value: 'RAW', label: 'Raw', hint: 'Uncooked / barf-style' },
  { value: 'DEHYDRATED', label: 'Dehydrated', hint: 'Gently dried' },
  { value: 'HOMEMADE', label: 'Homemade', hint: 'Kitchen-prepared' },
] as const;

export type MealsPerDayPreset = '1' | '2' | '3' | 'CUSTOM';

export type MealsPerDeliveryPreset = '1' | '2' | '3' | 'CUSTOM';
