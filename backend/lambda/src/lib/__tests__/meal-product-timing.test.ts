import {
  resolveLeadTimeHours,
  resolvePrepTimeMinutes,
} from '../../utils/meal-product-timing';

describe('meal-product-timing', () => {
  it('uses prep minutes only for kitchen prep, not booking lead', () => {
    expect(
      resolvePrepTimeMinutes({ preparationLeadTime: 10 }, null),
    ).toBe(10);
    expect(
      resolveLeadTimeHours({ preparationLeadTime: 10 }, null, 24),
    ).toBe(24);
  });

  it('prefers explicit leadTimeHours over legacy prep field', () => {
    expect(
      resolveLeadTimeHours(
        { preparationLeadTime: 10, leadTimeHours: 4 },
        null,
        24,
      ),
    ).toBe(4);
  });

  it('reads lead from meal_plans row when metadata missing', () => {
    expect(resolveLeadTimeHours({}, 6, 24)).toBe(6);
  });
});
