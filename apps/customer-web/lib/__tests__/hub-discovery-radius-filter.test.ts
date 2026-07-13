import { filterHubDiscoveryRowsByRadius } from '@/lib/hub-discovery-radius-filter';

describe('filterHubDiscoveryRowsByRadius', () => {
  it('drops at_center providers outside 50km when coords are known', () => {
    const rows = [
      { id: 'near', distanceKm: 12 },
      { id: 'far', distanceKm: 851 },
    ];
    const filtered = filterHubDiscoveryRowsByRadius(rows, {
      serviceStyle: 'at_center',
      latitude: '19.076',
      longitude: '72.8777',
    });
    expect(filtered.map((r) => r.id)).toEqual(['near']);
  });

  it('keeps tele providers regardless of distance', () => {
    const rows = [{ id: 'remote', distanceKm: 900 }];
    const filtered = filterHubDiscoveryRowsByRadius(rows, {
      serviceStyle: 'tele',
      latitude: '19.076',
      longitude: '72.8777',
    });
    expect(filtered).toHaveLength(1);
  });

  it('allows unknown distance for sitting when sittingRelaxed', () => {
    const rows = [{ id: 'sitter', distance: null }];
    const filtered = filterHubDiscoveryRowsByRadius(rows, {
      serviceStyle: 'at_home',
      latitude: '19.076',
      longitude: '72.8777',
      sittingRelaxed: true,
    });
    expect(filtered).toHaveLength(1);
  });
});
