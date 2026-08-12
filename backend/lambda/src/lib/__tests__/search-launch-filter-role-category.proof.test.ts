/**
 * Regression: Search hub-browse launch filter must accept role-name categories
 * that GET /search puts on vendor cards (v.category ?? roles.name).
 * Home /customer/services/by-style does not run shouldIncludeSearchResult.
 */
import { mapCatalogSlugToLaunchServiceId } from '@warmpawz/service-launch-mappings';
import {
  shouldIncludeSearchResult,
  type LaunchGeoFilter,
} from '../customer-launch-geo-filter';

function filterWithHubsLaunched(): LaunchGeoFilter {
  return {
    stateCode: 'KA',
    city: 'Bangalore',
    isStyleLaunched: (serviceId, serviceStyle) => {
      const id = String(serviceId).toLowerCase().replace(/_/g, '-');
      const key = `${id}:${serviceStyle}`;
      return (
        key === 'vet:at_center' ||
        key === 'grooming:at_center' ||
        key === 'training:at_center' ||
        key === 'boarding:at_center' ||
        key === 'walker:at_home' ||
        key === 'pet-sitter:at_home'
      );
    },
    isHubLaunched: (categorySlug) => {
      const hub = String(categorySlug || '').toLowerCase();
      return ['vet', 'veterinary', 'grooming', 'training', 'boarding', 'walker', 'sitting', 'pet-sitter', 'pet_sitter'].includes(
        hub
      );
    },
  };
}

describe('Search launch filter — role-name category parity with Home', () => {
  const filter = filterWithHubsLaunched();

  it('maps role-like search categories to canonical launch ids', () => {
    expect(mapCatalogSlugToLaunchServiceId('vet_clinic')).toBe('vet');
    expect(mapCatalogSlugToLaunchServiceId('veterinarian')).toBe('vet');
    expect(mapCatalogSlugToLaunchServiceId('pet_groomer')).toBe('grooming');
    expect(mapCatalogSlugToLaunchServiceId('trainer_center')).toBe('training');
    expect(mapCatalogSlugToLaunchServiceId('trainer_home')).toBe('training');
    expect(mapCatalogSlugToLaunchServiceId('pet_boarding')).toBe('boarding');
    expect(mapCatalogSlugToLaunchServiceId('pet_sitter')).toBe('pet-sitter');
  });

  it('keeps role-name vendors under launched hubs (former drop stage)', () => {
    expect(
      shouldIncludeSearchResult(filter, { category: 'vet_clinic' }, 'vet')
    ).toBe(true);
    expect(
      shouldIncludeSearchResult(filter, { category: 'veterinarian' }, 'vet')
    ).toBe(true);
    expect(
      shouldIncludeSearchResult(filter, { category: 'pet_groomer' }, 'grooming')
    ).toBe(true);
    expect(
      shouldIncludeSearchResult(filter, { category: 'trainer_center' }, 'training')
    ).toBe(true);
    expect(
      shouldIncludeSearchResult(filter, { category: 'trainer_home' }, 'training')
    ).toBe(true);
    expect(
      shouldIncludeSearchResult(filter, { category: 'pet_boarding' }, 'boarding')
    ).toBe(true);
  });

  it('stage simulation: launch filter no longer removes role-name vendors', () => {
    const afterGate = [
      { id: 'v1', category: 'vet_clinic' },
      { id: 'v2', category: 'vet' },
    ];
    const afterLaunch = afterGate.filter((v) =>
      shouldIncludeSearchResult(
        filter,
        { category: v.category, serviceType: v.category },
        'vet'
      )
    );
    expect(afterLaunch.map((v) => v.id).sort()).toEqual(['v1', 'v2']);
  });
});
