import {
  parseMealPlanDietaryJson,
  resolvePackWeightGramsFromDietary,
} from '../../utils/meal-pack-weight';

describe('meal-pack-weight', () => {
  it('reads packWeightGrams from dietary JSON', () => {
    expect(resolvePackWeightGramsFromDietary({ packWeightGrams: 350 })).toBe(350);
  });

  it('supports legacy key aliases', () => {
    expect(resolvePackWeightGramsFromDietary({ weight_g: 500 })).toBe(500);
    expect(resolvePackWeightGramsFromDietary({ pack_weight_grams: 250 })).toBe(250);
  });

  it('parses simple packSize strings', () => {
    expect(resolvePackWeightGramsFromDietary({ packSize: '500g' })).toBe(500);
  });

  it('returns null when missing', () => {
    expect(resolvePackWeightGramsFromDietary({})).toBeNull();
  });

  it('parses dietary_requirements JSON string', () => {
    const d = parseMealPlanDietaryJson(JSON.stringify({ packWeightGrams: 400 }));
    expect(resolvePackWeightGramsFromDietary(d)).toBe(400);
  });
});
