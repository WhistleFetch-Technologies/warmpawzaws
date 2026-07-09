/**
 * Per-style launch resolution — inherits parent service geography unless a style override exists.
 */

import type { LaunchStatusValue, ServiceStyleLaunchKey } from '@warmpawz/service-launch-mappings';

export type LaunchStatus = LaunchStatusValue;

export interface CityConfig {
  status: LaunchStatus;
  rolloutPercentage: number;
}

export interface StateConfig {
  status: LaunchStatus;
  rolloutPercentage: number;
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

export function effectiveStatusForGeography(
  existingService: ServiceLaunchGeoConfig | undefined,
  stateCode: string,
  city: string,
  fallbackStatus: LaunchStatus = 'hidden'
): { status: LaunchStatus; rollout: number } {
  let status: LaunchStatus = existingService?.defaultStatus || fallbackStatus;
  let rollout = existingService?.defaultRolloutPercentage ?? 0;

  if (stateCode && existingService?.stateOverrides?.[stateCode]) {
    const stateConfig = existingService.stateOverrides[stateCode];
    status = stateConfig.status;
    rollout = stateConfig.rolloutPercentage;

    const cityConfig = city ? getCityLaunchOverride(stateConfig.cities, city) : undefined;
    if (cityConfig) {
      status = cityConfig.status;
      rollout = cityConfig.rolloutPercentage;
    }
  }

  return { status, rollout };
}

function hasStyleOverrideAtGeography(
  styleSlice: GeoLaunchSlice,
  stateCode: string,
  city: string
): boolean {
  if (styleSlice.defaultStatus !== undefined || styleSlice.defaultRolloutPercentage !== undefined) {
    return true;
  }
  if (!stateCode || !styleSlice.stateOverrides?.[stateCode]) return false;
  const sc = styleSlice.stateOverrides[stateCode];
  if (city && getCityLaunchOverride(sc.cities, city)) return true;
  return sc.status !== undefined || sc.rolloutPercentage !== undefined;
}

/**
 * Style inherits parent effective status unless the style has an explicit override
 * at default, state, or city level for the requested geography.
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

  if (stateCode && city && styleSlice.stateOverrides?.[stateCode]) {
    const cityConfig = getCityLaunchOverride(styleSlice.stateOverrides[stateCode].cities, city);
    if (cityConfig) {
      return {
        status: cityConfig.status,
        rollout: cityConfig.rolloutPercentage,
        inheritsParent: false,
      };
    }
  }

  if (stateCode && styleSlice.stateOverrides?.[stateCode]) {
    const sc = styleSlice.stateOverrides[stateCode];
    if (sc.status !== undefined) {
      return {
        status: sc.status,
        rollout: sc.rolloutPercentage ?? parent.rollout,
        inheritsParent: false,
      };
    }
  }

  if (styleSlice.defaultStatus !== undefined) {
    return {
      status: styleSlice.defaultStatus,
      rollout: styleSlice.defaultRolloutPercentage ?? parent.rollout,
      inheritsParent: !hasStyleOverrideAtGeography(styleSlice, stateCode, city),
    };
  }

  return { ...parent, inheritsParent: true };
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
    next.stateOverrides[stateCode] = { status: 'hidden', rolloutPercentage: 0, cities: {} };
  }

  if (!city) {
    next.stateOverrides[stateCode] = {
      ...next.stateOverrides[stateCode],
      status,
      rolloutPercentage,
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
