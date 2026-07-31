import type { FeaturedProvider } from '@/lib/featured-provider';
import { mergeWalkInDiscoveryBatches } from '@/lib/mergeWalkInDiscoveryBatches';

function provider(
  id: string,
  distanceKm: number | null,
  displayName = id
): FeaturedProvider {
  return {
    id,
    displayName,
    subtitle: 'Test',
    photoUrl: null,
    rating: 4,
    reviewCount: 1,
    distanceKm,
    experienceYears: null,
    fromPrice: 499,
    priceLabel: 'per visit',
  };
}

describe('mergeWalkInDiscoveryBatches', () => {
  it('merges batches and sorts by nearest distance', () => {
    const result = mergeWalkInDiscoveryBatches([
      { category: 'vet', providers: [provider('v1', 3.2), provider('v2', 1.1)] },
      { category: 'grooming', providers: [provider('g1', 2.0)] },
    ]);

    expect(result.map((p) => p.id)).toEqual(['v2', 'g1', 'v1']);
    expect(result[0].category).toBe('vet');
    expect(result[1].category).toBe('grooming');
  });

  it('dedupes by id and keeps nearer copy across categories', () => {
    const result = mergeWalkInDiscoveryBatches([
      { category: 'vet', providers: [provider('same', 5.0)] },
      { category: 'grooming', providers: [provider('same', 1.5)] },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('same');
    expect(result[0].category).toBe('grooming');
    expect(result[0].distanceKm).toBe(1.5);
  });

  it('places null distances last', () => {
    const result = mergeWalkInDiscoveryBatches([
      {
        category: 'vet',
        providers: [provider('far', null), provider('near', 0.5)],
      },
    ]);

    expect(result.map((p) => p.id)).toEqual(['near', 'far']);
  });

  it('respects limit cap', () => {
    const result = mergeWalkInDiscoveryBatches(
      [
        {
          category: 'vet',
          providers: [
            provider('a', 1),
            provider('b', 2),
            provider('c', 3),
            provider('d', 4),
            provider('e', 5),
          ],
        },
      ],
      { limit: 3 }
    );

    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty batches', () => {
    expect(mergeWalkInDiscoveryBatches([])).toEqual([]);
    expect(
      mergeWalkInDiscoveryBatches([
        { category: 'vet', providers: [] },
        { category: 'grooming', providers: [] },
      ])
    ).toEqual([]);
  });
});
