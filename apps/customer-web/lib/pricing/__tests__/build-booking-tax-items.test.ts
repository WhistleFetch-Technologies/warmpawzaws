import { buildBookingTaxCalculateItems } from '../build-booking-tax-items';

describe('buildBookingTaxCalculateItems', () => {
  test('sends one TaxItem per selected service, not a combined amount', () => {
    const items = buildBookingTaxCalculateItems({
      selectedServices: [
        { id: 'vet', name: 'Consult', price: 1000, category: 'veterinary' },
        { id: 'diag', name: 'Blood test', price: 1000, category: 'diagnostic' },
      ],
      fallbackServiceId: 'vet',
      fallbackAmount: 2000,
      serviceStyle: 'at_center',
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ serviceId: 'vet', amount: 1000, category: 'veterinary' });
    expect(items[1]).toMatchObject({ serviceId: 'diag', amount: 1000, category: 'diagnostic' });
    expect(items.some((item) => item.amount === 2000)).toBe(false);
  });

  test('order of selected services does not change per-line amounts', () => {
    const a = buildBookingTaxCalculateItems({
      selectedServices: [
        { id: 'vet', price: 1000 },
        { id: 'diag', price: 1000 },
      ],
      fallbackAmount: 2000,
    });
    const b = buildBookingTaxCalculateItems({
      selectedServices: [
        { id: 'diag', price: 1000 },
        { id: 'vet', price: 1000 },
      ],
      fallbackAmount: 2000,
    });
    expect(a.map((item) => item.amount).sort()).toEqual(b.map((item) => item.amount).sort());
  });

  test('uses customer list price, not a commission-reduced amount', () => {
    const items = buildBookingTaxCalculateItems({
      selectedServices: [{ id: 'vet', originalPrice: 1000, price: 900 }],
      fallbackAmount: 1000,
    });
    expect(items[0].amount).toBe(1000);
  });

  test('coupon allocation keeps two-decimal remainder on the last line', () => {
    const items = buildBookingTaxCalculateItems({
      selectedServices: [
        { id: 'vet', price: 1000 },
        { id: 'diag', price: 1000 },
        { id: 'groom', price: 1000 },
      ],
      fallbackAmount: 1000,
    });
    const amounts = items.map((item) => Number(item.amount));
    expect(amounts.reduce((sum, n) => Math.round((sum + n) * 100) / 100, 0)).toBe(1000);
    expect(amounts).toEqual([333.33, 333.33, 333.34]);
  });
});
