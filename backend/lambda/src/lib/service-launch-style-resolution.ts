/**
 * Per-style launch resolution — inherits parent service geography unless a style override exists.
 */

import type { LaunchStatusValue, ServiceStyleLaunchKey } from '@warmpawz/service-launch-mappings';

export type LaunchStatus = LaunchStatusValue;

export interface CityConfig {
  status: LaunchStatus;
  rolloutPercentage: number;
}

/** State bucket may exist only to hold city overrides (no state-level status). */
export interface StateConfig {
  status?: LaunchStatus;
  rolloutPercentage?: number;
  cities: Record<string, CityConfig>;
}

/** Partial geo slice — only overridden fields are persisted for styles. */
export interface GeoLaunchSlice {
  defaultStatus?: LaunchStatus;
  defaultRolloutPercentage?: number;
  stateOverrides?: Record<string, StateConfig>;
}

export interface ServiceLaunchGeoConfig {
  defaultStatus?: LaunchStatus;
  defaultRolloutPercentage?: number;
  stateOverrides?: Record<string, StateConfig>;
  styleOverrides?: Partial<Record<ServiceStyleLaunchKey, GeoLaunchSlice>>;
}

const LAUNCH_STATUS_RANK: Record<LaunchStatus, number> = {
  hidden: 0,
  coming_soon: 1,
  beta: 2,
  launched: 3,
};

const CITY_NAME_ALIASES: Record<string, string> = {
  bengaluru: 'Bangalore',
  bangalore: 'Bangalore',
  mumbai: 'Mumbai',
  bombay: 'Mumbai',
  chennai: 'Chennai',
  madras: 'Chennai',
  kolkata: 'Kolkata',
  calcutta: 'Kolkata',
  'new delhi': 'New Delhi',
  delhi: 'New Delhi',
  hyderabad: 'Hyderabad',
  pune: 'Pune',
  poona: 'Pune',
  ahmedabad: 'Ahmedabad',
  gurugram: 'Gurugram',
  gurgaon: 'Gurugram',
  noida: 'Noida',
  ghaziabad: 'Ghaziabad',
};

export function normalizeIndianCityName(cityName: string): string {
  const t = String(cityName || '').trim();
  if (!t) return '';
  const mapped = CITY_NAME_ALIASES[t.toLowerCase()];
  return mapped || t;
}

export function getCityLaunchOverride(
  cities: Record<string, CityConfig> | undefined,
  cityQuery: string
): CityConfig | undefined {
  if (!cities || !cityQuery) return undefined;
  const q = cityQuery.trim();
  if (cities[q]) return cities[q];
  const canon = normalizeIndianCityName(q);
  if (canon && cities[canon]) return cities[canon];
  const qLower = q.toLowerCase();
  for (const k of Object.keys(cities)) {
    if (k.toLowerCase() === qLower) return cities[k];
    if (canon && normalizeIndianCityName(k).toLowerCase() === canon.toLowerCase()) return cities[k];
  }
  return undefined;
}

/** Style cannot be more visible than parent at the same geography. */
export function lessPermissiveLaunchStatus(a: LaunchStatus, b: LaunchStatus): LaunchStatus {
  return LAUNCH_STATUS_RANK[a] <= LAUNCH_STATUS_RANK[b] ? a : b;
}

type GeoResolved = { status: LaunchStatus; rollout: number; hasOverride: boolean };

function resolveGeoSliceAtGeography(
  slice: GeoLaunchSlice | undefined,
  stateCode: string,
  city: string,
  inheritFrom: { status: LaunchStatus; rollout: number }
): GeoResolved {
  if (!slice) {
    return { ...inheritFrom, hasOverride: false };
  }

  let baseStatus = slice.defaultStatus ?? inheritFrom.status;
  let baseRollout = slice.defaultRolloutPercentage ?? inheritFrom.rollout;
  const hasDefaultOverride =
    slice.defaultStatus !== undefined || slice.defaultRolloutPercentage !== undefined;

  if (!stateCode || !slice.stateOverrides?.[stateCode]) {
    return {
      status: baseStatus,
      rollout: baseRollout,
      hasOverride: hasDefaultOverride,
    };
  }

  const stateConfig = slice.stateOverrides[stateCode];
  const cityConfig = city ? getCityLaunchOverride(stateConfig.cities, city) : undefined;

  if (cityConfig) {
    return {
      status: cityConfig.status,
      rollout: cityConfig.rolloutPercentage,
      hasOverride: true,
    };
  }

  if (stateConfig.status !== undefined) {
    return {
      status: stateConfig.status,
      rollout: stateConfig.rolloutPercentage ?? baseRollout,
      hasOverride: true,
    };
  }

  return {
    status: baseStatus,
    rollout: baseRollout,
    hasOverride: hasDefaultOverride,
  };
}

export function effectiveStatusForGeography(
  existingService: ServiceLaunchGeoConfig | undefined,
  stateCode: string,
  city: string,
  fallbackStatus: LaunchStatus = 'hidden'
): { status: LaunchStatus; rollout: number } {
  const fallback = {
    status: existingService?.defaultStatus || fallbackStatus,
    rollout: existingService?.defaultRolloutPercentage ?? 0,
  };
  const slice: GeoLaunchSlice = {
    defaultStatus: existingService?.defaultStatus,
    defaultRolloutPercentage: existingService?.defaultRolloutPercentage,
    stateOverrides: existingService?.stateOverrides,
  };
  const resolved = resolveGeoSliceAtGeography(slice, stateCode, city, fallback);
  return { status: resolved.status, rollout: resolved.rollout };
}

/**
 * Style inherits parent effective status unless the style has an explicit override
 * at default, state, or city level for the requested geography.
 * Resolved style is always clamped to parent visibility (cannot exceed parent).
 */
export function effectiveStyleStatusForGeography(
  parentService: ServiceLaunchGeoConfig | undefined,
  styleKey: ServiceStyleLaunchKey,
  stateCode: string,
  city: string,
  fallbackStatus: LaunchStatus = 'hidden'
): { status: LaunchStatus; rollout: number; inheritsParent: boolean } {
  const parent = effectiveStatusForGeography(parentService, stateCode, city, fallbackStatus);
  const styleSlice = parentService?.styleOverrides?.[styleKey];

  if (!styleSlice) {
    return { ...parent, inheritsParent: true };
  }

  const resolved = resolveGeoSliceAtGeography(styleSlice, stateCode, city, parent);
  const clampedStatus = lessPermissiveLaunchStatus(resolved.status, parent.status);
  const clampedToParent = clampedStatus !== resolved.status;

  return {
    status: clampedStatus,
    rollout: clampedToParent ? parent.rollout : resolved.rollout,
    inheritsParent: clampedToParent || !resolved.hasOverride,
  };
}

export function mergeStyleOverrides(
  base: Partial<Record<ServiceStyleLaunchKey, GeoLaunchSlice>> | undefined,
  overlay: Partial<Record<ServiceStyleLaunchKey, GeoLaunchSlice>> | undefined
): Partial<Record<ServiceStyleLaunchKey, GeoLaunchSlice>> {
  const out: Partial<Record<ServiceStyleLaunchKey, GeoLaunchSlice>> = { ...(base || {}) };
  for (const key of Object.keys(overlay || {}) as ServiceStyleLaunchKey[]) {
    const b = out[key];
    const o = overlay![key];
    if (!o) continue;
    out[key] = {
      ...(b || {}),
      ...o,
      stateOverrides: mergeStateOverrides(b?.stateOverrides, o.stateOverrides),
    };
  }
  return out;
}

export function mergeStateOverrides(
  base: Record<string, StateConfig> | undefined,
  overlay: Record<string, StateConfig> | undefined
): Record<string, StateConfig> {
  const out: Record<string, StateConfig> = { ...(base || {}) };
  for (const st of Object.keys(overlay || {})) {
    const b = out[st];
    const o = overlay![st];
    out[st] = {
      ...(b || {}),
      ...o,
      cities: { ...(b?.cities || {}), ...(o?.cities || {}) },
    } as StateConfig;
  }
  return out;
}

export function applyGeographyUpdateToSlice(
  slice: GeoLaunchSlice,
  stateCode: string | undefined,
  city: string | undefined,
  status: LaunchStatus,
  rolloutPercentage: number
): GeoLaunchSlice {
  const next: GeoLaunchSlice = { ...slice };

  if (!stateCode) {
    next.defaultStatus = status;
    next.defaultRolloutPercentage = rolloutPercentage;
    return next;
  }

  if (!next.stateOverrides) next.stateOverrides = {};
  if (!next.stateOverrides[stateCode]) {
    next.stateOverrides[stateCode] = { cities: {} };
  }

  if (!city) {
    next.stateOverrides[stateCode] = {
      ...next.stateOverrides[stateCode],
      status,
      rolloutPercentage,
      cities: next.stateOverrides[stateCode].cities || {},
    };
    return next;
  }

  const citiesMap = { ...(next.stateOverrides[stateCode].cities || {}) };
  const canonCity = normalizeIndianCityName(city);
  const cityKey = canonCity || city;
  for (const k of Object.keys(citiesMap)) {
    if (k !== cityKey && normalizeIndianCityName(k) === cityKey) {
      delete citiesMap[k];
    }
  }
  citiesMap[cityKey] = { status, rolloutPercentage };
  next.stateOverrides[stateCode] = {
    ...next.stateOverrides[stateCode],
    cities: citiesMap,
  };
  return next;
}
