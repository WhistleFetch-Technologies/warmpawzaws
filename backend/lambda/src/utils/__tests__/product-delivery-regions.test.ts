import {
  deliveryBlockMessage,
  isProductDeliverableToCity,
  normalizeCity,
  parseDeliveryRegionsCsv,
} from '@warmpawz/shared-types';

describe('product delivery regions', () => {
  it('normalizeCity trims and lowercases', () => {
    expect(normalizeCity('  Mumbai  ')).toBe('mumbai');
  });

  it('parseDeliveryRegionsCsv splits comma-separated cities', () => {
    expect(parseDeliveryRegionsCsv('Mumbai, Pune; Delhi')).toEqual([
      'Mumbai',
      'Pune',
      'Delhi',
    ]);
  });

  it('empty regions ships everywhere', () => {
    expect(isProductDeliverableToCity([], 'Mumbai')).toBe(true);
    expect(isProductDeliverableToCity(undefined, 'Mumbai')).toBe(true);
  });

  it('empty customer city allows browse', () => {
    expect(isProductDeliverableToCity(['Mumbai'], '')).toBe(true);
    expect(isProductDeliverableToCity(['Mumbai'], null)).toBe(true);
  });

  it('matches city case-insensitively', () => {
    expect(isProductDeliverableToCity(['Mumbai', 'Pune'], 'mumbai')).toBe(true);
    expect(isProductDeliverableToCity(['Mumbai'], 'Pune')).toBe(false);
  });

  it('deliveryBlockMessage includes product and allowed cities', () => {
    const msg = deliveryBlockMessage('Dog Food', 'Chennai', ['Mumbai', 'Pune']);
    expect(msg).toContain('Dog Food');
    expect(msg).toContain('Chennai');
    expect(msg).toContain('Mumbai');
  });
});
