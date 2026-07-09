/**
 * Geo launch filter helpers for search, featured-vendors, discover-services.
 */

import {
  mapCatalogSlugToLaunchServiceId,
  normalizeServiceKey,
  normalizeServiceStyleLaunchKey,
  supportedStylesForLaunchServiceId,
  type ServiceStyleLaunchKey,
} from '@warmpawz/service-launch-mappings';
import { query } from '../database/rds-connection';
import {
  effectiveStatusForGeography,
  effectiveStyleStatusForGeography,
  type LaunchStatus,
  type ServiceLaunchGeoConfig,
} from './service-launch-style-resolution';
import { hubSlugToDiscoveryContext, normalizeServiceStyle } from './search-discovery-parity';
import {
  resolveFeaturedVendorsRequestScreen,
} from '../utils/featured-vendor-service-context';

const SETTING_KEY = 'platform:service-launch-config';

const INDIAN_STATES = [
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'CT', name: 'Chhattisgarh' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'HR', name: 'Haryana' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MN', name: 'Manipur' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OR', name: 'Odisha' },
  { code: 'PB', name: 'Punjab' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TG', name: 'Telangana' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'WB', name: 'West Bengal' },
];

function resolveStateCodeFromName(state: string): string {
  if (!state) return '';
  const cleanedState = state.replace(/\s*\d{6}\s*$/, '').trim();
  const stateMatch = INDIAN_STATES.find((s) => {
    const q = state.toLowerCase();
    const cleaned = cleanedState.toLowerCase();
    return (
      q === s.name.toLowerCase() ||
      q === s.code.toLowerCase() ||
      cleaned === s.name.toLowerCase() ||
      cleaned === s.code.toLowerCase()
    );
  });
  return stateMatch?.code || '';
}

function isLaunched(status: LaunchStatus): boolean {
  return status === 'launched' || status === 'beta';
}

type ServiceLaunchSlice = ServiceLaunchGeoConfig;

async function loadLaunchConfig(): Promise<Record<string, ServiceLaunchSlice>> {
  const configResult = await query(
    `SELECT setting_value FROM platform_settings WHERE setting_key = $1`,
    [SETTING_KEY]
  ).catch(() => ({ rows: [] }));

  if (!configResult.rows?.length) return {};
  const value = configResult.rows[0].setting_value;
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  return raw && typeof raw === 'object' ? raw : {};
}

async function resolveCustomerGeoFromPhone(phone: string): Promise<{ state: string; city: string }> {
  const clean = String(phone || '').trim();
  if (!clean) return { state: '', city: '' };
  try {
    const { rows } = await query(
      `SELECT city, state FROM customer_addresses
       WHERE customer_id IN (SELECT id FROM customers WHERE phone = $1 LIMIT 1)
       ORDER BY is_default DESC NULLS LAST, created_at ASC
       LIMIT 1`,
      [clean]
    );
    if (rows?.[0]) {
      const city = String(rows[0].city || '').replace(/\s*\d{6}\s*$/, '').trim();
      const state = String(rows[0].state || '').replace(/\s*\d{6}\s*$/, '').trim();
      return { state, city };
    }
  } catch {
    /* ignore */
  }
  return { state: '', city: '' };
}

export type LaunchGeoFilter = {
  stateCode: string;
  city: string;
  isStyleLaunched(serviceId: string, serviceStyle: string): boolean;
  isHubLaunched(categorySlug: string | undefined): boolean;
};

export async function createLaunchGeoFilter(opts: {
  state?: string;
  city?: string;
  phone?: string;
}): Promise<LaunchGeoFilter> {
  let state = String(opts.state || '').trim();
  let city = String(opts.city || '').trim();
  if (!state && !city && opts.phone) {
    const geo = await resolveCustomerGeoFromPhone(opts.phone);
    state = geo.state;
    city = geo.city;
  }

  const stateCode = resolveStateCodeFromName(state);
  const config = await loadLaunchConfig();

  const isStyleLaunched = (serviceId: string, serviceStyle: string): boolean => {
    const svcKey = normalizeServiceKey(serviceId);
    const styleKey = normalizeServiceStyleLaunchKey(serviceStyle);
    if (!svcKey) return true;
    const slice = config[svcKey] as ServiceLaunchSlice | undefined;
    if (!styleKey) {
      const parent = effectiveStatusForGeography(slice, stateCode, city, 'hidden');
      return isLaunched(parent.status);
    }
    const supported = supportedStylesForLaunchServiceId(svcKey);
    if (!supported.includes(styleKey)) {
      const parent = effectiveStatusForGeography(slice, stateCode, city, 'hidden');
      return isLaunched(parent.status);
    }
    const resolved = effectiveStyleStatusForGeography(slice, styleKey, stateCode, city, 'hidden');
    return isLaunched(resolved.status);
  };

  const isHubLaunched = (categorySlug: string | undefined): boolean => {
    const hub = hubSlugToDiscoveryContext(categorySlug);
    if (!hub) return true;
    const serviceId = mapCatalogSlugToLaunchServiceId(hub.discoverCategory);
    return isStyleLaunched(serviceId, hub.serviceStyle);
  };

  return { stateCode, city, isStyleLaunched, isHubLaunched };
}

export function categoryToLaunchServiceId(category: string | null | undefined): string {
  return normalizeServiceKey(mapCatalogSlugToLaunchServiceId(String(category || '').trim()));
}

export function shouldIncludeSearchResult(
  filter: LaunchGeoFilter,
  row: {
    category?: string | null;
    serviceType?: string | null;
    service_style?: string | null;
    serviceStyle?: string | null;
  },
  hubCategory?: string
): boolean {
  if (hubCategory && !filter.isHubLaunched(hubCategory)) {
    return false;
  }

  const category = String(row.category || row.serviceType || '').trim();
  const serviceId = categoryToLaunchServiceId(category);
  if (!serviceId || serviceId === 'unknown') return true;

  const styleRaw =
    row.service_style ||
    row.serviceStyle ||
    (hubCategory ? hubSlugToDiscoveryContext(hubCategory)?.serviceStyle : null) ||
    hubSlugToDiscoveryContext(category)?.serviceStyle;

  const style = normalizeServiceStyle(styleRaw || '') || styleRaw;
  if (!style) return filter.isStyleLaunched(serviceId, 'at_center');

  const styleKey = normalizeServiceStyleLaunchKey(style);
  if (!styleKey) return true;
  return filter.isStyleLaunched(serviceId, styleKey);
}

export async function resolveLaunchGeoFromQuery(
  qs: Record<string, string | undefined> | undefined
): Promise<LaunchGeoFilter> {
  const phone = qs?.customerPhone || qs?.phone || '';
  const state = qs?.state || qs?.customerState || '';
  const city = qs?.city || qs?.customerCity || '';
  return createLaunchGeoFilter({ phone, state, city });
}

const FIXED_STYLE_SCREENS: Record<string, { serviceId: string; serviceStyle: string }> = {
  'vet-clinic-list': { serviceId: 'vet', serviceStyle: 'at_center' },
  'vet-tele-consultation': { serviceId: 'vet', serviceStyle: 'tele' },
  'vet-home-visit': { serviceId: 'vet', serviceStyle: 'at_home' },
  grooming_center: { serviceId: 'grooming', serviceStyle: 'at_center' },
  grooming_home: { serviceId: 'grooming', serviceStyle: 'at_home' },
  training_center: { serviceId: 'training', serviceStyle: 'at_center' },
  training_home: { serviceId: 'training', serviceStyle: 'at_home' },
};

/** Mirror customer-style-screen-launch.ts for spotlight / featured-vendor rows. */
export function resolveStyleLaunchTargetForSpotlightScreen(
  screen: string
): { serviceId: string; serviceStyle: string } | null {
  const key = String(screen || '').trim();
  return FIXED_STYLE_SCREENS[key] || null;
}

/** Resolve navigation screen from spotlight row CTA / category / role (promotion-navigation parity). */
export function resolveSpotlightRowNavScreen(row: {
  cta_link?: string | null;
  ctaLink?: string | null;
  service_category?: string | null;
  serviceCategory?: string | null;
  role_id?: string | null;
  roleId?: string | null;
}): string | null {
  const ctaRaw = row.ctaLink ?? row.cta_link ?? '';
  const cta = String(ctaRaw ?? '').trim();
  if (cta && !/^https?:\/\//i.test(cta)) {
    const pathOnly = cta.split('?')[0].split('#')[0].trim();
    const seg = pathOnly.replace(/^\/+/, '').split('/').filter(Boolean)[0];
    if (seg) {
      if (resolveStyleLaunchTargetForSpotlightScreen(seg)) {
        return seg;
      }
      const mapped = resolveFeaturedVendorsRequestScreen(seg);
      if (mapped) return mapped;
    }
  }
  const svc = String(row.serviceCategory ?? row.service_category ?? '').trim();
  if (svc) {
    const mapped = resolveFeaturedVendorsRequestScreen(svc);
    if (mapped) return mapped;
  }
  const role = String(row.roleId ?? row.role_id ?? '').trim();
  if (role) {
    const mapped = resolveFeaturedVendorsRequestScreen(role);
    if (mapped) return mapped;
  }
  return null;
}

export function shouldIncludeFeaturedSpotlightRow(
  filter: LaunchGeoFilter,
  row: {
    cta_link?: string | null;
    ctaLink?: string | null;
    service_category?: string | null;
    serviceCategory?: string | null;
    role_id?: string | null;
    roleId?: string | null;
  }
): boolean {
  const screen = resolveSpotlightRowNavScreen(row);
  if (!screen) return true;
  const target = resolveStyleLaunchTargetForSpotlightScreen(screen);
  if (!target) return true;
  return filter.isStyleLaunched(target.serviceId, target.serviceStyle);
}
