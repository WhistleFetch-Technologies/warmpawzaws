import {
  buildStorefrontDimensions,
  extractDeliveryRegionsFromRow,
  flattenProductForApiResponse,
} from '../product-storefront-normalize';

describe('product-storefront-normalize', () => {
  it('extractDeliveryRegionsFromRow reads metadata.delivery_regions', () => {
    expect(
      extractDeliveryRegionsFromRow({
        metadata: { delivery_regions: ['Mumbai', 'Pune'] },
      }),
    ).toEqual(['Mumbai', 'Pune']);
  });

  it('buildStorefrontDimensions maps specs cm + weight kg', () => {
    expect(
      buildStorefrontDimensions({
        weight: 1.5,
        specifications: {
          length_cm: 10,
          breadth_cm: 20,
          height_cm: 5,
        },
      }),
    ).toEqual({
      length: 10,
      width: 20,
      height: 5,
      weight: 1.5,
    });
  });

  it('flattenProductForApiResponse exposes delivery_regions and dimensions', () => {
    const out = flattenProductForApiResponse({
      id: 'p1',
      name: 'Treats',
      weight: 0.5,
      metadata: { delivery_regions: ['Delhi'] },
      specifications: {
        length_cm: 8,
        breadth_cm: 4,
        height_cm: 2,
        key_features: 'Crunchy',
      },
    });
    expect(out.delivery_regions).toEqual(['Delhi']);
    expect(out.dimensions).toEqual({
      length: 8,
      width: 4,
      height: 2,
      weight: 0.5,
    });
    expect(out.key_features).toBe('Crunchy');
  });
});
