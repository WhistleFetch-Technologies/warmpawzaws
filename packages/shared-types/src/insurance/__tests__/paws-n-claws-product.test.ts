import {
  isPawsCoverageSelectionValid,
  validatePawsCoverageSelection,
} from '../paws-n-claws-product';

describe('Paws N Claws coverage rules', () => {
  it('accepts comprehensive with copay and add-ons', () => {
    expect(
      isPawsCoverageSelectionValid({
        mainSection: 'comprehensive',
        sumInsured: 100_000,
        copayPercent: 10,
        addons: ['veterinary_consultation'],
      }),
    ).toBe(true);
  });

  it('rejects third-party with add-ons', () => {
    const issues = validatePawsCoverageSelection({
      mainSection: 'third_party',
      sumInsured: 100_000,
      copayPercent: null,
      addons: ['funeral_expenses'],
    });
    expect(issues.some((i) => i.code === 'ADDONS_BLOCKED_WITH_TPL')).toBe(true);
  });

  it('requires MYO cover selection', () => {
    const issues = validatePawsCoverageSelection({
      mainSection: 'make_your_own',
      myoCovers: [],
      sumInsured: 50_000,
      copayPercent: null,
      addons: [],
    });
    expect(issues.some((i) => i.code === 'MYO_COVER_REQUIRED')).toBe(true);
  });
});
