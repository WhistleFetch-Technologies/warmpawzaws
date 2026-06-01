import { generateMealOrderNumber } from '../meal-order-number';

describe('generateMealOrderNumber', () => {
  it('uses ML prefix, YYMMDD, and 4-digit suffix', () => {
    const n = generateMealOrderNumber(new Date('2026-05-27T10:00:00+05:30'));
    expect(n).toMatch(/^ML\d{10}$/);
    expect(n.startsWith('ML260527')).toBe(true);
  });
});
