import { z } from 'zod';
import {
  ALLERGEN_TAG_VALUES,
  DAY_OF_WEEK_VALUES,
  DELIVERY_FREQUENCY_VALUES,
  MEAL_CATEGORY_VALUES,
  MEAL_DELIVERY_TYPE_VALUES,
  MEALS_PER_DAY_PRESET_VALUES,
  MEALS_PER_DELIVERY_PRESET_VALUES,
  MEDICAL_CONDITION_TAG_VALUES,
  PREPARATION_TYPE_VALUES,
  PURCHASE_TYPE_VALUES,
  type MealCategory,
  type MealDeliveryType,
  type MedicalConditionTag,
  type PreparationType,
  type PurchaseType,
} from '../constants/meal-product-enums';
import { normalizeIngredientList, resolveMealsPerDayPreset } from '../utils/meal-product-dietary';
import { legacyDeliveryTypeMirror } from '../utils/meal-purchase-metadata';

const FEEDING_INSTRUCTIONS_MAX = 2000;
const STORAGE_INSTRUCTIONS_MAX = 1000;
const MEALS_CUSTOM_MAX = 300;

function enumFrom<const T extends readonly string[]>(values: T) {
  return z.enum(values as unknown as [string, ...string[]]);
}

const mealCategoryEnum = enumFrom(MEAL_CATEGORY_VALUES);
const medicalEnum = enumFrom(MEDICAL_CONDITION_TAG_VALUES);
const deliveryEnum = enumFrom(MEAL_DELIVERY_TYPE_VALUES);
const mealsPresetEnum = enumFrom(MEALS_PER_DAY_PRESET_VALUES);
const mealsPerDeliveryPresetEnum = enumFrom(MEALS_PER_DELIVERY_PRESET_VALUES);
const purchaseTypeEnum = enumFrom(PURCHASE_TYPE_VALUES);
const deliveryFrequencyEnum = enumFrom(DELIVERY_FREQUENCY_VALUES);
const dayOfWeekEnum = enumFrom(DAY_OF_WEEK_VALUES);
const allergenEnum = enumFrom(ALLERGEN_TAG_VALUES);
const preparationEnum = enumFrom(PREPARATION_TYPE_VALUES);

const ingredientsSchema = z.preprocess(
  (v) => normalizeIngredientList(v),
  z.array(z.string().min(1).max(120)).max(80).min(1, 'Add at least one ingredient'),
);

function coerceMealProductRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const o = { ...(raw as Record<string, unknown>) };
  const sc = o.subscriptionConfig;
  if (sc && typeof sc === 'object' && !Array.isArray(sc)) {
    const sub = sc as Record<string, unknown>;
    const lift = (k: string) => {
      if (o[k] == null && sub[k] != null) o[k] = sub[k];
    };
    lift('deliveryFrequency');
    lift('deliveryDays');
    lift('mealsPerDelivery');
    lift('mealsPerDeliveryPreset');
    lift('mealsPerDeliveryCustom');
    lift('recommendedPlanLengthWeeks');
    lift('subscriptionPrice');
    lift('pauseAllowed');
    lift('cancelAnytime');
  }
  if (!o.purchaseType || o.purchaseType === '') {
    const dt = typeof o.deliveryType === 'string' ? o.deliveryType.trim().toUpperCase() : '';
    if (dt === 'WEEKLY_SUBSCRIPTION') o.purchaseType = 'WEEKLY_PLAN';
    else if (dt === 'MONTHLY_SUBSCRIPTION') o.purchaseType = 'MONTHLY_PLAN';
    else o.purchaseType = 'ONE_TIME';
  }
  if (typeof o.purchaseType === 'string') {
    const pt = o.purchaseType.trim().toUpperCase();
    if ((PURCHASE_TYPE_VALUES as readonly string[]).includes(pt)) o.purchaseType = pt;
  }
  if (o.mealsPerDayPreset == null || o.mealsPerDayPreset === '') {
    o.mealsPerDayPreset = resolveMealsPerDayPreset(o);
  }
  if (o.mealsPerDeliveryPreset == null || o.mealsPerDeliveryPreset === '') {
    o.mealsPerDeliveryPreset = '2';
  }
  if (
    (o.shelfLifeDays === undefined || o.shelfLifeDays === null || o.shelfLifeDays === '') &&
    o.shelfLife != null
  ) {
    const n = Number(o.shelfLife as number);
    if (Number.isFinite(n)) o.shelfLifeDays = n;
  }
  if (
    (o.shelfLifeDays === undefined || o.shelfLifeDays === null || o.shelfLifeDays === '') &&
    o.durationDays != null &&
    o.durationDays !== ''
  ) {
    const n = Number(o.durationDays as number);
    if (Number.isFinite(n) && n >= 1 && n <= 365) o.shelfLifeDays = n;
  }
  const ptFinal = String(o.purchaseType || 'ONE_TIME').toUpperCase();
  if ((PURCHASE_TYPE_VALUES as readonly string[]).includes(ptFinal)) {
    o.deliveryType = legacyDeliveryTypeMirror(ptFinal as PurchaseType);
  }
  if (o.prepTimeMinutes != null && o.prepTimeMinutes !== '' && o.preparationLeadTime == null) {
    o.preparationLeadTime = o.prepTimeMinutes;
  }
  return o;
}

const mealProductInnerSchema = z
  .object({
    name: z.string().trim().min(1, 'Meal name is required'),
    description: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v == null ? '' : String(v).trim()))
      .pipe(z.string().min(1, 'Description is required')),
    price: z.coerce.number().finite().positive('Price must be positive'),

    mealImageUrl: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((v) => {
        if (v == null || v === '') return undefined;
        const t = String(v).trim();
        return t.length ? t : undefined;
      }),

    ingredients: ingredientsSchema,

    mealCategories: z.preprocess((v) => {
      const allowed = new Set<string>(MEAL_CATEGORY_VALUES);
      if (!Array.isArray(v)) return ['HOMEMADE_DIET'];
      const filtered = v.filter((x) => typeof x === 'string' && allowed.has(x)) as MealCategory[];
      return filtered.length > 0 ? filtered : ['HOMEMADE_DIET'];
    }, z.array(mealCategoryEnum).min(1, 'Select at least one meal category')),

    medicalConditionTags: z.preprocess((v) => {
      const allowed = new Set<string>(MEDICAL_CONDITION_TAG_VALUES);
      if (!Array.isArray(v)) return [];
      return v.filter((x) => typeof x === 'string' && allowed.has(x)) as MedicalConditionTag[];
    }, z.array(medicalEnum)),

    feedingInstructions: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((v) => {
        if (v == null) return undefined;
        const t = String(v).trim();
        return t.length ? t : undefined;
      })
      .pipe(z.string().max(FEEDING_INSTRUCTIONS_MAX).optional()),

    storageInstructions: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((v) => {
        if (v == null) return undefined;
        const t = String(v).trim();
        return t.length ? t : undefined;
      })
      .pipe(z.string().max(STORAGE_INSTRUCTIONS_MAX).optional()),

    shelfLifeDays: z.coerce.number().int().min(1).max(365),
    shelfLife: z.union([z.coerce.number(), z.string()]).optional(),

    purchaseType: z.preprocess((v) => {
      const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
      if ((PURCHASE_TYPE_VALUES as readonly string[]).includes(s)) return s;
      return 'ONE_TIME';
    }, purchaseTypeEnum),

    /** @deprecated responses still include this for older apps */
    deliveryType: z.preprocess((v) => {
      const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
      if (MEAL_DELIVERY_TYPE_VALUES.includes(s as MealDeliveryType)) return s;
      return 'ONE_TIME';
    }, deliveryEnum),

    subscriptionEnabled: z.coerce.boolean().optional(),

    deliveryFrequency: z.preprocess((v) => {
      const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
      if ((DELIVERY_FREQUENCY_VALUES as readonly string[]).includes(s)) return s;
      return undefined;
    }, deliveryFrequencyEnum.optional()),

    deliveryDays: z.preprocess((v) => {
      const allowed = new Set<string>(DAY_OF_WEEK_VALUES);
      if (!Array.isArray(v)) return [];
      const out: string[] = [];
      for (const x of v) {
        const u = String(x).trim().toUpperCase();
        if (allowed.has(u)) out.push(u);
      }
      return out;
    }, z.array(dayOfWeekEnum)),

    mealsPerDelivery: z.coerce.number().int().min(1).max(50).optional(),
    mealsPerDeliveryPreset: mealsPerDeliveryPresetEnum,
    mealsPerDeliveryCustom: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((v) => (v == null ? undefined : String(v).trim() || undefined))
      .pipe(z.string().max(MEALS_CUSTOM_MAX).optional()),

    recommendedPlanLengthWeeks: z.preprocess((v) => {
      const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
      if (n === 1 || n === 2 || n === 4) return n;
      return undefined;
    }, z.union([z.literal(1), z.literal(2), z.literal(4)]).optional()),

    subscriptionPrice: z.preprocess((v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }, z.number().finite().positive().optional()),

    pauseAllowed: z.coerce.boolean().optional().default(true),
    cancelAnytime: z.coerce.boolean().optional().default(true),

    mealsPerDayPreset: mealsPresetEnum,

    mealsPerDayCustom: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((v) => (v == null ? undefined : String(v).trim() || undefined))
      .pipe(z.string().max(MEALS_CUSTOM_MAX).optional()),

    mealsPerDay: z.coerce.number().int().min(1).max(5).optional(),

    allergens: z.preprocess((v) => {
      const allowed = new Set<string>(ALLERGEN_TAG_VALUES);
      if (!Array.isArray(v)) return [];
      return v.filter((x) => typeof x === 'string' && allowed.has(x));
    }, z.array(allergenEnum)),

    preparationType: z.preprocess((v) => {
      const s = typeof v === 'string' ? v.trim() : '';
      if (PREPARATION_TYPE_VALUES.includes(s as PreparationType)) return s;
      return 'FRESH_COOKED';
    }, preparationEnum),

    petTypes: z.preprocess(
      (v) => (Array.isArray(v) && v.length ? v.map(String) : ['Dog']),
      z.array(z.string().min(1)).min(1),
    ),
    dietType: z.preprocess((v) => (typeof v === 'string' && v.trim() ? String(v).trim() : 'Non-Veg'), z.string().min(1)),
    suitableFor: z.preprocess((v) => (Array.isArray(v) ? v.map(String) : []), z.array(z.string())),
    nutritionalValue: z.preprocess(
      (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
      z.record(z.string(), z.unknown()),
    ),
    /** Kitchen prep duration in minutes (not booking lead time). */
    preparationLeadTime: z.coerce.number().int().min(1).max(24 * 60).optional().default(60),
    /** Minimum hours before first delivery slot (booking policy). */
    leadTimeHours: z.coerce.number().int().min(0).max(168).optional(),
    orderCutoffTime: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((v) => {
        if (v == null || v === '') return undefined;
        const t = String(v).trim();
        return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(t) ? t : undefined;
      }),
    stockQuantity: z.coerce.number().int().min(0).optional(),
    packSize: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((v) => {
        if (v == null) return undefined;
        const t = String(v).trim();
        return t.length ? t.slice(0, 200) : undefined;
      }),
  })
  .superRefine((data, ctx) => {
    if (!data.mealImageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Meal image is required',
        path: ['mealImageUrl'],
      });
    }
    const pt = data.purchaseType as PurchaseType;

    if (pt === 'WEEKLY_PLAN') {
      if (!data.deliveryDays || data.deliveryDays.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select at least one delivery day for weekly plans',
          path: ['deliveryDays'],
        });
      }
      if (data.mealsPerDeliveryPreset === 'CUSTOM') {
        const n = parseInt(String(data.mealsPerDeliveryCustom || '').trim(), 10);
        if (!Number.isFinite(n) || n < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Enter meals per delivery when CUSTOM is selected',
            path: ['mealsPerDeliveryCustom'],
          });
        }
      }
    }

    if (pt === 'MONTHLY_PLAN') {
      if (!data.deliveryFrequency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Delivery frequency is required for monthly nutrition plans',
          path: ['deliveryFrequency'],
        });
      }
      if (data.mealsPerDayPreset === 'CUSTOM' && !(data.mealsPerDayCustom && data.mealsPerDayCustom.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Describe meals per day when CUSTOM is selected',
          path: ['mealsPerDayCustom'],
        });
      }
    }

    if (pt === 'ONE_TIME') {
      if (data.mealsPerDayPreset === 'CUSTOM' && !(data.mealsPerDayCustom && data.mealsPerDayCustom.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Describe meal frequency when CUSTOM is selected',
          path: ['mealsPerDayCustom'],
        });
      }
    }
  });

/**
 * Validates vendor meal product create/update bodies.
 * Required: name, description, mealImageUrl, price, mealCategories (≥1), ingredients (≥1),
 * preparationType, purchaseType (or legacy deliveryType), shelfLifeDays (1–365), petTypes (≥1).
 *
 * Request JSON (camelCase):
 * - purchaseType: ONE_TIME | WEEKLY_PLAN | MONTHLY_PLAN (legacy deliveryType still accepted)
 * - WEEKLY_PLAN: deliveryDays (≥1), mealsPerDeliveryPreset (+ custom when CUSTOM), optional subscriptionPrice
 * - MONTHLY_PLAN: deliveryFrequency, mealsPerDayPreset (+ custom when CUSTOM), optional subscriptionPrice
 * - subscriptionConfig: optional object; fields merge into top-level when provided
 * - deliveryType: deprecated mirror; derived when omitted
 */
export const mealProductRequestSchema = z.preprocess(coerceMealProductRaw, mealProductInnerSchema);

export type MealProductRequestParsed = z.infer<typeof mealProductInnerSchema>;

export function parseMealProductRequest(raw: unknown) {
  return mealProductRequestSchema.safeParse(raw);
}

export function formatMealProductZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
}
