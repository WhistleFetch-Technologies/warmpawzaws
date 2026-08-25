import { resolveWalkInDiscoveryRadiusKm } from '../walk-in-discovery-radius';

describe('resolveWalkInDiscoveryRadiusKm', () => {
  it('prefers query over env and does not invent a marketplace default', () => {
    expect(
      resolveWalkInDiscoveryRadiusKm({
        queryMaxDistanceKm: '12.5',
        envValue: '99',
      })
    ).toEqual({ radiusKm: 12.5, source: 'query' });
  });

  it('uses env when query is absent', () => {
    expect(
      resolveWalkInDiscoveryRadiusKm({
        envValue: '15',
      })
    ).toEqual({ radiusKm: 15, source: 'env' });
  });

  it('leaves radius unconfigured instead of using marketplace 10/50', () => {
    expect(resolveWalkInDiscoveryRadiusKm({})).toEqual({
      radiusKm: null,
      source: 'unconfigured',
    });
  });

  it('rejects non-positive values', () => {
    expect(
      resolveWalkInDiscoveryRadiusKm({
        queryMaxDistance: '0',
        envValue: '-4',
      })
    ).toEqual({ radiusKm: null, source: 'unconfigured' });
  });
});
