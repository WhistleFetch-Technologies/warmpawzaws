import { buildWapptByCategoryFeedUrl } from '../wappt-discovery-feed-url';

describe('buildWapptByCategoryFeedUrl', () => {
  it('omits coordinates when the customer location is missing', () => {
    expect(
      buildWapptByCategoryFeedUrl({
        category: 'vet',
        serviceStyle: 'at_center',
        limit: 3,
      }),
    ).toBe(
      '/customer/warmpawz-appointments/discovery/by-category?category=vet&serviceStyle=at_center&limit=3',
    );
  });

  it('appends customer latitude and longitude so the API can return distance', () => {
    const url = buildWapptByCategoryFeedUrl({
      category: 'vet',
      serviceStyle: 'at_center',
      limit: 20,
      latitude: '12.9716',
      longitude: '77.5946',
    });
    expect(url).toContain('latitude=12.9716');
    expect(url).toContain('longitude=77.5946');
  });
});
