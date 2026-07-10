import {
  applyGeographyUpdateToSlice,
  effectiveStatusForGeography,
  effectiveStyleStatusForGeography,
  lessPermissiveLaunchStatus,
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

  it('city-only style override does not hide other cities in the same state', () => {
    const cfg = {
      defaultStatus: 'launched' as const,
      defaultRolloutPercentage: 100,
      styleOverrides: {
        at_center: applyGeographyUpdateToSlice({}, 'KA', 'Bangalore', 'hidden', 0),
      },
    };
    expect(effectiveStyleStatusForGeography(cfg, 'at_center', 'KA', 'Bangalore').status).toBe('hidden');
    expect(effectiveStyleStatusForGeography(cfg, 'at_center', 'KA', 'Mysore').status).toBe('launched');
  });

  it('style launched cannot exceed parent hidden', () => {
    const cfg = {
      defaultStatus: 'hidden' as const,
      defaultRolloutPercentage: 0,
      styleOverrides: {
        tele: { defaultStatus: 'launched' as const, defaultRolloutPercentage: 100 },
      },
    };
    const r = effectiveStyleStatusForGeography(cfg, 'tele', 'KA', 'Bangalore', 'hidden');
    expect(r.status).toBe('hidden');
    expect(r.inheritsParent).toBe(true);
  });

  it('lessPermissiveLaunchStatus picks stricter status', () => {
    expect(lessPermissiveLaunchStatus('launched', 'coming_soon')).toBe('coming_soon');
    expect(lessPermissiveLaunchStatus('hidden', 'launched')).toBe('hidden');
  });
});
