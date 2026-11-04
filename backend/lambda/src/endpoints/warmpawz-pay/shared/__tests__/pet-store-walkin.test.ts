import { parseBillLineItems, requiresBillProof } from '../pet-store-walkin';

describe('requiresBillProof', () => {
  it('uses catalogue require_bill when true', () => {
    expect(
      requiresBillProof({ requireBill: true, roleName: 'pet_groomer' }),
    ).toBe(true);
  });

  it('uses catalogue require_bill when false even for walk-in role', () => {
    expect(
      requiresBillProof({ requireBill: false, roleName: 'pet_store_walkin' }),
    ).toBe(false);
  });

  it('falls back to walk-in role when require_bill is unknown', () => {
    expect(requiresBillProof({ roleName: 'pet_store_walkin' })).toBe(true);
    expect(requiresBillProof({ requireBill: null, roleName: 'pet_store_walkin' })).toBe(
      true,
    );
    expect(requiresBillProof({ roleName: 'pet_groomer' })).toBe(false);
  });
});

describe('parseBillLineItems', () => {
  it('reads item, quantity, and total and skips junk', () => {
    expect(
      parseBillLineItems([
        { item: ' Pedigree  ', quantity: '2', total: '499.5' },
        { item: '', quantity: 1, total: 10 },
        { item: 'Collar', quantity: -1, total: 20 },
        { item: 'Bowl', quantity: 1, total: 80 },
      ]),
    ).toEqual([
      { item: 'Pedigree', quantity: 2, total: 499.5 },
      { item: 'Bowl', quantity: 1, total: 80 },
    ]);
  });

  it('returns empty for non-arrays', () => {
    expect(parseBillLineItems(null)).toEqual([]);
    expect(parseBillLineItems({})).toEqual([]);
  });
});
