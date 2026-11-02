import { parseBillLineItems } from '../pet-store-walkin';

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
