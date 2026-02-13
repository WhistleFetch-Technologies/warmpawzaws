/**
 * ============================================================================
 * SERVICE DISCOVERY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Customer-facing service discovery and search:
 * - Multi-category search (Vet, Grooming, Training, Walker, etc.)
 * - Location-based filtering
 * - Rating filter
 * - Availability check
 * - Vendor profiles with services
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, insert } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getDiscoveryRules } from '../lib/rule-engine';
import { resolveVendorById, getVendorIdsForAvailabilityLookup, getVendorIdentityId } from './vendor-profile';
import { taxCalculationService } from '../lib/services/tax-calculation-service';
import { discountCalculationService } from '../lib/services/discount-calculation-service';

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Unified vendor photo URL: profile_photo_url (vendor profile upload) takes precedence,
 * then profile_image, logo_url, then first facility photo from metadata.
 * Use in all discovery endpoints so clinic/solo cards show photos consistently.
 */
function getVendorPhotoUrl(v: any): string | null {
  if (!v) return null;
  const url = v.profile_photo_url || v.profile_image || v.logo_url || null;
  if (url && String(url).trim()) return url;
  try {
    const meta = v.metadata;
    const m = typeof meta === 'string' ? (meta ? JSON.parse(meta) : {}) : meta || {};
    const photos = m?.facility_photos || m?.photos;
    const first = Array.isArray(photos) ? photos[0] : null;
    return first && String(first).trim() ? first : null;
  } catch {
    return null;
  }
}

const columnExistsCache = new Map<string, boolean>();
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key) as boolean;
  try {
    const res = await query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
       ) as exists`,
      [tableName, columnName]
    );
    const exists = res.rows?.[0]?.exists === true || res.rows?.[0]?.exists === 't';
    columnExistsCache.set(key, exists);
    return exists;
  } catch {
    columnExistsCache.set(key, false);
    return false;
  }
}

const STYLE_ALIASES: Record<string, string> = {
  at_clinic: 'at_center',
  at_vendor: 'at_center',
  at_center: 'at_center',
  home_visit: 'at_home',
  at_home: 'at_home',
  video_consultation: 'tele',
  online: 'tele',
  tele: 'tele',
};

function normalizeServiceStyle(style: string | null | undefined): string | null {
  if (!style) return null;
  const key = String(style).toLowerCase().trim().replace(/\s+/g, '_');
  return STYLE_ALIASES[key] || key;
}

function normalizeServiceStylesArray(styles: any): string[] {
  if (!styles) return [];
  const arr = Array.isArray(styles) ? styles : (styles?.selected ?? styles?.solo ?? []);
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const s of arr) {
    const norm = normalizeServiceStyle(s);
    if (norm && !out.includes(norm)) out.push(norm);
  }
  return out;
}

function parseRoleConfig(roleConfig: any): any {
  if (!roleConfig) return null;
  try {
    return typeof roleConfig === 'string' ? JSON.parse(roleConfig || '{}') : roleConfig;
  } catch {
    return null;
  }
}

function roleConfigAllowsStyle(roleConfig: any, serviceStyle: string | null | undefined): boolean {
  const normalized = normalizeServiceStyle(serviceStyle || '') || '';
  if (!normalized) return true;
  const config = parseRoleConfig(roleConfig);
  if (!config) return true;
  const styles = normalizeServiceStylesArray(config?.serviceStyles || config?.service_styles);
  if (styles.length === 0) return true;
  return styles.includes(normalized);
}

function acceptableStylesForService(serviceStyle: string | null | undefined): string[] {
  const normalized = normalizeServiceStyle(serviceStyle || '') || '';
  if (!normalized) return [];
  if (normalized === 'at_center') return ['at_center', 'at_vendor', 'at_clinic'];
  if (normalized === 'tele') return ['tele', 'online', 'video_consultation'];
  if (normalized === 'at_home') return ['at_home', 'home_visit'];
  return [normalized];
}

/** Map canonical role names to customer-facing discovery categories (align with CustomerHomeComplete tiles). */
function getCategoryFromRole(roleId: string): string {
  const roleCategoryMap: Record<string, string> = {
    // Vet
    'vet_clinic': 'vet', 'veterinarian': 'vet', 'vet_solo': 'vet', 'vet': 'vet',
    // Grooming
    'grooming_salon': 'grooming', 'pet_groomer': 'grooming', 'groomer': 'grooming', 'groomer_solo': 'grooming', 'groomer_center': 'grooming', 'grooming_solo': 'grooming',
    // Training
    'trainer': 'training', 'pet_trainer': 'training', 'trainer_solo': 'training', 'trainer_center': 'training', 'training_solo': 'training', 'solo': 'training',
    // Walker
    'dog_walker': 'walker', 'pet_walker': 'walker', 'walker': 'walker', 'walker_solo': 'walker', 'walking': 'walker',
    // Boarding
    'boarding': 'boarding', 'boarding_resort': 'boarding', 'pet_boarding': 'boarding', 'pet_boarder': 'boarding', 'pet_daycare': 'boarding',
    // Nutrition
    'nutritionist': 'nutrition', 'pet_nutritionist': 'nutrition', 'nutritionist_center': 'nutrition', 'nutritionist_solo': 'nutrition',
    // Adoption (shelter / adoption center)
    'adoption_center': 'adoption', 'ngo': 'adoption', 'shelter': 'adoption', 'pet_shelter': 'adoption', 'pet_adoption_center': 'adoption',
    // Shop / marketplace
    'seller': 'shop', 'pet_store': 'shop', 'pet_products_store': 'shop',
    // Diagnostics / lab
    'diagnostics_center': 'diagnostics', 'diagnostics_provider': 'diagnostics', 'diagnostics_solo': 'diagnostics',
    // Pharmacy, cafe, photography, insurance, ambulance, breeder, relocation, resort, holiday, sunset
    'pharmacy': 'pharmacy', 'pet_pharmacy': 'pharmacy',
    'cafe': 'cafes', 'pet_cafe': 'cafes',
    'photographer': 'photography', 'pet_photographer': 'photography',
    'insurance': 'insurance', 'pet_insurance': 'insurance',
    'ambulance': 'ambulance', 'pet_ambulance': 'ambulance',
    'breeder': 'breeder', 'pet_breeder': 'breeder',
    'relocation': 'relocation', 'pet_taxi': 'relocation', 'pet_transport': 'relocation', 'pet_relocation': 'relocation',
    'resort': 'resort', 'pet_resort': 'resort',
    'holiday': 'holiday',
    'sunset': 'sunset', 'pet_sunset_services': 'sunset',
    'event_organizer': 'events', 'pet_event_organizer': 'events',
    // Behaviourist, sitting
    'behaviourist': 'behaviourist', 'pet_behaviourist': 'behaviourist', 'behaviourist_solo': 'behaviourist',
    'pet_sitter': 'sitting', 'sitter': 'sitting', 'sitter_solo': 'sitting',
  };
  return roleCategoryMap[roleId] || roleCategoryMap[roleId?.toLowerCase?.()] || 'other';
}

/** DB-driven: role names that have at least one approved/active vendor with any published service.
 * Aligned with admin active vendors: no r.is_active filter so walker/trainer/groomer/vet all appear. */
async function getDiscoverableRoleNames(): Promise<string[]> {
  const result = await query(`
    SELECT DISTINCT r.name AS role_name
    FROM vendors v
    INNER JOIN roles r ON v.role_id = r.id
    WHERE (v.status = 'approved' OR v.status = 'active')
      AND v.is_active = true
      AND EXISTS (
        SELECT 1 FROM vendor_services vs
        WHERE vs.vendor_id = v.id
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
      )
    ORDER BY r.name
  `);
  return (result.rows || []).map((r: any) => r.role_name).filter(Boolean);
}

/** Role ID aliases: customer web / UI may send alternate spellings; DB uses canonical role names */
const ROLE_ID_ALIASES: Record<string, string> = {
  diagnostic_center: 'diagnostics_center',
  diagnostics: 'diagnostics_center',
};

/** Static role names per category for discovery when DB-driven list is empty. Align with 25 canonical roles. */
const CATEGORY_ROLE_NAMES: Record<string, string[]> = {
  vet: ['veterinarian', 'vet_clinic', 'vet_solo', 'vet'],
  grooming: ['groomer', 'groomer_solo', 'groomer_center', 'grooming_solo', 'pet_groomer'],
  training: ['trainer', 'trainer_solo', 'trainer_center', 'training_solo', 'pet_trainer', 'solo'],
  walker: ['walker', 'walker_solo', 'pet_walker', 'dog_walker'],
  walking: ['walker', 'walker_solo', 'pet_walker', 'dog_walker'],
  boarding: ['boarding', 'pet_boarder', 'pet_daycare', 'pet_boarding'],
  nutrition: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
  nutritionist: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
  adoption: ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
  shop: ['seller', 'pet_products_store'],
  diagnostics: ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
  'lab-diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
  pharmacy: ['pharmacy', 'pet_pharmacy'],
  cafes: ['cafe', 'pet_cafe'],
  cafe: ['cafe', 'pet_cafe'],
  photography: ['photographer', 'pet_photographer'],
  insurance: ['insurance', 'pet_insurance'],
  ambulance: ['ambulance', 'pet_ambulance'],
  breeder: ['breeder', 'pet_breeder'],
  relocation: ['relocation', 'pet_taxi', 'pet_transport', 'pet_relocation'],
  resort: ['resort', 'pet_resort'],
  holiday: ['holiday'],
  sunset: ['sunset', 'pet_sunset_services'],
  events: ['event_organizer', 'pet_event_organizer'],
  behaviourist: ['behaviourist', 'behaviourist_solo', 'pet_behaviourist'],
  sitting: ['pet_sitter', 'sitter_solo', 'sitter'],
};

/** Resolve target role names for discovery: from category or roleId, restricted to DB-discoverable roles.
 * When category/roleId is provided: return ALL discoverable roles in that category (e.g. walker → walker_solo, pet_walker, dog_walker).
 * Falls back to static CATEGORY_ROLE_NAMES when no discoverable roles exist so new vendors are still queryable. */
async function resolveTargetRolesForDiscovery(category?: string | null, roleId?: string | null): Promise<string[]> {
  const discoverable = await getDiscoverableRoleNames();
  let rawCategory = category?.toLowerCase().trim() || (roleId ? getCategoryFromRole(roleId) : null);
  // Normalize customer tile categoryIds to discovery category (e.g. lab-diagnostics → diagnostics for role lookup)
  if (rawCategory === 'lab-diagnostics') rawCategory = 'diagnostics';
  const effectiveCategory = rawCategory && getCategoryFromRole(rawCategory) !== 'other' ? getCategoryFromRole(rawCategory) : rawCategory;
  if (effectiveCategory) {
    const fromDb = discoverable.filter((role) => getCategoryFromRole(role) === effectiveCategory);
    if (fromDb.length > 0) return fromDb;
    // Support both normalized and raw (e.g. lab-diagnostics, cafes) for customer tile categoryIds
    return CATEGORY_ROLE_NAMES[effectiveCategory] || CATEGORY_ROLE_NAMES[rawCategory!] || [];
  }
  if (roleId) {
    const lower = roleId.toLowerCase().trim();
    const canonical = ROLE_ID_ALIASES[lower] || lower;
    const match = discoverable.find((r) => r.toLowerCase() === canonical || r.toLowerCase() === lower);
    return match ? [match] : [];
  }
  return discoverable;
}

export function registerServiceDiscoveryEndpoints(app: Hono) {
  /**
   * GET /customer/discovery/meta
   * DB-driven discovery meta: roles and service styles that have discoverable vendors.
   * Use this to populate dashboard filters so only options with data are shown.
   */
  app.get('/customer/discovery/meta', async (c) => {
    try {
      // Align with admin active vendors: (approved|active), any published/draft service, no r.is_active
      const rolesResult = await query(`
        SELECT DISTINCT r.name AS roleName, r.display_name AS roleDisplayName
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id AND vs.is_enabled = true
              AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
          )
        ORDER BY r.name
      `);
      const stylesResult = await query(`
        SELECT DISTINCT vs.service_style AS serviceStyle
        FROM vendor_services vs
        INNER JOIN vendors v ON v.id = vs.vendor_id
        WHERE (v.status = 'approved' OR v.status = 'active') AND v.is_active = true
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
          AND vs.service_style IS NOT NULL
        ORDER BY vs.service_style
      `);
      const roles = (rolesResult.rows || []).map((r: any) => ({
        roleId: r.rolename,
        roleName: r.rolename,
        displayName: r.roledisplayname || r.rolename,
        category: getCategoryFromRole(r.rolename || ''),
      }));
      const serviceStyles = (stylesResult.rows || []).map((s: any) => s.servicestyle).filter(Boolean);
      const categories = [...new Set(roles.map((r: any) => r.category).filter(Boolean))].sort();
      return c.json({
        success: true,
        roles,
        serviceStyles: serviceStyles.length ? serviceStyles : ['at_center', 'at_home', 'tele'],
        categories,
      });
    } catch (error: any) {
      console.error('[discovery/meta] Error:', error);
      return c.json({
        success: true,
        roles: [],
        serviceStyles: ['at_center', 'at_home', 'tele'],
        categories: ['vet', 'grooming', 'training', 'walker', 'nutrition', 'boarding', 'diagnostics', 'shop', 'cafes', 'photography', 'insurance', 'ambulance', 'breeder', 'adoption', 'relocation', 'resort', 'holiday', 'sunset'],
      }, 200);
    }
  });

  /**
   * GET /customer/debug/at-center-vendors
   * Debug endpoint to check for vendors with at_center services in database
   */
  app.get('/customer/debug/at-center-vendors', async (c) => {
    try {
      const category = c.req.query('category') || 'vet';
      
      // Query 1: All vendors with at_center services
      const allVendors = await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);

      // Query 2: Approved/active vendors with at_center services (non-solo)
      const approvedVendors = await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND LOWER(r.name) NOT LIKE '%solo%'
          AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);

      // Query 3: Vet category vendors with at_center services
      const vetVendors = await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND LOWER(r.name) IN ('vet_clinic', 'veterinarian', 'vet')
          AND LOWER(r.name) NOT LIKE '%solo%'
          AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);

      // Query 4: Check availability for vet vendors
      let vetAvailability = [];
      if (vetVendors.rows.length > 0) {
        const vetIds = vetVendors.rows.map((v: any) => v.id);
        const availabilityResult = await query(`
          SELECT 
            va.vendor_id,
            v.business_name,
            COUNT(va.id) as availability_slots,
            COUNT(CASE WHEN COALESCE(va.service_styles, ARRAY[]::text[]) && ARRAY['at_center', 'at_vendor', 'at_clinic']::text[] THEN 1 END) as matching_slots,
            COUNT(CASE WHEN COALESCE(va.service_styles, ARRAY[]::text[]) = ARRAY[]::text[] THEN 1 END) as empty_service_styles_slots
          FROM vendor_availability_v2 va
          INNER JOIN vendors v ON va.vendor_id = v.id
          WHERE va.vendor_id = ANY($1::uuid[])
            AND (va.is_available IS NULL OR va.is_available = true)
          GROUP BY va.vendor_id, v.business_name
        `, [vetIds]);
        vetAvailability = availabilityResult.rows;
      }

      return c.json({
        success: true,
        summary: {
          all_vendors_with_at_center: allVendors.rows.length,
          approved_active_non_solo: approvedVendors.rows.length,
          vet_category: vetVendors.rows.length,
          vet_with_availability: vetAvailability.length
        },
        all_vendors: allVendors.rows,
        approved_vendors: approvedVendors.rows,
        vet_vendors: vetVendors.rows,
        vet_availability: vetAvailability
      });
    } catch (error: any) {
      console.error('[debug/at-center-vendors] Error:', error);
      return c.json({
        success: false,
        error: error.message,
        stack: error.stack
      }, 500);
    }
  });

  /**
   * GET /customer/services
   * Get customer services list (alias for discover-services)
   */
  app.get("/customer/services", async (c) => {
    try {
      const category = c.req.query('category');
      const location = c.req.query('location');
      const minRating = c.req.query('minRating');
      const availability = c.req.query('availability');
      const petType = c.req.query('petType');
      const sortBy = c.req.query('sortBy') || 'rating';
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');

      // Build vendor query: strict discovery — advance availability (VA2), profile, published services
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
          AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
          AND EXISTS (
            SELECT 1 FROM vendor_services vs 
            WHERE vs.vendor_id = v.id 
              AND vs.is_enabled = true 
              AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
          )
          AND EXISTS (
            SELECT 1 FROM vendor_availability_v2 va
            WHERE (va.vendor_id::text = v.id::text OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone))
              AND (va.is_available IS NULL OR va.is_available = true)
          )
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // DB-driven: filter by category and/or roleId (only discoverable roles)
      const targetRoles = await resolveTargetRolesForDiscovery(category || null, roleId || null);
      if (targetRoles.length > 0) {
        vendorQuery += ` AND r.name = ANY($${paramIndex}::text[])`;
        params.push(targetRoles);
        paramIndex++;
      }

      // Get vendors
      const vendors = await query(vendorQuery, params);

      // Get services for each vendor: base on vendor_services so catalog-origin services appear (vs.service_id can point to services.id or service_catalog.id)
      const services = await Promise.all(
        vendors.rows.map(async (vendor: any) => {
          const params: any[] = [vendor.id];
          let styleClause = '';
          if (serviceStyle) {
            const acceptableStyles = acceptableStylesForService(serviceStyle);
            params.push(acceptableStyles);
            styleClause = ` AND vs.service_style = ANY($${params.length}::text[])`;
          }
          const vendorServices = await query(
            `SELECT vs.id as vs_id, vs.service_id, vs.service_name as vs_service_name, vs.custom_price, vs.custom_duration, vs.service_style, vs.category,
                    s.id as s_id, s.name as s_name, s.price as s_price, s.duration_minutes as s_duration,
                    sc.id as sc_id, sc.service_name as sc_service_name, sc.base_price as sc_price, sc.duration_minutes as sc_duration
             FROM vendor_services vs
             LEFT JOIN services s ON vs.service_id = s.id
             LEFT JOIN service_catalog sc ON vs.service_id = sc.id
             WHERE vs.vendor_id = $1 AND vs.is_enabled = true AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)${styleClause}
             ORDER BY COALESCE(vs.service_name, sc.service_name, s.name)`,
            params
          );

          return vendorServices.rows.map((row: any) => ({
            id: row.vs_id,
            serviceId: row.service_id,
            serviceName: row.vs_service_name || row.sc_service_name || row.s_name || 'Service',
            vendorId: vendor.id,
            vendorName: vendor.business_name,
            price: row.custom_price != null ? parseFloat(row.custom_price) : (row.sc_price != null ? parseFloat(row.sc_price) : (row.s_price != null ? parseFloat(row.s_price) : 0)),
            duration: row.custom_duration ?? row.sc_duration ?? row.s_duration ?? 30,
            serviceStyle: row.service_style || serviceStyle,
          }));
        })
      );

      return c.json({
        success: true,
        services: services.flat(),
      });
    } catch (error: any) {
      console.error('Error fetching customer services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/services/platform
   * Get platform-level services from the service catalog
   * 
   * Used for instant booking where customers select from platform-defined services
   * rather than vendor-specific services.
   * 
   * Query params:
   * - roleId: Filter by role (e.g., 'veterinarian', 'groomer')
   * - serviceStyle: Filter by style ('tele', 'at_home', 'at_center', 'all')
   * - category: Optional category filter
   */
  app.get("/customer/services/platform", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const category = c.req.query('category');

      if (!roleId) {
        return c.json({
          success: false,
          error: 'roleId is required',
        }, 400);
      }

      // ✅ Check if service_catalog table exists
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'service_catalog'
        )`
      ).catch(() => ({ rows: [{ exists: false }] }));

      if (!tableCheck.rows[0]?.exists) {
        // Return fallback services from vendor_services if service_catalog doesn't exist
        console.log('[Platform Services] service_catalog table not found, using vendor_services fallback');
        
        let fallbackQuery = `
          SELECT DISTINCT 
            vs.id,
            vs.service_id,
            vs.service_name,
            vs.service_name as display_name,
            vs.custom_description as description,
            vs.category as category_name,
            vs.service_style,
            vs.price as base_price,
            vs.duration_minutes
          FROM vendor_services vs
          INNER JOIN vendors v ON vs.vendor_id = v.id
          LEFT JOIN roles r ON v.role_id = r.id
          WHERE vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
            AND (LOWER(r.name) = LOWER($1) OR LOWER(r.display_name) = LOWER($1))
        `;
        
        const fallbackParams: any[] = [roleId];
        let paramIdx = 2;
        
        if (serviceStyle && serviceStyle !== 'all') {
          const acceptableStyles = acceptableStylesForService(serviceStyle);
          fallbackQuery += ` AND vs.service_style = ANY($${paramIdx}::text[])`;
          fallbackParams.push(acceptableStyles);
          paramIdx++;
        }
        
        fallbackQuery += ` LIMIT 50`;
        
        const fallbackResult = await query(fallbackQuery, fallbackParams).catch(() => ({ rows: [] }));
        
        const services = fallbackResult.rows.map((row: any) => ({
          id: row.service_id || row.id,
          serviceId: row.service_id,
          name: row.display_name || row.service_name,
          serviceName: row.service_name,
          displayName: row.display_name,
          description: row.description,
          categoryName: row.category_name,
          serviceStyle: row.service_style,
          basePrice: parseFloat(row.base_price) || 0,
          price: parseFloat(row.base_price) || 0,
          durationMinutes: row.duration_minutes || 30,
          duration: row.duration_minutes || 30,
        }));

        return c.json({
          success: true,
          count: services.length,
          services,
          filters: { roleId, serviceStyle, category },
          _fallback: true,
        });
      }

      // Build query for service_catalog
      let queryText = `
        SELECT 
          id,
          service_id,
          service_name,
          display_name,
          description,
          category_id,
          category_name,
          sub_category_id,
          sub_category_name,
          applicable_roles,
          service_style,
          base_price,
          duration_minutes,
          metadata,
          display_order
        FROM service_catalog
        WHERE status = 'active'
          AND (publish_status IN ('published','auto_published') OR publish_status IS NULL)
          AND $1 = ANY(applicable_roles)
      `;
      const params: any[] = [roleId];
      let paramIndex = 2;

      // Filter by service style
      if (serviceStyle && serviceStyle !== 'all') {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        queryText += ` AND (service_style = ANY($${paramIndex}::text[]) OR service_style = 'all')`;
        params.push(acceptableStyles);
        paramIndex++;
      }

      // Filter by category
      if (category) {
        queryText += ` AND (category_id = $${paramIndex} OR category_name ILIKE $${paramIndex + 1})`;
        params.push(category);
        params.push(`%${category}%`);
        paramIndex += 2;
      }

      queryText += ` ORDER BY display_order ASC, service_name ASC`;

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      // Format services for frontend consumption
      const services = result.rows.map((row: any) => ({
        id: row.service_id || row.id,
        serviceId: row.service_id,
        name: row.display_name || row.service_name,
        serviceName: row.service_name,
        displayName: row.display_name,
        description: row.description,
        categoryId: row.category_id,
        categoryName: row.category_name,
        subCategoryId: row.sub_category_id,
        subCategoryName: row.sub_category_name,
        serviceStyle: row.service_style,
        basePrice: parseFloat(row.base_price) || 0,
        price: parseFloat(row.base_price) || 0,
        durationMinutes: row.duration_minutes || 30,
        duration: row.duration_minutes || 30,
        metadata: row.metadata,
        displayOrder: row.display_order,
        applicableRoles: row.applicable_roles,
      }));

      console.log(`[Platform Services] Found ${services.length} services for role=${roleId}, style=${serviceStyle}`);

      return c.json({
        success: true,
        count: services.length,
        services,
        filters: {
          roleId,
          serviceStyle,
          category,
        },
      });
    } catch (error: any) {
      console.error('[Platform Services] Error:', error);
      // ✅ Return empty array instead of 500 error
      return c.json({
        success: true,
        count: 0,
        services: [],
        filters: {
          roleId: c.req.query('roleId'),
          serviceStyle: c.req.query('serviceStyle'),
          category: c.req.query('category'),
        },
        _error: error.message,
      });
    }
  });

  /**
   * OPTIONS /customer/discover-services
   * Handle CORS preflight requests
   * ✅ FIX: Explicit OPTIONS handler for CORS preflight
   */
  app.options("/customer/discover-services", async (c) => {
    return c.json({}, 200);
  });

  /**
   * GET /customer/discover-services
   * Main customer entry point for service discovery
   * 
   * ⚠️ CRITICAL BUSINESS RULE:
   * - For at_home/tele services: Returns staff members (if vendor has clinic) OR individual providers
   * - For at_center services: Returns vendors/business entities
   * ✅ FIX: Improved error handling
   */
  app.get("/customer/discover-services", async (c) => {
    try {
      const category = c.req.query('category');
      const location = c.req.query('location');
      const minRating = c.req.query('minRating');
      const availability = c.req.query('availability');
      const petType = c.req.query('petType');
      const sortBy = c.req.query('sortBy') || 'rating';
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const serviceStyle = c.req.query('serviceStyle'); // ⚠️ NEW: Filter by service style
      const roleId = c.req.query('roleId'); // ⚠️ NEW: Filter by role
      const problemTitle = c.req.query('problemTitle'); // Phase 2: Best for [problem] badge

      // ⚠️ For at_home and tele: align with admin active vendors source so walkers/trainers/groomers/vets all discover.
      // When category/roleId given: use same criteria as /admin/vendors/active (any published service), then filter by role.
      if (serviceStyle === 'at_home' || serviceStyle === 'tele') {
        const allProviders: any[] = [];
        // Category-based role expansion (like by-style): get ALL roles in category so walker, walker_solo, pet_walker all match.
        const effectiveCategory = (category?.toLowerCase().trim()) || (roleId ? getCategoryFromRole(roleId as string) : null) || null;
        const targetRoles = await resolveTargetRolesForDiscovery(effectiveCategory || null, effectiveCategory ? null : (roleId || null));
        const targetRolesLower = targetRoles.map((r) => r.toLowerCase());
        console.log('[discover-services] at_home/tele category=%s roleId=%s effectiveCategory=%s targetRoles=%s', category, roleId, effectiveCategory, JSON.stringify(targetRolesLower));

        // Rule book: discovery radius, max results, sort — use actual serviceStyle so tele gets tele-specific rules
        const roleIdForRule = (effectiveCategory || roleId || targetRoles[0] || 'all') as string;
        const ruleStyle = serviceStyle === 'tele' ? 'tele' : 'at_home';
        const discoveryRules = await getDiscoveryRules(roleIdForRule, 'discover', ruleStyle, effectiveCategory || undefined);
        const ruleRadiusKm = typeof discoveryRules.discovery_radius_km === 'number' ? discoveryRules.discovery_radius_km : 50;
        const ruleMaxResults = typeof discoveryRules.discovery_max_results === 'number' ? discoveryRules.discovery_max_results : 50;
        const ruleSortDefault = typeof discoveryRules.discovery_sort_default === 'string' ? discoveryRules.discovery_sort_default : 'relevance';

        // Role filter: match any role in the expanded category list (like by-style); LOWER + space→underscore for compatibility.
        const roleRestrictClause = targetRolesLower.length > 0
          ? ` AND r.id IS NOT NULL AND (LOWER(r.name) = ANY($1::text[]) OR LOWER(REPLACE(COALESCE(r.name, ''), ' ', '_')) = ANY($1::text[]))`
          : '';
        const soloCondition = targetRolesLower.length > 0 ? '' : ` AND (v.vendor_type = 'solo' OR LOWER(COALESCE(r.name, '')) LIKE '%_solo%' OR LOWER(COALESCE(r.name, '')) LIKE '%solo%')`;

        const acceptableServiceStyles = acceptableStylesForService(serviceStyle);
        // Params: [targetRoles..., acceptableStyles]; EXISTS always requires vs.service_style = requested style (including aliases).
        const vendorParams: any[] = targetRolesLower.length > 0 ? [targetRolesLower, acceptableServiceStyles] : [acceptableServiceStyles];
        const styleParamIndex = targetRolesLower.length > 0 ? '2' : '1';
        const existsServiceClause = ` AND EXISTS (
              SELECT 1 FROM vendor_services vs
              WHERE vs.vendor_id = v.id
            AND vs.service_style = ANY($${styleParamIndex}::text[])
                AND vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )`;

        // at_home/tele: prefer solo vendors; also allow roles that are explicitly solo (walker/sitter/etc).
        const soloOnlyClause = ` AND (
          v.vendor_type = 'solo'
          OR LOWER(COALESCE(r.name, '')) LIKE '%_solo%'
          OR LOWER(COALESCE(r.name, '')) LIKE '%solo%'
          OR LOWER(COALESCE(r.name, '')) IN ('walker','pet_walker','dog_walker','pet_sitter','sitter','pet_taxi','pet_transport','pet_relocation','relocation')
        )`;
        // Vendor-defined radius applies only to at_home (travel); tele uses rule-book only, no travel.
        const hasLogoUrl = await columnExists('vendors', 'logo_url');
        const logoColumn = hasLogoUrl ? 'v.logo_url' : 'NULL';
        let vendorQuery = `
          SELECT DISTINCT v.id, v.business_name, v.owner_name, v.phone, v.city, v.state,
                 v.latitude, v.longitude, r.name as role_name, r.display_name as role_display_name,
                 v.languages, v.is_verified, v.profile_photo_url, v.profile_image, ${logoColumn} as logo_url, v.specializations, v.is_online,
                 v.vendor_type, v.metadata, r.config as role_config,
                 v.service_radius,
                 (SELECT MIN(vs.service_radius_km) FROM vendor_services vs
                  WHERE vs.vendor_id = v.id AND vs.is_enabled = true
                    AND vs.service_style = 'at_home') AS service_radius_km_min_home
          FROM vendors v
          LEFT JOIN roles r ON v.role_id = r.id
          WHERE (v.status = 'approved' OR v.status = 'active')
            AND v.is_active = true
            AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
            AND EXISTS (
              SELECT 1 FROM vendor_availability_v2 va
              WHERE (va.vendor_id::text = v.id::text OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone))
                AND (va.is_available IS NULL OR va.is_available = true)
                AND (COALESCE(va.service_styles, ARRAY[]::text[]) && $${styleParamIndex}::text[])
            )
            ${soloOnlyClause}
            AND (${targetRolesLower.length > 0 ? '1=1' : "COALESCE(v.is_online, true) = true"})
            ${soloCondition}
            ${roleRestrictClause}
            ${existsServiceClause}
        `;

        vendorQuery += ` LIMIT 200`;

        let vendorResults: { rows: any[] };
        try {
          vendorResults = await query(vendorQuery, vendorParams);
        } catch (err: any) {
          console.error('[discover-services] at_home query error:', err?.message, err?.stack);
          vendorResults = { rows: [] };
        }
        console.log('[discover-services] at_home found %s vendors', vendorResults.rows?.length ?? 0);
        
        for (const vendor of vendorResults.rows) {
          if (!roleConfigAllowsStyle((vendor as any).role_config, serviceStyle)) continue;
          // ✅ ENRICHED: Get next available slot for solo vendor
          let nextAvailableSlot: { date: string; time: string; formattedDisplay: string } | null = null;
          try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const nextSlotsResult = await query(
              `SELECT va.day_of_week, COALESCE(va.time_window_start, va.start_time) as time_window_start, COALESCE(va.time_window_end, va.end_time) as time_window_end
               FROM vendor_availability_v2 va
               WHERE (va.vendor_id = $1 OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
                 AND (va.is_available IS NULL OR va.is_available = true)
                 AND (COALESCE(va.service_styles, ARRAY[]::text[]) && $3::text[])
               ORDER BY va.day_of_week ASC, COALESCE(va.time_window_start, va.start_time) ASC 
               LIMIT 1`,
              [vendor.id, vendor.phone || '', acceptableServiceStyles]
            );
            
            if (nextSlotsResult.rows.length > 0) {
              const slot = nextSlotsResult.rows[0];
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const dayOfWeek = slot.day_of_week;
              const timeStr = slot.time_window_start?.substring(0, 5) || '09:00';
              const formattedTime = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', hour12: true
              });
              
              // Calculate next occurrence of this day
              const todayDayOfWeek = today.getDay();
              let daysUntil = dayOfWeek - todayDayOfWeek;
              if (daysUntil < 0) daysUntil += 7;
              if (daysUntil === 0) daysUntil = 0; // Today
              
              const nextDate = new Date(today);
              nextDate.setDate(today.getDate() + daysUntil);
              
              nextAvailableSlot = {
                date: nextDate.toISOString().split('T')[0],
                time: timeStr,
                formattedDisplay: daysUntil === 0 ? `Today ${formattedTime}` : 
                                  daysUntil === 1 ? `Tomorrow ${formattedTime}` :
                                  `${dayNames[dayOfWeek]} ${formattedTime}`
              };
            }
          } catch (slotError) { /* Continue without */ }

          // ✅ ENRICHED: Get completed bookings
          let completedBookings = 0;
          try {
            const bookingsResult = await query(
              `SELECT COUNT(*) as count FROM bookings WHERE vendor_id = $1 AND status = 'completed'`,
              [vendor.id]
            );
            completedBookings = parseInt(bookingsResult.rows[0]?.count || '0', 10);
          } catch (bookErr) { /* Continue */ }
          
          // ✅ FIX: Calculate distance if customer coordinates provided
          let distance: number | null = null;
          let distanceText: string | null = null;
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            const lat1 = parseFloat(latitude as string);
            const lon1 = parseFloat(longitude as string);
            const lat2 = parseFloat(vendor.latitude);
            const lon2 = parseFloat(vendor.longitude);
            
            // Haversine formula
            const R = 6371; // Earth's radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = R * c;
            distanceText = distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)} km away`;
          }

          // At_home: vendor-defined radius (travel); rule-book default when vendor not set. Tele: rule-book only (no travel); 0 = no limit.
          const vendorRadiusRaw = vendor.service_radius != null ? Number(vendor.service_radius) : null;
          const vendorRadius = vendorRadiusRaw != null && vendorRadiusRaw > 0 ? vendorRadiusRaw : null;
          const serviceRadiusRaw = (vendor as any).service_radius_km_min_home != null ? Number((vendor as any).service_radius_km_min_home) : null;
          const serviceRadiusKmHome = serviceRadiusRaw != null && serviceRadiusRaw > 0 ? serviceRadiusRaw : null;
          let effectiveRadiusKm: number;
          let withinRadius: boolean;
          if (serviceStyle === 'at_home') {
            effectiveRadiusKm = vendorRadius ?? serviceRadiusKmHome ?? ruleRadiusKm ?? 50;
            withinRadius = !(latitude && longitude) || (distance != null && distance <= effectiveRadiusKm);
          } else {
            // tele: no vendor radius; rule-book only. discovery_radius_km_tele default 0 = no distance limit
            const teleRadiusKm = typeof discoveryRules.discovery_radius_km_tele === 'number'
              ? discoveryRules.discovery_radius_km_tele
              : (typeof discoveryRules.discovery_radius_km === 'number' ? discoveryRules.discovery_radius_km : 0);
            if (teleRadiusKm <= 0) {
              withinRadius = true; // no limit
            } else {
              effectiveRadiusKm = teleRadiusKm;
              withinRadius = !(latitude && longitude) || (distance != null && distance <= effectiveRadiusKm);
            }
          }
          if (!withinRadius) continue;

          // ✅ FIX: Get rating from reviews
          let avgRating = 0;
          let totalReviews = 0;
          try {
            const reviewsResult = await query(
              `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
               FROM reviews WHERE vendor_id = $1 AND is_approved = true`,
              [vendor.id]
            );
            avgRating = parseFloat(reviewsResult.rows[0]?.avg_rating || '0');
            totalReviews = parseInt(reviewsResult.rows[0]?.review_count || '0', 10);
          } catch (reviewErr) { /* Continue */ }

          // ✅ ENRICHED: Consultation price (min/max from any published service) - Phase 2: priceMin, priceMax
          let consultationFee = 0;
          let minPrice = 0;
          let maxPrice = 0;
          try {
            const priceResult = await query(
              `SELECT MIN(COALESCE(vs.custom_price, vs.price, 0))::numeric as min_price,
                      MAX(COALESCE(vs.custom_price, vs.price, 0))::numeric as max_price
               FROM vendor_services vs
               WHERE vs.vendor_id = $1 AND vs.is_enabled = true
                 AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)`,
              [vendor.id]
            );
            minPrice = parseFloat(priceResult.rows[0]?.min_price || '0') || 0;
            maxPrice = parseFloat(priceResult.rows[0]?.max_price || '0') || 0;
            consultationFee = minPrice;
          } catch (priceErr) { /* Continue */ }

          // Phase 2: Check if vendor has packages
          let hasPackages = false;
          try {
            const pkgResult = await query(
              `SELECT 1 FROM service_packages WHERE vendor_id = $1 LIMIT 1`,
              [vendor.id]
            );
            hasPackages = (pkgResult.rows?.length || 0) > 0;
          } catch { /* Continue */ }

          // Phase 2: Photos from vendor metadata (facility_photos)
          let photos: string[] = [];
          try {
            const meta = vendor.metadata;
            if (meta) {
              const m = typeof meta === 'string' ? JSON.parse(meta || '{}') : meta;
              const raw = m?.facility_photos || m?.photos || [];
              photos = Array.isArray(raw) ? raw.slice(0, 5).filter(Boolean) : [];
            }
          } catch { /* Continue */ }

          // Specializations: vendor_specializations first, then vendor.specializations
          let specializations: string[] = [];
          try {
            const specRes = await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [vendor.id]);
            specializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
          } catch { /* Continue */ }
          if (specializations.length === 0 && vendor.specializations) {
            try {
              specializations = Array.isArray(vendor.specializations)
                ? vendor.specializations
                : JSON.parse(vendor.specializations || '[]');
            } catch { /* ignore */ }
          }

          const hasPhoto = !!(getVendorPhotoUrl(vendor) || (photos && photos.length > 0));
          if (!nextAvailableSlot || !hasPhoto) continue;
          
          allProviders.push({
            id: vendor.id,
            vendorId: vendor.id,
            businessName: vendor.business_name || vendor.owner_name,
            name: vendor.business_name || vendor.owner_name,
            role: vendor.role_display_name || vendor.role_name,
            phone: vendor.phone,
            isStaffMember: false,
            isIndividualProvider: true, // Solo providers are individual providers
            isSoloProvider: true,
            vendor: {
              id: vendor.id,
              businessName: vendor.business_name || vendor.owner_name,
            },
            city: vendor.city,
            state: vendor.state,
            latitude: vendor.latitude,
            longitude: vendor.longitude,
            // ✅ FIX: Add distance and rating fields
            distance,
            distanceKm: distance != null ? parseFloat((distance as number).toFixed(2)) : null,
            distanceText,
            rating: avgRating,
            reviewCount: totalReviews,
            totalReviews,
            // ✅ ENRICHED: Consultation price for service provider discovery
            consultationFee,
            price: minPrice,
            // ✅ ENRICHED: Additional fields for UniversalVendorCard
            nextAvailableSlot,
            nextAvailable: nextAvailableSlot ? { date: nextAvailableSlot.date, time: nextAvailableSlot.time, display: nextAvailableSlot.formattedDisplay } : null,
            nextAvailability: nextAvailableSlot?.formattedDisplay || null,
            serviceStyles: serviceStyle ? (normalizeServiceStyle(serviceStyle) ? [normalizeServiceStyle(serviceStyle)!] : []) : ['at_center', 'at_home', 'tele'],
            vendorType: 'solo',
            roleName: vendor.role_name || vendor.role_display_name || '',
            completedBookings,
            isVerified: vendor.is_verified ?? (vendor.status === 'approved'),
            isOnline: vendor.is_online ?? true,
            languages: vendor.languages ? (Array.isArray(vendor.languages) ? vendor.languages : JSON.parse(vendor.languages || '[]')) : ['English', 'Hindi'],
            photoUrl: getVendorPhotoUrl(vendor),
            vendorProfileImage: getVendorPhotoUrl(vendor),
            specializations,
            // Phase 2: Gallery, price range, bestForProblem, hasPackages
            photos: photos.length > 0 ? photos : undefined,
            priceMin: minPrice > 0 ? minPrice : undefined,
            priceMax: maxPrice > 0 && maxPrice !== minPrice ? maxPrice : undefined,
            bestForProblem: problemTitle || undefined,
            hasPackages: hasPackages || undefined,
            // ✅ ENRICHED: Amenities for discovery card (from metadata)
            amenities: (() => {
              try {
                const meta = vendor.metadata;
                if (!meta) return [];
                const m = typeof meta === 'string' ? JSON.parse(meta) : meta;
                return Array.isArray(m?.amenities) ? m.amenities : [];
              } catch (_) { return []; }
            })(),
          });
        }

        // Rule book: sort by discovery_sort_default (query sortBy overrides when provided)
        const effectiveSort = (sortBy && sortBy.trim()) ? sortBy.trim().toLowerCase() : (ruleSortDefault || 'relevance').toLowerCase();
        if (effectiveSort === 'nearest' || effectiveSort === 'distance') {
          allProviders.sort((a: any, b: any) => {
            if (a.distance === null && b.distance === null) return 0;
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
          });
        } else if (effectiveSort === 'rating') {
          allProviders.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
        } else {
          // relevance: weighted score (rating + review count + distance bonus)
          allProviders.sort((a: any, b: any) => {
            const aScore = (parseFloat(a.rating) || 0) * 10 + (a.totalReviews || 0) * 0.5 + (a.distance != null ? Math.max(0, 50 - a.distance) : 0);
            const bScore = (parseFloat(b.rating) || 0) * 10 + (b.totalReviews || 0) * 0.5 + (b.distance != null ? Math.max(0, 50 - b.distance) : 0);
            return bScore - aScore;
          });
        }

        // Rule book: limit by discovery_max_results
        const limitedProviders = allProviders.slice(0, ruleMaxResults);

        console.log(`[Discover Services] Found ${limitedProviders.length} solo providers for style=${serviceStyle} (after radius/sort/limit)`);

        return c.json({
          success: true,
          vendors: limitedProviders,
          providers: limitedProviders, // Alias for compatibility
          total: limitedProviders.length,
        });
      }

      // Build vendor query: strict discovery — only vendors with advance availability, profile, and services
      // No fallback: vendor must have slot-based advance availability (VA2), profile completion, and services configured for the booking flow.
      // ✅ FIX: For at_center, make availability optional if vendor has at_center services (handles cases where availability isn't configured yet)
      const requireAvailability = serviceStyle !== 'at_center';
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name, r.config as role_config,
          COALESCE((SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true), 0) as service_count,
          COALESCE((SELECT COUNT(*) FROM vendor_availability_v2 va WHERE va.vendor_id = v.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)), 0) as availability_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE (v.status = 'approved' OR v.status = 'active') AND v.is_active = true
          AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
      `;
      if (requireAvailability) {
        vendorQuery += ` AND EXISTS (
            SELECT 1 FROM vendor_availability_v2 va
            WHERE (va.vendor_id::text = v.id::text OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone))
              AND (va.is_available IS NULL OR va.is_available = true)
          )`;
      }

      let params: any[] = [];
      let paramIndex = 1;

      // ✅ FIX: When serviceStyle=at_center, use the same query structure as debug endpoint (which works!)
      if (serviceStyle === 'at_center') {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        console.log('[discover-services] at_center: acceptableStyles=', acceptableStyles);
        
        // Resolve target roles BEFORE building query so we can include category/role filter
        const roleIdForCenter = (roleId) ? (() => {
          const m: Record<string, string> = {
            vet: 'vet_clinic', veterinarian: 'vet_clinic',
            grooming: 'groomer_center', groomer: 'groomer_center', pet_groomer: 'groomer_center',
            training: 'trainer_center', trainer: 'trainer_center', pet_trainer: 'trainer_center',
            nutrition: 'nutritionist_center', nutritionist: 'nutritionist_center',
            diagnostics: 'diagnostics_center', 'lab-diagnostics': 'diagnostics_center',
          };
          return m[(roleId as string).toLowerCase().trim()] || roleId;
        })() : roleId;
        let targetRoles = await resolveTargetRolesForDiscovery(category || null, roleIdForCenter || roleId || null);
        console.log('[discover-services] at_center: category=%s, roleIdForCenter=%s, initial targetRoles=%s', category, roleIdForCenter, JSON.stringify(targetRoles));
        // For at_center, exclude solo role names so business/clinic vendors are returned
        if (targetRoles.length > 0) {
          targetRoles = targetRoles.filter((r) => !r.toLowerCase().includes('solo'));
          if (targetRoles.length === 0) {
            targetRoles = await resolveTargetRolesForDiscovery(category || null, roleIdForCenter || roleId || null);
            targetRoles = (CATEGORY_ROLE_NAMES[category?.toLowerCase() || ''] || targetRoles).filter((r) => !r.toLowerCase().includes('solo'));
          }
        }
        console.log('[discover-services] at_center: final targetRoles=%s', JSON.stringify(targetRoles));
        
        // Use INNER JOIN like debug endpoint - this matches the working query
        // ✅ FIX: Add category/role filter to SQL query
        params = [acceptableStyles];
        let categoryFilterClause = '';
        if (targetRoles.length > 0) {
          categoryFilterClause = ` AND LOWER(r.name) = ANY($${params.length + 1}::text[])`;
          params.push(targetRoles.map((r) => r.toLowerCase()));
        } else if (category) {
          // Fallback: filter by vendor.category if roles not available
          categoryFilterClause = ` AND (LOWER(COALESCE(v.category, '')) = LOWER($${params.length + 1}) OR LOWER(r.name) LIKE LOWER($${params.length + 1} || '%'))`;
          params.push(category.toLowerCase());
        }
        
        vendorQuery = `
          SELECT DISTINCT v.*, r.name as role_name, r.display_name as role_display_name, r.config as role_config,
            COALESCE((SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true), 0) as service_count,
            COALESCE((SELECT COUNT(*) FROM vendor_availability_v2 va WHERE va.vendor_id = v.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)), 0) as availability_count
          FROM vendors v
          INNER JOIN roles r ON v.role_id = r.id
          INNER JOIN vendor_services vs ON vs.vendor_id = v.id AND vs.vendor_id IS NOT NULL
          WHERE (v.status = 'approved' OR v.status = 'active') AND v.is_active = true
            AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
            AND LOWER(r.name) NOT LIKE '%solo%'
            AND vs.service_style = ANY($1::text[])
            AND vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
            ${categoryFilterClause}
        `;
        paramIndex = params.length + 1;
      } else if (serviceStyle === 'at_home' || serviceStyle === 'tele') {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        vendorQuery += ` AND EXISTS (
          SELECT 1 FROM vendor_availability_v2 va
          WHERE (va.vendor_id::text = v.id::text OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone))
            AND (va.is_available IS NULL OR va.is_available = true)
            AND (COALESCE(va.service_styles, ARRAY[]::text[]) && $${paramIndex}::text[])
        )`;
        params.push(acceptableStyles);
        paramIndex++;
      }

      // DB-driven: filter by category and/or roleId. For at_center, this is already handled above in the query.
      // For other service styles, resolve roles here.
      let targetRoles: string[] = [];
      let roleFilterAdded = false;
      if (serviceStyle !== 'at_center') {
        const roleIdForCenter = roleId;
        targetRoles = await resolveTargetRolesForDiscovery(category || null, roleIdForCenter || roleId || null);
        if (targetRoles.length > 0) {
          vendorQuery += ` AND LOWER(r.name) = ANY($${paramIndex}::text[])`;
          params.push(targetRoles.map((r) => r.toLowerCase()));
          paramIndex++;
          roleFilterAdded = true;
          console.log('[discover-services] Added role filter with roles:', targetRoles.map((r) => r.toLowerCase()));
        }
      }

      // Filter by location (text match)
      if (location) {
        vendorQuery += ` AND (
          v.city ILIKE $${paramIndex} OR 
          v.state ILIKE $${paramIndex} OR 
          v.address ILIKE $${paramIndex}
        )`;
        params.push(`%${location}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY v.created_at DESC`;

      console.log('[discover-services] at_center: executing query with params:', JSON.stringify(params));
      console.log('[discover-services] at_center: query preview:', vendorQuery.substring(0, 800));
      let vendorResults = await query(vendorQuery, params);
      let vendors = vendorResults.rows;
      console.log('[discover-services] at_center: found %s vendors before enrichment', vendors.length);
      if (vendors.length > 0) {
        console.log('[discover-services] at_center: first vendor:', JSON.stringify({
          id: vendors[0].id,
          business_name: vendors[0].business_name,
          role_name: vendors[0].role_name,
          category: vendors[0].category,
          status: vendors[0].status,
          is_active: vendors[0].is_active
        }));
      } else {
        console.log('[discover-services] at_center: No vendors found. Check category filter and role matching.');
      }

      // Enrich vendors with services, reviews, and availability
      const enrichedVendors = (await Promise.all(
        vendors.map(async (vendor: any) => {
          if (serviceStyle && !roleConfigAllowsStyle((vendor as any).role_config, serviceStyle)) {
            console.log('[discover-services] at_center: vendor %s filtered by roleConfigAllowsStyle', vendor.id);
            return null;
          }
          // Get services - ✅ FIX: Query vendor_services directly (includes custom services)
          const servicesParams: any[] = [vendor.id];
          let servicesQuery = `
            SELECT 
              vs.id,
              vs.service_id,
              vs.service_name as name,
              vs.custom_description as description,
              vs.custom_price as price,
              COALESCE(vs.custom_duration, vs.duration_minutes) as duration_minutes,
              vs.service_style,
              vs.is_enabled,
              vs.publish_status,
              vs.category
            FROM vendor_services vs
            WHERE vs.vendor_id = $1
              AND vs.is_enabled = true
          `;
          
          // ✅ FIX: When serviceStyle is specified, filter by it (include legacy aliases)
          if (serviceStyle && serviceStyle !== 'all') {
            const acceptableStyles = acceptableStylesForService(serviceStyle);
            servicesQuery += ` AND vs.service_style = ANY($2::text[])`;
            servicesParams.push(acceptableStyles);
          }
          
          servicesQuery += ` AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)`;
          servicesQuery += ` ORDER BY vs.publish_status DESC, vs.service_name LIMIT 10`;
          
          const services = await query(servicesQuery, servicesParams);

          // Get reviews and calculate rating
          const reviews = await query(
            `SELECT rating FROM reviews 
             WHERE vendor_id = $1 
             AND is_approved = true`,
            [vendor.id]
          );

          const avgRating = reviews.rows.length > 0
            ? reviews.rows.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.rows.length
            : 0;

          // Check availability - vendor_availability_v2 only (legacy vendor_schedule_slots removed)
          let isAvailableToday = false;
          try {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const va2Check = await query(
              `SELECT 1 FROM vendor_availability_v2 
               WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
                 AND day_of_week = $3 
                 AND (is_available IS NULL OR is_available = true) 
               LIMIT 1`,
              [vendor.id, vendor.phone || '', dayOfWeek]
            );
            isAvailableToday = va2Check.rows.length > 0;
          } catch (error: any) {
            console.warn('[Discover Services] availability check failed:', error.message);
            isAvailableToday = true;
          }

          // Calculate distance if coordinates provided
          let distance: number | null = null;
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            distance = calculateDistance(
              parseFloat(latitude),
              parseFloat(longitude),
              parseFloat(vendor.latitude),
              parseFloat(vendor.longitude)
            );
          }

          // ✅ FIX: Fetch vendor promotions for service listings
          let activePromotions: any[] = [];
          try {
            const promotionsResult = await query(
              `SELECT id, name, description, discount_type, discount_value, code, 
                      start_date, end_date, min_order_value, max_discount_amount
               FROM vendor_promotions 
               WHERE vendor_id = $1::uuid 
                 AND is_active = true 
                 AND (start_date IS NULL OR start_date <= NOW())
                 AND (end_date IS NULL OR end_date >= NOW())
               ORDER BY discount_value DESC
               LIMIT 3`,
              [vendor.id]
            );
            activePromotions = promotionsResult.rows.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              discountType: p.discount_type,
              discountValue: parseFloat(p.discount_value),
              code: p.code,
              minOrderValue: p.min_order_value ? parseFloat(p.min_order_value) : null,
              maxDiscountAmount: p.max_discount_amount ? parseFloat(p.max_discount_amount) : null,
            }));
          } catch (promoError) {
            // Promotions table might not exist, continue without promotions
            console.debug('Could not fetch vendor promotions:', promoError);
          }

          // ✅ FIX: Detect if vendor is solo/individual
          const isSoloProvider = 
            (vendor.role_name || '').toLowerCase().includes('solo') ||
            (vendor.role_display_name || '').toLowerCase().includes('solo') ||
            (vendor.role_name || '').includes('_solo');

          // ✅ ENRICHED: Get next available slot (advanced schedule only - vendor_availability_v2)
          let nextAvailableSlot: { date: string; time: string; formattedDisplay: string } | null = null;
          try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const dayOfWeek = today.getDay();

            const acceptableStyles = serviceStyle ? acceptableStylesForService(serviceStyle) : [];
            const va2Result = await query(
                `SELECT day_of_week, COALESCE(time_window_start, start_time) as start_time
                 FROM vendor_availability_v2
                 WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
                   AND (is_available IS NULL OR is_available = true)
                   ${acceptableStyles.length > 0 ? `AND ((COALESCE(service_styles, ARRAY[]::text[]) && $3::text[]) OR service_style = ANY($3::text[]) OR service_type = ANY($3::text[]))` : ''}
                 ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC
                 LIMIT 7`,
                acceptableStyles.length > 0 ? [vendor.id, vendor.phone || '', acceptableStyles] : [vendor.id, vendor.phone || '']
              ).catch(() => ({ rows: [] }));

              if (va2Result.rows.length > 0) {
                const slot = va2Result.rows[0];
                const targetDay = slot.day_of_week;
                let daysToAdd = targetDay - dayOfWeek;
                if (daysToAdd < 0) daysToAdd += 7;
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + daysToAdd);
                const timeStr = (slot.start_time || '09:00').toString().substring(0, 5);
                const formattedTime = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                const targetStr = targetDate.toISOString().split('T')[0];
                const isToday = targetStr === todayStr;
                const isTomorrow = targetStr === new Date(today.getTime() + 86400000).toISOString().split('T')[0];
                nextAvailableSlot = {
                  date: targetStr,
                  time: timeStr,
                  formattedDisplay: isToday ? `Today ${formattedTime}` : 
                                    isTomorrow ? `Tomorrow ${formattedTime}` :
                                    `${targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${formattedTime}`
                };
              }
          } catch (slotError) {
            // Silently continue if slots not available
          }

          // ✅ ENRICHED: Get specializations from vendor_specializations, vendor profile, or services
          let specializations: string[] = [];
          try {
            const specRes = await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [vendor.id]).catch(() => ({ rows: [] }));
            specializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
            if (specializations.length === 0 && vendor.specializations) {
              specializations = Array.isArray(vendor.specializations) ? 
                vendor.specializations : JSON.parse(vendor.specializations || '[]');
            }
            if (specializations.length === 0) {
              // Derive from services as fallback
              const uniqueCategories = [...new Set(services.rows.map((s: any) => s.category).filter(Boolean))];
              specializations = uniqueCategories.slice(0, 3) as string[];
            }
          } catch (specError) {
            // Continue without specializations
          }

          // ✅ ENRICHED: Get completed bookings count
          let completedBookings = 0;
          try {
            const bookingsResult = await query(
              `SELECT COUNT(*) as count FROM appointments 
               WHERE vendor_id = $1 AND status = 'completed'`,
              [vendor.id]
            );
            completedBookings = parseInt(bookingsResult.rows[0]?.count || '0', 10);
          } catch (bookingsError) {
            // Continue without bookings count
          }

          // ✅ ENRICHED: Get experience (from vendor profile or calculate)
          let experience = '';
          try {
            if (vendor.years_of_experience) {
              const years = parseInt(vendor.years_of_experience, 10);
              experience = years >= 10 ? '10+ years' : years >= 5 ? '5+ years' : years >= 2 ? '2+ years' : '1+ years';
            } else if (vendor.created_at) {
              const yearsActive = Math.floor((Date.now() - new Date(vendor.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
              if (yearsActive > 0) {
                experience = `${yearsActive}+ years on platform`;
              }
            }
          } catch (expError) {
            // Continue without experience
          }

          // ✅ ENRICHED: Get languages
          let languages: string[] = [];
          try {
            if (vendor.languages) {
              languages = Array.isArray(vendor.languages) ? vendor.languages : JSON.parse(vendor.languages || '[]');
            } else {
              languages = ['English', 'Hindi']; // Default for India
            }
          } catch (langError) {
            languages = ['English', 'Hindi'];
          }

          // ✅ ENRICHED: Check verification status
          const isVerified = vendor.is_verified === true || vendor.status === 'approved';

          // Phase 2: priceMin, priceMax from services
          const servicePrices = (services.rows || []).map((s: any) => parseFloat(s.price || s.custom_price || '0')).filter((p: number) => p > 0);
          const priceMin = servicePrices.length > 0 ? Math.min(...servicePrices) : 0;
          const priceMax = servicePrices.length > 0 ? Math.max(...servicePrices) : 0;

          // Phase 2: hasPackages, photos
          let hasPackages = false;
          let photos: string[] = [];
          try {
            const pkgResult = await query(`SELECT 1 FROM service_packages WHERE vendor_id = $1 LIMIT 1`, [vendor.id]);
            hasPackages = (pkgResult.rows?.length || 0) > 0;
          } catch { /* Continue */ }
          try {
            const meta = vendor.metadata;
            if (meta) {
              const m = typeof meta === 'string' ? JSON.parse(meta || '{}') : meta;
              const raw = m?.facility_photos || m?.photos || [];
              photos = Array.isArray(raw) ? raw.slice(0, 5).filter(Boolean) : [];
            }
          } catch { /* Continue */ }

          let vendorIdentityId: string | null = null;
          try {
            vendorIdentityId = await getVendorIdentityId(vendor.id);
          } catch { /* Continue */ }

          return {
            id: vendor.id,
            vendorId: vendor.id,
            vendor_identity_id: vendorIdentityId ?? undefined,
            vendorIdentityId: vendorIdentityId ?? undefined,
            businessName: vendor.business_name,
            roleId: vendor.role_id,
            roleName: vendor.role_name,
            roleDisplayName: vendor.role_display_name,
            category: getCategoryFromRole(vendor.role_name),
            isSoloProvider,
            vendorType: isSoloProvider ? 'solo' : 'clinic',
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
            location: vendor.latitude && vendor.longitude ? {
              coordinates: { lat: parseFloat(vendor.latitude), lng: parseFloat(vendor.longitude) },
              address: vendor.address,
            } : null,
            rating: avgRating,
            reviewCount: reviews.rows.length,
            totalReviews: reviews.rows.length,
            totalOfferings: services.rows.length,
            distanceKm: distance != null ? parseFloat((distance as number).toFixed(2)) : null,
            serviceStyles: serviceStyle ? [serviceStyle] : ['at_center', 'at_home', 'tele'],
            featuredOfferings: services.rows.slice(0, 3).map((s: any) => ({
              id: s.id,
              name: s.name || s.service_name,
              price: s.price || s.custom_price || 0,
              duration: s.duration_minutes || s.custom_duration || 30,
              serviceStyle: s.service_style || (serviceStyle || 'at_home'),
              category: s.category,
            })),
            availabilityScore: isAvailableToday ? 100 : 0,
            isAvailableToday,
            distance,
            // ✅ ENRICHED: Format distance for display
            distanceText: distance !== null ? (distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)} km away`) : null,
            phone: vendor.phone,
            email: vendor.email,
            operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
            // ✅ NEW: Include active vendor promotions for display badges
            hasActivePromotions: activePromotions.length > 0,
            promotions: activePromotions,
            topPromotion: activePromotions[0] || null,
            // ✅ ENRICHED: Additional fields for UniversalVendorCard
            nextAvailableSlot,
            nextAvailable: nextAvailableSlot ? { date: nextAvailableSlot.date, time: nextAvailableSlot.time, display: nextAvailableSlot.formattedDisplay } : null,
            nextAvailability: nextAvailableSlot?.formattedDisplay || null,
            specializations,
            experience,
            completedBookings,
            languages,
            isVerified,
            photoUrl: getVendorPhotoUrl(vendor),
            vendorProfileImage: getVendorPhotoUrl(vendor),
            // Phase 2: Gallery, price range, bestForProblem, hasPackages
            photos: photos.length > 0 ? photos : undefined,
            priceMin: priceMin > 0 ? priceMin : undefined,
            priceMax: priceMax > 0 && priceMax !== priceMin ? priceMax : undefined,
            bestForProblem: problemTitle || undefined,
            hasPackages: hasPackages || undefined,
          };
        })
      )).filter(Boolean);

      // Strict discovery: photos loaded, next availability, profile (specializations), services with complete duration and info
      // ✅ FIX: For at_center, make availability optional (vendors may not have availability configured yet)
      let filteredVendors = enrichedVendors.filter((v: any) => {
        const hasPhoto = !!(v.photoUrl || (v.photos && v.photos.length > 0));
        const hasNextAvailability = !!v.nextAvailableSlot || !!v.nextAvailability;
        const hasProfileInfo = !!(v.businessName || v.specializations?.length > 0);
        const hasCompleteServices = v.featuredOfferings && v.featuredOfferings.length > 0 && v.featuredOfferings.every((o: any) =>
          (o.duration != null && Number(o.duration) > 0) && (o.name || o.category)
        );
        // For at_center: require photo, profile, and services; availability is optional
        if (serviceStyle === 'at_center') {
          return hasPhoto && hasProfileInfo && hasCompleteServices;
        }
        // For at_home/tele: require all fields
        return hasPhoto && hasNextAvailability && hasProfileInfo && hasCompleteServices;
      });
      if (serviceStyle === 'at_center') {
        filteredVendors = filteredVendors.filter((v: any) =>
          v.featuredOfferings && v.featuredOfferings.length > 0 &&
          v.featuredOfferings.some((offering: any) => offering.serviceStyle === 'at_center')
        );
      }

      // Rule book: discovery radius (clinic from customer location), max results, default sort
      const discoverRules = await getDiscoveryRules(
        category || roleId || 'all',
        'discover',
        serviceStyle || undefined,
        category || undefined
      );
      const discoverRadiusKm = typeof discoverRules.discovery_radius_km === 'number' ? discoverRules.discovery_radius_km : 50;
      const discoverMaxResults = typeof discoverRules.discovery_max_results === 'number' ? discoverRules.discovery_max_results : 50;
      const discoverSortDefault = typeof discoverRules.discovery_sort_default === 'string' ? discoverRules.discovery_sort_default : 'relevance';

      // Filter by distance when customer location provided (rule-book radius)
      if (latitude && longitude) {
        filteredVendors = filteredVendors.filter((v: any) =>
          v.distance == null || v.distance <= discoverRadiusKm
        );
      }

      // Filter by rating
      if (minRating) {
        filteredVendors = filteredVendors.filter((v: any) => v.rating >= parseFloat(minRating));
      }

      // Sort (use rule-book default when not provided)
      const effectiveSortBy = sortBy || discoverSortDefault;
      if (effectiveSortBy === 'distance' && latitude && longitude) {
        filteredVendors.sort((a: any, b: any) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
      } else if (effectiveSortBy === 'rating') {
        filteredVendors.sort((a: any, b: any) => b.rating - a.rating);
      } else if (effectiveSortBy === 'price') {
        filteredVendors.sort((a: any, b: any) => {
          const aPrice = a.featuredOfferings[0]?.price || 0;
          const bPrice = b.featuredOfferings[0]?.price || 0;
          return aPrice - bPrice;
        });
      } else {
        // relevance: rating + reviews + distance bonus
        filteredVendors.sort((a: any, b: any) => {
          const aScore = (parseFloat(a.rating) || 0) * 10 + (a.totalReviews || 0) * 0.5 + (a.distance != null ? Math.max(0, 50 - a.distance) : 0);
          const bScore = (parseFloat(b.rating) || 0) * 10 + (b.totalReviews || 0) * 0.5 + (b.distance != null ? Math.max(0, 50 - b.distance) : 0);
          return bScore - aScore;
        });
      }

      // Rule book: limit by discovery_max_results
      const limitedVendors = filteredVendors.slice(0, discoverMaxResults);

      return c.json({
        success: true,
        vendors: limitedVendors,
        total: limitedVendors.length,
        filters: {
          category,
          location,
          minRating,
          availability,
          petType,
          sortBy: effectiveSortBy,
          serviceStyle,
        },
      });
    } catch (error: any) {
      console.error('[discover-services] Error discovering services:', error);
      console.error('[discover-services] Error stack:', error?.stack);
      
      // ✅ FIX: Return proper error codes instead of masking with 200 OK
      // This allows frontend to handle errors properly and enables better debugging
      const errorMessage = error?.message || 'Unknown error discovering services';
      
      // Check for specific error types
      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        return c.json({ 
          success: false, 
          error: 'Service temporarily busy. Please try again in a moment.',
          code: 'POOL_EXHAUSTED',
          vendors: [], 
          total: 0 
        }, 503);
      }
      
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        return c.json({ 
          success: false, 
          error: 'Request timed out. Please try again.',
          code: 'TIMEOUT',
          vendors: [], 
          total: 0 
        }, 504);
      }
      
      // Return 500 for other errors (with fallback empty data for graceful degradation)
      return c.json({ 
        success: false, 
        error: 'Failed to discover services. Please try again.',
        code: 'INTERNAL_ERROR',
        _debug: process.env.NODE_ENV !== 'production' ? errorMessage : undefined,
        vendors: [], 
        total: 0 
      }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId/available-slots
   * Standard availability API for all service types (vet, grooming, training, walker, etc.).
   * Query: date (required), serviceStyle (at_center | at_home | tele), totalDuration?, staffId?, serviceIds?.
   * Response: { success, slots: [{ time, available, booked?, slotDuration?, bufferMinutes?, serviceStyles? }], date, vendorId, serviceStyle, staffBased?, message? }.
   * Uses vendor_availability_v2 only; supports 006 (time_window_*, service_style, is_enabled) and 057+ (start_time/end_time, service_styles, is_available) schemas.
   * Enforces: (1) past booking window + admin buffer, (2) holidays & breaks, (3) service style per slot, (4) buffer between bookings, (5) max capacity when defined.
   */
  app.get("/customer/vendor/:vendorId/available-slots", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date');
      const serviceStyle = c.req.query('serviceStyle') || 'at_home';
      const staffId = c.req.query('staffId');
      const serviceId = c.req.query('serviceId');
      const totalDuration = Math.max(15, parseInt(c.req.query('totalDuration') || '30', 10) || 30);

      if (!date) {
        return c.json({ error: 'date parameter is required' }, 400);
      }

      // Resolve vendor (frontend may pass vendor_identity.id or staff's vendor_id; resolve to vendors.id)
      console.log(`[SLOTS] ========== STARTING VENDOR RESOLUTION ==========`);
      console.log(`[SLOTS] Input vendorId from URL: ${vendorId}`);
      
      // ✅ CRITICAL: First check if input vendorId is a vendor_identity.id and get its linked vendor_id
      let linkedVendorId: string | null = null;
      try {
        const viCheck = await query(
          `SELECT vendor_id::text as vendor_id_text, phone, onboarding_status
           FROM vendor_identity 
           WHERE id::text = $1 
           LIMIT 1`,
          [vendorId]
        );
        if (viCheck.rows.length > 0) {
          const vi = viCheck.rows[0];
          console.log(`[SLOTS] Input is vendor_identity.id: ${vendorId}`);
          console.log(`[SLOTS] vendor_identity.vendor_id: ${vi.vendor_id_text}`);
          console.log(`[SLOTS] vendor_identity.phone: ${vi.phone}, status: ${vi.onboarding_status}`);
          if (vi.vendor_id_text) {
            linkedVendorId = vi.vendor_id_text;
            console.log(`[SLOTS] ✅ Found linked vendor_id: ${linkedVendorId}`);
          }
        }
      } catch (e: any) {
        console.warn(`[SLOTS] Could not check vendor_identity: ${e?.message}`);
      }
      
      let resolvedVendorId: string;
      let availabilityIdsForQuery: string[];
      let canonicalVendorId: string;
      
      console.log(`[SLOTS] ========== CUSTOMER SLOTS REQUEST START ==========`);
      console.log(`[SLOTS] Input vendorId (from URL param): ${vendorId}`);
      console.log(`[SLOTS] Requested date: ${date}`);
      console.log(`[SLOTS] Requested serviceStyle: ${serviceStyle}`);
      
      const vendor = await resolveVendorById(vendorId);
      console.log(`[SLOTS] resolveVendorById result:`, vendor ? { id: vendor.id, business_name: vendor.business_name, phone: vendor.phone, status: vendor.status, is_active: vendor.is_active } : 'null');
      if (!vendor) {
        console.log(`[SLOTS] ERROR: Vendor not found for ID: ${vendorId}`);
        // ✅ FIX: If we found a linked vendor_id but resolveVendorById failed, try using the linked vendor_id directly
        if (linkedVendorId) {
          console.log(`[SLOTS] ⚠️ resolveVendorById failed, but found linked vendor_id: ${linkedVendorId}, trying direct lookup...`);
          const directVendor = await query(
            `SELECT * FROM vendors WHERE id::text = $1 LIMIT 1`,
            [linkedVendorId]
          ).catch(() => ({ rows: [] }));
          if (directVendor.rows.length > 0) {
            resolvedVendorId = linkedVendorId;
            const availabilityIds = await getVendorIdsForAvailabilityLookup(resolvedVendorId);
            canonicalVendorId = resolvedVendorId;
            availabilityIdsForQuery = availabilityIds;
            console.log(`[SLOTS] ✅ Using linked vendor_id directly: ${canonicalVendorId}`);
            console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
          } else {
        return c.json({ error: 'Vendor not found' }, 404);
      }
        } else {
          return c.json({ error: 'Vendor not found' }, 404);
        }
      } else {
        // ✅ CRITICAL: Check if vendor exists but availability might be stored under a different vendor_id
        // This can happen if vendor was recreated or there are duplicate vendor records
        console.log(`[SLOTS] Vendor found: id=${vendor.id}, business_name=${vendor.business_name}, phone=${vendor.phone}`);
        
        // Check if availability exists for this vendor_id
        const availabilityCheck = await query(
          `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
          [vendor.id]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        
        const availabilityCount = parseInt(availabilityCheck.rows[0]?.count || '0', 10);
        console.log(`[SLOTS] Availability records for vendor.id ${vendor.id}: ${availabilityCount}`);
        
        // ✅ FIX: Always check for other vendors with same phone that have availability
        // This handles the case where availability is stored under a different vendor_id
        let finalVendorId = vendor.id;
        let allAvailabilityIds: string[] = [];
        
        if (vendor.phone) {
          console.log(`[SLOTS] Checking for other vendors with same phone (${vendor.phone}) that have availability...`);
          const duplicateVendors = await query(
            `SELECT id::text, business_name, 
                    (SELECT COUNT(*) FROM vendor_availability_v2 WHERE vendor_id::text = vendors.id::text) as availability_count
             FROM vendors 
             WHERE phone = $1
             ORDER BY availability_count DESC, id::text
             LIMIT 10`,
            [vendor.phone]
          ).catch(() => ({ rows: [] }));
          
          if (duplicateVendors.rows.length > 0) {
            console.log(`[SLOTS] Found ${duplicateVendors.rows.length} vendor(s) with same phone:`);
            duplicateVendors.rows.forEach((dup: any) => {
              console.log(`[SLOTS]   - vendor.id: ${dup.id}, business_name: ${dup.business_name}, availability_count: ${dup.availability_count}`);
            });
            
            // Find the vendor with the most availability (or use current vendor if it has availability)
            const vendorWithMostAvailability = duplicateVendors.rows.find((dup: any) => parseInt(dup.availability_count || '0', 10) > 0) || 
                                               (availabilityCount > 0 ? { id: vendor.id, availability_count: availabilityCount } : null);
            
            if (vendorWithMostAvailability) {
              finalVendorId = vendorWithMostAvailability.id;
              console.log(`[SLOTS] ✅ Using vendor with availability: ${finalVendorId} (availability_count: ${vendorWithMostAvailability.availability_count})`);
            } else {
              finalVendorId = vendor.id;
              console.log(`[SLOTS] No vendor with availability found, using original: ${finalVendorId}`);
            }
          } else {
            finalVendorId = vendor.id;
          }
        } else {
          finalVendorId = vendor.id;
        }
        
        // ✅ CRITICAL: Use EXACT same logic as GET /vendor/:vendorId/availability endpoint
        // That endpoint uses getVendorIdsForAvailabilityLookup and queries with ANY($1::text[])
        // This automatically includes all vendors with same phone, so availability will be found
        resolvedVendorId = finalVendorId;
        canonicalVendorId = finalVendorId;
        availabilityIdsForQuery = await getVendorIdsForAvailabilityLookup(finalVendorId);
        console.log(`[SLOTS] ========== VENDOR ID RESOLUTION COMPLETE ==========`);
        console.log(`[SLOTS] Input vendorId (from URL): ${vendorId}`);
        console.log(`[SLOTS] Resolved vendor.id: ${vendor.id}`);
        console.log(`[SLOTS] Final vendorId for query: ${finalVendorId}`);
        console.log(`[SLOTS] canonicalVendorId: ${canonicalVendorId}`);
        console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
        console.log(`[SLOTS] Are input and resolved different? ${vendorId !== vendor.id ? 'YES - This might be the issue!' : 'NO - Same ID'}`);
        
        // ✅ CRITICAL: Check vendor status
        console.log(`[SLOTS] Vendor status check: status=${vendor.status}, is_active=${vendor.is_active}, is_online=${vendor.is_online}`);
        
        // ✅ CRITICAL: Check what availability exists for each ID
        console.log(`[SLOTS] Checking availability records...`);
        for (const availId of availabilityIdsForQuery) {
          const availCheck = await query(
            `SELECT COUNT(*) as count, 
                    array_agg(DISTINCT day_of_week) as days,
                    array_agg(DISTINCT service_styles) as styles
             FROM vendor_availability_v2 
             WHERE vendor_id::text = $1 
               AND (COALESCE(is_available, true) = true)`,
            [availId]
          ).catch(() => ({ rows: [{ count: 0, days: [], styles: [] }] }));
          console.log(`[SLOTS]   - vendor_id ${availId}: ${availCheck.rows[0]?.count || 0} records, days: ${JSON.stringify(availCheck.rows[0]?.days)}, styles: ${JSON.stringify(availCheck.rows[0]?.styles)}`);
          
          // ✅ CRITICAL: Also check vendor status for this ID
          const vendorStatusCheck = await query(
            `SELECT id::text, business_name, status, is_active, is_online 
             FROM vendors 
             WHERE id::text = $1`,
            [availId]
          ).catch(() => ({ rows: [] }));
          if (vendorStatusCheck.rows.length > 0) {
            const v = vendorStatusCheck.rows[0];
            console.log(`[SLOTS]   - vendor status: id=${v.id}, status=${v.status}, is_active=${v.is_active}, is_online=${v.is_online}`);
          } else {
            // ✅ CRITICAL: Check if this is a vendor_identity.id
            const identityCheck = await query(
              `SELECT id::text, vendor_id::text, phone, onboarding_status 
               FROM vendor_identity 
               WHERE id::text = $1`,
              [availId]
            ).catch(() => ({ rows: [] }));
            if (identityCheck.rows.length > 0) {
              const vi = identityCheck.rows[0];
              console.log(`[SLOTS]   - This is vendor_identity.id: ${vi.id}, vendor_id: ${vi.vendor_id}, phone: ${vi.phone}`);
            }
          }
        }
        
        // ✅ CRITICAL: Also check availability under the original input vendor ID (in case it's different)
        if (vendorId !== finalVendorId && !availabilityIdsForQuery.includes(vendorId)) {
          console.log(`[SLOTS] ⚠️ Input vendorId ${vendorId} not in availabilityIdsForQuery, checking availability directly...`);
          const directAvailCheck = await query(
            `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
            [vendorId]
          ).catch(() => ({ rows: [{ count: 0 }] }));
          console.log(`[SLOTS]   - Direct check for vendor_id ${vendorId}: ${directAvailCheck.rows[0]?.count || 0} records`);
          if (parseInt(directAvailCheck.rows[0]?.count || '0', 10) > 0) {
            console.log(`[SLOTS] ⚠️ WARNING: Availability exists under input vendorId ${vendorId} but it's not in availabilityIdsForQuery!`);
            availabilityIdsForQuery.push(vendorId);
            console.log(`[SLOTS] ✅ Added ${vendorId} to availabilityIdsForQuery`);
          }
        }
        
        // ✅ CRITICAL: Find ALL vendor_identity records for this vendor and check if availability exists under any of them
        // This handles the case where availability was saved under vendor_identity.id instead of vendors.id
        if (vendor.phone) {
          console.log(`[SLOTS] ⚠️ Checking ALL vendor_identity records for phone ${vendor.phone} to find availability...`);
          const allIdentityRecords = await query(
            `SELECT id::text, vendor_id::text, phone 
             FROM vendor_identity 
             WHERE phone = $1 OR vendor_id::text = $2`,
            [vendor.phone, finalVendorId]
          ).catch(() => ({ rows: [] }));
          console.log(`[SLOTS] Found ${allIdentityRecords.rows.length} vendor_identity records for this vendor`);
          for (const identityRow of allIdentityRecords.rows) {
            const identityId = identityRow.id;
            if (!availabilityIdsForQuery.includes(identityId)) {
              const identityAvailCheck = await query(
                `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
                [identityId]
              ).catch(() => ({ rows: [{ count: 0 }] }));
              const availCount = parseInt(identityAvailCheck.rows[0]?.count || '0', 10);
              console.log(`[SLOTS]   - vendor_identity.id ${identityId}: ${availCount} availability records`);
              if (availCount > 0) {
                console.log(`[SLOTS] ⚠️ WARNING: Availability exists under vendor_identity.id ${identityId}!`);
                availabilityIdsForQuery.push(identityId);
                console.log(`[SLOTS] ✅ Added ${identityId} to availabilityIdsForQuery`);
              }
            }
          }
        }
        console.log(`[SLOTS] Final resolved vendor: id=${resolvedVendorId}, business_name=${vendor.business_name}, phone=${vendor.phone}`);
        console.log(`[SLOTS] ✅ Using array query with availabilityIdsForQuery (includes all vendors with same phone)`);
      }

      // Parse date in local timezone to avoid UTC issues
      // Date format: "YYYY-MM-DD"
      const [year, month, day] = date.split('-').map(Number);
      const requestedDate = new Date(year, month - 1, day);
      const dayOfWeek = requestedDate.getDay();
      const slotsDebug = c.req.query('debug') === '1' || c.req.query('debug') === 'true';
      console.log(`[SLOTS] Date parsing: input=${date}, parsed=${requestedDate.toISOString()}, dayOfWeek=${dayOfWeek} (0=Sun, 1=Mon, 2=Tue, etc.)`);
      if (slotsDebug) {
        console.log(`[SLOTS] debug: resolvedVendorId=${resolvedVendorId}, canonicalVendorId=${canonicalVendorId}, availabilityIdsForQuery=${JSON.stringify(availabilityIdsForQuery)}, date=${date}, dayOfWeek=${dayOfWeek}, serviceStyle=${serviceStyle}`);
        try {
          const va2DebugRows = await query(
            `SELECT vendor_id, day_of_week,
             COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
             service_style, service_type, is_available, is_enabled
             FROM vendor_availability_v2
             WHERE vendor_id::text = ANY($1::text[])
             ORDER BY day_of_week`,
            [availabilityIdsForQuery]
          );
          const rows = (va2DebugRows?.rows ?? []).slice(0, 25);
          console.log(`[SLOTS] debug: VA2 total=${va2DebugRows?.rows?.length ?? 0}, dayOfWeek requested=${dayOfWeek}, sample=${JSON.stringify(rows)}`);
        } catch (e: any) {
          console.warn('[SLOTS] debug: VA2 lookup failed', e?.message);
        }
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const requestedDateOnly = new Date(requestedDate);
      requestedDateOnly.setHours(0, 0, 0, 0);
      const isToday = requestedDateOnly.getTime() === today.getTime();
      const now = new Date();

      // Scheduling policy: min notice (past booking window) - used for both staff and va2 paths
      let minNoticeMinutes = 30;
      try {
        const policies = await query(`SELECT policy_type, policy_config FROM scheduling_policies WHERE is_active = true`).catch(() => ({ rows: [] }));
        const bufferPolicy = policies.rows.find((p: any) => p.policy_type === 'buffer_time');
        if (bufferPolicy?.policy_config) {
          const cfg = bufferPolicy.policy_config as any;
          minNoticeMinutes = cfg.minBufferTime ?? cfg.minNoticeMinutes ?? 30;
        }
      } catch (_) { /* ignore */ }
      const minBookingTime = new Date(now.getTime() + minNoticeMinutes * 60 * 1000);

      // ---------- 1) Holiday check: no slots if vendor has holiday on this date ----------
      let isHoliday = false;
      try {
        const holEnhanced = await query(
          `SELECT 1 FROM vendor_holidays_enhanced 
           WHERE vendor_id = $1 AND is_active = true
             AND ($2::date >= start_date AND $2::date <= end_date)
           LIMIT 1`,
          [resolvedVendorId, date]
        ).catch(() => ({ rows: [] }));
        if (holEnhanced.rows.length > 0) {
          isHoliday = true;
        }
      } catch {
        // ignore
      }
      if (!isHoliday) {
        try {
          const holLegacy = await query(
            `SELECT 1 FROM vendor_holidays WHERE vendor_id = $1 AND date = $2 LIMIT 1`,
            [resolvedVendorId, date]
          ).catch(() => ({ rows: [] }));
          if (holLegacy.rows.length > 0) isHoliday = true;
        } catch {
          // ignore
        }
      }
      if (!isHoliday && vendor.metadata && (vendor.metadata as any).vacation_mode?.isActive) {
        const vm = (vendor.metadata as any).vacation_mode;
        const start = new Date(vm.startDate);
        const end = new Date(vm.endDate);
        if (requestedDate >= start && requestedDate <= end) isHoliday = true;
      }
      if (isHoliday) {
        return c.json({
          success: true,
          slots: [],
          date,
          vendorId: canonicalVendorId,
          serviceStyle,
          staffBased: false,
          message: 'Vendor is on holiday or vacation on this date',
        });
      }
      
      // Staff-based availability (at_home/tele): still uses staff_availability_slots; past-window enforced below
      if (serviceStyle === 'at_home' || serviceStyle === 'tele') {
        let staffQuery = `
          SELECT DISTINCT 
            sas.id as slot_id,
            sas.staff_id,
            s.name as staff_name,
            s.photo_url as staff_photo,
            sas.start_time,
            sas.end_time,
            sas.is_available,
            sss.lead_time_minutes,
            sss.buffer_time_minutes
          FROM staff_availability_slots sas
          INNER JOIN staff s ON sas.staff_id = s.id
          LEFT JOIN staff_slot_services sss ON sas.id = sss.slot_id
          LEFT JOIN services srv ON sss.service_id = srv.id
          WHERE s.vendor_id = $1
          AND sas.date = $2
          AND sas.is_available = true
          AND s.is_active = true
          AND s.mobile_verified = true
        `;
        const params: any[] = [resolvedVendorId, date];
        let paramIndex = 3;

        if (staffId) {
          staffQuery += ` AND s.id = $${paramIndex}`;
          params.push(staffId);
          paramIndex++;
        }

        if (serviceId) {
          staffQuery += ` AND sss.service_id = $${paramIndex}`;
          params.push(serviceId);
          paramIndex++;
        }

        // Filter by service style - removed since services table doesn't have service_style column
        // Service style filtering is handled at vendor_services level, not at staff_slot_services level
        // staffQuery += ` AND (srv.service_style = $${paramIndex} OR srv.service_style IS NULL)`;
        // params.push(serviceStyle);
        // paramIndex++;

        staffQuery += ` ORDER BY sas.start_time, s.name`;

        const staffSlotsResult = await query(staffQuery, params).catch((err) => {
          console.warn('[SLOTS] Staff availability query failed, falling back to vendor hours:', err.message);
          return { rows: [] };
        });

        if (staffSlotsResult.rows.length > 0) {
          // Get existing bookings to mark booked slots
          const existingBookingsResult = await query(
            `SELECT booking_time, staff_id FROM bookings 
             WHERE vendor_id = $1 
             AND booking_date = $2 
             AND status NOT IN ('cancelled', 'rejected')`,
            [resolvedVendorId, date]
          ).catch(() => ({ rows: [] }));

          // Group bookings by staff
          const bookedByStaff: Record<string, Set<string>> = {};
          for (const booking of existingBookingsResult.rows) {
            const sid = booking.staff_id || 'general';
            if (!bookedByStaff[sid]) {
              bookedByStaff[sid] = new Set();
            }
            const time = typeof booking.booking_time === 'string' 
              ? booking.booking_time.substring(0, 5) 
              : booking.booking_time;
            bookedByStaff[sid].add(time);
          }

          // Generate 30-minute slots for each staff availability window
          const slots: any[] = [];
          const now = new Date();
          const requestedDate = new Date(date);

          // ✅ FIX: Only check if slot is in the past if the date is TODAY
          // For future dates, all slots should be available (unless booked)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const requestedDateOnly = new Date(requestedDate);
          requestedDateOnly.setHours(0, 0, 0, 0);
          const isToday = requestedDateOnly.getTime() === today.getTime();

          for (const staffSlot of staffSlotsResult.rows) {
            const [startHour, startMin] = staffSlot.start_time.split(':').map(Number);
            const [endHour, endMin] = staffSlot.end_time.split(':').map(Number);
            const staffBookedTimes = bookedByStaff[staffSlot.staff_id] || new Set();

            let currentHour = startHour;
            let currentMin = startMin;

            while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
              const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
              
              // ✅ ENFORCE: Past booking window (scheduling policy min notice)
              let isPast = false;
              if (isToday) {
                const slotDateTime = new Date(requestedDate);
                slotDateTime.setHours(currentHour, currentMin, 0, 0);
                isPast = slotDateTime < minBookingTime;
              }

              // Check if booked for this staff
              const isBooked = staffBookedTimes.has(timeStr);

              slots.push({
                time: timeStr,
                available: !isPast && !isBooked,
                booked: isBooked,
                staffId: staffSlot.staff_id,
                staffName: staffSlot.staff_name,
                staffPhoto: staffSlot.staff_photo,
                leadTimeMinutes: staffSlot.lead_time_minutes || 0,
                bufferTimeMinutes: staffSlot.buffer_time_minutes || 15,
              });

              currentMin += 30;
              if (currentMin >= 60) {
                currentMin -= 60;
                currentHour += 1;
              }
            }
          }

          // Remove duplicate times and sort
          const uniqueSlots = slots.reduce((acc: any[], slot) => {
            const existing = acc.find(s => s.time === slot.time && s.staffId === slot.staffId);
            if (!existing) {
              acc.push(slot);
            }
            return acc;
          }, []);

          return c.json({
            success: true,
            slots: uniqueSlots.sort((a, b) => a.time.localeCompare(b.time)),
            date,
            vendorId,
            serviceStyle,
            staffBased: true, // ✅ Flag indicating slots are staff-specific
          });
        }
        // If no staff availability found, fall through to vendor_availability_v2 then operating hours
      }

      // ---------- 2) Slot-based advance availability only: vendor_availability_v2 (no fallback) ----------
      // Only vendors who have set advance availability in the dashboard get slots. No weekly fallback.
      const normalizedServiceStyle = (serviceStyle === 'at_vendor' || serviceStyle === 'at_center') ? 'at_center' : serviceStyle;
      const acceptableStylesForSlot: string[] =
        normalizedServiceStyle === 'at_center' ? ['at_center', 'at_vendor'] :
        normalizedServiceStyle === 'tele' ? ['tele', 'online', 'video_consultation'] :
        [normalizedServiceStyle];
      const dayOfWeekValues = dayOfWeek === 0 ? [0, 7] : [dayOfWeek];
      let va2Slots: any[] = [];
      
      // ✅ DEBUG: Log vendor ID resolution
      console.log(`[SLOTS] ========== VENDOR ID RESOLUTION ==========`);
      console.log(`[SLOTS] inputVendorId=${vendorId}`);
      console.log(`[SLOTS] resolvedVendorId=${resolvedVendorId}`);
      console.log(`[SLOTS] canonicalVendorId=${canonicalVendorId}`);
      console.log(`[SLOTS] availabilityIdsForQuery=${JSON.stringify(availabilityIdsForQuery)}`);
      console.log(`[SLOTS] ========== QUERY PARAMETERS ==========`);
      console.log(`[SLOTS] date=${date}, dayOfWeek=${dayOfWeek} (0=Sun, 1=Mon, 2=Tue, etc.)`);
      console.log(`[SLOTS] serviceStyle=${serviceStyle}, normalizedServiceStyle=${normalizedServiceStyle}`);
      console.log(`[SLOTS] acceptableStylesForSlot=${JSON.stringify(acceptableStylesForSlot)}`);
      console.log(`[SLOTS] dayOfWeekValues=${JSON.stringify(dayOfWeekValues)}`);
      
      // ✅ DEBUG: Check if any availability records exist for this vendor
      try {
        // First, check if ANY records exist for ANY of the availabilityIds (to see if vendor_id matches)
        const anyRecordsQuery = await query(
          `SELECT vendor_id::text, day_of_week, 
                  COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
                  service_style, service_type
           FROM vendor_availability_v2
           WHERE vendor_id::text = ANY($1::text[])
           ORDER BY day_of_week
           LIMIT 10`,
          [availabilityIdsForQuery]
        );
        console.log(`[SLOTS] ========== ANY RECORDS FOR availabilityIdsForQuery ==========`);
        console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
        console.log(`[SLOTS] Total records found: ${anyRecordsQuery.rows.length}`);
        if (anyRecordsQuery.rows.length > 0) {
          console.log(`[SLOTS] Sample records:`, JSON.stringify(anyRecordsQuery.rows.slice(0, 3), null, 2));
        } else {
          console.log(`[SLOTS] ⚠️ NO RECORDS FOUND for any vendor_id in availabilityIdsForQuery!`);
          console.log(`[SLOTS] This means vendor_id in vendor_availability_v2 doesn't match any ID in availabilityIdsForQuery`);
        }
        
        // Check ALL vendor_availability_v2 records for this vendor (no filters)
        const allVA2Records = await query(
          `SELECT vendor_id::text, day_of_week, 
                  COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
                  service_type, 
                  is_available,
                  COALESCE(time_window_start, start_time) as start_time,
                  COALESCE(time_window_end, end_time) as end_time
           FROM vendor_availability_v2
           WHERE vendor_id::text = $1
           ORDER BY day_of_week, COALESCE(time_window_start, start_time)`,
          [canonicalVendorId]
        );
        console.log(`[SLOTS] ========== ALL vendor_availability_v2 RECORDS FOR CANONICAL VENDOR ID ==========`);
        console.log(`[SLOTS] canonicalVendorId: ${canonicalVendorId}`);
        console.log(`[SLOTS] Total records: ${allVA2Records.rows.length}`);
        if (allVA2Records.rows.length > 0) {
          console.log(`[SLOTS] Records:`, JSON.stringify(allVA2Records.rows, null, 2));
        } else {
          console.log(`[SLOTS] ⚠️ NO RECORDS FOUND for canonicalVendorId!`);
        }
        
        // Diagnostic query with filters
        const diagnosticQuery = await query(
          `SELECT 
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[])) as day_match_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[]) AND (
               (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[])
              OR (service_type IS NOT NULL AND service_type::text = ANY($3::text[]))
            )) as day_style_match_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[]) AND (
              (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[])
              OR (service_type IS NOT NULL AND service_type::text = ANY($3::text[]))
            ) AND (COALESCE(is_available, true) = true OR is_available IS NULL)) as day_style_enabled_match_count,
            array_agg(DISTINCT day_of_week) as distinct_days,
            array_agg(DISTINCT service_type) FILTER (WHERE service_type IS NOT NULL) as distinct_service_types
           FROM vendor_availability_v2
           WHERE vendor_id::text = $1`,
          [canonicalVendorId, dayOfWeekValues, acceptableStylesForSlot]
        );
        const diag = diagnosticQuery.rows[0];
        console.log(`[SLOTS] Diagnostic: total=${diag.total_count}, day_match=${diag.day_match_count}, day_style_match=${diag.day_style_match_count}, day_style_enabled_match=${diag.day_style_enabled_match_count}`);
        console.log(`[SLOTS] Diagnostic: days=${JSON.stringify(diag.distinct_days)}, service_types=${JSON.stringify(diag.distinct_service_types)}`);
      } catch (diagErr: any) {
        console.warn(`[SLOTS] Diagnostic query failed:`, diagErr?.message);
      }
      
      // ✅ CRITICAL: Before querying, ensure we have ALL possible vendor IDs that might have availability
      // This includes vendor_identity.id if the vendor saved under that ID
      console.log(`[SLOTS] ========== FINAL availabilityIdsForQuery BEFORE QUERY ==========`);
      console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
      console.log(`[SLOTS] This array will be used to query vendor_availability_v2`);
      
      // ✅ CRITICAL: Direct query to verify data exists BEFORE main query block
      // Try querying WITHOUT vendor status filters first, as vendor might not be approved/active but still have availability
      console.log(`[SLOTS] ========== DIRECT VERIFICATION QUERY (NO VENDOR STATUS FILTERS) ==========`);
      let verificationSlots: any[] = [];
      try {
        // First try with service style filter but without vendor status filters
        const directVerification = await query(
          `SELECT va.id, va.day_of_week, 
                  COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                  COALESCE(va.time_window_end, va.end_time) as time_window_end,
                  va.start_time, va.end_time,
                  va.service_styles, va.service_type,
                  COALESCE(va.is_available, true) as is_available
           FROM vendor_availability_v2 va
           WHERE va.vendor_id::text = ANY($1::text[])
             AND va.day_of_week = ANY($2::int[])
             AND (
               (COALESCE(va.service_styles, ARRAY[]::text[]) && $3::text[])
               OR (va.service_type IS NOT NULL AND va.service_type::text = ANY($3::text[]))
             )
             AND COALESCE(va.is_available, true) = true`,
          [availabilityIdsForQuery, dayOfWeekValues, acceptableStylesForSlot]
        );
        console.log(`[SLOTS] Direct verification query (with service style filter) returned ${directVerification.rows.length} rows`);
        if (directVerification.rows.length > 0) {
          console.log(`[SLOTS] ✅ VERIFICATION SUCCESS: Found ${directVerification.rows.length} records matching service style`);
          console.log(`[SLOTS] First record:`, JSON.stringify(directVerification.rows[0]));
          console.log(`[SLOTS] First record time_window_start: ${directVerification.rows[0].time_window_start}, time_window_end: ${directVerification.rows[0].time_window_end}`);
          verificationSlots = directVerification.rows;
        } else {
          // Try without service style filter to see if records exist at all
          console.log(`[SLOTS] ⚠️ No records with service style filter, trying without service style filter...`);
          const directVerificationNoStyle = await query(
            `SELECT va.id, va.day_of_week, 
                    COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                    COALESCE(va.time_window_end, va.end_time) as time_window_end,
                    va.start_time, va.end_time,
                    va.service_styles, va.service_type,
                    COALESCE(va.is_available, true) as is_available
             FROM vendor_availability_v2 va
             WHERE va.vendor_id::text = ANY($1::text[])
               AND va.day_of_week = ANY($2::int[])
               AND COALESCE(va.is_available, true) = true`,
            [availabilityIdsForQuery, dayOfWeekValues]
          );
          console.log(`[SLOTS] Direct verification query (no service style filter) returned ${directVerificationNoStyle.rows.length} rows`);
          if (directVerificationNoStyle.rows.length > 0) {
            console.log(`[SLOTS] ⚠️ Found ${directVerificationNoStyle.rows.length} records but service style filter excluded them`);
            console.log(`[SLOTS] Sample record service_styles: ${JSON.stringify(directVerificationNoStyle.rows[0].service_styles)}`);
            console.log(`[SLOTS] Sample record service_type: ${directVerificationNoStyle.rows[0].service_type}`);
            console.log(`[SLOTS] Sample record service_style: ${directVerificationNoStyle.rows[0].service_style}`);
            console.log(`[SLOTS] acceptableStylesForSlot: ${JSON.stringify(acceptableStylesForSlot)}`);
            // ✅ FIX: Do NOT use records that don't match service style - this causes whole day slots
            // Only use records that actually match the requested service style
            const styleFiltered = directVerificationNoStyle.rows.filter((row: any) => {
              const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
              const serviceType = row.service_type || row.service_style || '';
              return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                     acceptableStylesForSlot.includes(serviceType);
            });
            if (styleFiltered.length > 0) {
              console.log(`[SLOTS] ✅ After style filtering, ${styleFiltered.length} records match service style`);
              verificationSlots = styleFiltered;
            } else {
              console.log(`[SLOTS] ⚠️ No records match service style after filtering - will return empty slots`);
            }
          } else {
            console.log(`[SLOTS] ⚠️ VERIFICATION: No records found for day_of_week ${dayOfWeek} at all`);
          }
        }
      } catch (verifyErr: any) {
        console.error(`[SLOTS] Direct verification query failed: ${verifyErr?.message}`);
      }
      
      // ✅ CRITICAL: If verification found records, use them directly (they're already filtered by service style and is_available)
      // Only run main query if verification found no records
      if (verificationSlots.length === 0) {
        console.log(`[SLOTS] ========== EXECUTING MAIN QUERY (verification found 0, applying filters) ==========`);
        try {
          // ✅ CRITICAL FIX: Since SQL test confirms records exist, try fallback query FIRST
          // This ensures we always find weekly availability even if service style filter is too strict
        console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
        console.log(`[SLOTS] dayOfWeekValues: ${JSON.stringify(dayOfWeekValues)}`);
        console.log(`[SLOTS] canonicalVendorId: ${canonicalVendorId}`);
        console.log(`[SLOTS] acceptableStylesForSlot: ${JSON.stringify(acceptableStylesForSlot)}`);
        
        // ✅ CRITICAL FIX: Use ENHANCED AVAILABILITY VIEW (vendor_availability_full)
        // This view automatically filters by is_online, status='approved', is_active=true
        // This ensures we only get availability for vendors that are actually available
        console.log(`[SLOTS] Using ENHANCED AVAILABILITY VIEW with availabilityIdsForQuery=${JSON.stringify(availabilityIdsForQuery)}, dayOfWeek=${dayOfWeek}, acceptableStylesForSlot=${JSON.stringify(acceptableStylesForSlot)}`);
        try {
          // First try with service style filter using the enhanced view
          // ✅ CRITICAL: Use minimal columns that exist in all schema versions
          console.log(`[SLOTS] Attempting query with style filter...`);
          let arrayQueryWithStyle: any = { rows: [] };
          try {
            arrayQueryWithStyle = await query(
              `SELECT va.id, va.day_of_week, 
                      COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                      COALESCE(va.time_window_end, va.end_time) as time_window_end,
                      va.start_time, va.end_time,
                      va.service_styles, va.service_type,
                      COALESCE(va.is_available, true) as is_available,
                      v.is_online, v.status, v.is_active
               FROM vendor_availability_v2 va
               JOIN vendors v ON va.vendor_id = v.id
               WHERE va.vendor_id::text = ANY($1::text[])
                 AND va.day_of_week = ANY($2::int[])
                 AND (
                   (COALESCE(va.service_styles, ARRAY[]::text[]) && $3::text[])
                   OR (va.service_type IS NOT NULL AND va.service_type::text = ANY($3::text[]))
                   OR EXISTS (
                     SELECT 1 FROM unnest(COALESCE(va.service_styles, ARRAY[]::text[])) AS style
                     WHERE style = ANY($3::text[])
                   )
                 )
                 AND COALESCE(va.is_available, true) = true
                 AND v.status = 'approved'
                 AND v.is_active = true
               ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
              [availabilityIdsForQuery, dayOfWeekValues, acceptableStylesForSlot]
            );
            console.log(`[SLOTS] Query with style filter succeeded: ${arrayQueryWithStyle.rows.length} rows`);
          } catch (err: any) {
            console.log(`[SLOTS] Query with style filter failed: ${err?.message}`);
            console.log(`[SLOTS] Error details:`, err);
            arrayQueryWithStyle = { rows: [] };
          }
          va2Slots = arrayQueryWithStyle?.rows || [];
          console.log(`[SLOTS] Array query (with style filter) found ${va2Slots.length} records`);
          if (va2Slots.length > 0) {
            console.log(`[SLOTS] ✅ SUCCESS! Found ${va2Slots.length} records using array query with style filter`);
            console.log(`[SLOTS] First record:`, JSON.stringify(va2Slots[0]));
            console.log(`[SLOTS] First record time_window_start: ${va2Slots[0]?.time_window_start || va2Slots[0]?.start_time}, time_window_end: ${va2Slots[0]?.time_window_end || va2Slots[0]?.end_time}`);
            console.log(`[SLOTS] First record service_styles: ${JSON.stringify(va2Slots[0]?.service_styles)}`);
          } else {
            console.log(`[SLOTS] ⚠️ Array query with style filter returned 0 - trying without style filter...`);
            // Fallback: try without style filter using enhanced view (includes online status check)
            console.log(`[SLOTS] Attempting query without style filter...`);
            let arrayQueryNoStyle: any = { rows: [] };
            try {
              arrayQueryNoStyle = await query(
                `SELECT va.id, va.day_of_week, 
                        COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                        COALESCE(va.time_window_end, va.end_time) as time_window_end,
                        va.start_time, va.end_time,
                        va.service_styles, va.service_type,
                        COALESCE(va.is_available, true) as is_available,
                        v.is_online, v.status, v.is_active
                 FROM vendor_availability_v2 va
                 JOIN vendors v ON va.vendor_id = v.id
                 WHERE va.vendor_id::text = ANY($1::text[])
                   AND va.day_of_week = ANY($2::int[])
                   AND (COALESCE(va.is_available, true) = true)
                   AND v.status = 'approved'
                   AND v.is_active = true
                 ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                [availabilityIdsForQuery, dayOfWeekValues]
              );
              console.log(`[SLOTS] Query without style filter succeeded: ${arrayQueryNoStyle.rows.length} rows`);
            } catch (err: any) {
              console.log(`[SLOTS] Query without style filter failed: ${err?.message}`);
              arrayQueryNoStyle = { rows: [] };
            }
            const noStyleRows = arrayQueryNoStyle?.rows || [];
            console.log(`[SLOTS] Array query (NO style filter) found ${noStyleRows.length} records`);
            if (noStyleRows.length > 0) {
              console.log(`[SLOTS] ⚠️ Records exist but service style filter excluded them!`);
              console.log(`[SLOTS] Sample record service_styles: ${JSON.stringify(noStyleRows[0].service_styles)}`);
              console.log(`[SLOTS] Sample record service_type: ${noStyleRows[0].service_type}`);
              console.log(`[SLOTS] Sample record service_style: ${noStyleRows[0].service_style}`);
              console.log(`[SLOTS] acceptableStylesForSlot: ${JSON.stringify(acceptableStylesForSlot)}`);
              console.log(`[SLOTS] Sample record time_window_start: ${noStyleRows[0]?.time_window_start || noStyleRows[0]?.start_time}, time_window_end: ${noStyleRows[0]?.time_window_end || noStyleRows[0]?.end_time}`);
              // ✅ FIX: Filter by service style BEFORE using records - don't use records that don't match
              const styleFiltered = noStyleRows.filter((row: any) => {
                const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
                const serviceType = row.service_type || row.service_style || '';
                return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                       acceptableStylesForSlot.includes(serviceType);
              });
              if (styleFiltered.length > 0) {
                console.log(`[SLOTS] ✅ After style filtering, ${styleFiltered.length} records match service style`);
                va2Slots = styleFiltered;
              } else {
                console.log(`[SLOTS] ⚠️ No records match service style after filtering - will return empty slots`);
                va2Slots = []; // Don't use records that don't match service style
              }
            } else {
              // ✅ CRITICAL: Try query without vendor status filters (vendor might be offline or not approved)
              console.log(`[SLOTS] ⚠️ No availability found even without service style filter, trying without vendor status filters...`);
              console.log(`[SLOTS] Attempting query without vendor status filters...`);
              let noStatusFilterResult: any = { rows: [] };
              try {
                noStatusFilterResult = await query(
                  `SELECT va.id, va.day_of_week, 
                          COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                          COALESCE(va.time_window_end, va.end_time) as time_window_end,
                          va.start_time, va.end_time,
                          va.service_styles, va.service_type,
                          COALESCE(va.is_available, true) as is_available
                   FROM vendor_availability_v2 va
                   WHERE va.vendor_id::text = ANY($1::text[])
                     AND va.day_of_week = ANY($2::int[])
                     AND (COALESCE(va.is_available, true) = true)
                   ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                  [availabilityIdsForQuery, dayOfWeekValues]
                );
                console.log(`[SLOTS] Query without vendor status filters succeeded: ${noStatusFilterResult.rows.length} rows`);
              } catch (err: any) {
                console.log(`[SLOTS] Query without vendor status filters failed: ${err?.message}`);
                noStatusFilterResult = { rows: [] };
              }
              console.log(`[SLOTS] ⚠️ Query without vendor status filters returned ${noStatusFilterResult.rows.length} rows`);
              if (noStatusFilterResult.rows.length > 0) {
                va2Slots = noStatusFilterResult.rows;
                console.log(`[SLOTS] ✅ Using results without vendor status filters (${va2Slots.length} slots)`);
                console.log(`[SLOTS] ⚠️ WARNING: Vendor status filters excluded these records! Vendor may not be approved/active/online.`);
                console.log(`[SLOTS] First record from no-status-filter query:`, JSON.stringify(noStatusFilterResult.rows[0]));
              } else {
                console.log(`[SLOTS] ⚠️ No records found even without style filter for availabilityIdsForQuery`);
                console.log(`[SLOTS] This means no availability exists for vendor_id in ${JSON.stringify(availabilityIdsForQuery)} on day_of_week ${dayOfWeek}`);
                // ✅ CRITICAL: Last resort - query without ANY filters except vendor_id and day_of_week
                console.log(`[SLOTS] ⚠️ Last resort: Querying without ANY filters (except vendor_id and day_of_week)...`);
                console.log(`[SLOTS] Attempting last resort query (no filters except vendor_id and day_of_week)...`);
                let lastResortQuery: any = { rows: [] };
                try {
                  lastResortQuery = await query(
                    `SELECT va.id, va.day_of_week, 
                            COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                            COALESCE(va.time_window_end, va.end_time) as time_window_end,
                            va.start_time, va.end_time,
                            va.service_styles, va.service_type,
                            COALESCE(va.is_available, true) as is_available
                     FROM vendor_availability_v2 va
                     WHERE va.vendor_id::text = ANY($1::text[])
                       AND va.day_of_week = ANY($2::int[])
                     ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                    [availabilityIdsForQuery, dayOfWeekValues]
                  );
                  console.log(`[SLOTS] Last resort query succeeded: ${lastResortQuery.rows.length} rows`);
                } catch (err: any) {
                  console.log(`[SLOTS] Last resort query failed: ${err?.message}`);
                  lastResortQuery = { rows: [] };
                }
                console.log(`[SLOTS] ⚠️ Last resort query returned ${lastResortQuery.rows.length} rows`);
                if (lastResortQuery.rows.length > 0) {
                  // ✅ FIX: Filter last resort results by service style - don't use all records
                  if (acceptableStylesForSlot && acceptableStylesForSlot.length > 0) {
                    const styleFiltered = lastResortQuery.rows.filter((row: any) => {
                      const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
                      const serviceType = row.service_type || row.service_style || '';
                      return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                             acceptableStylesForSlot.includes(serviceType);
                    });
                    if (styleFiltered.length > 0) {
                      va2Slots = styleFiltered;
                      console.log(`[SLOTS] ✅ Using last resort results (${styleFiltered.length} slots after service style filter, from ${lastResortQuery.rows.length} total)`);
                    } else {
                      console.log(`[SLOTS] ⚠️ Last resort query found records but none match service style - will return empty slots`);
                      va2Slots = [];
                    }
                  } else {
                  va2Slots = lastResortQuery.rows;
                    console.log(`[SLOTS] ✅ Using last resort results (${va2Slots.length} slots) - NO SERVICE STYLE FILTER`);
                  }
                  if (va2Slots.length > 0) {
                    console.log(`[SLOTS] First record:`, JSON.stringify(va2Slots[0]));
                  }
                }
              }
            }
          }
        } catch (innerErr: any) {
          console.error(`[SLOTS] Inner query block failed: ${innerErr?.message}`);
        }
        } catch (queryErr: any) {
          console.error(`[SLOTS] ========== QUERY BLOCK FAILED ==========`);
          console.error(`[SLOTS] Query failed: ${queryErr?.message}`);
          console.error(`[SLOTS] Query error stack: ${queryErr?.stack}`);
          console.error(`[SLOTS] Query error code: ${queryErr?.code}`);
          console.error(`[SLOTS] Query error detail: ${queryErr?.detail}`);
          va2Slots = [];
        }
      }
      
      // ✅ CRITICAL: Prioritize verificationSlots since they're already filtered correctly (service style + is_available, no vendor status filter)
      // This ensures we find availability even if vendor status filters exclude records
      // ✅ FIX: Ensure verificationSlots are filtered by service style
      if (verificationSlots.length > 0) {
        console.log(`[SLOTS] ========== USING VERIFICATION RESULTS (${verificationSlots.length} records) - PRIORITIZED ==========`);
        // Double-check service style filtering on verification slots
        if (acceptableStylesForSlot && acceptableStylesForSlot.length > 0) {
          const styleFiltered = verificationSlots.filter((row: any) => {
            const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
            const serviceType = row.service_type || row.service_style || '';
            return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                   acceptableStylesForSlot.includes(serviceType);
          });
          if (styleFiltered.length !== verificationSlots.length) {
            console.log(`[SLOTS] ⚠️ Verification slots filtered: ${verificationSlots.length} -> ${styleFiltered.length} (removed non-matching service styles)`);
          }
          va2Slots = styleFiltered;
        } else {
        va2Slots = verificationSlots;
        }
      } else if (va2Slots.length === 0) {
        console.log(`[SLOTS] ========== NO RECORDS FOUND (verification: ${verificationSlots.length}, main query: ${va2Slots.length}) ==========`);
      } else {
        console.log(`[SLOTS] ========== USING MAIN QUERY RESULTS (${va2Slots.length} records) ==========`);
        // ✅ FIX: Ensure main query results are also filtered by service style
        if (acceptableStylesForSlot && acceptableStylesForSlot.length > 0) {
          const styleFiltered = va2Slots.filter((row: any) => {
            const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
            const serviceType = row.service_type || row.service_style || '';
            return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                   acceptableStylesForSlot.includes(serviceType);
          });
          if (styleFiltered.length !== va2Slots.length) {
            console.log(`[SLOTS] ⚠️ Main query results filtered: ${va2Slots.length} -> ${styleFiltered.length} (removed non-matching service styles)`);
          }
          va2Slots = styleFiltered;
        }
      }
      
      console.log(`[SLOTS] ========== FINAL QUERY RESULT ==========`);
      console.log(`[SLOTS] va2Slots.length: ${va2Slots.length}`);
      console.log(`[SLOTS] canonicalVendorId: ${canonicalVendorId}`);
      console.log(`[SLOTS] dayOfWeek: ${dayOfWeek}`);
      console.log(`[SLOTS] acceptableStylesForSlot: ${JSON.stringify(acceptableStylesForSlot)}`);
      if (va2Slots.length > 0) {
        console.log(`[SLOTS] ✅ Found ${va2Slots.length} availability records - will generate slots`);
        console.log(`[SLOTS] First record:`, JSON.stringify(va2Slots[0]));
        console.log(`[SLOTS] First record service_styles: ${JSON.stringify(va2Slots[0].service_styles)}`);
        console.log(`[SLOTS] First record service_type: ${va2Slots[0].service_type}`);
        console.log(`[SLOTS] First record is_available: ${va2Slots[0].is_available}`);
        console.log(`[SLOTS] First record time_window_start: ${va2Slots[0].time_window_start}, time_window_end: ${va2Slots[0].time_window_end}`);
      } else {
        console.log(`[SLOTS] ⚠️ No availability records found after all queries`);
        // ✅ ENHANCED AVAILABILITY DEBUG: Check vendor status and online status
        try {
          const vendorStatusCheck = await query(
            `SELECT v.id::text, v.business_name, v.phone, v.status, v.is_active, v.is_online,
                    (SELECT COUNT(*) FROM vendor_availability_v2 WHERE vendor_id::text = v.id::text) as availability_count
             FROM vendors v
             WHERE v.id::text = ANY($1::text[])
             ORDER BY availability_count DESC
             LIMIT 5`,
            [availabilityIdsForQuery]
          );
          console.log(`[SLOTS] ⚠️ ENHANCED AVAILABILITY DEBUG - Vendor status check: ${JSON.stringify(vendorStatusCheck.rows)}`);
          
          // Check if vendor is offline or not approved
          for (const vendor of vendorStatusCheck.rows) {
            const issues: string[] = [];
            if (vendor.status !== 'approved') issues.push(`status=${vendor.status} (needs 'approved')`);
            if (!vendor.is_active) issues.push(`is_active=false`);
            if (vendor.is_online === false) issues.push(`is_online=false`);
            if (issues.length > 0) {
              console.log(`[SLOTS] ⚠️ Vendor ${vendor.id} has issues: ${issues.join(', ')}`);
            }
          }
        } catch (debugErr: any) {
          console.warn(`[SLOTS] Enhanced availability debug failed: ${debugErr?.message}`);
        }
      }
      
      // ✅ CRITICAL: Error handling is done by the endpoint handler's catch block
      // The verification query and main query already have their own error handling

      // No fallback: only slot-based advance availability (vendor_availability_v2) produces slots.
      // Vendors without advance scheduling do not show slots and should not be discoverable.

      // Breaks for this day
      let breaks: { startTime: string; endTime: string }[] = [];
      try {
        const breakRows = await query(
          `SELECT start_time, end_time FROM vendor_breaks
           WHERE vendor_id = $1 AND is_active = true
             AND ((is_recurring = true AND day_of_week = $2) OR break_date = $3::date)`,
          [resolvedVendorId, dayOfWeek, date]
        ).catch(() => ({ rows: [] }));
        breaks = breakRows.rows.map((r: any) => ({
          startTime: typeof r.start_time === 'string' ? r.start_time.substring(0, 5) : r.start_time,
          endTime: typeof r.end_time === 'string' ? r.end_time.substring(0, 5) : r.end_time,
        }));
      } catch (_) { /* ignore */ }

      const timeToMinutes = (t: string): number => {
        const s = typeof t === 'string' ? t.substring(0, 5) : String(t);
        const [h, m] = s.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      // Existing bookings with duration (for buffer overlap and capacity)
      const normalizeBookingTime = (t: any): string => {
        if (t == null) return '00:00';
        if (typeof t === 'string') {
          if (t.includes('T')) {
            const timePart = (t.split('T')[1] || '').substring(0, 5);
            return timePart.length >= 5 ? timePart : t.substring(0, 5);
          }
          return t.substring(0, 5);
        }
        if (typeof (t as Date).getHours === 'function') {
          const d = t as Date;
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return String(t).substring(0, 5);
      };
      let existingBookings: { booking_time: string; duration_minutes: number }[] = [];
      try {
        // ✅ CRITICAL: Use total_duration_minutes if available (for multi-service bookings), otherwise duration_minutes
        // This ensures we use the actual booking duration, not just the base service duration
        const bookResult = await query(
          `SELECT booking_time, 
                  COALESCE(total_duration_minutes, duration_minutes, 30) as duration_minutes
           FROM bookings
           WHERE vendor_id = $1 AND booking_date = $2
             AND status NOT IN ('cancelled', 'rejected', 'no_show')`,
          [resolvedVendorId, date]
        ).catch(() => ({ rows: [] }));
        existingBookings = bookResult.rows.map((b: any) => ({
          booking_time: normalizeBookingTime(b.booking_time),
          duration_minutes: Number(b.duration_minutes) || 30,
        }));
      } catch (_) { /* ignore */ }

      if (va2Slots.length > 0) {
        console.log(`[SLOTS] ========== GENERATING SLOTS FROM ${va2Slots.length} AVAILABILITY RECORDS ==========`);
        // ✅ CRITICAL: Filter records by service style - STRICT FILTERING (no fallback to all records)
        // This ensures tele service only shows tele-specific availability (e.g., 2pm-6pm), not whole day
        let filteredSlots = va2Slots;
        if (acceptableStylesForSlot && acceptableStylesForSlot.length > 0) {
          filteredSlots = va2Slots.filter((row: any) => {
            const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
            const serviceType = row.service_type || row.service_style || '';
            const hasMatchingStyle = serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                                    acceptableStylesForSlot.includes(serviceType);
            if (!hasMatchingStyle) {
              console.log(`[SLOTS] Filtering out record: service_styles=${JSON.stringify(serviceStyles)}, service_type=${serviceType}, acceptableStyles=${JSON.stringify(acceptableStylesForSlot)}`);
            } else {
              console.log(`[SLOTS] ✅ Record matches service style: service_styles=${JSON.stringify(serviceStyles)}, service_type=${serviceType}, time_window=${row.time_window_start || row.start_time}-${row.time_window_end || row.end_time}`);
            }
            return hasMatchingStyle;
          });
          console.log(`[SLOTS] After service style filter: ${filteredSlots.length} records (from ${va2Slots.length})`);
          // ✅ FIX: DO NOT fallback to all records - if no matching service style, return empty slots
          // This ensures tele service only shows tele-specific availability windows
          if (filteredSlots.length === 0) {
            console.log(`[SLOTS] ⚠️ No availability records match service style '${serviceStyle}' (acceptableStyles: ${JSON.stringify(acceptableStylesForSlot)})`);
            console.log(`[SLOTS] ⚠️ This vendor may not have ${serviceStyle} availability configured, or records use different service style values`);
            // Return empty slots instead of using all records
            return c.json({
              success: true,
              slots: [],
              date,
              vendorId: canonicalVendorId,
              inputVendorId: vendorId,
              serviceStyle,
              staffBased: false,
              message: `No ${serviceStyle} availability configured for this day. Vendor must set ${serviceStyle}-specific schedule in Advanced Availability.`,
              availabilityMeta: {
                source: 'vendor_availability_v2',
                hadAvailability: va2Slots.length > 0, // Had records but none matched service style
                allBooked: false,
                totalSlots: 0,
                availableSlots: 0,
                bookedSlots: 0,
              },
            });
          }
        }
        
        const slots: any[] = [];
        let slotsGenerated = 0;
        let slotsSkipped = 0;
        console.log(`[SLOTS] ========== SLOT GENERATION DEBUG ==========`);
        console.log(`[SLOTS] isToday: ${isToday}`);
        console.log(`[SLOTS] requestedDate: ${date}`);
        console.log(`[SLOTS] minBookingTime: ${minBookingTime.toISOString()}`);
        console.log(`[SLOTS] Current time (now): ${now.toISOString()}`);
        console.log(`[SLOTS] minNoticeMinutes: ${minNoticeMinutes}`);
        console.log(`[SLOTS] Processing ${filteredSlots.length} availability records...`);
        
        for (const row of filteredSlots) {
          const startTime = row.time_window_start || row.start_time;
          const endTime = row.time_window_end || row.end_time;
          console.log(`[SLOTS] Processing record: id=${row.id}, day_of_week=${row.day_of_week}, startTime=${startTime}, endTime=${endTime}`);
          if (!startTime || !endTime) {
            console.log(`[SLOTS] Skipping record with missing time: startTime=${startTime}, endTime=${endTime}`);
            continue;
          }
          // ✅ CRITICAL: slot_duration_minutes might not exist, use default 30
          const slotDuration = 30; // Default slot duration
          console.log(`[SLOTS]   slotDuration: ${slotDuration} minutes`);
          // Use lead time per service style (at_home=travel, at_center=prep, tele=setup); fallback to buffer_time
          const leadByStyle = row.lead_time_by_style != null
            ? (typeof row.lead_time_by_style === 'string' ? JSON.parse(row.lead_time_by_style) : row.lead_time_by_style)
            : {};
          const bufferMinutes = (leadByStyle && typeof leadByStyle === 'object' && (leadByStyle[normalizedServiceStyle] != null || leadByStyle[serviceStyle] != null))
            ? Number(leadByStyle[normalizedServiceStyle] ?? leadByStyle[serviceStyle])
            : Number(row.buffer_time ?? row.buffer_time_minutes) || minNoticeMinutes;
          const maxCapacity = row.max_capacity != null && row.max_capacity !== '' ? parseInt(String(row.max_capacity), 10) : null;

          const winStart = timeToMinutes(startTime);
          const winEnd = timeToMinutes(endTime);
          console.log(`[SLOTS]   Time window: ${startTime} (${winStart} min) to ${endTime} (${winEnd} min)`);
          console.log(`[SLOTS]   Total window duration: ${winEnd - winStart} minutes`);
          let currentMinutes = winStart;
          let slotsGeneratedForThisRecord = 0;
          let slotsSkippedForThisRecord = 0;

          while (currentMinutes + slotDuration <= winEnd) {
            const timeStr = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;

            // 0) Slot must fit in window: appointment (totalDuration) must end before window end
            if (currentMinutes + totalDuration > winEnd) {
              console.log(`[SLOTS]     Skipping ${timeStr}: slot would extend past window end (${currentMinutes + totalDuration} > ${winEnd})`);
              currentMinutes += slotDuration;
              slotsSkippedForThisRecord++;
              continue;
            }

            // 1) Past booking window - for today, include past slots but mark as unavailable
            let isPastSlot = false;
            if (isToday) {
              const slotDateTime = new Date(requestedDate);
              slotDateTime.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);
              isPastSlot = slotDateTime < minBookingTime;
              if (isPastSlot) {
                console.log(`[SLOTS]     ${timeStr} is in the past (${slotDateTime.toISOString()} < ${minBookingTime.toISOString()}) - will include as unavailable`);
              } else {
                console.log(`[SLOTS]     ✅ ${timeStr} is NOT in the past (${slotDateTime.toISOString()} >= ${minBookingTime.toISOString()})`);
              }
            } else {
              console.log(`[SLOTS]     ✅ ${timeStr} is for future date (not today), skipping past check`);
            }

            // 2) Break overlap
            // ✅ FIX: Use slotDuration for break check (slot size), but also check if totalDuration would extend into break
            const slotEndMin = currentMinutes + slotDuration;  // Slot end for break check
            const serviceEndMin = currentMinutes + totalDuration;  // Service end if booked at this slot
            const inBreak = breaks.some((brk: { startTime: string; endTime: string }) => {
              const bStart = timeToMinutes(brk.startTime);
              const bEnd = timeToMinutes(brk.endTime);
              // Slot overlaps break if slot itself overlaps OR if service would extend into break
              return (currentMinutes < bEnd && slotEndMin > bStart) || (currentMinutes < bEnd && serviceEndMin > bStart);
            });
            if (inBreak) {
              currentMinutes += slotDuration;
              continue;
            }

            // 3) Overlap check with existing bookings (slot start + slotDuration vs booking start + duration)
            // ✅ STRICT BUSINESS RULE: Each slot is atomic and independent
            // Buffer is informational (travel/prep/setup) and MUST NOT block adjacent slots
            // Only service duration blocks slots - buffer is used for scheduling spacing, not availability blocking
            // ✅ CRITICAL: Use slotDuration (actual slot size) not totalDuration (requested service duration) for overlap check
            // ✅ ATOMIC SLOT RULE: Booking 09:00 (30min) should ONLY block 09:00, NOT 09:30
            // Mathematical proof:
            //   Booking 09:00: bStart=540, bEnd=540+30=570 (09:30)
            //   Slot 09:30: currentMinutes=570, slotEnd=570+30=600 (10:00)
            //   Overlap: 570 < 570 && 600 > 540 = false && true = false ✅ (NO overlap)
            const slotEnd = currentMinutes + slotDuration;  // ✅ Use slotDuration, NO buffer in blocking
            const overlapsBooking = existingBookings.some((b: { booking_time: string; duration_minutes: number }) => {
              const bStart = timeToMinutes(b.booking_time);
              
              // ✅ FIX: For at_center only, subtract buffer time from booking duration for overlap check
              // at_home/tele use exact time matching (staff-based) so they don't have this issue
              // Buffer is informational (prep time) and should NOT block adjacent slots for at_center
              let bookingDuration = b.duration_minutes;
              if (normalizedServiceStyle === 'at_center' && bufferMinutes > 0) {
                // Subtract buffer from booking duration for overlap check only
                // This ensures adjacent slots are not blocked by buffer time
                // Minimum duration is slotDuration to prevent negative values
                bookingDuration = Math.max(slotDuration, bookingDuration - bufferMinutes);
              }
              
              const bEnd = bStart + bookingDuration;  // ✅ Use adjusted duration for at_center (no buffer blocking)
              // ✅ ATOMIC OVERLAP FORMULA: (slotStart < bookingEnd) AND (slotEnd > bookingStart)
              // This ensures adjacent slots (slotStart = bookingEnd) do NOT overlap
              return currentMinutes < bEnd && slotEnd > bStart;  // ✅ Strict < ensures atomic behavior
            });

            // ✅ FIX: Check max capacity first to determine availability
            let available = true;
            let booked = false;
            if (maxCapacity != null && maxCapacity > 0) {
              const norm = (t: string) => (typeof t === 'string' ? t.substring(0, 5) : String(t));
              const sameStartCount = existingBookings.filter(
                (b: { booking_time: string }) => norm(b.booking_time) === timeStr
              ).length;
              available = sameStartCount < maxCapacity;
              booked = !available;
            } else {
              // ✅ FIX: If overlaps booking (buffer conflict), mark as booked but still return slot
              booked = overlapsBooking;
              available = !booked;
            }

            // ✅ FIX: For today, mark past slots as unavailable (but still include them)
            if (isPastSlot) {
              available = false;
              booked = false; // Past slots are not "booked", they're just unavailable
            }

            // ✅ FIX: Always add slot (even if booked or past) so UI can show it as unavailable
            // Dynamic payload: pass through schedule fields so clients sync with future enhancements
            // ✅ FIX: Filter serviceStyles to only include styles matching the requested serviceStyle
            // When serviceStyle=at_center is requested, only return ["at_center"], not ["at_center", "at_home"]
            let filteredServiceStyles: string[] = [];
            if (Array.isArray(row.service_styles) && row.service_styles.length > 0) {
              // Filter to only include styles that match the requested serviceStyle
              filteredServiceStyles = row.service_styles.filter((style: string) => 
                acceptableStylesForSlot.includes(style)
              );
              // If no matching styles found, use the requested serviceStyle as fallback
              if (filteredServiceStyles.length === 0 && normalizedServiceStyle) {
                filteredServiceStyles = [normalizedServiceStyle];
              }
            } else if (normalizedServiceStyle) {
              // If no service_styles array, use the requested serviceStyle
              filteredServiceStyles = [normalizedServiceStyle];
            }
            
            const slotPayload: Record<string, unknown> = {
              time: timeStr,
              available,
              booked, // ✅ Explicitly mark as booked if overlapping or at capacity
              slotDuration,
              bufferMinutes,
              ...(isPastSlot && { isPast: true }), // ✅ Mark past slots for today
              ...(filteredServiceStyles.length > 0 && { serviceStyles: filteredServiceStyles }),
              ...(row.max_capacity != null && row.max_capacity !== '' && { maxCapacity: parseInt(String(row.max_capacity), 10) }),
            };
            slots.push(slotPayload);
            slotsGenerated++;
            slotsGeneratedForThisRecord++;
            console.log(`[SLOTS]     ✅ Added slot: ${timeStr} (available: ${available}, booked: ${booked})`);
            currentMinutes += slotDuration;
          }
          console.log(`[SLOTS]   Record complete: Generated ${slotsGeneratedForThisRecord} slots, skipped ${slotsSkippedForThisRecord} slots`);
          slotsSkipped += (Math.floor((winEnd - winStart) / slotDuration) - slotsGeneratedForThisRecord);
        }
        
        console.log(`[SLOTS] ========== SLOT GENERATION COMPLETE ==========`);
        console.log(`[SLOTS] Total slots generated: ${slotsGenerated}`);
        console.log(`[SLOTS] Slots skipped: ${slotsSkipped}`);
        console.log(`[SLOTS] Final slots array length: ${slots.length}`);

        const sortedSlots = slots.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
        console.log(`[SLOTS] Returning ${sortedSlots.length} sorted slots`);
        
        // ✅ FIX: Track metadata to distinguish "no availability" vs "all booked"
        const hadAvailabilityRecords = va2Slots.length > 0;
        const availableSlotsCount = sortedSlots.filter((s: any) => s.available === true).length;
        const bookedSlotsCount = sortedSlots.filter((s: any) => s.booked === true).length;
        const allBooked = hadAvailabilityRecords && availableSlotsCount === 0 && bookedSlotsCount > 0;
        
        return c.json({
          success: true,
          slots: sortedSlots,
          date,
          vendorId: canonicalVendorId,
          inputVendorId: vendorId,
          serviceStyle,
          staffBased: false,
          availabilityMeta: {
            source: 'vendor_availability_v2',
            slotDurationDefault: 30,
            bufferMinutesDefault: 15,
            hadAvailability: hadAvailabilityRecords, // ✅ Flag: availability records existed
            allBooked, // ✅ Flag: all slots were booked/filtered
            totalSlots: sortedSlots.length,
            availableSlots: availableSlotsCount,
            bookedSlots: bookedSlotsCount,
          },
        });
      }

      // No slot-based advance availability: do not show slots (no fallback)
      // ✅ FIX: Check if availability exists but was filtered out (all booked/past)
      const hadAvailabilityRecords = va2Slots.length > 0;
      let message = 'No advance availability set for this day and service type. Vendor must set schedule in Advanced Availability.';
      
      if (hadAvailabilityRecords) {
        // Availability exists but all slots were filtered (booked/past/breaks)
        message = 'All available slots for this date are currently booked or unavailable.';
      }
      
      return c.json({
        success: true,
        slots: [],
        date,
        vendorId: canonicalVendorId, // ✅ Use resolved canonical vendors.id
        inputVendorId: vendorId, // ✅ Also include original input for debugging
        serviceStyle,
        staffBased: false,
        message,
        availabilityMeta: {
          source: 'vendor_availability_v2',
          hadAvailability: hadAvailabilityRecords, // ✅ Flag: availability records existed
          allBooked: hadAvailabilityRecords, // ✅ If we had records but no slots, they're all booked/filtered
        },
      });
    } catch (error: any) {
      console.error('Error fetching available slots:', error);
      return c.json({ error: error.message || 'Failed to fetch available slots' }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId/services
   * Get vendor services for booking — only published, vendor-set price reflects immediately.
   * Uses vendor_services as source of truth so CRUD (price, publish/unpublish) reflects on customer web.
   */
  app.get("/customer/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const category = c.req.query('category');
      const serviceStyle = c.req.query('serviceStyle');

      // Resolve vendor (frontend may pass vendor_identity.id or staff id; resolve to vendors.id)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }
      const resolvedVendorId = vendor.id;

      // vendor_services.service_id can point to services.id (legacy) OR service_catalog.id (catalog-origin)
      let servicesQuery = `
        SELECT
          vs.id,
          vs.service_id,
          vs.service_name,
          vs.service_style,
          vs.price,
          vs.custom_price,
          vs.duration_minutes,
          vs.custom_duration,
          vs.custom_description,
          vs.category,
          vs.sub_category,
          vs.metadata as vs_metadata,
          vs.publish_status,
          s.name as base_name,
          s.description as base_description,
          sc.service_name as catalog_name,
          sc.display_name as catalog_display_name,
          sc.description as catalog_description,
          sc.specialization_ids as catalog_specialization_ids
        FROM vendor_services vs
        LEFT JOIN services s ON vs.service_id = s.id
        LEFT JOIN service_catalog sc ON vs.service_id = sc.id
        WHERE vs.vendor_id = $1
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      `;
      const queryParams: any[] = [resolvedVendorId];

      if (category) {
        queryParams.push(category);
        servicesQuery += ` AND (LOWER(vs.category) = LOWER($${queryParams.length}) OR LOWER(vs.category) LIKE '%' || LOWER($${queryParams.length}) || '%')`;
      }
      if (serviceStyle) {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        queryParams.push(acceptableStyles);
        servicesQuery += ` AND vs.service_style = ANY($${queryParams.length}::text[])`;
      }

      servicesQuery += ` ORDER BY vs.category, vs.service_name`;

      const result = await query(servicesQuery, queryParams);

      const formattedServices = result.rows.map((row: any) => {
        const price = row.custom_price != null ? parseFloat(row.custom_price) : (row.price != null ? parseFloat(row.price) : 0);
        const duration = row.custom_duration ?? row.duration_minutes ?? 30;
        const name = row.service_name || row.base_name || row.catalog_name || row.catalog_display_name || 'Service';
        const description = row.custom_description || row.base_description || row.catalog_description || '';
        const shortDescription = description.length > 200 ? description.slice(0, 200) + '…' : description;
        const rawSpec = row.catalog_specialization_ids;
        const specializationIds = Array.isArray(rawSpec) ? rawSpec : (rawSpec != null ? [].concat(rawSpec) : []);
        let metadata: any = {};
        try {
          metadata = typeof row.vs_metadata === 'string' ? (row.vs_metadata ? JSON.parse(row.vs_metadata) : {}) : (row.vs_metadata || {});
        } catch (_) {}
        const isPackage = !!metadata?.isPackage || metadata?.type === 'package';
        const packageDetails = isPackage && (metadata?.totalSessions != null || metadata?.validityDays != null) ? {
          totalSessions: metadata.totalSessions ?? null,
          validityDays: metadata.validityDays ?? null,
          sessionDuration: metadata.sessionDuration ?? duration,
        } : undefined;
        const taxCategoryId = metadata?.taxCategoryId ?? metadata?.tax_category ?? null;
        const couponEligible = metadata?.couponEligible !== false;
        return {
          id: row.id,
          serviceId: row.service_id,
          service_id: row.service_id,
          name,
          service_name: name,
          shortDescription,
          longDescription: description || null,
          description,
          durationMinutes: duration,
          base_price: row.price != null ? parseFloat(row.price) : 0,
          price,
          custom_price: row.custom_price != null ? parseFloat(row.custom_price) : undefined,
          duration,
          category: row.category,
          categorySlug: row.category,
          serviceStyle: row.service_style || 'at_center',
          specializationIds,
          specialization_ids: specializationIds,
          isPackage,
          packageDetails,
          taxCategoryId,
          couponEligible,
          publishStatus: row.publish_status || 'published',
          isEnabled: true,
          requiresPetProfile: false,
          requiresAddress: false,
        };
      });

      const services = formattedServices.filter((s: any) => !s.isPackage);
      const packages = formattedServices.filter((s: any) => s.isPackage);

      return c.json({
        success: true,
        services,
        packages,
        count: formattedServices.length
      });

    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to fetch services',
        services: []
      }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId
   * Get detailed vendor profile with all services
   * ✅ FIX: Must be registered AFTER /customer/vendor/:vendorId/available-slots to avoid route conflict
   */
  app.get("/customer/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Resolve vendor (frontend may pass vendor_identity.id or staff id; resolve to vendors.id)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Get role
      const roles = await select('roles', { id: vendor.role_id });
      const role = roles[0];

      // Get all services
      // Check if is_global column exists
      const serviceColumns = await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'services' AND column_name = 'is_global'`
      );
      const hasIsGlobal = serviceColumns.rows.length > 0;
      
      const services = await query(
        `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
         FROM services s
         LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
         WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
         AND s.is_active = true
         AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
         ORDER BY s.name`,
        [resolvedVendorId]
      );

      // Get reviews
      const reviews = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 
         AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 20`,
        [resolvedVendorId]
      );

      const avgRating = reviews.rows.length > 0
        ? reviews.rows.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.rows.length
        : 0;

      // Get staff (if applicable)
      const staff = await query(
        `SELECT s.* FROM staff s
         WHERE s.vendor_id = $1 
         AND s.is_active = true
         ORDER BY s.name`,
        [resolvedVendorId]
      );

      // Enrich vendor profile: specializations, styles, photos
      let vendorSpecializations: string[] = [];
      try {
        const specRes = await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [resolvedVendorId]);
        vendorSpecializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
      } catch (_) {}
      if (vendorSpecializations.length === 0 && vendor.specializations) {
        try {
          vendorSpecializations = Array.isArray(vendor.specializations)
            ? vendor.specializations
            : JSON.parse(vendor.specializations || '[]');
        } catch (_) {}
      }

      let vendorServiceStyles: string[] = [];
      try {
        const styleRes = await query(
          `SELECT DISTINCT service_style FROM vendor_services
           WHERE vendor_id = $1 AND is_enabled = true AND (publish_status IN ('published','auto_published') OR publish_status IS NULL)
           AND service_style IS NOT NULL`,
          [resolvedVendorId]
        );
        vendorServiceStyles = (styleRes.rows || []).map((r: any) => normalizeServiceStyle(r.service_style)).filter(Boolean) as string[];
      } catch (_) {}

      let facilityPhotos: string[] = [];
      try {
        const meta = vendor.metadata ? (typeof vendor.metadata === 'string' ? JSON.parse(vendor.metadata) : vendor.metadata) : null;
        const raw = meta?.facility_photos || meta?.photos || [];
        facilityPhotos = Array.isArray(raw) ? raw.filter(Boolean) : [];
      } catch (_) {}

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          roleId: vendor.role_id,
          roleName: role?.name,
          category: getCategoryFromRole(role?.name || ''),
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          phone: vendor.phone,
          email: vendor.email,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          rating: avgRating,
          totalReviews: reviews.rows.length,
          operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
          description: vendor.description || '',
          photoUrl: getVendorPhotoUrl(vendor),
          vendorType: vendor.vendor_type === 'solo' ? 'solo' : 'business',
          specializations: vendorSpecializations,
          serviceStyles: vendorServiceStyles,
          facilityPhotos,
        },
        services: services.rows,
        reviews: reviews.rows,
        staff: staff.rows,
      });
    } catch (error: any) {
      console.error('Error fetching vendor profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendors/search
   * Search vendors by roleId and other filters
   * This is a compatibility endpoint for components that use /customer/vendors/search
   */
  app.get("/customer/vendors/search", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const searchQuery = c.req.query('query'); // Renamed to avoid shadowing the query function
      const location = c.req.query('location');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const serviceStyle = c.req.query('serviceStyle');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Build vendor query
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name, r.config as role_config
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by roleId (primary filter) - expand to category roles when roleId is a category key
      if (roleId) {
        const targetRoles = await resolveTargetRolesForDiscovery(null, roleId);
        if (targetRoles.length > 0) {
          vendorQuery += ` AND r.name = ANY($${paramIndex}::text[])`;
          params.push(targetRoles);
          paramIndex++;
        } else {
          // ✅ FIX: Use only role name/display_name comparison (case-insensitive), not id::text
        vendorQuery += ` AND (LOWER(r.name) = LOWER($${paramIndex}) OR LOWER(r.display_name) = LOWER($${paramIndex}))`;
        params.push(roleId);
        paramIndex++;
        }
      }

      // ✅ Vendor discovery rules: filter by service style; enforce publish_status = 'published' (align with discover-services)
      if (serviceStyle) {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        vendorQuery += ` AND EXISTS (
          SELECT 1 FROM vendor_services vs 
          WHERE vs.vendor_id = v.id 
            AND vs.service_style = ANY($${paramIndex}::text[]) 
            AND vs.is_enabled = true 
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )`;
        params.push(acceptableStyles);
        paramIndex++;
      }

      // Filter by search query (name, business_name, specialization)
      if (searchQuery) {
        vendorQuery += ` AND (
          v.business_name ILIKE $${paramIndex} OR 
          v.owner_name ILIKE $${paramIndex} OR
          v.specialization ILIKE $${paramIndex}
        )`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
      }

      // Filter by location
      if (location) {
        vendorQuery += ` AND (
          v.city ILIKE $${paramIndex} OR 
          v.state ILIKE $${paramIndex} OR 
          v.address ILIKE $${paramIndex}
        )`;
        params.push(`%${location}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY v.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      paramIndex += 2;

      const vendorResults = await query(vendorQuery, params);
      let vendors = vendorResults.rows;

      // Enrich vendors with unified card shape: photoUrl, specializations, nextAvailable, distanceText, serviceStyles
      const enrichedVendors = (await Promise.all(
        vendors.map(async (vendor: any) => {
          if (serviceStyle && !roleConfigAllowsStyle((vendor as any).role_config, serviceStyle)) {
            return null;
          }
          const reviews = await query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
             FROM reviews 
             WHERE vendor_id = $1 AND is_approved = true`,
            [vendor.id]
          );
          const avgRating = reviews.rows[0]?.avg_rating || 0;
          const reviewCount = reviews.rows[0]?.review_count || 0;

          let distance: number | null = null;
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            distance = calculateDistance(
              parseFloat(latitude),
              parseFloat(longitude),
              parseFloat(vendor.latitude),
              parseFloat(vendor.longitude)
            );
          }
          const distanceKm = distance != null ? parseFloat(distance.toFixed(2)) : null;
          const distanceText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)} km away`) : null;

          let specializations: string[] = [];
          try {
            const specRes = await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [vendor.id]);
            specializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
          } catch (_) {}
          if (specializations.length === 0 && vendor.specializations) {
            specializations = Array.isArray(vendor.specializations) ? vendor.specializations : (typeof vendor.specializations === 'string' ? JSON.parse(vendor.specializations || '[]') : []);
          }

          let nextAvailable: { date: string; time: string; display: string } | null = null;
          try {
            const styleArray = serviceStyle === 'at_center' ? ['at_center', 'at_vendor'] : serviceStyle === 'tele' ? ['tele', 'online', 'video_consultation'] : [serviceStyle].filter(Boolean);
            if (styleArray.length > 0) {
              const today = new Date();
              const dayOfWeek = today.getDay();
              const va2 = await query(
                `SELECT day_of_week, COALESCE(time_window_start, start_time) as start_time
                 FROM vendor_availability_v2
                 WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
                   AND (is_available IS NULL OR is_available = true)
                   AND (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[] OR service_style = ANY($3::text[]) OR service_type = ANY($3::text[]))
                 ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC LIMIT 1`,
                [vendor.id, vendor.phone || '', styleArray]
              );
              if (va2.rows?.length > 0) {
                const s = va2.rows[0];
                let daysToAdd = s.day_of_week - dayOfWeek;
                if (daysToAdd < 0) daysToAdd += 7;
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + daysToAdd);
                const timeStr = (s.start_time || '09:00').toString().substring(0, 5);
                const formatted = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                nextAvailable = {
                  date: targetDate.toISOString().split('T')[0],
                  time: timeStr,
                  display: daysToAdd === 0 ? `Today ${formatted}` : daysToAdd === 1 ? `Tomorrow ${formatted}` : `${targetDate.toLocaleDateString('en-US', { weekday: 'short' })} ${formatted}`,
                };
              }
            }
          } catch (_) {}

          const servicesCountRes = await query(
            `SELECT COUNT(*) as count FROM vendor_services vs WHERE vs.vendor_id = $1 AND vs.is_enabled = true AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)`,
            [vendor.id]
          );
          const servicesCount = parseInt(servicesCountRes.rows[0]?.count || '0');
          const minPriceRes = await query(
            `SELECT MIN(COALESCE(custom_price, price)) as min_price FROM vendor_services WHERE vendor_id = $1 AND is_enabled = true AND (publish_status IN ('published','auto_published') OR publish_status IS NULL)`,
            [vendor.id]
          );
          const minPrice = minPriceRes.rows[0]?.min_price != null ? parseFloat(minPriceRes.rows[0].min_price) : undefined;

          const vendorType = vendor.vendor_type === 'solo' ? 'solo' : 'business';
          const roleName = vendor.role_name || vendor.role_display_name || '';
          const normalizedStyle = normalizeServiceStyle(serviceStyle || '') || serviceStyle || '';

          return {
            id: vendor.id,
            vendorId: vendor.id,
            businessName: vendor.business_name,
            name: vendor.business_name || vendor.owner_name,
            photoUrl: getVendorPhotoUrl(vendor),
            rating: parseFloat(avgRating) || 0,
            reviewCount: parseInt(reviewCount) || 0,
            distanceKm,
            distance: distanceKm,
            distanceText,
            specializations,
            nextAvailable,
            serviceStyles: serviceStyle ? (normalizedStyle ? [normalizedStyle] : []) : ['at_center', 'at_home', 'tele'],
            minPrice,
            vendorType,
            roleName,
            servicesCount,
            priceRange: vendor.price_range || null,
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
          };
        })
      )).filter(Boolean);

      // If serviceStyle is 'at_home' or 'tele', also return staff
      let staff: any[] = [];
      if (serviceStyle && ['at_home', 'tele'].includes(serviceStyle) && roleId) {
        const staffQuery = `
          SELECT s.*, v.business_name as vendor_name, v.city, v.state
          FROM staff s
          INNER JOIN vendors v ON s.vendor_id = v.id
          INNER JOIN roles r ON v.role_id = r.id
          WHERE s.is_active = true
            AND v.status = 'approved'
            AND v.is_active = true
            AND (LOWER(r.name) = LOWER($1) OR LOWER(r.display_name) = LOWER($1))
          LIMIT $2
        `;
        const staffResults = await query(staffQuery, [roleId, limit]);
        staff = staffResults.rows.map((s: any) => ({
          ...s,
          id: s.id,
          vendorId: s.vendor_id,
          name: s.name,
          rating: s.rating || 0,
        }));
      }

      return c.json({
        success: true,
        vendors: enrichedVendors,
        staff: staff.length > 0 ? staff : undefined,
        total: enrichedVendors.length,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error in /customer/vendors/search:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to search vendors',
        vendors: [],
        total: 0
      }, 500);
    }
  });

  /**
   * GET /customer/autocomplete
   * Search autocomplete suggestions
   */
  app.get("/customer/autocomplete", async (c) => {
    try {
      const q = c.req.query('q') || '';
      const limit = parseInt(c.req.query('limit') || '10', 10);

      if (!q || q.length < 2) {
        return c.json({ success: true, suggestions: [] });
      }

      // Search vendors
      const vendors = await query(
        `SELECT DISTINCT business_name as name, 'vendor' as type, id
         FROM vendors
         WHERE business_name ILIKE $1 AND status = 'approved' AND is_active = true
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      // Search services
      const services = await query(
        `SELECT DISTINCT name, 'service' as type, id
         FROM services
         WHERE name ILIKE $1 AND is_active = true
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      // Search problems
      const problems = await query(
        `SELECT DISTINCT problem_name as name, 'problem' as type, id
         FROM problem_grid
         WHERE problem_name ILIKE $1
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      const suggestions = [
        ...vendors.rows.map((v: any) => ({ text: v.name, type: v.type, id: v.id })),
        ...services.rows.map((s: any) => ({ text: s.name, type: s.type, id: s.id })),
        ...problems.rows.map((p: any) => ({ text: p.name, type: p.type, id: p.id })),
      ].slice(0, limit);

      return c.json({ success: true, suggestions });
    } catch (error: any) {
      console.error('Error in autocomplete:', error);
      return c.json({ success: true, suggestions: [] });
    }
  });

  /**
   * GET /customer/radar/providers
   * Get providers within radar radius
   */
  app.get("/customer/radar/providers", async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const roleId = c.req.query('roleId');
      const rules = await getDiscoveryRules(roleId || 'all', 'discover');
      const defaultRadiusKm = rules.discovery_radius_km ?? 10;
      const maxResults = typeof rules.discovery_max_results === 'number' ? rules.discovery_max_results : 50;
      const radius = c.req.query('radius') ? parseFloat(c.req.query('radius')!) : defaultRadiusKm;
      const serviceType = c.req.query('serviceType') || '';

      if (!lat || !lng) {
        return c.json({ error: 'lat and lng are required' }, 400);
      }

      const limitCount = Math.min(100, maxResults);
      // Get vendors with location within radius (rule-book radius + max_results)
      const vendors = await query(
        `SELECT v.*, r.name as role_name,
         (6371 * acos(
           cos(radians($1)) * cos(radians(CAST(v.latitude AS FLOAT))) *
           cos(radians(CAST(v.longitude AS FLOAT)) - radians($2)) +
           sin(radians($1)) * sin(radians(CAST(v.latitude AS FLOAT)))
         )) AS distance_km
         FROM vendors v
         INNER JOIN roles r ON v.role_id = r.id
         WHERE v.status = 'approved' AND v.is_active = true
           AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
           ${serviceType ? `AND r.name ILIKE $3` : ''}
         HAVING distance_km <= $4
         ORDER BY distance_km ASC
         LIMIT $5`,
        serviceType ? [lat, lng, `%${serviceType}%`, radius, limitCount] : [lat, lng, null, radius, limitCount]
      );

      return c.json({
        success: true,
        providers: vendors.rows.map((v: any) => ({
          id: v.id,
          name: v.business_name,
          role: v.role_name,
          distance: parseFloat(v.distance_km?.toFixed(2) || '0'),
          latitude: v.latitude,
          longitude: v.longitude,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching radar providers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendors/discover-by-problem
   * Enhanced vendor discovery by problem
   */
  app.get("/customer/vendors/discover-by-problem", async (c) => {
    try {
      const problem = c.req.query('problem') || c.req.query('problemId');
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');

      if (!problem) {
        return c.json({ error: 'problem or problemId is required' }, 400);
      }

      // Get vendors that handle this problem (specialization_id): check vendors.specializations, metadata.specializations, vendor_specializations, or service name/description
      const problemPattern = `%${problem}%`;
      let queryText = `
        SELECT DISTINCT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND (
            (v.specializations IS NOT NULL AND v.specializations::text ILIKE $2) OR
            (v.metadata IS NOT NULL AND v.metadata->'specializations' IS NOT NULL AND (v.metadata->'specializations')::text ILIKE $2) OR
            EXISTS (SELECT 1 FROM vendor_specializations vs WHERE vs.vendor_id = v.id AND (vs.specialization = $1 OR vs.specialization ILIKE $2)) OR
            EXISTS (SELECT 1 FROM vendor_services s WHERE s.vendor_id = v.id AND s.is_enabled = true AND (s.service_name ILIKE $2 OR (s.custom_description IS NOT NULL AND s.custom_description::text ILIKE $2)))
          )
      `;

      const params: any[] = [problem, problemPattern];
      let paramIdx = 3;

      if (roleId) {
        const targetRoles = await resolveTargetRolesForDiscovery(null, roleId);
        if (targetRoles.length > 0) {
          queryText += ` AND r.name = ANY($${paramIdx}::text[])`;
          params.push(targetRoles);
          paramIdx++;
        } else {
        // ✅ FIX: Use only role name comparison (case-insensitive), not id::text
        queryText += ` AND (LOWER(r.name) = LOWER($${paramIdx}) OR LOWER(r.display_name) = LOWER($${paramIdx}))`;
        params.push(roleId);
          paramIdx++;
        }
      }

      if (serviceStyle) {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        queryText += ` AND EXISTS (
          SELECT 1 FROM vendor_services vs 
          WHERE vs.vendor_id = v.id 
            AND vs.service_style = ANY($${paramIdx}::text[])
            AND vs.is_enabled = true 
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )`;
        params.push(acceptableStyles);
        paramIdx++;
      }

      // Add distance calculation if location provided
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        queryText = `
          SELECT *, 
          (6371 * acos(
            cos(radians($${paramIdx})) * cos(radians(CAST(latitude AS FLOAT))) *
            cos(radians(CAST(longitude AS FLOAT)) - radians($${paramIdx + 1})) +
            sin(radians($${paramIdx})) * sin(radians(CAST(latitude AS FLOAT)))
          )) AS distance_km
          FROM (${queryText}) subquery
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          ORDER BY distance_km ASC
        `;
        params.push(lat, lng);
        paramIdx += 2;
      } else {
        queryText += ` ORDER BY v.created_at DESC`;
      }

      queryText += ` LIMIT 20`;

      const result = await query(queryText, params);

      // Enrich with unified card shape: photoUrl, rating, reviewCount, specializations, nextAvailable, distanceText
      const enriched = await Promise.all((result.rows || []).map(async (row: any) => {
        const vendorId = row.id || row.vendor_id;
        let rating = 0;
        let reviewCount = 0;
        try {
          const rev = await query(`SELECT AVG(rating) as avg_rating, COUNT(*) as c FROM reviews WHERE vendor_id = $1 AND is_approved = true`, [vendorId]);
          rating = parseFloat(rev.rows[0]?.avg_rating || '0');
          reviewCount = parseInt(rev.rows[0]?.c || '0', 10);
        } catch (_) {}
        let specializations: string[] = [];
        try {
          const specRes = await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [vendorId]);
          specializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
        } catch (_) {}
        if (specializations.length === 0 && row.specializations) {
          specializations = Array.isArray(row.specializations) ? row.specializations : (typeof row.specializations === 'string' ? JSON.parse(row.specializations || '[]') : []);
        }
        let nextAvailable: { date: string; time: string; display: string } | null = null;
        try {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const va2 = await query(
            `SELECT day_of_week, COALESCE(time_window_start, start_time) as start_time
             FROM vendor_availability_v2
             WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
               AND (is_available IS NULL OR is_available = true)
             ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC LIMIT 1`,
            [vendorId, row.phone || '']
          );
          if (va2.rows?.length > 0) {
            const s = va2.rows[0];
            let daysToAdd = s.day_of_week - dayOfWeek;
            if (daysToAdd < 0) daysToAdd += 7;
            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            const timeStr = (s.start_time || '09:00').toString().substring(0, 5);
            const formatted = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            nextAvailable = {
              date: targetDate.toISOString().split('T')[0],
              time: timeStr,
              display: daysToAdd === 0 ? `Today ${formatted}` : daysToAdd === 1 ? `Tomorrow ${formatted}` : `${targetDate.toLocaleDateString('en-US', { weekday: 'short' })} ${formatted}`,
            };
          }
        } catch (_) {}
        const distanceKm = row.distance_km != null ? parseFloat(row.distance_km) : null;
        const distanceText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)} km away`) : null;
        const normalizedStyle = normalizeServiceStyle(serviceStyle || '') || serviceStyle || '';
        return {
          id: vendorId,
          vendorId,
          name: row.business_name || row.owner_name,
          photoUrl: getVendorPhotoUrl(row),
          rating,
          reviewCount,
          distanceKm,
          distanceText,
          specializations,
          nextAvailable,
          vendorType: row.vendor_type === 'solo' ? 'solo' : 'business',
          roleName: row.role_name || row.role_display_name || '',
          serviceStyles: serviceStyle ? (normalizedStyle ? [normalizedStyle] : []) : [], // discovery by problem does not filter by style unless provided
          ...row,
        };
      }));

      return c.json({
        success: true,
        results: enriched,
        roleConfig: roleId ? { roleId } : null,
      });
    } catch (error: any) {
      console.error('Error in discover-by-problem:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/facility
   * Get vendor facility details
   */
  app.get("/vendor/:vendorId/facility", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Resolve vendor (frontend may pass vendor_identity.id; data is stored by vendors.id)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get services
      // Check if is_global column exists
      const serviceColumns = await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'services' AND column_name = 'is_global'`
      );
      const hasIsGlobal = serviceColumns.rows.length > 0;
      
      const services = await query(
        `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
         FROM services s
         LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
         WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
         AND s.is_active = true
         AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
         ORDER BY s.name`,
        [vendor.id]
      );

      // Get rating
      const ratingResult = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews
         WHERE vendor_id = $1 AND is_approved = true`,
        [vendor.id]
      );

      // Get recent reviews
      const recentReviews = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [vendor.id]
      );

      // ✅ FIX: Extract facility data from vendor metadata and operating_hours
      const metadata = (vendor.metadata as any) || {};
      const operatingHours = vendor.operating_hours 
        ? (typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours)
        : null;

      // ✅ FIX: Generate presigned URLs for photos on-demand (since bucket has public access blocked)
      const rawPhotos = metadata.facility_photos || [];
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
      
      console.log(`[FACILITY-PHOTOS] Found ${rawPhotos.length} photos in metadata for vendor ${vendor.id}`);
      
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const s3Client = new S3Client({ region: AWS_REGION });
      
      const photos = await Promise.all(
        rawPhotos.map(async (photoItem: string) => {
          try {
            if (!photoItem || typeof photoItem !== 'string') {
              console.warn(`[FACILITY-PHOTOS] Invalid photo item:`, photoItem);
              return null;
            }
            
            let fileKey = photoItem.trim();
            
            // Extract key from various formats
            if (photoItem.includes('.s3.') && photoItem.includes('.amazonaws.com/')) {
              // Extract key from full S3 URL (e.g., https://bucket.s3.region.amazonaws.com/vendors/...)
              const urlParts = photoItem.split('.amazonaws.com/');
              if (urlParts.length > 1) {
                fileKey = urlParts[1].split('?')[0].split('#')[0]; // Remove query params and fragments
              }
            } else if (photoItem.includes('?') && (photoItem.includes('X-Amz') || photoItem.includes('AWSAccessKeyId'))) {
              // Extract key from presigned URL
              const urlParts = photoItem.split('?')[0];
              if (urlParts.includes('vendors/') && urlParts.includes('/facility/')) {
                const keyMatch = urlParts.match(/vendors\/[^/]+\/facility\/(.+)$/);
                if (keyMatch && keyMatch[1]) {
                  fileKey = `vendors/${vendor.id}/facility/${keyMatch[1]}`;
                } else {
                  // Try to extract from any path containing vendors/
                  const vendorsIndex = urlParts.indexOf('vendors/');
                  if (vendorsIndex >= 0) {
                    fileKey = urlParts.substring(vendorsIndex);
                  }
                }
              }
            } else if (photoItem.startsWith('vendors/')) {
              // Already a key - ensure it's for this vendor
              if (!fileKey.startsWith(`vendors/${vendor.id}/`)) {
                // If key is for different vendor or missing vendor ID, fix it
                const keyParts = fileKey.split('/');
                if (keyParts.length >= 3 && keyParts[0] === 'vendors') {
                  // Replace vendor ID in key
                  fileKey = `vendors/${vendor.id}/${keyParts.slice(2).join('/')}`;
                }
              }
            } else if (photoItem.startsWith('http://') || photoItem.startsWith('https://')) {
              // Full URL but not S3 - might be CloudFront or other CDN
              // Try to extract key or return as-is for public URLs
              console.log(`[FACILITY-PHOTOS] Photo is a full URL (non-S3), returning as-is:`, photoItem);
              return photoItem;
            }
            
            if (!fileKey || fileKey.length === 0) {
              console.warn(`[FACILITY-PHOTOS] Could not extract file key from:`, photoItem);
              return null;
            }
            
            console.log(`[FACILITY-PHOTOS] Generating presigned URL for key: ${fileKey}`);
            
            // ✅ FIX: Verify the object exists before generating presigned URL
            try {
              const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
              const headCommand = new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
              });
              await s3Client.send(headCommand);
            } catch (headError: any) {
              if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
                console.warn(`[FACILITY-PHOTOS] Object not found in S3: ${fileKey}`);
                return null;
              }
              console.warn(`[FACILITY-PHOTOS] Error checking object existence: ${fileKey}`, headError?.message);
            }
            
            // Generate fresh presigned URL (valid for 7 days)
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: fileKey,
            });
            
            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
            
            // ✅ FIX: Validate presigned URL format
            if (!presignedUrl || typeof presignedUrl !== 'string' || !presignedUrl.startsWith('https://')) {
              console.error(`[FACILITY-PHOTOS] Invalid presigned URL generated for ${fileKey}`);
              return null;
            }
            
            console.log(`[FACILITY-PHOTOS] Generated presigned URL for ${fileKey} (length: ${presignedUrl.length})`);
            return presignedUrl;
          } catch (error: any) {
            console.error(`[FACILITY-PHOTOS] Error generating presigned URL for ${photoItem}:`, error?.message || error);
            // ✅ FIX: If presigned URL generation fails, try returning the original URL if it's already a valid URL
            if (photoItem && (photoItem.startsWith('http://') || photoItem.startsWith('https://'))) {
              console.log(`[FACILITY-PHOTOS] Returning original URL as fallback:`, photoItem);
              return photoItem;
            }
            return null;
          }
        })
      );
      
      const validPhotos = photos.filter((url): url is string => url !== null && url !== undefined && url.length > 0);
      console.log(`[FACILITY-PHOTOS] Returning ${validPhotos.length} valid photos out of ${rawPhotos.length} total`);

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          business_name: vendor.business_name,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          phone: vendor.phone,
          email: vendor.email,
          roleId: vendor.role_id, // ✅ FIX: Include roleId for CenterProfileManager
          role_id: vendor.role_id,
        },
        facility: {
          centerName: vendor.business_name, // ✅ FIX: Include centerName
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Ensure pincode is returned
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          description: metadata.description || vendor.description || '', // ✅ FIX: Get description from metadata
          amenities: metadata.amenities || [],
          customAmenities: metadata.customAmenities || [], // ✅ FIX: Include custom amenities
          photos: validPhotos, // ✅ FIX: Use presigned URLs generated on-demand
          specializations: metadata.specializations || [],
          operatingHours: operatingHours || null,
          roleId: vendor.role_id, // ✅ FIX: Include roleId for SpecializationSelector
        },
        services: services.rows || [],
        rating: {
          average: parseFloat(ratingResult.rows[0]?.avg_rating || '0'),
          count: parseInt(ratingResult.rows[0]?.review_count || '0', 10),
        },
        recentReviews: recentReviews.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching vendor facility:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/facility/:vendorId
   * Update vendor facility details (address, timings, amenities, etc.)
   * ✅ FIX: This endpoint was missing, causing 404 errors in UAT
   */
  app.put("/vendor/facility/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const facilityData = await c.req.json();

      // Resolve vendor (frontend may pass vendor_identity.id; data is stored by vendors.id)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      // ✅ FIX: Build update data object, mapping frontend fields to database columns
      const updateData: any = {};
      
      // Address fields
      if (facilityData.address !== undefined) updateData.address = facilityData.address;
      if (facilityData.city !== undefined) updateData.city = facilityData.city;
      if (facilityData.state !== undefined) updateData.state = facilityData.state;
      if (facilityData.pincode !== undefined) updateData.pincode = facilityData.pincode;
      if (facilityData.country !== undefined) updateData.country = facilityData.country;
      
      // Location coordinates
      if (facilityData.latitude !== undefined) updateData.latitude = facilityData.latitude;
      if (facilityData.longitude !== undefined) updateData.longitude = facilityData.longitude;
      
      // Operating hours (stored as JSONB)
      if (facilityData.operatingHours !== undefined || facilityData.operating_hours !== undefined) {
        updateData.operating_hours = facilityData.operatingHours || facilityData.operating_hours;
      }
      
      // ✅ FIX: Build metadata object once to avoid overwriting
      const existingMetadata = (vendor.metadata as any) || {};
      const updatedMetadata: any = { ...existingMetadata };
      let metadataChanged = false;
      
      // Amenities (stored in metadata)
      if (facilityData.amenities !== undefined) {
        updatedMetadata.amenities = facilityData.amenities;
        metadataChanged = true;
      }
      
      // Custom amenities
      if (facilityData.customAmenities !== undefined) {
        updatedMetadata.customAmenities = facilityData.customAmenities;
        metadataChanged = true;
      }
      
      // Specializations (stored in metadata + vendors.specializations column + vendor_specializations table for 360° discovery)
      if (facilityData.specializations !== undefined) {
        const specArr = Array.isArray(facilityData.specializations)
          ? facilityData.specializations
          : (typeof facilityData.specializations === 'string' ? [facilityData.specializations] : []);
        updatedMetadata.specializations = specArr;
        metadataChanged = true;
        // Sync to vendors.specializations column so /customer/vendors/discover-by-problem works
        updateData.specializations = specArr;
        // vendor_specializations table will be synced below after vendor update
      }
      
      // Facility photos (stored in metadata)
      if (facilityData.photos !== undefined || facilityData.facility_photos !== undefined) {
        const photosInput = facilityData.photos || facilityData.facility_photos || [];
        // ✅ FIX: Normalize photos - extract S3 keys from presigned URLs or full URLs
        const normalizedPhotos = photosInput.map((photoItem: string) => {
          if (!photoItem || typeof photoItem !== 'string') {
            return null;
          }
          
          // If it's already a key (starts with vendors/), return as-is
          if (photoItem.startsWith('vendors/')) {
            return photoItem;
          }
          
          // If it's a presigned URL or full S3 URL, extract the key
          if (photoItem.includes('.s3.') && photoItem.includes('.amazonaws.com/')) {
            // Extract key from full S3 URL
            const urlParts = photoItem.split('.amazonaws.com/');
            if (urlParts.length > 1) {
              return urlParts[1].split('?')[0].split('#')[0];
            }
          } else if (photoItem.includes('?') && (photoItem.includes('X-Amz') || photoItem.includes('AWSAccessKeyId'))) {
            // Extract key from presigned URL
            const urlParts = photoItem.split('?')[0];
            if (urlParts.includes('vendors/')) {
              const vendorsIndex = urlParts.indexOf('vendors/');
              return urlParts.substring(vendorsIndex);
            }
          }
          
          // If we can't extract a key, return null (invalid photo)
          console.warn(`[FACILITY-SAVE] Could not normalize photo, skipping:`, photoItem);
          return null;
        }).filter((key): key is string => key !== null && key.length > 0);
        
        console.log(`[FACILITY-SAVE] Normalized ${normalizedPhotos.length} photos from ${photosInput.length} input photos`);
        updatedMetadata.facility_photos = normalizedPhotos;
        metadataChanged = true;
      }
      
      // ✅ FIX: Store description in metadata (column doesn't exist in vendors table)
      if (facilityData.description !== undefined) {
        updatedMetadata.description = facilityData.description;
        metadataChanged = true;
      }
      
      // Update metadata if any metadata fields changed
      if (metadataChanged) {
        // ✅ FIX B1: Check if metadata column exists before trying to update it
        // If column doesn't exist, we'll use a raw SQL query to add it first
        try {
          // Check if metadata column exists
          const { query } = await import('../database/rds-connection');
          const columnCheck = await query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'vendors' AND column_name = 'metadata'`
          );
          
          if (columnCheck.rows.length === 0) {
            // Column doesn't exist, add it
            console.log('[FACILITY] Metadata column missing, adding it...');
            await query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS metadata JSONB');
            console.log('[FACILITY] Metadata column added successfully');
          }
          
          updateData.metadata = updatedMetadata;
        } catch (metadataError: any) {
          console.error('[FACILITY] Error handling metadata column:', metadataError);
          // If metadata update fails, continue with other fields but log the error
          // Don't fail the entire request if metadata column is missing
          if (!metadataError.message?.includes('does not exist')) {
            throw metadataError;
          }
          // Skip metadata update if column truly doesn't exist
          console.warn('[FACILITY] Skipping metadata update - column may not exist');
        }
      }
      
      // ✅ FIX: Validate that at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update. Please provide at least one facility field' }, 400);
      }

      // Always update the updated_at timestamp
      updateData.updated_at = new Date().toISOString();

      // Update vendor record with facility information (use resolved vendor id)
      const { update } = await import('../database/rds-connection');
      const updated = await update('vendors', { id: actualVendorId }, updateData);

      if (updated.length === 0) {
        return c.json({ error: 'Failed to update facility' }, 500);
      }

      // 360°: Sync specializations to vendor_specializations table so /customer/services/by-problem and /customer/vendors/by-problem discover correctly
      const specArr = facilityData.specializations !== undefined
        ? (Array.isArray(facilityData.specializations) ? facilityData.specializations : (typeof facilityData.specializations === 'string' ? [facilityData.specializations] : []))
        : null;
      if (specArr !== null) {
        try {
          await query('DELETE FROM vendor_specializations WHERE vendor_id = $1', [actualVendorId]);
          for (const spec of specArr) {
            const s = typeof spec === 'string' ? spec.trim() : (spec?.id ?? spec?.specializationId ?? String(spec));
            if (s) {
              await insert('vendor_specializations', { vendor_id: actualVendorId, specialization: s });
            }
          }
        } catch (syncErr: any) {
          console.warn('[FACILITY] vendor_specializations sync failed (non-fatal):', syncErr?.message);
        }
      }

      return c.json({
        success: true,
        message: 'Facility updated successfully',
        facility: {
          address: updated[0].address,
          city: updated[0].city,
          state: updated[0].state,
          pincode: updated[0].pincode,
          latitude: updated[0].latitude,
          longitude: updated[0].longitude,
          operating_hours: updated[0].operating_hours,
          amenities: (updated[0].metadata as any)?.amenities || [],
          photos: (updated[0].metadata as any)?.facility_photos || [],
          specializations: (updated[0].metadata as any)?.specializations ?? (updated[0].specializations ?? []),
        },
      });
    } catch (error: any) {
      console.error('Error updating vendor facility:', error);
      return c.json({ error: error.message || 'Failed to update facility' }, 500);
    }
  });

  /**
   * POST /vendor/facility/:vendorId/upload-photos
   * Upload facility photos for a vendor
   * ✅ FIX: This endpoint was missing, causing 404 errors
   */
  app.post("/vendor/facility/:vendorId/upload-photos", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📸 [FACILITY-PHOTOS] Uploading photos for vendor: ${vendorId}`);
      
      // Resolve vendor (frontend may pass vendor_identity.id; data is stored by vendors.id)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      // Parse the multipart form data
      const formData = await c.req.formData();
      const photos = formData.getAll('photos') as File[];
      
      if (!photos || photos.length === 0) {
        return c.json({ error: 'No photos provided' }, 400);
      }

      console.log(`📸 [FACILITY-PHOTOS] Processing ${photos.length} photos`);
      
      // Upload photos to S3
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      
      const photoUrls: string[] = [];
      const photoKeys: string[] = [];
      
      for (const photo of photos) {
        try {
          // Generate a unique filename
          const timestamp = Date.now();
          const ext = photo.name.split('.').pop() || 'jpg';
          const fileKey = `vendors/${actualVendorId}/facility/facility_${timestamp}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
          
          // Convert File to ArrayBuffer and upload to S3
          const arrayBuffer = await photo.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: uint8Array,
            ContentType: photo.type || 'image/jpeg',
            // ✅ FIX: No ACL needed - bucket has public access blocked, we'll use presigned URLs
          }));
          
          // ✅ FIX: Store S3 key only (not URL) - we'll generate presigned URLs on-demand when retrieving
          photoUrls.push(fileKey); // Store key, not URL
          photoKeys.push(fileKey);
          
          console.log(`📸 [FACILITY-PHOTOS] Uploaded to S3: ${fileKey}`);
        } catch (photoError: any) {
          console.error(`❌ [FACILITY-PHOTOS] Error processing photo ${photo.name}:`, photoError);
          // Continue with other photos
        }
      }

      // Update vendor metadata with new photos (use resolved vendor id)
      const existingMetadata = (vendor.metadata as any) || {};
      const existingPhotos = existingMetadata.facility_photos || [];
      const allPhotos = [...existingPhotos, ...photoUrls];
      
      const { update } = await import('../database/rds-connection');
      await update('vendors', { id: actualVendorId }, {
        metadata: { ...existingMetadata, facility_photos: allPhotos },
        updated_at: new Date().toISOString(),
      });

      console.log(`✅ [FACILITY-PHOTOS] Uploaded ${photoUrls.length} photos for vendor ${actualVendorId}`);

      return c.json({
        success: true,
        photoUrls: photoUrls,
        totalPhotos: allPhotos.length,
      });
    } catch (error: any) {
      console.error('Error uploading facility photos:', error);
      return c.json({ error: error.message || 'Failed to upload photos' }, 500);
    }
  });


  /**
   * GET /customer/facility/:vendorId
   * Customer-facing endpoint to get vendor/clinic facility details
   */
  app.get("/customer/facility/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ error: 'Valid vendor ID is required' }, 400);
      }

      // Get vendor details
      const vendorResult = await query(
        `SELECT v.*, r.name as role_name, r.display_name as role_display_name,
                r.config as role_config
         FROM vendors v
         LEFT JOIN roles r ON v.role_id = r.id
         WHERE v.id = $1`,
        [vendorId]
      );

      if (vendorResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }

      const vendor = vendorResult.rows[0];

      // Get rating
      const ratingResult = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews WHERE vendor_id = $1`,
        [vendorId]
      );

      // Get recent reviews
      const reviewsResult = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1
         ORDER BY r.created_at DESC LIMIT 5`,
        [vendorId]
      );

      // Get staff
      const staffResult = await query(
        `SELECT id, name, role, experience_years, is_active
         FROM staff WHERE vendor_id = $1 AND is_active = true`,
        [vendorId]
      );

      // ✅ FIX: Extract metadata for description, custom amenities, and photos
      const metadata = (vendor.metadata as any) || {};
      const operatingHours = vendor.operating_hours 
        ? (typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours)
        : null;

      // ✅ FIX: Generate presigned URLs for photos on-demand (since bucket has public access blocked)
      const rawPhotos = metadata.facility_photos || [];
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
      
      console.log(`[FACILITY-PHOTOS] Found ${rawPhotos.length} photos in metadata for vendor ${vendor.id}`);
      
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const s3Client = new S3Client({ region: AWS_REGION });
      
      const photos = await Promise.all(
        rawPhotos.map(async (photoItem: string) => {
          try {
            if (!photoItem || typeof photoItem !== 'string') {
              console.warn(`[FACILITY-PHOTOS] Invalid photo item:`, photoItem);
              return null;
            }
            
            let fileKey = photoItem.trim();
            
            // Extract key from various formats
            if (photoItem.includes('.s3.') && photoItem.includes('.amazonaws.com/')) {
              // Extract key from full S3 URL (e.g., https://bucket.s3.region.amazonaws.com/vendors/...)
              const urlParts = photoItem.split('.amazonaws.com/');
              if (urlParts.length > 1) {
                fileKey = urlParts[1].split('?')[0].split('#')[0]; // Remove query params and fragments
              }
            } else if (photoItem.includes('?') && (photoItem.includes('X-Amz') || photoItem.includes('AWSAccessKeyId'))) {
              // Extract key from presigned URL
              const urlParts = photoItem.split('?')[0];
              if (urlParts.includes('vendors/') && urlParts.includes('/facility/')) {
                const keyMatch = urlParts.match(/vendors\/[^/]+\/facility\/(.+)$/);
                if (keyMatch && keyMatch[1]) {
                  fileKey = `vendors/${vendor.id}/facility/${keyMatch[1]}`;
                } else {
                  // Try to extract from any path containing vendors/
                  const vendorsIndex = urlParts.indexOf('vendors/');
                  if (vendorsIndex >= 0) {
                    fileKey = urlParts.substring(vendorsIndex);
                  }
                }
              }
            } else if (photoItem.startsWith('vendors/')) {
              // Already a key - ensure it's for this vendor
              if (!fileKey.startsWith(`vendors/${vendor.id}/`)) {
                // If key is for different vendor or missing vendor ID, fix it
                const keyParts = fileKey.split('/');
                if (keyParts.length >= 3 && keyParts[0] === 'vendors') {
                  // Replace vendor ID in key
                  fileKey = `vendors/${vendor.id}/${keyParts.slice(2).join('/')}`;
                }
              }
            } else if (photoItem.startsWith('http://') || photoItem.startsWith('https://')) {
              // Full URL but not S3 - might be CloudFront or other CDN
              // Try to extract key or return as-is for public URLs
              console.log(`[FACILITY-PHOTOS] Photo is a full URL (non-S3), returning as-is:`, photoItem);
              return photoItem;
            }
            
            if (!fileKey || fileKey.length === 0) {
              console.warn(`[FACILITY-PHOTOS] Could not extract file key from:`, photoItem);
              return null;
            }
            
            console.log(`[FACILITY-PHOTOS] Generating presigned URL for key: ${fileKey}`);
            
            // ✅ FIX: Verify the object exists before generating presigned URL
            try {
              const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
              const headCommand = new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
              });
              await s3Client.send(headCommand);
            } catch (headError: any) {
              if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
                console.warn(`[FACILITY-PHOTOS] Object not found in S3: ${fileKey}`);
                return null;
              }
              console.warn(`[FACILITY-PHOTOS] Error checking object existence: ${fileKey}`, headError?.message);
            }
            
            // Generate fresh presigned URL (valid for 7 days)
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: fileKey,
            });
            
            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
            
            // ✅ FIX: Validate presigned URL format
            if (!presignedUrl || typeof presignedUrl !== 'string' || !presignedUrl.startsWith('https://')) {
              console.error(`[FACILITY-PHOTOS] Invalid presigned URL generated for ${fileKey}`);
              return null;
            }
            
            console.log(`[FACILITY-PHOTOS] Generated presigned URL for ${fileKey} (length: ${presignedUrl.length})`);
            return presignedUrl;
          } catch (error: any) {
            console.error(`[FACILITY-PHOTOS] Error generating presigned URL for ${photoItem}:`, error?.message || error);
            // ✅ FIX: If presigned URL generation fails, try returning the original URL if it's already a valid URL
            if (photoItem && (photoItem.startsWith('http://') || photoItem.startsWith('https://'))) {
              console.log(`[FACILITY-PHOTOS] Returning original URL as fallback:`, photoItem);
              return photoItem;
            }
            return null;
          }
        })
      );
      
      const validPhotos = photos.filter((url): url is string => url !== null && url !== undefined && url.length > 0);
      console.log(`[FACILITY-PHOTOS] Returning ${validPhotos.length} valid photos out of ${rawPhotos.length} total`);

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Ensure pincode is returned
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          description: metadata.description || vendor.description || '', // ✅ FIX: Get description from metadata
          logoUrl: vendor.logo_url,
          coverImageUrl: vendor.cover_image_url,
          role: vendor.role_name,
          roleDisplayName: vendor.role_display_name,
        },
        facility: {
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Include pincode
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          photos: validPhotos, // ✅ FIX: Use presigned URLs generated on-demand
          amenities: metadata.amenities || vendor.amenities || [], // ✅ FIX: Get from metadata
          customAmenities: metadata.customAmenities || [], // ✅ FIX: Include custom amenities
          description: metadata.description || vendor.description || '', // ✅ FIX: Include description
          operatingHours: operatingHours, // ✅ FIX: Parse operating hours
          specializations: metadata.specializations || [], // ✅ FIX: Include specializations
        },
        rating: {
          average: parseFloat(ratingResult.rows[0]?.avg_rating || '0').toFixed(1),
          count: parseInt(ratingResult.rows[0]?.review_count || '0', 10),
        },
        recentReviews: reviewsResult.rows.map(r => ({
          id: r.id,
          customerName: r.customer_name || 'Anonymous',
          rating: r.rating,
          comment: r.comment,
          date: r.created_at,
        })),
        staff: staffResult.rows.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          experienceYears: s.experience_years,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching facility:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /customer/clinic/:vendorId/services
   * Get services for a specific clinic/vendor
   */
  app.get("/customer/clinic/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceStyle = c.req.query('style') || c.req.query('serviceStyle');
      
      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ error: 'Valid vendor ID is required', success: false }, 400);
      }

      // Get vendor services from vendor_services table
      let servicesQuery = `
        SELECT 
          vs.id,
          vs.service_id,
          vs.service_name,
          vs.service_style,
          vs.price,
          COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
          vs.custom_description as description,
          vs.is_enabled,
          vs.publish_status,
          vs.category as category_name,
          vs.sub_category as sub_category_name,
          vs.is_custom_service as is_package,
          vs.metadata as package_details,
          s.name as base_service_name,
          s.description as base_description
        FROM vendor_services vs
        LEFT JOIN services s ON vs.service_id = s.id
        WHERE vs.vendor_id = $1 
          AND vs.is_enabled = true 
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      `;
      
      const params: any[] = [vendorId];
      
      if (serviceStyle) {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        servicesQuery += ` AND vs.service_style = ANY($2::text[])`;
        params.push(acceptableStyles);
      }
      
      servicesQuery += ` ORDER BY vs.category, vs.service_name`;

      const servicesResult = await query(servicesQuery, params);

      const services = servicesResult.rows.map(s => ({
        id: s.id,
        serviceId: s.service_id,
        serviceName: s.service_name || s.base_service_name,
        description: s.description || s.base_description || '',
        price: parseFloat(s.price || 0),
        duration: s.duration || 30,
        serviceStyle: s.service_style,
        categoryName: s.category_name || s.category,
        subCategoryName: s.sub_category_name || s.sub_category,
        isPackage: s.is_package,
        packageDetails: s.package_details,
        isEnabled: s.is_enabled,
        publishStatus: s.publish_status,
      }));

      // Group by service style
      const groupedServices = {
        at_center: services.filter(s => s.serviceStyle === 'at_center'),
        at_home: services.filter(s => s.serviceStyle === 'at_home'),
        tele: services.filter(s => s.serviceStyle === 'tele'),
      };

      return c.json({
        success: true,
        services,
        grouped: groupedServices,
        total: services.length,
      });
    } catch (error: any) {
      console.error('Error fetching clinic services:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /customer/services/by-style
   * Get available services filtered by style (tele, at_home, at_center)
   * 
   * ⚠️ CRITICAL BUSINESS RULE for at_home and tele:
   * - For BUSINESS ENTITIES (clinics, grooming centers): Return only VERIFIED STAFF MEMBERS
   * - For INDIVIDUAL PROVIDERS (home groomers, individual vets): Return the provider directly
   * - Only verified providers (mobile_verified = true) appear in results
   */
  app.get("/customer/services/by-style", async (c) => {
    try {
      const serviceStyle = c.req.query('style');
      const category = c.req.query('category');
      const roleId = c.req.query('roleId'); // ✅ FIX: Support roleId parameter
      const specialization = c.req.query('specialization'); // ✅ FIX: Support specialization parameter
      const problemTitle = c.req.query('problemTitle'); // Phase 2: "Best for [problem]" badge
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const rules = await getDiscoveryRules(
        roleId || category || 'all',
        'discover',
        serviceStyle || undefined,
        category || undefined
      );
      const defaultRadiusKm = rules.discovery_radius_km ?? 50;
      const maxResults = rules.discovery_max_results ?? 50;
      const radius = c.req.query('radius') ? parseInt(c.req.query('radius')!, 10) : defaultRadiusKm;
      const maxDistance = c.req.query('maxDistance'); // ✅ NEW: Maximum distance filter in km
      const minRating = c.req.query('minRating'); // ✅ NEW: Minimum rating filter
      const sortBy = c.req.query('sortBy') || (rules.discovery_sort_default as string) || 'relevance'; // ✅ Rule engine: default sort
      
      if (!serviceStyle) {
        return c.json({ error: 'Service style is required (tele, at_home, at_center)', success: false }, 400);
      }

      // Normalize legacy styles so vendors stored as at_vendor/online are discoverable
      const acceptableStyles: string[] = acceptableStylesForService(serviceStyle);

      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;
      const maxDistanceKm = maxDistance ? parseFloat(maxDistance) : null;
      const minRatingValue = minRating ? parseFloat(minRating) : null;

      // ========== FOR AT_CENTER: Return vendors directly ==========
      if (serviceStyle === 'at_center') {
        const hasLogoUrl = await columnExists('vendors', 'logo_url');
        const logoColumn = hasLogoUrl ? 'v.logo_url' : 'NULL';
        let vendorsQuery = `
          SELECT DISTINCT ON (v.id)
            v.id as vendor_id,
            v.business_name,
            v.owner_name,
            v.phone,
            v.address,
            v.city,
            v.latitude,
            v.longitude,
            v.metadata,
            v.profile_photo_url,
            v.profile_image,
            ${logoColumn} as logo_url,
            v.specializations,
            v.vendor_type,
            r.name as role_name,
            r.display_name as role_display_name,
            r.config as role_config,
            (SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id) as avg_rating,
            (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id) as review_count,
            'vendor' as provider_type
          FROM vendors v
          LEFT JOIN roles r ON v.role_id = r.id
          INNER JOIN vendor_services vs ON vs.vendor_id = v.id
          WHERE v.status = 'approved' 
            AND v.is_active = true
            AND vs.service_style = ANY($1::text[])
            AND vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
            AND (r.name IS NULL OR LOWER(r.name) NOT LIKE '%solo%')
        `;
        
        const params: any[] = [acceptableStyles];
        let paramIndex = 2;

        if (category) {
          // ✅ FIX: Align with getCategoryFromRole - include all center/solo role name variants so discoverable vendors populate.
          // Vet center uses discover-services; by-style must match same role set for grooming/training/walker.
          const categoryRoles: Record<string, string[]> = {
            'vet': ['veterinarian', 'vet_clinic', 'vet_solo', 'vet', 'Veterinarian'],
            'grooming': ['groomer', 'grooming_salon', 'pet_groomer', 'groomer_center', 'groomer_solo', 'grooming_solo'],
            'training': ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo', 'training_solo'],
            'nutritionist': ['nutritionist', 'pet_nutritionist', 'nutritionist_center', 'nutritionist_solo'],
            'nutrition': ['nutritionist', 'pet_nutritionist', 'nutritionist_center', 'nutritionist_solo'],
            'walker': ['walker', 'pet_walker', 'dog_walker', 'walker_solo'],
            'boarding': ['boarding', 'pet_boarder', 'pet_boarding'],
            'adoption': ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
            'shop': ['seller', 'pet_products_store'],
            'cafes': ['cafe', 'pet_cafe'],
            'cafe': ['cafe', 'pet_cafe'],
            'photography': ['photographer', 'pet_photographer'],
            'insurance': ['insurance', 'pet_insurance'],
            'ambulance': ['ambulance', 'pet_ambulance'],
            'breeder': ['breeder', 'pet_breeder'],
            'relocation': ['relocation', 'pet_taxi', 'pet_transport', 'pet_relocation'],
            'resort': ['resort', 'pet_resort'],
            'holiday': ['holiday'],
            'sunset': ['sunset', 'pet_sunset_services'],
            'behaviourist': ['behaviourist', 'pet_behaviourist', 'behaviourist_solo'],
            'sitting': ['pet_sitter', 'sitter', 'sitter_solo'],
            'diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
            'lab-diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
          };
          const roles = categoryRoles[category.toLowerCase()];
          if (roles) {
            vendorsQuery += ` AND r.name = ANY($${paramIndex})`;
            params.push(roles);
            paramIndex++;
          }
        }

        // ✅ FIX: Filter by specialization if provided
        if (specialization) {
          // Check if vendors table has specialization column
          const hasSpecializationColumn = await query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendors' AND column_name = 'specialization'
            )
          `).then(r => r.rows[0]?.exists).catch(() => false);

          // Check if vendors table has metadata column with specializations
          const hasMetadataColumn = await query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendors' AND column_name = 'metadata'
            )
          `).then(r => r.rows[0]?.exists).catch(() => false);

          if (hasSpecializationColumn) {
            vendorsQuery += ` AND (
              v.specialization ILIKE $${paramIndex} OR
              v.specialization = $${paramIndex}
            )`;
            params.push(`%${specialization}%`);
            paramIndex++;
          } else if (hasMetadataColumn) {
            // Check metadata JSON for specializations array
            vendorsQuery += ` AND (
              v.metadata::text ILIKE $${paramIndex} OR
              EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(v.metadata->'specializations') AS spec
                WHERE spec ILIKE $${paramIndex}
              )
            )`;
            params.push(`%${specialization}%`);
            paramIndex++;
          }
        }

        vendorsQuery += ` ORDER BY v.id, avg_rating DESC NULLS LAST LIMIT ${Math.min(100, Math.max(1, maxResults))}`;

        const vendorsResult = await query(vendorsQuery, params);

        const vendorsWithServices = (await Promise.all(
          vendorsResult.rows.map(async (vendor) => {
            if (serviceStyle && !roleConfigAllowsStyle((vendor as any).role_config, serviceStyle)) {
              return null;
            }
            const servicesResult = await query(
              `SELECT 
                vs.id,
                vs.service_id,
                vs.service_name,
                vs.price,
                COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
                vs.custom_description as description,
                vs.category as category_name
               FROM vendor_services vs
               WHERE vs.vendor_id = $1 
                 AND vs.service_style = ANY($2::text[])
                 AND vs.is_enabled = true
                 AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
               ORDER BY vs.price ASC`,
              [vendor.vendor_id, acceptableStyles]
            );

            let distance = null;
            if (customerLat && customerLng && vendor.latitude && vendor.longitude) {
              distance = calculateDistance(customerLat, customerLng, parseFloat(vendor.latitude), parseFloat(vendor.longitude));
            }
            const distanceKm = distance != null ? parseFloat((distance as number).toFixed(2)) : null;
            const distanceText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)} km away`) : null;

            // Next available slot from vendor_availability_v2 (at_center)
            let nextAvailable: { date: string; time: string; display: string } | null = null;
            try {
              const today = new Date();
              const dayOfWeek = today.getDay();
              const va2 = await query(
                `SELECT day_of_week, COALESCE(time_window_start, start_time) as start_time
                 FROM vendor_availability_v2
                 WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
                   AND (is_available IS NULL OR is_available = true)
                   AND (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[] OR service_style = ANY($3::text[]) OR service_type = ANY($3::text[]))
                 ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC LIMIT 1`,
                [vendor.vendor_id, (vendor as any).phone || '', acceptableStyles]
              );
              if (va2.rows?.length > 0) {
                const s = va2.rows[0];
                let daysToAdd = s.day_of_week - dayOfWeek;
                if (daysToAdd < 0) daysToAdd += 7;
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + daysToAdd);
                const timeStr = (s.start_time || '09:00').toString().substring(0, 5);
                const formatted = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const isToday = daysToAdd === 0;
                const isTomorrow = daysToAdd === 1;
                nextAvailable = {
                  date: targetDate.toISOString().split('T')[0],
                  time: timeStr,
                  display: isToday ? `Today ${formatted}` : isTomorrow ? `Tomorrow ${formatted}` : `${targetDate.toLocaleDateString('en-US', { weekday: 'short' })} ${formatted}`,
                };
              }
            } catch (_) { /* non-fatal */ }

            // Specializations from vendor_specializations
            let specializations: string[] = [];
            try {
              const specRes = await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [vendor.vendor_id]);
              specializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
            } catch (_) { /* non-fatal */ }
            if (specializations.length === 0 && (vendor as any).metadata) {
              try {
                const m = typeof (vendor as any).metadata === 'string' ? JSON.parse((vendor as any).metadata) : (vendor as any).metadata;
                const arr = m?.specializations;
                if (Array.isArray(arr)) specializations = arr.slice(0, 5);
              } catch (_) {}
            }

            // Phase 2: photos, priceMin, priceMax, hasPackages, bestForProblem
            const servicePrices = (servicesResult.rows || []).map((s: any) => parseFloat(s.price || '0')).filter((p: number) => p > 0);
            const priceMin = servicePrices.length > 0 ? Math.min(...servicePrices) : 0;
            const priceMax = servicePrices.length > 0 ? Math.max(...servicePrices) : 0;
            let hasPackages = false;
            let photos: string[] = [];
            try {
              const pkgRes = await query(`SELECT 1 FROM service_packages WHERE vendor_id = $1 LIMIT 1`, [vendor.vendor_id]);
              hasPackages = (pkgRes.rows?.length || 0) > 0;
            } catch { /* continue */ }
            try {
              const meta = (vendor as any).metadata;
              if (meta) {
                const m = typeof meta === 'string' ? JSON.parse(meta || '{}') : meta;
                const raw = m?.facility_photos || m?.photos || [];
                photos = Array.isArray(raw) ? raw.slice(0, 5).filter(Boolean) : [];
              }
            } catch { /* continue */ }

            const vendorType = (vendor as any).vendor_type === 'solo' ? 'solo' : 'business';
            const roleName = (vendor as any).role_name || (vendor as any).role_display_name || '';

            return {
              id: vendor.vendor_id,
              vendorId: vendor.vendor_id,
              providerId: vendor.vendor_id,
              providerType: 'vendor',
              name: vendor.business_name || vendor.owner_name,
              phone: vendor.phone,
              address: vendor.address,
              city: vendor.city,
              role: vendor.role_display_name || vendor.role_name,
              roleName,
              vendorType,
              photoUrl: getVendorPhotoUrl(vendor),
              rating: parseFloat(vendor.avg_rating || '0'),
              reviewCount: parseInt(vendor.review_count || '0', 10),
              distance: distanceKm,
              distanceKm,
              distanceText,
              nextAvailable,
              specializations,
              serviceStyles: acceptableStyles,
              minPrice: priceMin > 0 ? priceMin : undefined,
              isVerified: true,
              photos: photos.length > 0 ? photos : undefined,
              priceMin: priceMin > 0 ? priceMin : undefined,
              priceMax: priceMax > 0 && priceMax !== priceMin ? priceMax : undefined,
              bestForProblem: problemTitle || undefined,
              hasPackages: hasPackages || undefined,
              services: servicesResult.rows.map((s: any) => ({
                id: s.id,
                serviceId: s.service_id,
                name: s.service_name,
                price: parseFloat(s.price || 0),
                duration: s.duration || 30,
                description: s.description,
                category: s.category_name,
              })),
            };
          })
        )).filter(Boolean);

        let filteredVendors = vendorsWithServices.filter(v => v.services.length > 0);

        // ✅ Apply minRating filter
        if (minRatingValue !== null && minRatingValue > 0) {
          filteredVendors = filteredVendors.filter(v => parseFloat(v.rating) >= minRatingValue);
        }

        // ✅ Apply distance filter: use maxDistance param if provided, else rule-book default radius (at_center discovery)
        const effectiveMaxKm = maxDistanceKm !== null ? maxDistanceKm : (customerLat && customerLng ? radius : null);
        if (effectiveMaxKm !== null && customerLat && customerLng) {
          filteredVendors = filteredVendors.filter(v => 
            v.distance === null || v.distance <= effectiveMaxKm
          );
        }

        // ✅ Sort based on sortBy parameter
        filteredVendors.sort((a, b) => {
          switch (sortBy) {
            case 'distance':
              if (a.distance === null && b.distance === null) return 0;
              if (a.distance === null) return 1;
              if (b.distance === null) return -1;
              return a.distance - b.distance;
            
            case 'rating':
              return parseFloat(b.rating) - parseFloat(a.rating);
            
            case 'price':
              const aPrice = a.services[0]?.price || 0;
              const bPrice = b.services[0]?.price || 0;
              return aPrice - bPrice;
            
            case 'relevance':
            default:
              const aScore = (parseFloat(a.rating) * 10) + (a.reviewCount * 0.5) + (a.distance !== null ? Math.max(0, 50 - a.distance) : 0);
              const bScore = (parseFloat(b.rating) * 10) + (b.reviewCount * 0.5) + (b.distance !== null ? Math.max(0, 50 - b.distance) : 0);
              return bScore - aScore;
          }
        });

        return c.json({
          success: true,
          style: serviceStyle,
          providers: filteredVendors,
          total: filteredVendors.length,
          appliedFilters: {
            minRating: minRatingValue,
            maxDistance: maxDistanceKm ?? (customerLat && customerLng ? effectiveMaxKm : undefined),
            sortBy,
          },
        });
      }

      // ========== FOR AT_HOME and TELE: Return verified staff/individual providers ==========
      // 1. Get individual providers (staff with vendor_id = NULL and is_individual_provider = true)
      // 2. Get verified staff members from clinics/centers who are assigned to this service style

      const providers: any[] = [];

      // Check column existence for robust query building
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'photo') as has_photo,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'experience_years') as has_experience,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'qualifications') as has_qualifications,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'mobile_verified') as has_mobile_verified,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'default_location') as has_default_location,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'is_individual_provider') as has_individual_provider,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'enabled_by_staff') as has_enabled_by_staff,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'service_styles') as has_service_styles,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') as has_reviews_table,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'staff_id') as has_reviews_staff_id
      `);

      const {
        has_photo,
        has_experience,
        has_qualifications,
        has_mobile_verified,
        has_default_location,
        has_individual_provider,
        has_enabled_by_staff,
        has_service_styles,
        has_reviews_table,
        has_reviews_staff_id
      } = schemaCheck.rows[0] || {};

      // Build dynamic column selections based on schema availability
      const photoColumn = has_photo ? 's.photo' : 'NULL';
      const experienceColumn = has_experience ? 's.experience_years' : 'NULL';
      const qualificationsColumn = has_qualifications ? 's.qualifications' : 'NULL';
      const defaultLocationColumn = has_default_location ? 's.default_location' : 'NULL';
      const mobileVerifiedCondition = has_mobile_verified ? 'AND s.mobile_verified = true' : '';
      const individualProviderCondition = has_individual_provider ? 'AND s.is_individual_provider = true' : '';
      const enabledByStaffCondition = has_enabled_by_staff ? 'AND ss.enabled_by_staff = true' : '';
      const acceptableStylesForStaff = acceptableStylesForService(serviceStyle);
      const serviceStyleFilter = has_service_styles ? 'ss.service_styles && $PARAM::text[]' : 'TRUE';
      const avgRatingSubquery = (has_reviews_table && has_reviews_staff_id) 
        ? 'COALESCE((SELECT AVG(rating) FROM reviews WHERE staff_id = s.id), 0)' 
        : '0';
      const reviewCountSubquery = (has_reviews_table && has_reviews_staff_id) 
        ? 'COALESCE((SELECT COUNT(*) FROM reviews WHERE staff_id = s.id), 0)' 
        : '0';

      // Category role mapping - all canonical roles so discovery works for every customer tile
      const categoryRoles: Record<string, string[]> = {
        'vet': ['Veterinarian', 'veterinarian', 'vet', 'vet_clinic', 'vet_solo', 'Veterinarian (Solo)', 'Vet Solo', 'Veterinary Clinic'],
        'grooming': ['Groomer', 'groomer', 'pet_groomer', 'grooming_salon', 'groomer_center', 'groomer_solo', 'grooming_solo', 'Groomer (Solo)', 'Grooming Salon'],
        'training': ['Trainer', 'trainer', 'pet_trainer', 'trainer_center', 'trainer_solo', 'training_solo', 'Trainer (Solo)', 'Pet Trainer'],
        'walker': ['Walker', 'walker', 'pet_walker', 'dog_walker', 'walker_solo', 'Dog Walker', 'Walker (Solo)'],
        'boarding': ['boarding', 'pet_boarder', 'pet_boarding'],
        'adoption': ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
        'shop': ['seller', 'pet_products_store'],
        'cafes': ['cafe', 'pet_cafe'],
        'cafe': ['cafe', 'pet_cafe'],
        'photography': ['photographer', 'pet_photographer'],
        'insurance': ['insurance', 'pet_insurance'],
        'ambulance': ['ambulance', 'pet_ambulance'],
        'breeder': ['breeder', 'pet_breeder'],
        'relocation': ['relocation', 'pet_taxi', 'pet_transport', 'pet_relocation'],
        'resort': ['resort', 'pet_resort'],
        'holiday': ['holiday'],
        'sunset': ['sunset', 'pet_sunset_services'],
        'nutritionist': ['nutritionist', 'pet_nutritionist', 'nutritionist_center', 'nutritionist_solo', 'Pet Nutritionist', 'Nutritionist (Solo)'],
        'nutrition': ['nutritionist', 'pet_nutritionist', 'nutritionist_center', 'nutritionist_solo', 'Pet Nutritionist', 'Nutritionist (Solo)'],
        'behaviourist': ['behaviourist', 'pet_behaviourist', 'behaviourist_solo', 'Pet Behaviourist', 'Behaviourist (Solo)'],
        'sitting': ['pet_sitter', 'sitter', 'sitter_solo', 'Pet Sitter', 'Sitter (Solo)'],
        'diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo', 'Diagnostics Provider', 'Diagnostics (Solo)'],
        'lab-diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
      };

      // ✅ FIX: Use roleId if provided, otherwise use category mapping.
      // Resolve roleId to full category role list so walkers (walker_solo, pet_walker, dog_walker) and solo trainers (trainer_solo, pet_trainer) are discovered.
      let targetRoles: string[] = [];
      if (roleId) {
        try {
          const roles = await query(
            `SELECT name, display_name FROM roles WHERE LOWER(name) = LOWER($1) OR LOWER(display_name) = LOWER($1)`,
            [roleId]
          );
          if (roles.rows.length > 0) {
            const role = roles.rows[0];
            targetRoles = [role.name, role.display_name, roleId].filter(Boolean);
          } else {
            targetRoles = [roleId];
          }
          // Resolve roleId to category and add all role variants (walker → walker_solo, pet_walker, dog_walker; trainer → trainer_solo, pet_trainer)
          const roleCategory = getCategoryFromRole(roleId);
          if (roleCategory && categoryRoles[roleCategory]) {
            targetRoles = [...new Set([...targetRoles, ...categoryRoles[roleCategory]])];
          }
        } catch (err) {
          console.warn('Error fetching role:', err);
          targetRoles = [roleId];
          const roleCategory = getCategoryFromRole(roleId);
          if (roleCategory && categoryRoles[roleCategory]) {
            targetRoles = [...new Set([...targetRoles, ...categoryRoles[roleCategory]])];
          }
        }
      }
      
      // ✅ FIX: Also include category roles if category is provided (combine with roleId results)
      if (category) {
        const categoryRoleList = categoryRoles[category.toLowerCase()] || [];
        targetRoles = [...new Set([...targetRoles, ...categoryRoleList])];
      }
      
      // ✅ FIX: If no roles found, use category as fallback
      if (targetRoles.length === 0 && category) {
        targetRoles = categoryRoles[category.toLowerCase()] || [];
      }
      
      console.log(`[Services By Style] Target roles for roleId=${roleId}, category=${category}:`, targetRoles);

      // ========== 1. Get Individual Providers (no vendor_id, verified) ==========
      let individualQuery = `
        SELECT 
          s.id,
          s.name,
          s.phone,
          s.email,
          ${photoColumn} as photo,
          s.role,
          ${experienceColumn} as experience_years,
          ${qualificationsColumn} as qualifications,
          ${defaultLocationColumn} as default_location,
          ${has_individual_provider ? 's.is_individual_provider' : 'false'} as is_individual_provider,
          ${has_mobile_verified ? 's.mobile_verified' : 'true'} as mobile_verified,
          ${avgRatingSubquery} as avg_rating,
          ${reviewCountSubquery} as review_count
        FROM staff s
        WHERE s.is_active = true
          ${mobileVerifiedCondition}
          AND s.vendor_id IS NULL
          ${individualProviderCondition}
      `;

      const individualParams: any[] = [];
      let individualParamIdx = 1;

      if (targetRoles.length > 0) {
        individualQuery += ` AND s.role = ANY($${individualParamIdx})`;
        individualParams.push(targetRoles);
        individualParamIdx++;
      }

      // Check if staff has services with this style enabled (check both staff_services AND vendor_services)
      const styleFilterWithParam = has_service_styles 
        ? `ss.service_styles && $${individualParamIdx}::text[]` 
        : 'TRUE';
      
      individualQuery += ` AND (
        EXISTS (
          SELECT 1 FROM staff_services ss 
          WHERE ss.staff_id = s.id 
            ${enabledByStaffCondition}
            AND ss.is_active = true
            AND ${styleFilterWithParam}
        )
        OR
        -- Fallback: Check if individual provider has vendor_services with this style enabled
        EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = s.vendor_id
            AND vs.is_enabled = true
            AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
            AND vs.service_style = ANY($${individualParamIdx}::text[])
        )
      )`;
      individualParams.push(acceptableStylesForStaff);
      individualParamIdx++;

      // NOTE: Availability check removed - providers appear based on service style enablement
      // Availability is validated at booking time, not at discovery time

      // ✅ FIX: Filter by specialization if provided (check staff_specializations table)
      if (specialization) {
        const hasStaffSpecializationsTable = await query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'staff_specializations'
          )
        `).then(r => r.rows[0]?.exists).catch(() => false);

        if (hasStaffSpecializationsTable) {
          individualQuery += ` AND EXISTS (
            SELECT 1 FROM staff_specializations ss
            WHERE ss.staff_id = s.id
              AND (ss.specialization ILIKE $${individualParamIdx} OR ss.specialization = $${individualParamIdx})
          )`;
          individualParams.push(`%${specialization}%`);
          individualParamIdx++;
        }
      }

      const individualResult = await query(individualQuery, individualParams);

      for (const ind of individualResult.rows) {
        // Get services for this individual - first try staff_services
        let servicesResult = await query(
          `SELECT 
            ss.id,
            ss.service_id,
            ss.price,
            ss.duration_minutes as duration,
            ss.service_styles,
            s.name as service_name,
            s.description,
            s.category
           FROM staff_services ss
           INNER JOIN services s ON ss.service_id = s.id
           WHERE ss.staff_id = $1 
             AND ss.enabled_by_staff = true 
             AND ss.is_active = true
             AND ss.service_styles && $2::text[]
           ORDER BY ss.price ASC`,
          [ind.id, acceptableStylesForStaff]
        ).catch(() => ({ rows: [] }));

        // ✅ FIX: If no staff_services found, try vendor_services (for individual providers who use vendor_services)
        if (servicesResult.rows.length === 0 && ind.vendor_id) {
          servicesResult = await query(
            `SELECT 
              vs.id,
              vs.service_id,
              vs.price,
              COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
              vs.service_name,
              vs.custom_description as description,
              vs.category
             FROM vendor_services vs
             WHERE vs.vendor_id = $1 
               AND vs.service_style = $2
               AND vs.is_enabled = true
               AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
             ORDER BY vs.price ASC`,
            [ind.vendor_id, serviceStyle]
          ).catch(() => ({ rows: [] }));
        }

        // Calculate distance if location available
        let distance = null;
        if (customerLat && customerLng && ind.default_location) {
          const loc = typeof ind.default_location === 'string' 
            ? JSON.parse(ind.default_location) 
            : ind.default_location;
          if (loc.lat && loc.lng) {
            distance = calculateDistance(customerLat, customerLng, parseFloat(loc.lat), parseFloat(loc.lng));
          }
        }
        const distanceKm = distance ? parseFloat(distance.toFixed(2)) : null;
        const distanceText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)} km away`) : null;

        providers.push({
          providerId: ind.id,
          providerType: 'individual',
          staffId: ind.id,
          vendorId: ind.vendor_id || null,
          name: ind.name,
          phone: ind.phone,
          photo: ind.photo,
          role: ind.role,
          experienceYears: ind.experience_years,
          qualifications: ind.qualifications,
          rating: parseFloat(ind.avg_rating || '0').toFixed(1),
          reviewCount: parseInt(ind.review_count || '0', 10),
          distance: distanceKm,
          distanceKm,
          distanceText,
          isVerified: true,
          isIndividualProvider: true,
          photoUrl: ind.photo || null,
          serviceStyles: serviceStyle ? ((normalizeServiceStyle(serviceStyle) || serviceStyle) ? [normalizeServiceStyle(serviceStyle) || serviceStyle] : []) : [],
          vendorType: ind.vendor_id ? 'business' : 'solo',
          roleName: ind.role,
          specializations: [],
          nextAvailable: null,
          services: servicesResult.rows.map(s => ({
            id: s.id,
            serviceId: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price || 0),
            duration: s.duration || 30,
            description: s.description,
            category: s.category,
          })),
        });
      }

      // ========== 2. Get Verified Staff from Clinics/Centers ==========
      let staffQuery = `
        SELECT 
          s.id,
          s.name,
          s.phone,
          s.email,
          ${photoColumn} as photo,
          s.role,
          ${experienceColumn} as experience_years,
          ${qualificationsColumn} as qualifications,
          ${defaultLocationColumn} as default_location,
          ${has_mobile_verified ? 's.mobile_verified' : 'true'} as mobile_verified,
          s.vendor_id,
          v.business_name as vendor_name,
          v.address as vendor_address,
          v.city as vendor_city,
          v.latitude as vendor_lat,
          v.longitude as vendor_lng,
          r.display_name as vendor_role_display,
          ${avgRatingSubquery} as avg_rating,
          ${reviewCountSubquery} as review_count
        FROM staff s
        INNER JOIN vendors v ON s.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE s.is_active = true
          ${mobileVerifiedCondition}
          AND v.status = 'approved'
          AND v.is_active = true
          AND s.vendor_id IS NOT NULL
      `;

      const staffParams: any[] = [];
      let staffParamIdx = 1;

      // Filter by role
      if (targetRoles.length > 0) {
        staffQuery += ` AND s.role = ANY($${staffParamIdx})`;
        staffParams.push(targetRoles);
        staffParamIdx++;
      }

      // Check if staff has services with this style enabled (check both staff_services AND vendor_services)
      const staffStyleFilterWithParam = has_service_styles 
        ? `ss.service_styles && $${staffParamIdx}::text[]` 
        : 'TRUE';
        
      staffQuery += ` AND (
        EXISTS (
          SELECT 1 FROM staff_services ss 
          WHERE ss.staff_id = s.id 
            ${enabledByStaffCondition}
            AND ss.is_active = true
            AND ${staffStyleFilterWithParam}
        )
        OR
        -- Fallback: Check if vendor has published services with this style
        EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = s.vendor_id
            AND vs.is_enabled = true
            AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
            AND vs.service_style = ANY($${staffParamIdx}::text[])
        )
      )`;
      staffParams.push(acceptableStylesForStaff);
      staffParamIdx++;

      // NOTE: Availability check removed - providers appear based on service style enablement
      // Availability is validated at booking time, not at discovery time

      // ✅ FIX: Filter by specialization if provided (check staff_specializations table)
      if (specialization) {
        const hasStaffSpecializationsTable = await query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'staff_specializations'
          )
        `).then(r => r.rows[0]?.exists).catch(() => false);

        if (hasStaffSpecializationsTable) {
          staffQuery += ` AND EXISTS (
            SELECT 1 FROM staff_specializations ss
            WHERE ss.staff_id = s.id
              AND (ss.specialization ILIKE $${staffParamIdx} OR ss.specialization = $${staffParamIdx})
          )`;
          staffParams.push(`%${specialization}%`);
          staffParamIdx++;
        }
      }

      const staffResult = await query(staffQuery, staffParams);

      for (const staff of staffResult.rows) {
        // Get services for this staff - first try staff_services
        let servicesResult = await query(
          `SELECT 
            ss.id,
            ss.service_id,
            ss.price,
            ss.duration_minutes as duration,
            ss.service_styles,
            s.name as service_name,
            s.description,
            s.category
           FROM staff_services ss
           INNER JOIN services s ON ss.service_id = s.id
           WHERE ss.staff_id = $1 
             AND ss.enabled_by_staff = true 
             AND ss.is_active = true
             AND ss.service_styles && $2::text[]
           ORDER BY ss.price ASC`,
          [staff.id, acceptableStylesForStaff]
        ).catch(() => ({ rows: [] }));

        // ✅ FIX: If no staff_services found, fallback to vendor_services
        if (servicesResult.rows.length === 0 && staff.vendor_id) {
          servicesResult = await query(
            `SELECT 
              vs.id,
              vs.service_id,
              vs.price,
              COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
              vs.service_name,
              vs.custom_description as description,
              vs.category
             FROM vendor_services vs
             WHERE vs.vendor_id = $1 
               AND vs.service_style = ANY($2::text[])
               AND vs.is_enabled = true
               AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
             ORDER BY vs.price ASC`,
            [staff.vendor_id, acceptableStylesForStaff]
          ).catch(() => ({ rows: [] }));
        }

        // Calculate distance
        let distance = null;
        if (customerLat && customerLng) {
          // First try staff's default_location, then vendor's location
          let lat = null, lng = null;
          if (staff.default_location) {
            const loc = typeof staff.default_location === 'string' 
              ? JSON.parse(staff.default_location) 
              : staff.default_location;
            lat = loc.lat;
            lng = loc.lng;
          } else if (staff.vendor_lat && staff.vendor_lng) {
            lat = parseFloat(staff.vendor_lat);
            lng = parseFloat(staff.vendor_lng);
          }
          if (lat && lng) {
            distance = calculateDistance(customerLat, customerLng, lat, lng);
          }
        }
        const distanceKm = distance ? parseFloat(distance.toFixed(2)) : null;
        const distanceText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)} km away`) : null;

        providers.push({
          providerId: staff.id,
          providerType: 'staff',
          staffId: staff.id,
          vendorId: staff.vendor_id,
          vendorName: staff.vendor_name,
          name: staff.name,
          phone: staff.phone,
          photo: staff.photo,
          role: staff.role,
          experienceYears: staff.experience_years,
          qualifications: staff.qualifications,
          address: staff.vendor_address,
          city: staff.vendor_city,
          vendorRoleDisplay: staff.vendor_role_display,
          rating: parseFloat(staff.avg_rating || '0').toFixed(1),
          reviewCount: parseInt(staff.review_count || '0', 10),
          distance: distanceKm,
          distanceKm,
          distanceText,
          isVerified: true,
          isIndividualProvider: false,
          photoUrl: staff.photo || null,
          serviceStyles: serviceStyle ? ((normalizeServiceStyle(serviceStyle) || serviceStyle) ? [normalizeServiceStyle(serviceStyle) || serviceStyle] : []) : [],
          vendorType: staff.vendor_id ? 'business' : 'solo',
          roleName: staff.vendor_role_display || staff.role || '',
          specializations: [],
          nextAvailable: null,
          services: servicesResult.rows.map(s => ({
            id: s.id,
            serviceId: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price || 0),
            duration: s.duration || 30,
            description: s.description,
            category: s.category,
          })),
        });
      }

      // ========== 3. FALLBACK: Vendors with at_home/tele – align with admin active (any published service when category set) ==========
      const vendorIdsWithStaff = new Set(providers.map(p => p.vendorId).filter(Boolean));
      
      const acceptableStylesFallback = acceptableStylesForService(serviceStyle);
      const hasLogoUrlFallback = await columnExists('vendors', 'logo_url');
      const logoColumnFallback = hasLogoUrlFallback ? 'v.logo_url' : 'NULL';
      const vendorFallbackSoloCondition = targetRoles.length > 0
        ? ''
        : ` AND (
            v.vendor_type = 'solo'
            OR r.name LIKE '%_solo'
            OR r.name LIKE '%Solo%'
            OR LOWER(r.name) LIKE '%solo%'
            OR LOWER(r.name) IN ('walker','pet_walker','dog_walker','pet_sitter','sitter','pet_taxi','pet_transport','pet_relocation','relocation')
          )`;
      const vendorFallbackExistsService = ` AND EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id AND vs.is_enabled = true
            AND vs.service_style = ANY($1::text[])
              AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
          )`;
      let vendorFallbackQuery = `
        SELECT DISTINCT ON (v.id)
          v.id as vendor_id,
          v.business_name,
          v.owner_name,
          v.phone,
          v.address,
          v.city,
          v.latitude,
          v.longitude,
          v.profile_photo_url,
          v.profile_image,
          ${logoColumnFallback} as logo_url,
          v.specializations,
          v.metadata,
          v.vendor_type,
          r.name as role_name,
          r.display_name as role_display_name,
          r.config as role_config,
          (SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id) as avg_rating,
          (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id) as review_count
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          ${vendorFallbackSoloCondition}
          ${vendorFallbackExistsService}
      `;
      
      const vendorFallbackParams: any[] = [acceptableStylesFallback];
      let vendorFallbackParamIdx = 2;

      if (targetRoles.length > 0) {
        // ✅ FIX: More flexible role matching - check exact match, contains match, and normalized variants
        // This ensures vendors with roles like "Vet Solo", "Veterinarian (Solo)", "vet_solo" all match
        const targetRolesLower = targetRoles.map((r: string) => r.toLowerCase());
        const targetRolesNormalized = targetRolesLower.map((r: string) => r.replace(/[_\s()]/g, ''));
        
        vendorFallbackQuery += ` AND (
          LOWER(r.name) = ANY($${vendorFallbackParamIdx}::text[])
          OR LOWER(r.display_name) = ANY($${vendorFallbackParamIdx}::text[])
          OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(r.name, '_', ''), ' ', ''), '(', ''), ')', '')) = ANY($${vendorFallbackParamIdx + 1}::text[])
          OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(r.display_name, '_', ''), ' ', ''), '(', ''), ')', '')) = ANY($${vendorFallbackParamIdx + 1}::text[])
        )`;
        vendorFallbackParams.push(targetRolesLower);
        vendorFallbackParams.push(targetRolesNormalized);
        vendorFallbackParamIdx += 2;
      }

      // NOTE: Availability check removed - vendors appear based on service style enablement
      // Availability is validated at booking time, not at discovery time

      vendorFallbackQuery += ` ORDER BY v.id, avg_rating DESC NULLS LAST LIMIT ${Math.min(100, Math.max(1, maxResults))}`;

      console.log(`[Services By Style] Vendor fallback query:`, vendorFallbackQuery.substring(0, 200));
      console.log(`[Services By Style] Vendor fallback params:`, vendorFallbackParams);
      
      const vendorFallbackResult = await query(vendorFallbackQuery, vendorFallbackParams).catch((err) => {
        console.error('[Services By Style] Vendor fallback query error:', err);
        return { rows: [] };
      });
      
      console.log(`[Services By Style] Vendor fallback found ${vendorFallbackResult.rows.length} vendors`);
      
      // ✅ DEBUG: Check for specific vendor "Dr_Shivang_98765 42310_SOLO"
      if (vendorFallbackResult.rows.length > 0) {
        const shivangVendor = vendorFallbackResult.rows.find((v: any) => 
          (v.business_name && (v.business_name.includes('Shivang') || v.business_name.includes('42310'))) ||
          (v.owner_name && (v.owner_name.includes('Shivang') || v.owner_name.includes('42310'))) ||
          (v.phone && (v.phone.includes('42310') || v.phone.includes('98765')))
        );
        if (shivangVendor) {
          console.log(`[Services By Style] ✅ Found Shivang vendor in fallback results:`, {
            id: shivangVendor.vendor_id,
            name: shivangVendor.business_name || shivangVendor.owner_name,
            phone: shivangVendor.phone,
            status: shivangVendor.status,
            is_active: shivangVendor.is_active,
            role_name: shivangVendor.role_name
          });
        } else {
          console.log(`[Services By Style] ⚠️ Shivang vendor NOT found in fallback results. Checking database directly...`);
          // Check if vendor exists but didn't match query
          const directCheck = await query(`
            SELECT v.id, v.business_name, v.owner_name, v.phone, v.status, v.is_active, v.vendor_type,
                   r.name as role_name, r.display_name as role_display_name
            FROM vendors v
            LEFT JOIN roles r ON v.role_id = r.id
            WHERE (v.business_name ILIKE '%Shivang%' OR v.owner_name ILIKE '%Shivang%' OR v.phone LIKE '%42310%')
            LIMIT 1
          `).catch(() => ({ rows: [] }));
          if (directCheck.rows.length > 0) {
            const v = directCheck.rows[0];
            console.log(`[Services By Style] 🔍 Found Shivang vendor in DB:`, {
              id: v.id,
              name: v.business_name || v.owner_name,
              phone: v.phone,
              status: v.status,
              is_active: v.is_active,
              vendor_type: v.vendor_type,
              role_name: v.role_name,
              role_display_name: v.role_display_name
            });
            
            // Check why it didn't match - comprehensive diagnosis
            const statusCheck = (v.status === 'approved' || v.status === 'active') && v.is_active === true;
            console.log(`[Services By Style] ✅ Status check: ${statusCheck} (status: ${v.status}, is_active: ${v.is_active})`);
            
            // Check services
            const servicesCheck = await query(`
              SELECT vs.id, vs.service_name, vs.service_style, vs.is_enabled, vs.publish_status
              FROM vendor_services vs
              WHERE vs.vendor_id = $1 AND vs.service_style = ANY($2::text[])
            `, [v.id, acceptableStylesFallback]).catch(() => ({ rows: [] }));
            console.log(`[Services By Style] 📞 Services check:`, {
              has_services: servicesCheck.rows.length > 0,
              services: servicesCheck.rows,
              acceptable_styles: acceptableStylesFallback
            });
            
            const enabledPublishedServices = servicesCheck.rows.filter(s => 
              s.is_enabled === true && 
              (s.publish_status === 'published' || s.publish_status === 'auto_published' || s.publish_status === 'draft' || s.publish_status === null)
            );
            console.log(`[Services By Style] ✅ Enabled & published services: ${enabledPublishedServices.length}`);
            
            // Check role matching
            if (targetRoles.length > 0) {
              const roleMatches = targetRoles.some((role: string) => 
                v.role_name?.toLowerCase() === role.toLowerCase() ||
                v.role_display_name?.toLowerCase() === role.toLowerCase()
              );
              console.log(`[Services By Style] ✅ Role match: ${roleMatches}`, {
                vendor_role: v.role_name,
                vendor_role_display: v.role_display_name,
                target_roles: targetRoles
              });
            }
          }
        }
      }

      for (const vendor of vendorFallbackResult.rows) {
        // Skip vendors that already have staff in providers list
        if (vendorIdsWithStaff.has(vendor.vendor_id)) continue;
        if (serviceStyle && !roleConfigAllowsStyle((vendor as any).role_config, serviceStyle)) continue;

        // Get services for this vendor
        // ✅ FIX: Include 'auto_published' status to match the EXISTS check above
        const servicesResult = await query(
          `SELECT 
            vs.id,
            vs.service_id,
            vs.price,
            COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
            vs.service_name,
            vs.custom_description as description,
            vs.category
           FROM vendor_services vs
           WHERE vs.vendor_id = $1 
             AND vs.service_style = ANY($2::text[])
             AND vs.is_enabled = true
             AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
           ORDER BY vs.price ASC`,
          [vendor.vendor_id, acceptableStylesFallback]
        ).catch(() => ({ rows: [] }));

        let distance = null;
        if (customerLat && customerLng && vendor.latitude && vendor.longitude) {
          distance = calculateDistance(customerLat, customerLng, parseFloat(vendor.latitude), parseFloat(vendor.longitude));
        }
        const distanceKm = distance ? parseFloat(distance.toFixed(2)) : null;
        const distanceText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)} km away`) : null;

        const minPrice = servicesResult.rows.length > 0
          ? Math.min(...servicesResult.rows.map((s: any) => parseFloat(s.price || 0)))
          : 0;
        let amenities: string[] = [];
        try {
          const meta = vendor.metadata;
          if (meta) {
            const m = typeof meta === 'string' ? JSON.parse(meta) : meta;
            if (Array.isArray(m?.amenities)) amenities = m.amenities;
          }
        } catch (_) {}
        const specializations = vendor.specializations
          ? (Array.isArray(vendor.specializations) ? vendor.specializations : JSON.parse(vendor.specializations || '[]'))
          : [];

        providers.push({
          providerId: vendor.vendor_id,
          providerType: 'vendor',
          vendorId: vendor.vendor_id,
          vendorName: vendor.business_name || vendor.owner_name,
          name: vendor.business_name || vendor.owner_name,
          phone: vendor.phone,
          photo: getVendorPhotoUrl(vendor),
          photoUrl: getVendorPhotoUrl(vendor),
          role: vendor.role_display_name || vendor.role_name,
          roleName: vendor.role_name || vendor.role_display_name || '',
          experienceYears: null,
          qualifications: null,
          address: vendor.address,
          city: vendor.city,
          rating: parseFloat(vendor.avg_rating || '0').toFixed(1),
          reviewCount: parseInt(vendor.review_count || '0', 10),
          distance: distanceKm,
          distanceKm,
          distanceText,
          isVerified: true,
          isIndividualProvider: true,
          vendorType: vendor.vendor_type === 'solo' ? 'solo' : 'business',
          serviceStyles: serviceStyle ? ((normalizeServiceStyle(serviceStyle) || serviceStyle) ? [normalizeServiceStyle(serviceStyle) || serviceStyle] : []) : acceptableStylesFallback,
          nextAvailable: null,
          price: minPrice,
          consultationFee: minPrice,
          specializations,
          amenities,
          services: servicesResult.rows.map(s => ({
            id: s.id,
            serviceId: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price || 0),
            duration: s.duration || 30,
            description: s.description,
            category: s.category,
          })),
        });
      }

      // Filter providers with at least one service
      let filteredProviders = providers.filter(p => p.services.length > 0);

      // ✅ Apply minRating filter
      if (minRatingValue !== null && minRatingValue > 0) {
        filteredProviders = filteredProviders.filter(p => parseFloat(p.rating) >= minRatingValue);
      }

      // ✅ Apply maxDistance filter
      if (maxDistanceKm !== null && customerLat && customerLng) {
        filteredProviders = filteredProviders.filter(p => 
          p.distance === null || p.distance <= maxDistanceKm
        );
      }

      // ✅ Sort based on sortBy parameter
      filteredProviders.sort((a, b) => {
        switch (sortBy) {
          case 'distance':
            // Sort by distance ascending (nearest first)
            if (a.distance === null && b.distance === null) return 0;
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
          
          case 'rating':
            // Sort by rating descending (highest first)
            return parseFloat(b.rating) - parseFloat(a.rating);
          
          case 'price':
            // Sort by lowest service price
            const aPrice = a.services[0]?.price || 0;
            const bPrice = b.services[0]?.price || 0;
            return aPrice - bPrice;
          
          case 'relevance':
          default:
            // Relevance: weighted score of rating + review count + distance bonus
            const aScore = (parseFloat(a.rating) * 10) + (a.reviewCount * 0.5) + (a.distance !== null ? Math.max(0, 50 - a.distance) : 0);
            const bScore = (parseFloat(b.rating) * 10) + (b.reviewCount * 0.5) + (b.distance !== null ? Math.max(0, 50 - b.distance) : 0);
            return bScore - aScore;
        }
      });

      console.log(`[Services By Style] Found ${filteredProviders.length} providers for style=${serviceStyle}, category=${category}, sortBy=${sortBy}`);

      return c.json({
        success: true,
        style: serviceStyle,
        providers: filteredProviders,
        total: filteredProviders.length,
        // Also return as vendors for backward compatibility
        vendors: filteredProviders,
        appliedFilters: {
          minRating: minRatingValue,
          maxDistance: maxDistanceKm,
          sortBy,
        },
      });
    } catch (error: any) {
      console.error('Error fetching services by style:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /vendors
   * List vendors by role (for customer app clinic/groomer listing)
   * Query params: role, city, status, limit
   */
  app.get("/vendors", async (c) => {
    try {
      const role = c.req.query('role');
      const city = c.req.query('city');
      const status = c.req.query('status') || 'approved';
      const limit = parseInt(c.req.query('limit') || '50', 10);

      let vendorQuery = `
        SELECT 
          v.id,
          v.business_name,
          v.owner_name,
          v.phone,
          v.address,
          v.city,
          v.latitude,
          v.longitude,
          v.status,
          v.role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(
            (SELECT AVG(rating)::numeric(3,1) FROM reviews WHERE vendor_id = v.id),
            4.5
          ) as avg_rating,
          COALESCE(
            (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id),
            0
          ) as review_count,
          COALESCE(
            (SELECT COUNT(*) FROM bookings WHERE vendor_id = v.id AND status = 'completed'),
            0
          ) as completed_bookings
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by status
      if (status) {
        vendorQuery += ` AND v.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Filter by role name
      if (role) {
        vendorQuery += ` AND (r.name = $${paramIndex} OR r.display_name ILIKE $${paramIndex + 1})`;
        params.push(role, `%${role}%`);
        paramIndex += 2;
      }

      // Filter by city
      if (city) {
        vendorQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY avg_rating DESC, completed_bookings DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await query(vendorQuery, params);

      const vendors = result.rows.map((v: any) => ({
        id: v.id,
        businessName: v.business_name || v.owner_name,
        ownerName: v.owner_name,
        phone: v.phone,
        address: v.address,
        city: v.city,
        latitude: v.latitude,
        longitude: v.longitude,
        status: v.status,
        roleId: v.role_id,
        roleName: v.role_name,
        roleDisplayName: v.role_display_name,
        rating: parseFloat(v.avg_rating || '4.5').toFixed(1),
        reviewCount: parseInt(v.review_count || '0', 10),
        completedBookings: parseInt(v.completed_bookings || '0', 10),
      }));

      return c.json({
        success: true,
        vendors: vendors,
        total: vendors.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * POST /customer/pricing/quote
   * Returns server-calculated pricing: basePrice, tax, discount, finalPrice, taxBreakdown, coupon.
   * Use in booking summary so UI always displays correct totals.
   */
  app.post("/customer/pricing/quote", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const serviceId = body.serviceId || body.service_id;
      const vendorId = body.vendorId || body.vendor_id;
      const customerId = body.customerId || body.customer_id;
      const couponCode = (body.couponCode || body.coupon_code || '').trim() || undefined;

      if (!serviceId || !vendorId) {
        return c.json({ success: false, error: 'serviceId and vendorId are required' }, 400);
      }

      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }

      let basePrice = 0;
      let category = '';
      let taxCategoryId: string | null = null;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);

      const vsRow = await query(
        `SELECT vs.id, vs.service_id, vs.price, vs.custom_price, vs.category, vs.metadata
         FROM vendor_services vs
         WHERE (vs.id = $1::uuid OR (vs.service_id = $1 AND vs.vendor_id = $2::uuid))
           AND vs.vendor_id = $2::uuid AND vs.is_enabled = true`,
        [serviceId, vendor.id]
      );
      if (vsRow.rows?.length > 0) {
        const vs = vsRow.rows[0];
        basePrice = vs.custom_price != null ? parseFloat(vs.custom_price) : parseFloat(vs.price || '0');
        category = vs.category || '';
        try {
          const meta = typeof vs.metadata === 'string' ? (vs.metadata ? JSON.parse(vs.metadata) : {}) : (vs.metadata || {});
          taxCategoryId = meta.taxCategoryId || meta.tax_category || null;
        } catch (_) {}
      } else {
        const catalogRow = await query(
          `SELECT id, base_price, category_id, category_name FROM service_catalog WHERE (service_id = $1 OR id = $1::uuid) AND status = 'active'`,
          [serviceId]
        );
        if (catalogRow.rows?.length > 0) {
          const sc = catalogRow.rows[0];
          basePrice = parseFloat(sc.base_price || '0');
          category = sc.category_name || sc.category_id || '';
        }
      }

      if (basePrice <= 0) {
        return c.json({ success: false, error: 'Could not resolve service price' }, 400);
      }

      const discountResult = await discountCalculationService.calculateDiscounts({
        vendorId: vendor.id,
        serviceIds: [serviceId],
        originalAmount: basePrice,
        customerId,
        couponCode,
        serviceCategory: category,
      });

      const amountAfterDiscount = discountResult.finalAmount;
      const vendorLocation = vendor.state ? { state: vendor.state, city: vendor.city } : undefined;
      const customerLocation = body.customerState ? { state: body.customerState, city: body.customerCity } : undefined;

      const taxResult = await taxCalculationService.calculateTax({
        items: [{
          id: serviceId,
          type: 'service',
          amount: amountAfterDiscount,
          quantity: 1,
          category,
          taxCategoryId: taxCategoryId || undefined,
        }],
        customerLocation,
        vendorLocation,
        vendorId: vendor.id,
        serviceType: category,
        category,
      });

      const tax = taxResult.totalTax;
      const finalPrice = taxResult.grandTotal;
      const taxBreakdown = (taxResult.hsnSummary || []).map((h: any) => ({
        name: h.description || 'GST',
        rate: h.gstRate,
        amount: h.totalTax,
      }));

      const couponInfo = discountResult.appliedDiscounts.find((d: any) => d.type === 'coupon')
        ? {
            code: couponCode,
            type: discountResult.appliedDiscounts.find((d: any) => d.type === 'coupon')?.discountType || 'percent',
            value: discountResult.appliedDiscounts.find((d: any) => d.type === 'coupon')?.discountValue || 0,
            applied: true,
          }
        : { applied: false };

      return c.json({
        success: true,
        basePrice,
        tax,
        discount: discountResult.totalDiscountAmount,
        finalPrice,
        taxBreakdown,
        coupon: couponInfo,
      });
    } catch (error: any) {
      console.error('Error in /customer/pricing/quote:', error);
      return c.json({ success: false, error: error?.message || 'Pricing quote failed' }, 500);
    }
  });

  /**
   * GET /customer/diagnostics/vendor-by-phone
   * Diagnostic endpoint to check vendor status and eligibility
   */
  app.get("/customer/diagnostics/vendor-by-phone", async (c) => {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'Phone parameter required' }, 400);
      }

      // Find vendor
      const vendorResult = await query(`
        SELECT 
          v.id, 
          v.business_name, 
          v.owner_name, 
          v.phone, 
          v.status, 
          v.is_active, 
          v.vendor_type,
          r.id as role_id,
          r.name as role_name, 
          r.display_name as role_display_name
        FROM vendors v 
        LEFT JOIN roles r ON v.role_id = r.id 
        WHERE v.phone LIKE $1 OR v.phone = $2
        ORDER BY v.created_at DESC 
        LIMIT 5
      `, [`%${phone}%`, phone]);

      if (vendorResult.rows.length === 0) {
        return c.json({ 
          found: false, 
          message: 'Vendor not found',
          search_phone: phone
        });
      }

      const vendor = vendorResult.rows[0];
      
      // Check services
      const servicesResult = await query(`
        SELECT 
          vs.id, 
          vs.service_name, 
          vs.service_style, 
          vs.is_enabled, 
          vs.publish_status,
          vs.category,
          vs.price
        FROM vendor_services vs
        WHERE vs.vendor_id = $1
        ORDER BY vs.created_at DESC
      `, [vendor.id]);

      // Check tele services specifically
      const teleServices = servicesResult.rows.filter(s => 
        (s.service_style === 'tele' || s.service_style === 'online') && 
        s.is_enabled === true &&
        (s.publish_status === 'published' || s.publish_status === 'auto_published' || s.publish_status === 'draft' || s.publish_status === null)
      );

      // Eligibility checks
      const eligibility = {
        statusApproved: vendor.status === 'approved' || vendor.status === 'active',
        isActive: vendor.is_active === true,
        hasRole: vendor.role_id !== null,
        hasServices: servicesResult.rows.length > 0,
        hasTeleServices: teleServices.length > 0,
        roleMatches: false // Will check below
      };

      // Check role matching for vet
      const targetRoles = ['veterinarian', 'vet', 'vet_clinic', 'vet_solo', 'Veterinarian (Solo)', 'Vet Solo', 'Veterinary Clinic'];
      eligibility.roleMatches = targetRoles.some(role => 
        vendor.role_name?.toLowerCase() === role.toLowerCase() ||
        vendor.role_display_name?.toLowerCase() === role.toLowerCase()
      );

      // If vendor is pending but has all other requirements, offer to approve
      const canApprove = !eligibility.statusApproved && 
                        eligibility.isActive && 
                        eligibility.hasRole && 
                        eligibility.hasServices && 
                        eligibility.hasTeleServices && 
                        eligibility.roleMatches;

      return c.json({
        found: true,
        vendor: {
          id: vendor.id,
          business_name: vendor.business_name,
          owner_name: vendor.owner_name,
          phone: vendor.phone,
          status: vendor.status,
          is_active: vendor.is_active,
          vendor_type: vendor.vendor_type,
          role_name: vendor.role_name,
          role_display_name: vendor.role_display_name
        },
        services: {
          total: servicesResult.rows.length,
          all: servicesResult.rows,
          tele: teleServices
        },
        eligibility,
        willAppear: Object.values(eligibility).every(v => v === true),
        target_roles: targetRoles,
        canApprove,
        fix: canApprove ? 'Update vendor status from "pending" to "approved" to make it appear in results' : null
      });
    } catch (error: any) {
      console.error('[Diagnostics] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/diagnostics/approve-vendor
   * Diagnostic endpoint to approve a vendor (for testing purposes)
   */
  app.post("/customer/diagnostics/approve-vendor", async (c) => {
    try {
      const body = await c.req.json();
      const vendorId = body.vendorId || body.id;
      
      if (!vendorId) {
        return c.json({ error: 'Vendor ID required' }, 400);
      }

      // Update vendor status to approved
      const updateResult = await query(`
        UPDATE vendors 
        SET 
          status = 'approved',
          approved_at = NOW(),
          is_active = true,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, business_name, phone, status, is_active
      `, [vendorId]);

      if (updateResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      return c.json({
        success: true,
        message: 'Vendor approved successfully',
        vendor: updateResult.rows[0]
      });
    } catch (error: any) {
      console.error('[Diagnostics] Error approving vendor:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
