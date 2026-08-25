import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
import { walkInProvidersEqual } from '@/hooks/useWalkInNearbyProviders';

function provider(id: string, distanceKm = 1.2): WalkInProvider {
  return {
    id,
    displayName: `Vendor ${id}`,
    subtitle: 'Vet clinic',
    category: 'vet',
    distanceKm,
    fromPrice: 499,
    priceLabel: 'per visit',
    rating: 4.5,
    reviewCount: 10,
    photoUrl: null,
    experienceYears: null,
    warmpawzPayEligible: true,
    appointmentEligible: true,
  };
}

describe('walkInProvidersEqual', () => {
  it('returns true for identical provider lists', () => {
    const list = [provider('a'), provider('b')];
    expect(walkInProvidersEqual(list, [...list])).toBe(true);
  });

  it('returns false when order or ids differ', () => {
    expect(walkInProvidersEqual([provider('a')], [provider('b')])).toBe(false);
    expect(walkInProvidersEqual([provider('a'), provider('b')], [provider('b'), provider('a')])).toBe(
      false
    );
  });

  it('returns false when distance changes', () => {
    expect(walkInProvidersEqual([provider('a', 1.0)], [provider('a', 2.0)])).toBe(false);
  });

  it('returns false when catalogue capabilities change', () => {
    expect(
      walkInProvidersEqual(
        [provider('a')],
        [{ ...provider('a'), appointmentEligible: false }]
      )
    ).toBe(false);
  });
});
