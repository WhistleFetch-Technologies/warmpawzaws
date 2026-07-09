import {
  applyGeographyUpdateToSlice,
  effectiveStatusForGeography,
  effectiveStyleStatusForGeography,
} from '../service-launch-style-resolution';

describe('service-launch-style-resolution', () => {
  const parent = {
    defaultStatus: 'launched' as const,
    defaultRolloutPercentage: 100,
    stateOverrides: {
      KL: {
        status: 'launched' as const,
        rolloutPercentage: 100,
        cities: {},
      },
    },
    styleOverrides: {
      at_center: {
        defaultStatus: 'hidden' as const,
        defaultRolloutPercentage: 0,
      },
      tele: {
        stateOverrides: {
          KL: {
            status: 'coming_soon' as const,
            rolloutPercentage: 50,
            cities: {},
          },
        },
      },
    },
  };

  it('inherits parent when style has no overrides', () => {
    const r = effectiveStyleStatusForGeography(parent, 'at_home', 'KA', 'Bangalore', 'hidden');
    expect(r.status).toBe('launched');
    expect(r.inheritsParent).toBe(true);
  });

  it('uses style default override', () => {
    const r = effectiveStyleStatusForGeography(parent, 'at_center', 'KA', 'Bangalore', 'hidden');
    expect(r.status).toBe('hidden');
    expect(r.inheritsParent).toBe(false);
  });

  it('uses style state override over parent launched', () => {
    const r = effectiveStyleStatusForGeography(parent, 'tele', 'KL', 'Kochi', 'hidden');
    expect(r.status).toBe('coming_soon');
    expect(r.inheritsParent).toBe(false);
  });

  it('parent geography resolution unchanged', () => {
    expect(effectiveStatusForGeography(parent, 'KL', 'Kochi').status).toBe('launched');
    expect(effectiveStatusForGeography(parent, 'MH', 'Mumbai').status).toBe('launched');
  });

  it('applyGeographyUpdateToSlice persists only style slice', () => {
    const next = applyGeographyUpdateToSlice({}, 'KA', undefined, 'beta', 80);
    expect(next.stateOverrides?.KA?.status).toBe('beta');
    expect(next.defaultStatus).toBeUndefined();
  });
});
