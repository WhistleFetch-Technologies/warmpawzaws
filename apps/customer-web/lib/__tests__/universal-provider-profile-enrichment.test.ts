import {
  mapFacilityRecentReviews,
  mergeProviderAboutFromFacility,
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
});
