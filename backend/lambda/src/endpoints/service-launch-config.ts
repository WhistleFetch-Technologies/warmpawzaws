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
import { mapCatalogSlugToLaunchServiceId } from '@warmpawz/service-launch-mappings';
import { query } from '../database/rds-connection';

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
 * Canonical Indian city names for launch config keys and lookups.
 * Admin UI lists "Bangalore" while some data may use "Bengaluru"; without this,
 * city overrides are missed and state-level "Launched" appears after setting Hidden.
 */
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

function normalizeIndianCityName(cityName: string): string {
  const t = String(cityName || '').trim();
  if (!t) return '';
  const mapped = CITY_NAME_ALIASES[t.toLowerCase()];
  return mapped || t;
}

// Launch status types
export type LaunchStatus = 'hidden' | 'coming_soon' | 'beta' | 'launched';

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
  // Metadata
  createdAt: string;
  updatedAt: string;
}

interface StateConfig {
  status: LaunchStatus;
  rolloutPercentage: number;
  // City-level overrides within the state
  cities: Record<string, CityConfig>;
}

interface CityConfig {
  status: LaunchStatus;
  rolloutPercentage: number;
}

function getCityLaunchOverride(
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

function mergeStateOverrides(
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

      // 1. Unique catalog categories with names/slugs resolved via service_categories
      //    (fixes rows where service_catalog.category_id was set to service_categories.id UUID)
      //    Prefer service_categories.name over service_catalog.category_name: legacy backfills
      //    used the literal "General" when category_name was empty (see migration 511), which
      //    would otherwise hide the real category label (e.g. Vet, Training) on this dashboard.
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

      // 2. Get existing launch configuration
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

      // 3. Build service list from categories + additional dashboard services
      const dashboardServices: any[] = [];
      const processedCategories = new Set<string>();

      // Add services from service_catalog categories
      for (const cat of categoriesResult.rows || []) {
        const slug = String(cat.category_slug || cat.catalog_category_id || '').trim();
        if (!slug) continue;

        const dashboardId = mapCatalogSlugToLaunchServiceId(slug);

        // Legacy placeholder row — not a real launch surface (see service_catalog migration 511).
        if (dashboardId === 'general') continue;

        if (processedCategories.has(dashboardId)) continue;
        processedCategories.add(dashboardId);

        const displayName = String(cat.category_name || slug).trim();
        const existingService = collectLaunchConfigForCategory(slug, dashboardId, existingConfig, uuidToSlug);
        const icon = getServiceIcon(dashboardId, slug);

        // Determine effective status for the requested geography
        let effectiveStatus: LaunchStatus = existingService?.defaultStatus || 'hidden';
        let effectiveRollout = existingService?.defaultRolloutPercentage || 0;

        if (stateCode && existingService?.stateOverrides?.[stateCode]) {
          const stateConfig = existingService.stateOverrides[stateCode];
          effectiveStatus = stateConfig.status;
          effectiveRollout = stateConfig.rolloutPercentage;

          const cityConfig = city ? getCityLaunchOverride(stateConfig.cities, city) : undefined;
          if (cityConfig) {
            effectiveStatus = cityConfig.status;
            effectiveRollout = cityConfig.rolloutPercentage;
          }
        }

        dashboardServices.push({
          id: dashboardId,
          serviceId: dashboardId,
          serviceName: displayName,
          displayName,
          icon,
          categoryId: slug,
          categoryName: displayName,
          displayOrder: cat.display_order,
          // Full config for admin editing
          defaultStatus: existingService?.defaultStatus || 'hidden',
          defaultRolloutPercentage: existingService?.defaultRolloutPercentage || 0,
          stateOverrides: existingService?.stateOverrides || {},
          // Effective status for the requested geography
          effectiveStatus,
          effectiveRolloutPercentage: effectiveRollout,
        });
      }

      // 4. Add additional dashboard services not in catalog categories
      //    (Always show these tiles in Marketing → Dashboard UI even when service_catalog
      //    has no active+published row for that category — e.g. Pet Sitter.)
      const additionalServices = [
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

      for (const svc of additionalServices) {
        if (processedCategories.has(svc.id)) continue;
        processedCategories.add(svc.id);

        const existingService = collectLaunchConfigForCategory(svc.id, svc.id, existingConfig, uuidToSlug);

        let effectiveStatus: LaunchStatus = existingService?.defaultStatus || 'hidden';
        let effectiveRollout = existingService?.defaultRolloutPercentage || 0;

        if (stateCode && existingService?.stateOverrides?.[stateCode]) {
          const stateConfig = existingService.stateOverrides[stateCode];
          effectiveStatus = stateConfig.status;
          effectiveRollout = stateConfig.rolloutPercentage;

          const cityCfg = city ? getCityLaunchOverride(stateConfig.cities, city) : undefined;
          if (cityCfg) {
            effectiveStatus = cityCfg.status;
            effectiveRollout = cityCfg.rolloutPercentage;
          }
        }

        dashboardServices.push({
          id: svc.id,
          serviceId: svc.id,
          serviceName: svc.name,
          displayName: svc.name,
          icon: svc.icon,
          categoryId: svc.id,
          categoryName: svc.name,
          displayOrder: 100 + additionalServices.indexOf(svc),
          defaultStatus: existingService?.defaultStatus || 'hidden',
          defaultRolloutPercentage: existingService?.defaultRolloutPercentage || 0,
          stateOverrides: existingService?.stateOverrides || {},
          effectiveStatus,
          effectiveRolloutPercentage: effectiveRollout,
        });
      }

      // Sort by display order
      dashboardServices.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

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
   * Body: { serviceId, stateCode?, city?, status, rolloutPercentage }
   */
  app.put('/config/service-launch/geography', async (c) => {
    try {
      const body = await c.req.json();
      const { serviceId, stateCode, city, status, rolloutPercentage = 100 } = body;

      if (!serviceId) {
        return c.json({ success: false, error: 'serviceId is required' }, 400);
      }

      if (!['hidden', 'coming_soon', 'beta', 'launched'].includes(status)) {
        return c.json({ 
          success: false, 
          error: 'status must be one of: hidden, coming_soon, beta, launched' 
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

      // Update based on geography level
      if (!stateCode) {
        // Update default (all India)
        serviceConfig.defaultStatus = status;
        serviceConfig.defaultRolloutPercentage = rolloutPercentage;
      } else if (!city) {
        // Update state level
        if (!serviceConfig.stateOverrides) {
          serviceConfig.stateOverrides = {};
        }
        if (!serviceConfig.stateOverrides[stateCode]) {
          serviceConfig.stateOverrides[stateCode] = {
            status: 'hidden',
            rolloutPercentage: 0,
            cities: {},
          };
        }
        serviceConfig.stateOverrides[stateCode].status = status;
        serviceConfig.stateOverrides[stateCode].rolloutPercentage = rolloutPercentage;
      } else {
        // Update city level
        if (!serviceConfig.stateOverrides) {
          serviceConfig.stateOverrides = {};
        }
        if (!serviceConfig.stateOverrides[stateCode]) {
          serviceConfig.stateOverrides[stateCode] = {
            status: 'hidden',
            rolloutPercentage: 0,
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

      // Find state code from state name (case-insensitive)
      let stateCode = '';
      if (state) {
        const stateMatch = INDIAN_STATES.find(
          s => s.name.toLowerCase() === state.toLowerCase() || 
               s.code.toLowerCase() === state.toLowerCase()
        );
        stateCode = stateMatch?.code || '';
      }

      // Get configuration
      const configResult = await query(
        `SELECT setting_value FROM platform_settings WHERE setting_key = $1`,
        [SETTING_KEY]
      ).catch(() => ({ rows: [] }));

      let config: Record<string, ServiceLaunchConfig> = {};
      if (configResult.rows && configResult.rows.length > 0) {
        const value = configResult.rows[0].setting_value;
        config = typeof value === 'string' ? JSON.parse(value) : value;
      }

      const canonicalConfig = await canonicalizeServiceLaunchConfig(config as Record<string, any>);

      // Build list of visible services with their status
      const visibleServices: any[] = [];
      const comingSoonServices: any[] = [];
      const hiddenServices: any[] = [];

      for (const [serviceId, serviceConfig] of Object.entries(canonicalConfig)) {
        let status: LaunchStatus = serviceConfig.defaultStatus || 'hidden';
        let rollout = serviceConfig.defaultRolloutPercentage || 0;

        // Check state override
        if (stateCode && serviceConfig.stateOverrides?.[stateCode]) {
          const stateConfig = serviceConfig.stateOverrides[stateCode];
          status = stateConfig.status;
          rollout = stateConfig.rolloutPercentage;

          const cityConfig = city ? getCityLaunchOverride(stateConfig.cities, city) : undefined;
          if (cityConfig) {
            status = cityConfig.status;
            rollout = cityConfig.rolloutPercentage;
          }
        }

        const serviceInfo = {
          serviceId,
          status,
          rolloutPercentage: rollout,
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

      return c.json({
        success: true,
        location: {
          state: state || null,
          stateCode: stateCode || null,
          city: city || null,
        },
        services: {
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
        services: { visible: [], comingSoon: [], hidden: [] },
        buttons: [],
      }, 200);
    }
  });
}
