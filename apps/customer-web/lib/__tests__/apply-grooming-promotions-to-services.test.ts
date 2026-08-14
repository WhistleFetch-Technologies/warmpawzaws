import { applyGroomingPromotionsToServices } from '../apply-grooming-promotions-to-services';

const warm10 = {
  id: 'warm10',
  applicable_services: [] as string[],
  applicable_roles: [] as string[],
  start_date: '2026-07-20',
  end_date: '2026-08-24',
  is_active: true,
  discount_type: 'percentage' as const,
  discount_value: '10',
};

describe('applyGroomingPromotionsToServices', () => {
  it('keeps list price 1650 and puts the 10% sale on discount fields', () => {
    const [row] = applyGroomingPromotionsToServices(
      [{ id: 'pkg3', price: 1650 }],
      [warm10],
      'grooming'
    );
    expect(row.price).toBe(1650);
    expect(row.originalPrice).toBe(1650);
    expect(row.discountPercentage).toBe(10);
    expect(row.discountAmount).toBe(165);
    expect(row.promotionId).toBe('warm10');
  });

  it('leaves price unchanged when no promotions apply', () => {
    const [row] = applyGroomingPromotionsToServices(
      [{ id: 'pkg3', price: 1650 }],
      [],
      'grooming'
    );
    expect(row.price).toBe(1650);
    expect(row.originalPrice).toBeUndefined();
  });
});
