import {
  mergeMealPlanCatalogForApi,
  resolveMealsPerDayColumn,
  resolveMealsPerDeliveryColumn,
} from '../../utils/meal-product-persistence';
import type { MealProductParsedCore } from '../../utils/meal-product-persistence';

function baseParsed(purchaseType: MealProductParsedCore['purchaseType']): MealProductParsedCore {
  return {
    name: 'Test',
    description: 'Desc',
    price: 100,
    petTypes: ['Dog'],
    dietType: 'Non-Veg',
    suitableFor: [],
    ingredients: ['rice'],
    nutritionalValue: {},
    preparationLeadTime: 60,
    leadTimeHours: 24,
    orderCutoffTime: '18:00',
    shelfLifeDays: 7,
    mealCategories: ['HOMEMADE_DIET'],
    medicalConditionTags: [],
    deliveryType: 'ONE_TIME',
    purchaseType,
    deliveryDays: ['MONDAY', 'THURSDAY'],
    mealsPerDeliveryPreset: '2',
    mealsPerDeliveryCustom: '',
    mealsPerDayPreset: '2',
    mealsPerDayCustom: '',
    allergens: [],
    preparationType: 'FRESH_COOKED',
    packWeightGrams: 450,
  };
}

describe('meal-product-persistence', () => {
  it('weekly uses meals_per_delivery column not meals_per_day', () => {
    const p = baseParsed('WEEKLY_PLAN');
    expect(resolveMealsPerDayColumn('WEEKLY_PLAN', p)).toBeNull();
    expect(resolveMealsPerDeliveryColumn('WEEKLY_PLAN', p)).toBe(2);
  });

  it('monthly uses meals_per_day column', () => {
    const p = baseParsed('MONTHLY_PLAN');
    p.deliveryFrequency = 'DAILY';
    expect(resolveMealsPerDayColumn('MONTHLY_PLAN', p)).toBe(2);
    expect(resolveMealsPerDeliveryColumn('MONTHLY_PLAN', p)).toBeNull();
  });

  it('merge prefers columns over JSON', () => {
    const merged = mergeMealPlanCatalogForApi(
      {
        purchase_type: 'WEEKLY_PLAN',
        pack_weight_grams: 600,
        meals_per_delivery: 3,
        delivery_days: ['FRIDAY'],
        prep_time_minutes: 45,
      },
      { packWeightGrams: 100, mealsPerDelivery: 1, deliveryDays: ['MONDAY'] },
    );
    expect(merged.packWeightGrams).toBe(600);
    expect(merged.mealsPerDelivery).toBe(3);
    expect(merged.deliveryDays).toEqual(['FRIDAY']);
    expect(merged.prepTimeMinutes).toBe(45);
  });
});
