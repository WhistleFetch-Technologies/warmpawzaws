import {
  mapFacilityRecentReviews,
  mergeProviderAboutFromFacility,
  normalizeFacilityRating,
} from '../universal-provider-profile-enrichment';

describe('universal-provider-profile-enrichment', () => {
  it('maps facility recent reviews', () => {
    const mapped = mapFacilityRecentReviews([
      {
        id: 'r1',
        customerName: 'Alex',
        rating: 5,
        comment: 'Great vet',
        date: '2026-01-01',
      },
    ]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      id: 'r1',
      customerName: 'Alex',
      rating: 5,
      comment: 'Great vet',
    });
  });

  it('merges about fields from facility response', () => {
    const about = mergeProviderAboutFromFacility(
      { qualifications: 'MVSc' },
      {
        vendor: { description: 'Home visit vet' },
        facility: { address: 'MG Road', city: 'Bengaluru', specializations: ['Surgery'] },
      }
    );
    expect(about.bio).toBe('Home visit vet');
    expect(about.qualifications).toBe('MVSc');
    expect(about.address).toBe('MG Road');
    expect(about.city).toBe('Bengaluru');
  });

  it('uses facility.description when provider seed bio is empty', () => {
    const about = mergeProviderAboutFromFacility(
      { bio: '' },
      {
        facility: { description: 'Professional dog walker serving Koramangala' },
        vendor: {},
      }
    );
    expect(about.bio).toBe('Professional dog walker serving Koramangala');
  });

  it('normalizes facility API rating shape average + count', () => {
    expect(normalizeFacilityRating({ average: '5.0', count: 1 })).toEqual({
      averageRating: 5,
      totalReviews: 1,
    });
  });

  it('normalizes legacy averageRating + totalReviews shape', () => {
    expect(normalizeFacilityRating({ averageRating: 4.2, totalReviews: 3 })).toEqual({
      averageRating: 4.2,
      totalReviews: 3,
    });
  });

  it('falls back to recent reviews when aggregate rating is zero', () => {
    expect(
      normalizeFacilityRating(
        { average: 0, count: 0 },
        { recentReviews: [{ rating: 5 }] }
      )
    ).toEqual({
      averageRating: 5,
      totalReviews: 1,
    });
  });
});
