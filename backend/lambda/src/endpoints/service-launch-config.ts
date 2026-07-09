/**
 * ============================================================================
 * SERVICE LAUNCH CONFIGURATION ENDPOINTS
 * ============================================================================
 * 
 * Controls service visibility and launch phases by geography (state/city):
 * - GET /config/service-launch - Get all services with launch status for a geography
 * - PUT /config/service-launch - Update service launch status for a geography
 * - GET /config/service-launch/customer - Get visible services for customer's location
 * 
 * This replaces the role-based Dashboard UI configuration.
 * Services are auto-populated from service_catalog table.
 * 
 * Date: 2026-01-29
 * ============================================================================
 */

import { Hono } from 'hono';
import {
  mapCatalogSlugToLaunchServiceId,
  SERVICE_STYLE_LAUNCH_KEYS,
  supportedStylesForLaunchServiceId,
  type ServiceStyleLaunchKey,
} from '@warmpawz/service-launch-mappings';
import { query } from '../database/rds-connection';
import {
  applyGeographyUpdateToSlice,
  effectiveStatusForGeography as resolveGeoLaunchStatus,
  effectiveStyleStatusForGeography,
  getCityLaunchOverride,
  mergeStateOverrides,
  mergeStyleOverrides,
  normalizeIndianCityName,
  type GeoLaunchSlice,
  type LaunchStatus,
  type StateConfig,
} from '../lib/service-launch-style-resolution';

export type { LaunchStatus };

// Indian states list for geographic control
export const INDIAN_STATES = [
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'CT', name: 'Chhattisgarh' },
  { code: 'DD', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OR', name: 'Odisha' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TG', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },
];

// Major cities by state (expandable)
export const MAJOR_CITIES: Record<string, string[]> = {
  KA: ['Bangalore', 'Mysore', 'Mangalore', 'Hubli', 'Belgaum', 'Dharwad', 'Shimoga'],
  MH: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur'],
  DL: ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
  TN: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli'],
  TG: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  KL: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam'],
  GJ: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
  RJ: ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur'],
  UP: ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Noida', 'Ghaziabad', 'Meerut'],
  WB: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
  PB: ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
  HR: ['Gurugram', 'Faridabad', 'Karnal', 'Rohtak', 'Hisar'],
  BR: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'],
  MP: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain'],
  OR: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri'],
  AP: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
  JH: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
  CT: ['Raipur', 'Bhilai', 'Bilaspur'],
  AS: ['Guwahati', 'Jorhat', 'Dibrugarh'],
  GA: ['Panaji', 'Margao', 'Vasco da Gama'],
  CH: ['Chandigarh'],
  UK: ['Dehradun', 'Haridwar', 'Rishikesh', 'Nainital'],
  HP: ['Shimla', 'Dharamshala', 'Manali', 'Kullu'],
  JK: ['Srinagar', 'Jammu'],
  PY: ['Puducherry'],
  LD: ['Kavaratti'],
  AN: ['Port Blair'],
  LA: ['Leh'],
  SK: ['Gangtok'],
  AR: ['Itanagar'],
  MN: ['Imphal'],
  MZ: ['Aizawl'],
  NL: ['Kohima'],
  TR: ['Agartala'],
  ML: ['Shillong'],
};

/**
 * Canonical Indian city names — kept for backward compatibility in comments only;
 * resolution uses normalizeIndianCityName from service-launch-style-resolution.
 */

// Launch status types — re-exported from style resolution lib
// export type LaunchStatus = 'hidden' | 'coming_soon' | 'beta' | 'launched';

// Service launch config interface
interface ServiceLaunchConfig {
  serviceId: string;
  serviceName: string;
  displayName: string;
  icon: string;
  categoryId: string;
  categoryName: string;
  // Default status when no geographic override
  defaultStatus: LaunchStatus;
  defaultRolloutPercentage: number;
  // Geographic overrides: state code -> state config
  stateOverrides: Record<string, StateConfig>;
  /** Per-style overrides only — inherits parent when absent. */
  styleOverrides?: Partial<Record<ServiceStyleLaunchKey, GeoLaunchSlice>>;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Default icon mapping for services
const SERVICE_ICONS: Record<string, string> = {
  vet: '🩺',
  grooming: '✂️',
  shop: '🛍️',
  training: '🎓',
  walker: '🚶',
  boarding: '🏠',
  adoption: '❤️',
  mating: '💕',
  cafes: '☕',
  photography: '📷',
  insurance: '🛡️',
  breeder: '🐕',
  ambulance: '🚑',
  nutritionist: '🥗',
  relocation: '✈️',
  resort: '🏖️',
  holiday: '🌴',
  sunset: '🌅',
  veterinary: '🩺',
  diagnostic: '🔬',
  pharmacy: '💊',
  emergency: '🚨',
  wellness: '🌟',
  specialty: '⭐',
  daycare: '🏡',
  sitting: '🪑',
  'pet-sitter': '🏠',
  pet_sitter: '🏠',
  default: '🔘',
};

/** Detect Postgres-style UUID strings (used when category_id was wrongly set to service_categories.id). */
function isUuidKey(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s).trim());
}


/** Later entries win (so legacy UUID-keyed saves override empty slug keys). */
function mergeServiceLaunchEntries(...parts: Record<string, any>[]): Record<string, any> {
  const nonEmpty = parts.filter((p) => p && typeof p === 'object');
  if (nonEmpty.length === 0) return {};
  let acc = { ...nonEmpty[0] };
  for (let i = 1; i < nonEmpty.length; i++) {
    const overlay = nonEmpty[i];
    acc = {
      ...acc,
      ...overlay,
      stateOverrides: mergeStateOverrides(acc.stateOverrides, overlay.stateOverrides),
      styleOverrides: mergeStyleOverrides(acc.styleOverrides, overlay.styleOverrides),
    };
  }
  return acc;
}

/**
 * Merge platform_settings keys: legacy UUID / alternate slugs first, canonical dashboard id last.
 * mergeServiceLaunchEntries overlays later parts — if UUID was merged after `holiday`, stale
 * UUID city overrides overwrote admin saves done under `holiday` (e.g. Bangalore stayed Launched).
 */
function collectLaunchConfigForCategory(
  slug: string,
  dashboardId: string,
  existingConfig: Record<string, any>,
  uuidToSlug: Map<string, string>
): Record<string, any> {
  const parts: Record<string, any>[] = [];
  for (const [uuidKey, resolvedSlug] of uuidToSlug) {
    if (mapCatalogSlugToLaunchServiceId(resolvedSlug) === dashboardId && existingConfig[uuidKey]) {
      parts.push(existingConfig[uuidKey]);
    }
  }
  // Same tile may have been saved under older catalog slugs before canonical launch ids.
  if (dashboardId === 'pet-sitter') {
    for (const legacy of ['sitting', 'sitter', 'pet_sitter']) {
      if (legacy !== slug && legacy !== dashboardId && existingConfig[legacy]) {
        parts.push(existingConfig[legacy]);
      }
    }
  }
  if (dashboardId === 'holiday') {
    for (const legacy of ['pet-holiday', 'pet_holiday', 'pet_holiday_planner']) {
      if (legacy !== slug && legacy !== dashboardId && existingConfig[legacy]) {
        parts.push(existingConfig[legacy]);
      }
    }
  }
  if (dashboardId === 'training') {
    for (const legacy of ['behavioral', 'behaviorist', 'pet_behaviorist', 'pet_trainer', 'trainer']) {
      if (legacy !== slug && legacy !== dashboardId && existingConfig[legacy]) {
        parts.push(existingConfig[legacy]);
      }
    }
  }
  if (dashboardId === 'nutritionist') {
    for (const legacy of ['nutrition', 'wellness']) {
      if (legacy !== slug && legacy !== dashboardId && existingConfig[legacy]) {
        parts.push(existingConfig[legacy]);
      }
    }
  }
  if (slug !== dashboardId && existingConfig[slug]) {
    parts.push(existingConfig[slug]);
  }
  if (existingConfig[dashboardId]) {
    parts.push(existingConfig[dashboardId]);
  }
  return mergeServiceLaunchEntries(...parts);
}

// Get icon for service
function getServiceIcon(serviceId: string | null | undefined, categoryId: string | null | undefined): string {
  const normalizedServiceId = (serviceId || '').toLowerCase();
  const normalizedCategoryId = (categoryId || '').toLowerCase();
  
  // Check service ID first
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (normalizedServiceId.includes(key)) return icon;
  }
  
  // Check category ID
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (normalizedCategoryId.includes(key)) return icon;
  }
  
  return SERVICE_ICONS.default;
}

/** Collapse legacy UUID keys in stored launch config into canonical dashboard ids (e.g. pet-sitter). */
async function canonicalizeServiceLaunchConfig(raw: Record<string, any>): Promise<Record<string, any>> {
  if (!raw || typeof raw !== 'object') return {};
  const uuidKeys = Object.keys(raw).filter(isUuidKey);
  const uuidToSlug = new Map<string, string>();
  if (uuidKeys.length > 0) {
    const uuidRes = await query(
      `SELECT id::text AS id, category_id::text AS category_id
       FROM service_categories
       WHERE id::text = ANY($1::text[])`,
      [uuidKeys]
    ).catch(() => ({ rows: [] }));
    for (const r of uuidRes.rows || []) {
      if (r.category_id) uuidToSlug.set(r.id, String(r.category_id).trim());
    }
  }

  const buckets = new Map<string, string[]>();
  for (const key of Object.keys(raw)) {
    let slug = key;
    if (isUuidKey(key)) {
      const resolved = uuidToSlug.get(key);
      if (resolved) slug = resolved;
    }
    const canonicalId = mapCatalogSlugToLaunchServiceId(slug);
    if (!buckets.has(canonicalId)) buckets.set(canonicalId, []);
    buckets.get(canonicalId)!.push(key);
  }

  const out: Record<string, any> = {};
  for (const [canonicalId, keys] of buckets) {
    // Merge UUID / legacy keys first, canonical id key last so admin saves under `holiday` (etc.) win.
    const rank = (k: string) => {
      if (isUuidKey(k)) return 0;
      if (String(k).toLowerCase() === String(canonicalId).toLowerCase()) return 2;
      return 1;
    };
    const ordered = [...keys].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
    out[canonicalId] = mergeServiceLaunchEntries(...ordered.map((k) => raw[k]));
  }
  return out;
}

// Setting key for service launch config
const SETTING_KEY = 'platform:service-launch-config';

/** Dashboard tiles not always present in published service_catalog rows. */
const ADDITIONAL_DASHBOARD_SERVICES: ReadonlyArray<{ id: string; name: string; icon: string }> = [
  { id: 'shop', name: 'Pet Products', icon: '🛍️' },
  { id: 'adoption', name: 'Adoption', icon: '❤️' },
  { id: 'mating', name: 'Peer to Peer', icon: '💕' },
  { id: 'cafes', name: 'Pet Cafes', icon: '☕' },
  { id: 'photography', name: 'Photography', icon: '📷' },
  { id: 'insurance', name: 'Insurance', icon: '🛡️' },
  { id: 'breeder', name: 'Breeder', icon: '🐕' },
  { id: 'nutritionist', name: 'Nutritionist', icon: '🥗' },
  { id: 'relocation', name: 'Pet Relocation', icon: '✈️' },
  { id: 'resort', name: 'Pet Resort', icon: '🏖️' },
  { id: 'holiday', name: 'Pet Holiday', icon: '🌴' },
  { id: 'pet-sitter', name: 'Pet Sitter', icon: '🏠' },
  { id: 'sunset', name: 'Sunset Care', icon: '🌅' },
];

export type DashboardLaunchService = {
  id: string;
  serviceId: string;
  serviceName: string;
  displayName: string;
  icon: string;
  categoryId: string;
  categoryName: string;
  displayOrder: number;
  defaultStatus: LaunchStatus;
  defaultRolloutPercentage: number;
  stateOverrides: Record<string, StateConfig>;
  styleOverrides?: Partial<Record<ServiceStyleLaunchKey, GeoLaunchSlice>>;
  supportedStyles?: ServiceStyleLaunchKey[];
  effectiveStyles?: Record<
    ServiceStyleLaunchKey,
    { effectiveStatus: LaunchStatus; effectiveRolloutPercentage: number; inheritsParent: boolean }
  >;
  effectiveStatus: LaunchStatus;
  effectiveRolloutPercentage: number;
};

function resolveStateCodeFromName(state: string): string {
  if (!state) return '';
  const cleanedState = state.replace(/\s*\d{6}\s*$/, '').trim();
  const stateMatch = INDIAN_STATES.find((s) => {
    const sNameLower = s.name.toLowerCase();
    const sCodeLower = s.code.toLowerCase();
    const queryLower = state.toLowerCase();
    const cleanedLower = cleanedState.toLowerCase();
    return (
      queryLower === sNameLower ||
      queryLower === sCodeLower ||
      cleanedLower === sNameLower ||
      cleanedLower === sCodeLower
    );
  });
  return stateMatch?.code || '';
}

async function loadExistingLaunchConfigRaw(): Promise<{
  existingConfig: Record<string, ServiceLaunchConfig>;
  uuidToSlug: Map<string, string>;
}> {
  const configResult = await query(
    `SELECT setting_value FROM platform_settings WHERE setting_key = $1`,
    [SETTING_KEY]
  ).catch(() => ({ rows: [] }));

  let existingConfig: Record<string, ServiceLaunchConfig> = {};
  if (configResult.rows && configResult.rows.length > 0) {
    try {
      const value = configResult.rows[0].setting_value;
      existingConfig = typeof value === 'string' ? JSON.parse(value) : value;
    } catch (e) {
      console.warn('Failed to parse existing config:', e);
    }
  }

  const uuidKeys = Object.keys(existingConfig).filter(isUuidKey);
  const uuidToSlug = new Map<string, string>();
  if (uuidKeys.length > 0) {
    const uuidRes = await query(
      `SELECT id::text AS id, category_id::text AS category_id
       FROM service_categories
       WHERE id::text = ANY($1::text[])`,
      [uuidKeys]
    ).catch(() => ({ rows: [] }));
    for (const r of uuidRes.rows || []) {
      if (r.category_id) uuidToSlug.set(r.id, String(r.category_id).trim());
    }
  }

  return { existingConfig, uuidToSlug };
}

function effectiveStatusForGeography(
  existingService: Partial<ServiceLaunchConfig> | undefined,
  stateCode: string,
  city: string
): { status: LaunchStatus; rollout: number } {
  return resolveGeoLaunchStatus(existingService, stateCode, city, 'hidden');
}

function buildEffectiveStylesForService(
  existingService: Partial<ServiceLaunchConfig> | undefined,
  stateCode: string,
  city: string,
  serviceId: string
): Record<
  ServiceStyleLaunchKey,
  { effectiveStatus: LaunchStatus; effectiveRolloutPercentage: number; inheritsParent: boolean }
> | undefined {
  const supported = supportedStylesForLaunchServiceId(serviceId);
  if (!supported.length) return undefined;
  const out = {} as Record<
    ServiceStyleLaunchKey,
    { effectiveStatus: LaunchStatus; effectiveRolloutPercentage: number; inheritsParent: boolean }
  >;
  for (const styleKey of supported) {
    const resolved = effectiveStyleStatusForGeography(existingService, styleKey, stateCode, city, 'hidden');
    out[styleKey] = {
      effectiveStatus: resolved.status,
      effectiveRolloutPercentage: resolved.rollout,
      inheritsParent: resolved.inheritsParent,
    };
  }
  return out;
}

/**
 * Full Marketing dashboard catalog (service_catalog + additional tiles) with per-geo status.
 * Shared by admin GET /config/service-launch and customer GET /config/service-launch/customer.
 */
export async function buildDashboardServiceCatalog(
  stateCode: string,
  city: string
): Promise<DashboardLaunchService[]> {
  const categoriesResult = await query(
    `SELECT 
       sc.category_id AS catalog_category_id,
       COALESCE(
         NULLIF(TRIM(MAX(cat.name)), ''),
         NULLIF(TRIM(MAX(sc.category_name)), ''),
         MAX(sc.category_id)
       ) AS category_name,
       COALESCE(MAX(cat.category_id::text), MAX(sc.category_id::text)) AS category_slug,
       MIN(sc.display_order) AS display_order
     FROM service_catalog sc
     LEFT JOIN service_categories cat
       ON (cat.id::text = sc.category_id OR LOWER(TRIM(cat.category_id::text)) = LOWER(TRIM(sc.category_id::text)))
     WHERE sc.status = 'active'
       AND sc.publish_status = 'published'
     GROUP BY sc.category_id
     ORDER BY MIN(sc.display_order)`
  ).catch(() => ({ rows: [] }));

  const { existingConfig, uuidToSlug } = await loadExistingLaunchConfigRaw();

  const dashboardServices: DashboardLaunchService[] = [];
  const processedCategories = new Set<string>();

  for (const cat of categoriesResult.rows || []) {
    const slug = String(cat.category_slug || cat.catalog_category_id || '').trim();
    if (!slug) continue;

    const dashboardId = mapCatalogSlugToLaunchServiceId(slug);
    if (dashboardId === 'general') continue;
    if (processedCategories.has(dashboardId)) continue;
    processedCategories.add(dashboardId);

    const displayName = String(cat.category_name || slug).trim();
    const existingService = collectLaunchConfigForCategory(slug, dashboardId, existingConfig, uuidToSlug);
    const icon = getServiceIcon(dashboardId, slug);
    const { status, rollout } = effectiveStatusForGeography(existingService, stateCode, city);

    dashboardServices.push({
      id: dashboardId,
      serviceId: dashboardId,
      serviceName: displayName,
      displayName,
      icon,
      categoryId: slug,
      categoryName: displayName,
      displayOrder: cat.display_order,
      defaultStatus: existingService?.defaultStatus || 'hidden',
      defaultRolloutPercentage: existingService?.defaultRolloutPercentage || 0,
      stateOverrides: existingService?.stateOverrides || {},
      styleOverrides: existingService?.styleOverrides,
      supportedStyles: supportedStylesForLaunchServiceId(dashboardId),
      effectiveStyles: buildEffectiveStylesForService(existingService, stateCode, city, dashboardId),
      effectiveStatus: status,
      effectiveRolloutPercentage: rollout,
    });
  }

  for (const svc of ADDITIONAL_DASHBOARD_SERVICES) {
    if (processedCategories.has(svc.id)) continue;
    processedCategories.add(svc.id);

    const existingService = collectLaunchConfigForCategory(svc.id, svc.id, existingConfig, uuidToSlug);
    const { status, rollout } = effectiveStatusForGeography(existingService, stateCode, city);

    dashboardServices.push({
      id: svc.id,
      serviceId: svc.id,
      serviceName: svc.name,
      displayName: svc.name,
      icon: svc.icon,
      categoryId: svc.id,
      categoryName: svc.name,
      displayOrder: 100 + ADDITIONAL_DASHBOARD_SERVICES.findIndex((s) => s.id === svc.id),
      defaultStatus: existingService?.defaultStatus || 'hidden',
      defaultRolloutPercentage: existingService?.defaultRolloutPercentage || 0,
      stateOverrides: existingService?.stateOverrides || {},
      styleOverrides: existingService?.styleOverrides,
      supportedStyles: supportedStylesForLaunchServiceId(svc.id),
      effectiveStyles: buildEffectiveStylesForService(existingService, stateCode, city, svc.id),
      effectiveStatus: status,
      effectiveRolloutPercentage: rollout,
    });
  }

  dashboardServices.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  return dashboardServices;
}

function bucketDashboardServicesByCustomerStatus(catalog: DashboardLaunchService[]) {
  const visibleServices: any[] = [];
  const comingSoonServices: any[] = [];
  const hiddenServices: any[] = [];

  for (const svc of catalog) {
    const status = svc.effectiveStatus;
    const serviceInfo = {
      serviceId: svc.serviceId,
      displayName: svc.displayName,
      status,
      rolloutPercentage: svc.effectiveRolloutPercentage,
      isVisible: status === 'launched' || status === 'beta',
      isComingSoon: status === 'coming_soon',
    };

    if (status === 'launched' || status === 'beta') {
      visibleServices.push(serviceInfo);
    } else if (status === 'coming_soon') {
      comingSoonServices.push(serviceInfo);
    } else {
      hiddenServices.push(serviceInfo);
    }
  }

  return { visibleServices, comingSoonServices, hiddenServices };
}

export function registerServiceLaunchConfigEndpoints(app: Hono) {
  
  /**
   * GET /config/service-launch/states
   * Get list of Indian states for the selector
   */
  app.get('/config/service-launch/states', async (c) => {
    return c.json({
      success: true,
      states: INDIAN_STATES,
    });
  });

  /**
   * GET /config/service-launch/cities
   * Get list of cities for a state
   * Query params: stateCode
   */
  app.get('/config/service-launch/cities', async (c) => {
    const stateCode = c.req.query('stateCode');
    
    if (!stateCode) {
      return c.json({ 
        success: false, 
        error: 'stateCode query parameter is required' 
      }, 400);
    }
    
    const cities = MAJOR_CITIES[stateCode.toUpperCase()] || [];
    
    return c.json({
      success: true,
      stateCode,
      cities,
    });
  });

  /**
   * GET /config/service-launch
   * Get all dashboard services with their launch configuration
   * Query params: stateCode (optional), city (optional)
   * 
   * Returns services grouped by dashboard category with launch status
   */
  app.get('/config/service-launch', async (c) => {
    try {
      const stateCode = c.req.query('stateCode') || '';
      const city = c.req.query('city') || '';
      const dashboardServices = await buildDashboardServiceCatalog(stateCode, city);

      return c.json({
        success: true,
        services: dashboardServices,
        requestedGeography: {
          stateCode: stateCode || null,
          city: city || null,
        },
        availableStates: INDIAN_STATES,
      });
    } catch (error: any) {
      console.error('Error fetching service launch config:', error);
      return c.json({ 
        success: false, 
        error: error.message || 'Failed to fetch service launch configuration' 
      }, 500);
    }
  });

  /**
   * PUT /config/service-launch
   * Update service launch configuration
   * Body: { serviceId, defaultStatus, defaultRolloutPercentage, stateOverrides }
   * 
   * Can update single service or multiple services at once
   */
  app.put('/config/service-launch', async (c) => {
    try {
      const body = await c.req.json();
      const { services, serviceId, ...singleServiceConfig } = body;

      // Get existing config
      const configResult = await query(
        `SELECT setting_value FROM platform_settings WHERE setting_key = $1`,
        [SETTING_KEY]
      ).catch(() => ({ rows: [] }));

      let existingConfig: Record<string, any> = {};
      if (configResult.rows && configResult.rows.length > 0) {
        try {
          const value = configResult.rows[0].setting_value;
          existingConfig = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
          console.warn('Failed to parse existing config:', e);
        }
      }

      // Handle bulk update (array of services)
      if (Array.isArray(services)) {
        for (const svc of services) {
          if (!svc.serviceId) continue;
          existingConfig[svc.serviceId] = {
            ...existingConfig[svc.serviceId],
            ...svc,
            styleOverrides:
              svc.styleOverrides !== undefined
                ? svc.styleOverrides
                : existingConfig[svc.serviceId]?.styleOverrides,
            updatedAt: new Date().toISOString(),
          };
        }
      }
      // Handle single service update
      else if (serviceId) {
        existingConfig[serviceId] = {
          ...existingConfig[serviceId],
          serviceId,
          ...singleServiceConfig,
          updatedAt: new Date().toISOString(),
        };
      } else {
        return c.json({ 
          success: false, 
          error: 'Either services array or serviceId is required' 
        }, 400);
      }

      // Upsert the configuration
      const configExists = configResult.rows && configResult.rows.length > 0;
      
      if (configExists) {
        await query(
          `UPDATE platform_settings 
           SET setting_value = $1, updated_at = NOW() 
           WHERE setting_key = $2`,
          [JSON.stringify(existingConfig), SETTING_KEY]
        );
      } else {
        await query(
          `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
           VALUES ($1, $2, 'object', 'Service launch configuration by geography', NOW(), NOW())`,
          [SETTING_KEY, JSON.stringify(existingConfig)]
        );
      }

      return c.json({
        success: true,
        message: 'Service launch configuration saved successfully',
        config: existingConfig,
      });
    } catch (error: any) {
      console.error('Error saving service launch config:', error);
      return c.json({ 
        success: false, 
        error: error.message || 'Failed to save service launch configuration' 
      }, 500);
    }
  });

  /**
   * PUT /config/service-launch/geography
   * Update launch status for a specific service + geography combination
   * Body: { serviceId, serviceStyle?, stateCode?, city?, status, rolloutPercentage }
   * When serviceStyle is tele | at_center | at_home, only the style override slice is persisted.
   */
  app.put('/config/service-launch/geography', async (c) => {
    try {
      const body = await c.req.json();
      const { serviceId, serviceStyle, stateCode, city, status, rolloutPercentage = 100 } = body;

      if (!serviceId) {
        return c.json({ success: false, error: 'serviceId is required' }, 400);
      }

      if (!['hidden', 'coming_soon', 'beta', 'launched'].includes(status)) {
        return c.json({ 
          success: false, 
          error: 'status must be one of: hidden, coming_soon, beta, launched' 
        }, 400);
      }

      const styleKey =
        serviceStyle && SERVICE_STYLE_LAUNCH_KEYS.includes(serviceStyle)
          ? (serviceStyle as ServiceStyleLaunchKey)
          : null;
      if (serviceStyle && !styleKey) {
        return c.json({
          success: false,
          error: 'serviceStyle must be one of: tele, at_center, at_home',
        }, 400);
      }

      const supportedStyles = supportedStylesForLaunchServiceId(serviceId);
      if (styleKey && !supportedStyles.includes(styleKey)) {
        return c.json({
          success: false,
          error: `serviceStyle "${styleKey}" is not supported for service "${serviceId}"`,
        }, 400);
      }

      // Get existing config
      const configResult = await query(
        `SELECT setting_value FROM platform_settings WHERE setting_key = $1`,
        [SETTING_KEY]
      ).catch(() => ({ rows: [] }));

      let existingConfig: Record<string, any> = {};
      if (configResult.rows && configResult.rows.length > 0) {
        const value = configResult.rows[0].setting_value;
        existingConfig = typeof value === 'string' ? JSON.parse(value) : value;
      }

      // Initialize service config if not exists
      if (!existingConfig[serviceId]) {
        existingConfig[serviceId] = {
          serviceId,
          defaultStatus: 'hidden',
          defaultRolloutPercentage: 0,
          stateOverrides: {},
          createdAt: new Date().toISOString(),
        };
      }

      const serviceConfig = existingConfig[serviceId];

      if (styleKey) {
        if (!serviceConfig.styleOverrides) serviceConfig.styleOverrides = {};
        const currentSlice: GeoLaunchSlice = serviceConfig.styleOverrides[styleKey] || {};
        serviceConfig.styleOverrides[styleKey] = applyGeographyUpdateToSlice(
          currentSlice,
          stateCode || undefined,
          city || undefined,
          status as LaunchStatus,
          rolloutPercentage
        );
      } else if (!stateCode) {
        serviceConfig.defaultStatus = status;
        serviceConfig.defaultRolloutPercentage = rolloutPercentage;
      } else if (!city) {
        if (!serviceConfig.stateOverrides) {
          serviceConfig.stateOverrides = {};
        }
        if (!serviceConfig.stateOverrides[stateCode]) {
          serviceConfig.stateOverrides[stateCode] = {
            cities: {},
          };
        }
        serviceConfig.stateOverrides[stateCode].status = status;
        serviceConfig.stateOverrides[stateCode].rolloutPercentage = rolloutPercentage;
      } else {
        if (!serviceConfig.stateOverrides) {
          serviceConfig.stateOverrides = {};
        }
        if (!serviceConfig.stateOverrides[stateCode]) {
          serviceConfig.stateOverrides[stateCode] = {
            cities: {},
          };
        }
        if (!serviceConfig.stateOverrides[stateCode].cities) {
          serviceConfig.stateOverrides[stateCode].cities = {};
        }
        const citiesMap = serviceConfig.stateOverrides[stateCode].cities;
        const canonCity = normalizeIndianCityName(city);
        const cityKey = canonCity || city;
        for (const k of Object.keys(citiesMap)) {
          if (k !== cityKey && normalizeIndianCityName(k) === cityKey) {
            delete citiesMap[k];
          }
        }
        citiesMap[cityKey] = {
          status,
          rolloutPercentage,
        };
      }

      serviceConfig.updatedAt = new Date().toISOString();
      existingConfig[serviceId] = serviceConfig;

      // Upsert the configuration
      const configExists = configResult.rows && configResult.rows.length > 0;
      
      if (configExists) {
        await query(
          `UPDATE platform_settings 
           SET setting_value = $1, updated_at = NOW() 
           WHERE setting_key = $2`,
          [JSON.stringify(existingConfig), SETTING_KEY]
        );
      } else {
        await query(
          `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
           VALUES ($1, $2, 'object', 'Service launch configuration by geography', NOW(), NOW())`,
          [SETTING_KEY, JSON.stringify(existingConfig)]
        );
      }

      return c.json({
        success: true,
        message: 'Service launch status updated',
        serviceId,
        serviceStyle: styleKey || null,
        geography: { stateCode: stateCode || 'all', city: city || 'all' },
        status,
        rolloutPercentage,
      });
    } catch (error: any) {
      console.error('Error updating service launch geography:', error);
      return c.json({ 
        success: false, 
        error: error.message || 'Failed to update service launch status' 
      }, 500);
    }
  });

  /**
   * GET /config/service-launch/customer
   * Get visible services for a customer based on their location
   * Query params: state, city
   * 
   * This endpoint is used by the customer web app to determine
   * which services to show on the dashboard
   */
  app.get('/config/service-launch/customer', async (c) => {
    try {
      const state = c.req.query('state') || '';
      const city = c.req.query('city') || '';
      const stateCode = resolveStateCodeFromName(state);

      const catalog = await buildDashboardServiceCatalog(stateCode, city);
      const { visibleServices, comingSoonServices, hiddenServices } =
        bucketDashboardServicesByCustomerStatus(catalog);

      return c.json({
        success: true,
        location: {
          state: state || null,
          stateCode: stateCode || null,
          city: city || null,
        },
        services: {
          catalog: catalog.map((svc) => ({
            serviceId: svc.serviceId,
            displayName: svc.displayName,
            icon: svc.icon,
            categoryId: svc.categoryId,
            effectiveStatus: svc.effectiveStatus,
            rolloutPercentage: svc.effectiveRolloutPercentage,
            supportedStyles: svc.supportedStyles,
            effectiveStyles: svc.effectiveStyles,
          })),
          visible: visibleServices,
          comingSoon: comingSoonServices,
          hidden: hiddenServices,
        },
        // For backward compatibility with old dashboard config format
        buttons: [
          ...visibleServices.map(s => ({ id: s.serviceId, enabled: true, launchPhase: s.status === 'beta' ? 'beta' : 'full' })),
          ...comingSoonServices.map(s => ({ id: s.serviceId, enabled: false, launchPhase: 'coming_soon' })),
        ],
      });
    } catch (error: any) {
      console.error('Error fetching customer service launch config:', error);
      // Graceful degradation: return 200 with defaults so customer home loads
      return c.json({
        success: true,
        location: { state: null, stateCode: null, city: null },
        services: { visible: [], comingSoon: [], hidden: [], catalog: [] },
        buttons: [],
      }, 200);
    }
  });
}
