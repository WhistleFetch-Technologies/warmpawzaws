import { resolveCustomerVendorAmenities } from '../vendor-display-media';

describe('resolveCustomerVendorAmenities', () => {
  it('reads amenities and customAmenities from facility-shaped payload', () => {
    const resolved = resolveCustomerVendorAmenities({
      amenities: ['parking', 'wifi'],
      customAmenities: ['Suite Room'],
    });
    expect(resolved.amenities).toEqual(['parking', 'wifi']);
    expect(resolved.customAmenities).toEqual(['Suite Room']);
  });

  it('accepts snake_case custom_amenities', () => {
    const resolved = resolveCustomerVendorAmenities({
      amenities: ['ac'],
      custom_amenities: ['Cat ward'],
    });
    expect(resolved.customAmenities).toEqual(['Cat ward']);
  });

  it('returns empty arrays when missing', () => {
    expect(resolveCustomerVendorAmenities(null)).toEqual({
      amenities: [],
      customAmenities: [],
    });
  });
});
