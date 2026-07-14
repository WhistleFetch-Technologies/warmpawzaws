import {
  applyMaximumDiscount,
  benefitAmountsWithinTolerance,
  calculateRemainingAmount,
  clampNonNegative,
  computeFlatDiscount,
  computePercentageDiscount,
  safeCurrencyMath,
} from '../math';
import { PercentageBenefitStrategy } from '../strategies/percentage-benefit.strategy';
import { FlatBenefitStrategy } from '../strategies/flat-benefit.strategy';
import { BogoBenefitStrategy } from '../strategies/bogo-benefit.strategy';
import { BundleBenefitStrategy } from '../strategies/bundle-benefit.strategy';
import { ComboBenefitStrategy } from '../strategies/combo-benefit.strategy';
import { resolveDiscountWithLegacyFallback } from '../compare';

describe('benefit-engine math', () => {
  it('computePercentageDiscount', () => {
    expect(computePercentageDiscount(1000, 10)).toBe(100);
    expect(computePercentageDiscount(0, 10)).toBe(0);
    expect(computePercentageDiscount(100, 0)).toBe(0);
  });

  it('computeFlatDiscount', () => {
    expect(computeFlatDiscount(50)).toBe(50);
    expect(computeFlatDiscount(-5)).toBe(0);
  });

  it('applyMaximumDiscount caps and clamps to base', () => {
    expect(applyMaximumDiscount(200, 150, 1000)).toBe(150);
    expect(applyMaximumDiscount(500, null, 300)).toBe(300);
    expect(applyMaximumDiscount(-10, null, 100)).toBe(0);
    // 0 means unlimited (seller UI stores 0.00 instead of null)
    expect(applyMaximumDiscount(200, 0, 1000)).toBe(200);
  });

  it('percentage with cap', () => {
    const raw = computePercentageDiscount(1000, 50);
    expect(applyMaximumDiscount(raw, 200, 1000)).toBe(200);
  });

  it('flat greater than order amount clamps via maxBase', () => {
    expect(applyMaximumDiscount(computeFlatDiscount(500), null, 200)).toBe(200);
  });

  it('zero and negative protection', () => {
    expect(safeCurrencyMath(NaN)).toBe(0);
    expect(clampNonNegative(-5)).toBe(0);
    expect(calculateRemainingAmount(100, 150)).toBe(0);
  });

  it('large amount and decimals', () => {
    const d = computePercentageDiscount(999999.99, 12.5);
    expect(d).toBeCloseTo(124999.99875, 2);
  });

  it('legacy fallback returns legacy on mismatch', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveDiscountWithLegacyFallback('test', 100, 50)).toBe(100);
    expect(resolveDiscountWithLegacyFallback('test', 100, 100)).toBe(100);
    expect(resolveDiscountWithLegacyFallback('test', 100, 100.5)).toBe(100.5);
    spy.mockRestore();
  });

  it('benefitAmountsWithinTolerance', () => {
    expect(benefitAmountsWithinTolerance(100, 100.5)).toBe(true);
    expect(benefitAmountsWithinTolerance(100, 102)).toBe(false);
  });
});

describe('benefit strategies', () => {
  const percentage = new PercentageBenefitStrategy();
  const flat = new FlatBenefitStrategy();
  const bogo = new BogoBenefitStrategy();
  const bundle = new BundleBenefitStrategy();
  const combo = new ComboBenefitStrategy();

  it('percentage strategy', () => {
    const result = percentage.calculate({
      originalAmount: 1000,
      currentAmount: 1000,
      eligibleAmount: 1000,
      discountType: 'percentage',
      discountValue: 10,
    });
    expect(result.discountAmount).toBe(100);
    expect(result.finalAmount).toBe(900);
  });

  it('flat strategy', () => {
    const result = flat.calculate({
      originalAmount: 500,
      currentAmount: 500,
      discountType: 'fixed',
      discountValue: 75,
    });
    expect(result.discountAmount).toBe(75);
  });

  it('BOGO strategy cheapest items', () => {
    const result = bogo.calculate({
      originalAmount: 250,
      currentAmount: 250,
      benefitType: 'buy_x_get_y',
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 100,
      items: [
        { productId: 'a', quantity: 1, unitPrice: 100 },
        { productId: 'b', quantity: 2, unitPrice: 50 },
      ],
    });
    expect(result.discountAmount).toBe(50);
  });

  it('bundle strategy', () => {
    const result = bundle.calculate({
      originalAmount: 250,
      currentAmount: 250,
      benefitType: 'bundle',
      bundleProductIds: ['p1', 'p2'],
      bundleDiscountPercent: 10,
      items: [
        { productId: 'p1', quantity: 2, unitPrice: 100 },
        { productId: 'p2', quantity: 1, unitPrice: 50 },
      ],
    });
    expect(result.discountAmount).toBe(25);
  });

  it('combo strategy', () => {
    const result = combo.calculate({
      originalAmount: 800,
      currentAmount: 800,
      benefitType: 'combo',
      comboDiscountPercent: 15,
    });
    expect(result.discountAmount).toBe(120);
  });
});
