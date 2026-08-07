import {
  minPriceFromServiceRows,
  priceFromVendorServiceRow,
  priceRangeFromDiscoveryRow,
  priceRangeFromServiceRows,
} from '../nutrition-vendor-price';

describe('nutrition-vendor-price', () => {
  it('priceFromVendorServiceRow prefers price then custom_price then base_price', () => {
    expect(priceFromVendorServiceRow({ price: 800 })).toBe(800);
    expect(priceFromVendorServiceRow({ custom_price: 1500, price: 0 })).toBe(1500);
    expect(priceFromVendorServiceRow({ base_price: 999 })).toBe(999);
    expect(priceFromVendorServiceRow({})).toBeNull();
  });

  it('priceRangeFromDiscoveryRow reads priceMin/priceMax and nested services', () => {
    expect(priceRangeFromDiscoveryRow({ priceMin: 800, priceMax: 1500 })).toEqual({
      priceMin: 800,
      priceMax: 1500,
    });
    expect(
      priceRangeFromDiscoveryRow({
        services: [{ price: 1500 }, { custom_price: 800 }],
      })
    ).toEqual({ priceMin: 800, priceMax: 1500 });
  });

  it('minPriceFromServiceRows returns lowest positive price', () => {
    expect(minPriceFromServiceRows([{ price: 1500 }, { base_price: 800 }])).toBe(800);
    expect(minPriceFromServiceRows([{ price: 0 }])).toBeNull();
  });

  it('priceRangeFromServiceRows returns min and max', () => {
    expect(priceRangeFromServiceRows([{ price: 1500 }, { base_price: 800 }])).toEqual({
      priceMin: 800,
      priceMax: 1500,
    });
  });
});
