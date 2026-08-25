import { readWalkInDiscoveryRadiusKm } from '../walk-in-discovery-radius';

describe('readWalkInDiscoveryRadiusKm', () => {
  it('does not invent a marketplace radius when unset', () => {
    expect(readWalkInDiscoveryRadiusKm(undefined)).toBeNull();
    expect(readWalkInDiscoveryRadiusKm('')).toBeNull();
  });

  it('reads a configured Walk-in radius without using 10/50 marketplace values', () => {
    expect(readWalkInDiscoveryRadiusKm('15')).toBe(15);
    expect(readWalkInDiscoveryRadiusKm('0')).toBeNull();
    expect(readWalkInDiscoveryRadiusKm('-8')).toBeNull();
  });
});
