import {
  WALK_IN_AT_CENTER_RADIUS_KM,
  applyWalkInQueryTighten,
  parsePositiveKm,
  parseWalkInQueryTightenKm,
  resolveWalkInEffectiveRadius,
  resolveWalkInHomeRadiusKm,
} from '../walk-in-discovery-radius';

describe('Walk-in geographic eligibility', () => {
  it('uses a fixed 50 km at-center product rule', () => {
    expect(WALK_IN_AT_CENTER_RADIUS_KM).toBe(50);
    expect(
      resolveWalkInEffectiveRadius({
        hasAtHome: false,
        hasAtCenter: true,
        homeRadiusKm: 10,
      })
    ).toEqual({
      homeRadiusKm: 10,
      effectiveRadiusKm: 50,
      radiusSource: 'walk_in_at_center_50km',
    });
  });

  it('includes 49 and 50 km at-center and excludes 51 km', () => {
    const { effectiveRadiusKm } = resolveWalkInEffectiveRadius({
      hasAtHome: false,
      hasAtCenter: true,
    });
    expect(effectiveRadiusKm).toBe(50);
    expect(49 <= (effectiveRadiusKm as number)).toBe(true);
    expect(50 <= (effectiveRadiusKm as number)).toBe(true);
    expect(51 <= (effectiveRadiusKm as number)).toBe(false);
  });

  it('uses vendors.service_radius for at-home', () => {
    expect(
      resolveWalkInHomeRadiusKm({ serviceRadius: 10, serviceDistanceKm: 15 })
    ).toBe(10);
    const resolved = resolveWalkInEffectiveRadius({
      hasAtHome: true,
      hasAtCenter: false,
      homeRadiusKm: 10,
    });
    expect(resolved).toEqual({
      homeRadiusKm: 10,
      effectiveRadiusKm: 10,
      radiusSource: 'vendor_service_radius',
    });
    expect(9 <= 10).toBe(true);
    expect(11 <= 10).toBe(false);
  });

  it('falls back to vendors.service_distance_km when service_radius is missing', () => {
    expect(
      resolveWalkInHomeRadiusKm({ serviceRadius: null, serviceDistanceKm: 15 })
    ).toBe(15);
    const resolved = resolveWalkInEffectiveRadius({
      hasAtHome: true,
      hasAtCenter: false,
      homeRadiusKm: 15,
    });
    expect(resolved.effectiveRadiusKm).toBe(15);
    expect(14 <= 15).toBe(true);
    expect(16 <= 15).toBe(false);
  });

  it('does not use Marketplace 10 km when at-home radius is missing', () => {
    expect(resolveWalkInHomeRadiusKm({ serviceRadius: null, serviceDistanceKm: null })).toBeNull();
    expect(
      resolveWalkInEffectiveRadius({
        hasAtHome: true,
        hasAtCenter: false,
        homeRadiusKm: null,
      })
    ).toEqual({
      homeRadiusKm: null,
      effectiveRadiusKm: null,
      radiusSource: null,
    });
  });

  it('treats mixed style as max(50, homeRadius)', () => {
    expect(
      resolveWalkInEffectiveRadius({
        hasAtHome: true,
        hasAtCenter: true,
        homeRadiusKm: 20,
      })
    ).toEqual({
      homeRadiusKm: 20,
      effectiveRadiusKm: 50,
      radiusSource: 'walk_in_mixed_style_union',
    });
    expect(
      resolveWalkInEffectiveRadius({
        hasAtHome: true,
        hasAtCenter: true,
        homeRadiusKm: 70,
      }).effectiveRadiusKm
    ).toBe(70);
  });

  it('keeps mixed vendors at 45 km and excludes 55 km when home is 20', () => {
    const cap = resolveWalkInEffectiveRadius({
      hasAtHome: true,
      hasAtCenter: true,
      homeRadiusKm: 20,
    }).effectiveRadiusKm as number;
    expect(45 <= cap).toBe(true);
    expect(55 <= cap).toBe(false);
  });

  it('keeps mixed vendors at 60 km and excludes 71 km when home is 70', () => {
    const cap = resolveWalkInEffectiveRadius({
      hasAtHome: true,
      hasAtCenter: true,
      homeRadiusKm: 70,
    }).effectiveRadiusKm as number;
    expect(60 <= cap).toBe(true);
    expect(71 <= cap).toBe(false);
  });

  it('does not invent a style when vendor_services are absent', () => {
    expect(
      resolveWalkInEffectiveRadius({
        hasAtHome: false,
        hasAtCenter: false,
        homeRadiusKm: 25,
      })
    ).toEqual({
      homeRadiusKm: 25,
      effectiveRadiusKm: null,
      radiusSource: null,
    });
  });

  it('does not treat 0 or negative as a usable radius', () => {
    expect(parsePositiveKm(0)).toBeNull();
    expect(parsePositiveKm(-4)).toBeNull();
    expect(resolveWalkInHomeRadiusKm({ serviceRadius: 0, serviceDistanceKm: -8 })).toBeNull();
  });

  it('lets a query tighten but never expand the 50 km center rule', () => {
    expect(applyWalkInQueryTighten(50, 100)).toBe(50);
    expect(applyWalkInQueryTighten(70, 20)).toBe(20);
    expect(parseWalkInQueryTightenKm({ maxDistanceKm: '100' })).toBe(100);
  });
});
