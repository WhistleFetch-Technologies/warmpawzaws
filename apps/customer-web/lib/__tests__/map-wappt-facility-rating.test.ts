import { mapWapptFacilityRating } from '../map-wappt-facility-rating';

describe('mapWapptFacilityRating', () => {
  it('maps facility API { average, count } to Overview shape', () => {
    expect(mapWapptFacilityRating({ average: 4.5, count: 12 })).toEqual({
      averageRating: 4.5,
      totalReviews: 12,
    });
  });

  it('preserves already-mapped averageRating / totalReviews', () => {
    expect(mapWapptFacilityRating({ averageRating: 4, totalReviews: 3 })).toEqual({
      averageRating: 4,
      totalReviews: 3,
    });
  });

  it('keeps real zero review counts (does not treat 0 as missing)', () => {
    expect(mapWapptFacilityRating({ average: 0, count: 0 })).toEqual({
      averageRating: 0,
      totalReviews: 0,
    });
  });

  it('returns null for empty / invalid payloads', () => {
    expect(mapWapptFacilityRating(null)).toBeNull();
    expect(mapWapptFacilityRating({})).toBeNull();
    expect(mapWapptFacilityRating({ average: 'x', count: 'y' })).toBeNull();
  });
});
