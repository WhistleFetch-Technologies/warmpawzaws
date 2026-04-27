/**
 * ============================================================================
 * VENDOR SERVICES MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor service management:
 * - Get vendor services (by style)
 * - Add/update/delete services
 * - Enable/disable services
 * - Custom service creation
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { select, insert, update, query } from '../../../database/rds-connection';
import { checkVendorCapability } from '../../../middleware/capability-enforcement';
import { extractEntityIds, normalizeDbRow, buildVendorResponse } from '../../../utils/entity-extractor';
import { isValidUUID, normalizeVendorService } from '../../../types/entities';
import { resolveVendorById } from './vendorProfile.vendor';

// ----------------------------------------------------------------------------
// Category normalization helpers
// ----------------------------------------------------------------------------
const isUuid = (s?: string) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

/** Normalize catalog slug for comparison (service_categories.category_id uses kebab-case). */
function normalizeCatalogCategoryKey(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

async function resolveCategory(dbQuery: typeof query, raw?: string | null) {
  let category_id: string | null = null;
  let category_text: string | null = null;

  const key = (raw || '').trim();
  if (!key) return { category_id, category_text };

  if (isUuid(key)) {
    const res = await dbQuery(
      `SELECT id, name, category_id AS slug
       FROM service_categories
       WHERE id = $1::uuid
         AND (is_active = true OR is_active IS NULL)
       LIMIT 1`,
      [key]
    ).catch(() => ({ rows: [] }));
    const row = res.rows?.[0];
    if (!row?.id) {
      return { category_id: null, category_text: null };
    }
    category_id = row.id;
    const rawName = row.name != null ? String(row.name).trim() : '';
    const rawSlug = row.slug != null ? String(row.slug).trim() : '';
    category_text = rawName || rawSlug || null;
    return { category_id, category_text };
  }

  const slugNorm = normalizeCatalogCategoryKey(key);

  const res = await dbQuery(
    `SELECT id, name
     FROM service_categories
     WHERE (is_active = true OR is_active IS NULL)
       AND (
         (category_id IS NOT NULL AND LOWER(REPLACE(REPLACE(TRIM(category_id), '_', '-'), ' ', '-')) = $1)
         OR LOWER(TRIM(COALESCE(name, ''))) = LOWER(TRIM($2))
       )
     ORDER BY CASE
       WHEN category_id IS NOT NULL AND LOWER(REPLACE(REPLACE(TRIM(category_id), '_', '-'), ' ', '-')) = $1 THEN 0
       ELSE 1
     END
     LIMIT 1`,
    [slugNorm, key]
  ).catch(() => ({ rows: [] }));

  const row = res.rows?.[0];
  if (row?.id) {
    category_id = row.id;
    category_text = (row.name && String(row.name).trim()) || key;
  } else {
    category_text = key;
  }

  return { category_id, category_text };
}

/**
 * Map role IDs/names to service catalog applicable_roles (must match service-catalog.ts)
 * So vendor service management discovers catalog services for the vendor's role.
 */
const roleMappings: Record<string, string[]> = {
  // ✅ FIX: Healthcare roles with clinic services
  'veterinarian': ['vet', 'veterinarian', 'vet_clinic', 'vet_solo'],
  'vet_solo': ['vet', 'veterinarian', 'vet_clinic', 'vet_solo', 'solo_vet'],
  'veterinary_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'veterinarian'],
  'vet_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'veterinarian', 'vet_solo'],
  'diagnostics_center': ['diagnostics_center', 'vet_clinic', 'veterinarian'],

  // ✅ FIX: Nutritionist should ONLY see nutrition services, NOT vet services
  'nutritionist': ['nutritionist', 'pet_nutritionist'],
  'nutritionist_center': ['nutritionist', 'pet_nutritionist', 'nutritionist_center'],

  'pet_pharmacy': ['pharmacy', 'pet_pharmacy'],
  'pet_ambulance': ['ambulance', 'pet_ambulance'],
  'ambulance': ['ambulance', 'pet_ambulance'],
  'pharmacy': ['pharmacy', 'pet_pharmacy'],
  'insurance': ['insurance', 'pet_insurance'],
  'center': ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'center'],
  'testing_center': ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'testing_center', 'center'],
  'clinic': ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'clinic'],
  'pet_groomer': ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
  'groomer_center': ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
  'groomer_solo': ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
  'pet_walker': ['walker', 'pet_walker', 'dog_walker'],
  'walker': ['walker', 'pet_walker', 'dog_walker'],
  'pet_trainer': ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  'trainer_center': ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  'trainer_solo': ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  'pet_behaviorist': ['behaviorist', 'pet_behaviorist', 'behaviorist_solo', 'behaviorist_center'],
  'behaviorist_solo': ['behaviorist_solo', 'pet_behaviorist', 'behaviorist'],
  'behaviorist_center': ['behaviorist_center', 'pet_behaviorist', 'behaviorist'],
  'pet_sitter': ['sitter', 'pet_sitter'],
  'sitter': ['sitter', 'pet_sitter'],
  'pet_taxi': ['transport', 'pet_transport', 'pet_taxi', 'relocation'],
  'relocation': ['pet_transport', 'relocation', 'pet_relocation'],
  'pet_boarding': ['boarding', 'pet_boarder', 'pet_hotel', 'pet_boarding', 'pet_daycare'],
  'boarding': ['boarding', 'pet_boarder', 'pet_daycare', 'pet_sitter'],
  'pet_resort': ['resort', 'pet_resort'],
  'resort': ['resort', 'pet_resort'],
  'pet_cafe': ['cafe', 'pet_cafe'],
  'cafe': ['cafe', 'pet_cafe'],
  'pet_photographer': ['photographer', 'pet_photographer'],
  'photographer': ['photographer', 'pet_photographer'],
  'pet_sunset_services': ['sunset', 'pet_sunset_services', 'sunset_services'],
  'sunset': ['sunset', 'pet_sunset_services'],
  'holiday': ['holiday'],
  'pet_products_store': ['store', 'pet_store', 'retailer', 'seller', 'pet_products_store'],
  'seller': ['store', 'pet_store', 'seller', 'pet_products_store'],
  'pet_breeder': ['breeder', 'pet_breeder'],
  'breeder': ['breeder', 'pet_breeder'],
  'pet_shelter': ['shelter', 'pet_shelter', 'adoption_center', 'pet_adoption_center'],
  'adoption_center': ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
  'event_organizer': ['pet_event_organizer', 'event_organizer'],
};

/**
 * Resolve request vendorId to actual vendor id (vendors table).
 * Uses shared resolveVendorById so identity id, application id, vendor_id fallbacks and
 * auto-create work for both new and existing vendors.
 * Returns null when vendor cannot be resolved (not found or not approved).
 */
async function resolveVendorId(paramVendorId: string): Promise<string | null> {
  const trimmed = (paramVendorId || '').trim();
  if (!trimmed) return null;
  const vendor = await resolveVendorById(trimmed);
  if (vendor?.id) {
    if (vendor.id !== trimmed) {
      console.log(`[VendorServices] Resolved vendorId ${trimmed} to actual vendor ${vendor.id}`);
    }
    return vendor.id;
  }
  return null;
}

export function registerVendorServicesEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/services
   * Get all services for a vendor (grouped by style)
   * ✅ CRITICAL: Includes role, capabilities, and allowed service styles (DB query - no frontend dependency)
   */
  app.get("/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      if (!(paramVendorId || '').trim()) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const customOnly = c.req.query('custom') === 'true'; // ✅ Support custom=true filter

      // Handle test IDs - return empty services
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          services: [],
          total: 0,
        });
      }

      // ✅ If custom=true, return only custom services (different response format)
      if (customOnly) {
        const customServices = await query(
          `SELECT vs.*, s.name as base_service_name, s.description as base_description
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
           AND vs.is_custom_service = true
           ORDER BY vs.created_at DESC`,
          [vendorId]
        );

        const formattedServices = customServices.rows.map((s: any) => ({
          id: s.id,
          serviceId: s.service_id,
          serviceName: s.service_name || s.base_service_name,
          name: s.service_name || s.base_service_name,
          description: s.custom_description || s.description || s.base_description,
          categoryName: s.category,
          subCategoryName: s.sub_category,
          price: parseFloat(s.price || s.custom_price || '0'),
          duration: s.duration_minutes || s.custom_duration || 30,
          serviceStyle: s.service_style,
          publishStatus: s.publish_status,
          isEnabled: s.is_enabled,
          isCustomService: true,
          isPackage: s.metadata?.isPackage || false,
          packageDetails: s.metadata?.packageDetails,
          submittedForApprovalAt: s.submitted_for_approval_at,
          rejectionReason: s.rejection_reason,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }));

        return c.json({
          success: true,
          services: formattedServices,
          total: formattedServices.length,
        });
      }

      // ✅ CRITICAL: Get vendor with role and capabilities from DB (no frontend dependency)
      let vendors: any[] = [];
      try {
        vendors = await select('vendors', { id: vendorId });
      } catch (selectError: any) {
        // Handle table not existing or other DB errors gracefully
        console.error(`[Vendor Services] DB error looking up vendor ${vendorId}:`, selectError.message);
        if (selectError.message?.includes('does not exist') || selectError.message?.includes('relation')) {
          // Table doesn't exist - return empty services
          return c.json({
            success: true,
            services: [],
            servicesByStyle: {
              at_home: { services: [], count: 0 },
              at_center: { services: [], count: 0 },
              tele: { services: [], count: 0 },
            },
            total: 0,
            role: null,
            capabilities: [],
            allowedServiceStyles: ['at_home', 'at_center', 'tele'],
            _note: 'Database not fully configured',
          });
        }
        // For other errors, return a graceful empty response instead of 500
        return c.json({
          success: false,
          error: 'Failed to load vendor data',
          services: [],
          total: 0,
        }, 500);
      }

      if (vendors.length === 0) {
        // Return empty services gracefully for approved vendors without vendors table entry
        console.log(`[Vendor Services] Vendor ${vendorId} not found in vendors table, returning empty services`);
        return c.json({
          success: true,
          services: [],
          servicesByStyle: {
            at_home: { services: [], count: 0 },
            at_center: { services: [], count: 0 },
            tele: { services: [], count: 0 },
          },
          total: 0,
          role: null,
          capabilities: [],
          allowedServiceStyles: ['at_home', 'at_center', 'tele'],
        });
      }
      const vendor = vendors[0];

      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      // ✅ FIX: Start with empty array, derive from role config or role name
      let allowedServiceStyles: string[] = [];

      // ✅ NEW: Role-based service style rules (must match role-seeding.ts)
      // Used as fallback when role config is missing or empty
      const ROLE_SERVICE_STYLES: Record<string, string[]> = {
        'pet_groomer': ['at_center', 'at_home'], // NO tele
        'groomer': ['at_center', 'at_home'],
        'groomer_solo': ['at_home'], // Solo groomers only do home visits
        'groomer_center': ['at_center', 'at_home'],
        'pet_walker': ['at_home'], // Walkers only do home visits
        'walker': ['at_home'],
        'dog_walker': ['at_home'],
        'pet_trainer': ['at_home', 'at_center', 'tele'], // Trainers: center, home, online
        'trainer': ['at_home', 'at_center', 'tele'],
        'trainer_center': ['at_home', 'at_center', 'tele'], // Training center: both center and home
        'training_center': ['at_home', 'at_center', 'tele'],
        'trainer_solo': ['at_home', 'tele'], // Solo trainer: home + online only
        'pet_sitter': ['at_home'],
        'sitter': ['at_home'],
        'pet_taxi': ['at_home'],
        'pet_boarding': ['at_center'],
        'pet_resort': ['at_center'],
        'pet_cafe': ['at_center'],
        'veterinarian': ['at_center', 'tele', 'at_home'], // Vets have tele
        'vet': ['at_center', 'tele', 'at_home'],
        'vet_solo': ['at_home', 'tele'], // Solo vets - no at_center but have tele
        'veterinary_clinic': ['at_center', 'tele', 'at_home'],
        'vet_clinic': ['at_center', 'tele', 'at_home'],
        'nutritionist': ['at_center', 'tele', 'at_home'], // Nutritionists have tele
        'pet_nutritionist': ['at_center', 'tele', 'at_home'],
        'pet_behaviorist': ['at_home', 'at_center', 'tele'],
        'behaviorist_solo': ['at_home', 'tele'], // Solo: home + tele only
        'behaviorist_center': ['at_home', 'at_center', 'tele'], // Center: all styles
        'diagnostics': ['at_home', 'at_center'],
        'diagnostic_center': ['at_home', 'at_center'], // Diagnostics center: center + home (e.g. lab, sample collection)
        'diagnostics_center': ['at_home', 'at_center'],
        'pet_pharmacy': ['delivery', 'pickup'],
        'pharmacy': ['delivery', 'pickup'],
        'pet_products_store': ['delivery', 'pickup'],
        'pet_ambulance': ['at_home'],
        'ambulance': ['at_home'],
        'pet_photographer': ['at_center', 'at_home'],
        'photographer': ['at_center', 'at_home'],
        'pet_sunset_services': ['at_center', 'at_home'],
        'sunset': ['at_center', 'at_home'],
        'event_organizer': ['at_center'],
        'insurance': ['at_center'],
        'pet_breeder': ['at_center', 'at_home'],
        'breeder': ['at_center', 'at_home'],
        'relocation': ['at_home'],
        'pet_relocation': ['at_home'],
        'resort': ['at_center'],
        'holiday': ['at_center'],
        'nutritionist_center': ['at_center', 'at_home', 'tele'],
        'adoption_center': ['at_center'],
        'pet_shelter': ['at_center'],
        'seller': ['at_center', 'delivery', 'pickup'],
      };

      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            // Support array or object with .selected / .solo (walker has { selected: ['at_home'], solo: ['at_home'] })
            const serviceStylesConfig = roleConfig?.serviceStyles || roleConfig?.service_styles;
            const rawStyles = Array.isArray(serviceStylesConfig)
              ? serviceStylesConfig
              : (serviceStylesConfig?.selected ?? serviceStylesConfig?.solo ?? []);

            // Map role config styles to database styles
            // Role config uses: at_clinic, video_consultation, home_visit
            // Database uses: at_center, at_home, tele
            const styleMapping: Record<string, string> = {
              'at_clinic': 'at_center',
              'at_center': 'at_center',
              'video_consultation': 'tele',
              'tele': 'tele',
              'home_visit': 'at_home',
              'at_home': 'at_home',
              'online': 'tele', // Map online to tele
            };

            // ✅ DYNAMIC SERVICE STYLES: Determine from multiple sources in priority order
            // Priority 1: Role config's explicit serviceStyles (most authoritative)
            // Priority 2: Role name-based defaults (fallback)
            // Priority 3: Conservative default (at_home only)

            const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
            const roleName = (role.name || '').toLowerCase().replace(/\s+/g, '_');

            // ✅ SOLO PROVIDER ROLES: These roles cannot have at_center even if role config says so
            // (they physically can't operate from a center - e.g., pet sitters, dog walkers)
            const SOLO_ONLY_ROLES = ['pet_sitter', 'sitter', 'pet_walker', 'walker', 'dog_walker', 'pet_taxi'];
            const isSoloOnlyRole = SOLO_ONLY_ROLES.includes(roleName);

            // ✅ CENTER-CAPABLE ROLES: These roles CAN operate from a center even as solo
            // (e.g., solo trainer with training facility, training center, groomer with shop)
            const CENTER_CAPABLE_SOLO_ROLES = ['pet_trainer', 'trainer', 'trainer_center', 'training_center', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
            const isCenterCapableSolo = CENTER_CAPABLE_SOLO_ROLES.includes(roleName);

            if (Array.isArray(rawStyles) && rawStyles.length > 0) {
              // Role config has explicit service styles - use them
              allowedServiceStyles = rawStyles.map((s: string) => styleMapping[s] || s);
              console.log(`[Vendor Services] Using role config serviceStyles: ${allowedServiceStyles.join(', ')}`);

              // ✅ Only filter at_center for SOLO-ONLY roles (walkers, sitters, taxi)
              // Trainers, groomers, vets who are solo CAN still have center services
              if (vendorConfiguration === 'solo' && isSoloOnlyRole && !isCenterCapableSolo) {
                allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
                console.log(`[Vendor Services] Solo-only role (${roleName}) - filtered at_center. Allowed: ${allowedServiceStyles.join(', ')}`);
              }
            } else {
              // ✅ FIX: If role config has no serviceStyles, derive from role name
              console.log(`[Vendor Services] No serviceStyles in role config, deriving from role name: ${roleName}`);
              allowedServiceStyles = ROLE_SERVICE_STYLES[roleName] || ['at_home']; // Default to at_home only

              // For derived styles, apply solo filter for non-center-capable roles
              if (vendorConfiguration === 'solo' && !isCenterCapableSolo) {
                allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
                console.log(`[Vendor Services] Solo provider (${roleName}) - filtered at_center. Allowed: ${allowedServiceStyles.join(', ')}`);
              }
            }

            // Get capabilities from DB
            try {
              const allPermissions = await query(
                `SELECT role_id, permission_name 
                 FROM role_permissions 
                 WHERE role_id = ANY($1::text[])`,
                [[vendor.role_id]]
              );
              capabilities = allPermissions.rows.map((p: any) => p.permission_name);
            } catch {
              const permissions = await select('role_permissions', { role_id: vendor.role_id });
              capabilities = permissions.map(p => p.permission_name);
            }
          } else {
            // Role ID set but role not found – default to at_home for discovery
            console.warn(`[Vendor Services] No role found for role_id ${vendor.role_id}, defaulting to at_home`);
            allowedServiceStyles = ['at_home'];
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Services] Failed to load role ${vendor.role_id}:`, roleError.message);
          // ✅ FIX: On error, default to at_home only (safest fallback)
          allowedServiceStyles = ['at_home'];
        }
      } else {
        // ✅ FIX: No role_id - use conservative default
        console.warn(`[Vendor Services] Vendor ${vendorId} has no role_id, defaulting to at_home only`);
        allowedServiceStyles = ['at_home'];
      }

      // ✅ Never leave allowedServiceStyles empty (fixes walker/services discovery)
      if (!allowedServiceStyles || allowedServiceStyles.length === 0) {
        allowedServiceStyles = ['at_home'];
        console.log(`[Vendor Services] Fallback: allowedServiceStyles set to ['at_home']`);
      }

      // ✅ DYNAMIC SERVICE STYLES: Vendor table solo check (secondary source)
      // Only filter at_center if vendor is solo AND not a center-capable role
      const vendorRoleName = role?.name?.toLowerCase().replace(/\s+/g, '_') || '';
      const vendorCenterCapableRoles = ['pet_trainer', 'trainer', 'trainer_center', 'training_center', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
      const isVendorCenterCapable = vendorCenterCapableRoles.includes(vendorRoleName);

      if ((vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo') && !isVendorCenterCapable) {
        allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
        console.log(`[Vendor Services] Solo vendor (${vendorRoleName}) - not center-capable, filtered at_center. Allowed: ${allowedServiceStyles.join(', ')}`);
      } else if (vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo') {
        console.log(`[Vendor Services] Solo vendor (${vendorRoleName}) - center-capable, keeping all styles: ${allowedServiceStyles.join(', ')}`);
      }

      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const servicesByStyle: Record<string, any> = {};

      // ✅ CRITICAL FIX: Return ALL services for the vendor, regardless of service_style
      // Services created from admin may have any service_style, and vendors should see all their services
      // The allowedServiceStyles filter is only used for validation when CREATING services, not when FETCHING
      const allServices = await query(
        `SELECT vs.*, s.name as base_service_name, s.description as base_description
         FROM vendor_services vs
         LEFT JOIN services s ON vs.service_id = s.id
         WHERE vs.vendor_id = $1
         ORDER BY vs.service_style NULLS LAST, vs.created_at DESC`,
        [vendorId]
      );

      // Group services by style
      // Services are grouped by their actual service_style, or assigned to first allowed style if NULL
      const nullStyleServices = allServices.rows.filter((s: any) => s.service_style === null || s.service_style === undefined);
      const firstAllowedStyle = allowedServiceStyles.length > 0 ? allowedServiceStyles[0] : 'at_home';

      // Initialize all service style buckets
      for (const style of serviceStyles) {
        servicesByStyle[style] = { services: [], count: 0 };
      }

      // Group services by their service_style
      for (const service of allServices.rows) {
        const serviceStyle = service.service_style || firstAllowedStyle; // Use first allowed style as fallback for NULL

        // Only add to the style bucket if it's a valid service style
        if (serviceStyles.includes(serviceStyle)) {
          if (!servicesByStyle[serviceStyle]) {
            servicesByStyle[serviceStyle] = { services: [], count: 0 };
          }

          servicesByStyle[serviceStyle].services.push({
            id: service.id,
            serviceId: service.service_id,
            serviceName: service.service_name || service.base_service_name,
            name: service.service_name || service.base_service_name,
            description: service.description || service.base_description,
            category: service.category,
            subCategory: service.sub_category,
            price: parseFloat(service.price || service.custom_price || '0'),
            duration: service.duration_minutes || service.custom_duration || 30,
            serviceStyle: service.service_style || serviceStyle, // Use actual style or fallback
            publishStatus: service.publish_status,
            isEnabled: service.is_enabled,
            isCustomService: service.is_custom_service || false,
            metadata: service.metadata || {},
            createdAt: service.created_at,
            updatedAt: service.updated_at,
          });
        }
      }

      // Update counts for each style
      for (const style of serviceStyles) {
        if (servicesByStyle[style]) {
          servicesByStyle[style].count = servicesByStyle[style].services.length;
        }
      }

      // Phase 2: Main list only allowed styles; disallowed (e.g. legacy at_center for Walker) in separate bucket.
      const flattenedServices = allowedServiceStyles.length > 0
        ? (allowedServiceStyles.flatMap((style: string) => servicesByStyle[style]?.services ?? []))
        : Object.values(servicesByStyle).flatMap((style: any) => style.services);
      const disallowedLegacy = allowedServiceStyles.length > 0
        ? (serviceStyles.filter((s: string) => !allowedServiceStyles.includes(s)).flatMap((style: string) => servicesByStyle[style]?.services ?? []))
        : [];

      return c.json({
        success: true,
        services: flattenedServices,
        servicesByStyle,
        allServices: flattenedServices,
        disallowedLegacy,
        totalEnabled: flattenedServices.length,
        vendor: {
          id: vendor.id,
          role_id: vendor.role_id,
          vendor_type: vendor.vendor_type,
        },
        role: role ? {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          config: roleConfig,
        } : null,
        capabilities,
        allowedServiceStyles,
        vendorTypes: roleConfig?.vendorTypes || [],
      });
    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/services/enabled
   * Get all enabled services for a vendor (across all service styles)
   * IMPORTANT: Must be registered BEFORE the generic :serviceStyle route
   */
  app.get("/vendor/:vendorId/services/enabled", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      console.log(`[VendorServices] Fetching enabled services for vendor ${vendorId}...`);

      // Get all enabled services for this vendor
      const result = await query(
        `SELECT 
          vs.id,
          vs.service_id,
          vs.service_name,
          vs.category,
          vs.sub_category,
          vs.service_style,
          vs.price,
          vs.custom_price,
          vs.duration_minutes,
          vs.custom_duration,
          vs.is_enabled,
          vs.publish_status,
          vs.is_custom_service,
          vs.created_at,
          vs.updated_at
        FROM vendor_services vs
        WHERE vs.vendor_id = $1
          AND vs.is_enabled = true
          AND (vs.publish_status = 'published' OR vs.publish_status IS NULL)
        ORDER BY vs.category, vs.service_name`,
        [vendorId]
      );

      const services = result.rows.map((row: any) => ({
        id: row.id,
        serviceId: row.service_id,
        serviceName: row.service_name,
        category: row.category,
        subCategory: row.sub_category,
        serviceStyle: row.service_style,
        price: row.price,
        customPrice: row.custom_price,
        duration: row.duration_minutes,
        customDuration: row.custom_duration,
        isEnabled: row.is_enabled,
        publishStatus: row.publish_status,
        isCustomService: row.is_custom_service,
      }));

      console.log(`[VendorServices] Found ${services.length} enabled services for vendor ${vendorId}`);

      return c.json({
        success: true,
        services,
        total: services.length,
      });
    } catch (error: any) {
      console.error('Error fetching enabled services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/services/:serviceStyle
   * Get services for a specific style
   * ✅ FIX: Validate service style against vendor's allowed styles (solo providers can't use at_center)
   */
  app.get("/vendor/:vendorId/services/:serviceStyle", async (c) => {
    try {
      const { vendorId: paramVendorId, serviceStyle } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      if (!['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'Invalid service style' }, 400);
      }

      // ✅ FIX: Check vendor's role config to validate allowed service styles
      let vendors: any[] = [];
      try {
        vendors = await select('vendors', { id: vendorId });
      } catch (selectError: any) {
        console.error(`[Vendor Services] DB error looking up vendor ${vendorId}:`, selectError.message);
        return c.json({
          success: false,
          error: 'Failed to load vendor data',
          services: [],
          total: 0,
        }, 500);
      }

      if (vendors.length === 0) {
        return c.json({
          success: true,
          services: [],
          total: 0,
        });
      }

      const vendor = vendors[0];
      // ✅ FIX: Start with empty array, derive from role config or role name
      let allowedServiceStyles: string[] = [];

      // Get role config to check allowed service styles
      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            const role = roles[0];
            const roleConfig = role.config || {};
            const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
            const roleName = (role.name || '').toLowerCase().replace(/\s+/g, '_');

            // ✅ DYNAMIC SERVICE STYLES: Center-capable solo roles
            const CENTER_CAPABLE_SOLO_ROLES = ['pet_trainer', 'trainer', 'trainer_center', 'training_center', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
            const isCenterCapableSolo = CENTER_CAPABLE_SOLO_ROLES.includes(roleName);

            // ✅ Only block at_center for solo providers who are NOT center-capable
            if (vendorConfiguration === 'solo' && serviceStyle === 'at_center' && !isCenterCapableSolo) {
              return c.json({
                success: false,
                error: 'Solo providers of this type cannot use "at_center" service style. Only "at_home" and "tele" (if applicable) are allowed.',
                services: [],
                total: 0,
              }, 400);
            }

            // Support array or object with .selected / .solo (walker has { selected: ['at_home'], solo: ['at_home'] })
            const serviceStylesConfigPost = roleConfig?.serviceStyles || roleConfig?.service_styles;
            const rawStyles = Array.isArray(serviceStylesConfigPost)
              ? serviceStylesConfigPost
              : (serviceStylesConfigPost?.selected ?? serviceStylesConfigPost?.solo ?? []);

            // Map role config styles to database styles
            const styleMapping: Record<string, string> = {
              'at_clinic': 'at_center',
              'at_center': 'at_center',
              'video_consultation': 'tele',
              'tele': 'tele',
              'home_visit': 'at_home',
              'at_home': 'at_home',
              'online': 'tele',
            };

            // ✅ SOLO-ONLY ROLES: These cannot have at_center even with role config
            const SOLO_ONLY_ROLES = ['pet_sitter', 'sitter', 'pet_walker', 'walker', 'dog_walker', 'pet_taxi'];
            const isSoloOnlyRole = SOLO_ONLY_ROLES.includes(roleName);

            if (Array.isArray(rawStyles) && rawStyles.length > 0) {
              allowedServiceStyles = rawStyles.map((s: string) => styleMapping[s] || s);
              console.log(`[Vendor Services POST] Using role config serviceStyles: ${allowedServiceStyles.join(', ')}`);

              // Only filter at_center for solo-only roles
              if (vendorConfiguration === 'solo' && isSoloOnlyRole && !isCenterCapableSolo) {
                allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
                console.log(`[Vendor Services POST] Solo-only role - filtered at_center: ${allowedServiceStyles.join(', ')}`);
              }
            } else {
              // ✅ FIX: Derive from role name if config is empty (must match GET handler and role-seeding.ts)
              const ROLE_SERVICE_STYLES: Record<string, string[]> = {
                'pet_groomer': ['at_center', 'at_home'],
                'groomer': ['at_center', 'at_home'],
                'groomer_solo': ['at_home'],
                'groomer_center': ['at_center', 'at_home'],
                'pet_walker': ['at_home'],
                'walker': ['at_home'],
                'dog_walker': ['at_home'],
                'pet_trainer': ['at_home', 'at_center', 'tele'],
                'trainer': ['at_home', 'at_center', 'tele'],
                'trainer_center': ['at_home', 'at_center', 'tele'],
                'training_center': ['at_home', 'at_center', 'tele'],
                'trainer_solo': ['at_home', 'tele'],
                'pet_sitter': ['at_home'],
                'sitter': ['at_home'],
                'pet_taxi': ['at_home'],
                'pet_boarding': ['at_center'],
                'pet_resort': ['at_center'],
                'pet_cafe': ['at_center'],
                'veterinarian': ['at_center', 'tele', 'at_home'],
                'vet': ['at_center', 'tele', 'at_home'],
                'vet_solo': ['at_home', 'tele'],
                'veterinary_clinic': ['at_center', 'tele', 'at_home'],
                'vet_clinic': ['at_center', 'tele', 'at_home'],
                'nutritionist': ['at_center', 'tele', 'at_home'],
                'pet_nutritionist': ['at_center', 'tele', 'at_home'],
                'nutritionist_center': ['at_center', 'at_home', 'tele'],
                'pet_behaviorist': ['at_home', 'at_center', 'tele'],
                'behaviorist_solo': ['at_home', 'tele'],
                'behaviorist_center': ['at_home', 'at_center', 'tele'],
                'diagnostics': ['at_home', 'at_center'],
                'diagnostic_center': ['at_home', 'at_center'],
                'diagnostics_center': ['at_home', 'at_center'],
                'pet_pharmacy': ['delivery', 'pickup'],
                'pharmacy': ['delivery', 'pickup'],
                'pet_products_store': ['delivery', 'pickup'],
                'pet_ambulance': ['at_home'],
                'ambulance': ['at_home'],
                'pet_photographer': ['at_center', 'at_home'],
                'photographer': ['at_center', 'at_home'],
                'pet_sunset_services': ['at_center', 'at_home'],
                'sunset': ['at_center', 'at_home'],
                'event_organizer': ['at_center'],
                'insurance': ['at_center'],
                'pet_breeder': ['at_center', 'at_home'],
                'breeder': ['at_center', 'at_home'],
                'relocation': ['at_home'],
                'pet_relocation': ['at_home'],
                'resort': ['at_center'],
                'holiday': ['at_center'],
                'adoption_center': ['at_center'],
                'pet_shelter': ['at_center'],
                'seller': ['at_center', 'delivery', 'pickup'],
              };
              allowedServiceStyles = ROLE_SERVICE_STYLES[roleName] || ['at_home'];
              console.log(`[Vendor Services POST] Derived from role name ${roleName}: ${allowedServiceStyles.join(', ')}`);

              // For derived styles, apply solo filter for non-center-capable roles
              if (vendorConfiguration === 'solo' && !isCenterCapableSolo) {
                allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
                console.log(`[Vendor Services POST] Solo provider - filtered at_center: ${allowedServiceStyles.join(', ')}`);
              }
            }
          } else {
            // Role ID set but role not found (e.g. deleted) – allow at_home so walker/solo discovery works
            console.warn(`[Vendor Services] No role found for role_id ${vendor.role_id}, defaulting to at_home`);
            allowedServiceStyles = ['at_home'];
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Services] Failed to load role ${vendor.role_id}:`, roleError.message);
          allowedServiceStyles = ['at_home']; // Conservative default on error
        }
      } else {
        console.warn(`[Vendor Services] Vendor has no role_id, defaulting to at_home only`);
        allowedServiceStyles = ['at_home'];
      }

      // ✅ Never leave allowedServiceStyles empty (fixes "Allowed styles: " for walkers)
      if (!allowedServiceStyles || allowedServiceStyles.length === 0) {
        allowedServiceStyles = ['at_home'];
        console.log(`[Vendor Services] Fallback: allowedServiceStyles set to ['at_home']`);
      }

      // ✅ DYNAMIC SERVICE STYLES: Vendor table solo check (secondary source)
      // Get role name for center-capable check
      let vendorRoleNamePost = '';
      try {
        if (vendor.role_id) {
          const rolesForCheck = await select('roles', { id: vendor.role_id });
          if (rolesForCheck.length > 0) {
            vendorRoleNamePost = (rolesForCheck[0].name || '').toLowerCase().replace(/\s+/g, '_');
          }
        }
      } catch (e) {
        // Ignore error, use empty role name
      }

      const vendorCenterCapableRolesPost = ['pet_trainer', 'trainer', 'trainer_center', 'training_center', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
      const isVendorCenterCapablePost = vendorCenterCapableRolesPost.includes(vendorRoleNamePost);

      if ((vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo' || vendor.vendor_type === 'solo') && !isVendorCenterCapablePost) {
        allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
        console.log(`[Vendor Services POST] Solo vendor (${vendorRoleNamePost}) - not center-capable, filtered: ${allowedServiceStyles.join(', ')}`);
      } else if (vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo' || vendor.vendor_type === 'solo') {
        console.log(`[Vendor Services POST] Solo vendor (${vendorRoleNamePost}) - center-capable, keeping all: ${allowedServiceStyles.join(', ')}`);
      }

      // ✅ Validate that the requested service style is allowed
      if (!allowedServiceStyles.includes(serviceStyle)) {
        return c.json({
          success: false,
          error: `Service style "${serviceStyle}" is not allowed for this vendor. Allowed styles: ${allowedServiceStyles.join(', ')}`,
          services: [],
          total: 0,
        }, 400);
      }

      // ✅ FIX: Return ALL services (enabled and disabled) for management
      // Remove is_enabled filter so vendors can see and manage all their services
      // ✅ CRITICAL FIX: Include services with NULL service_style (created from admin without style)
      // Note: serviceStyle is already validated above, so all returned services will match allowed styles
      const services = await query(
        `SELECT vs.*, s.name as base_service_name, s.description as base_description
         FROM vendor_services vs
         LEFT JOIN services s ON vs.service_id = s.id
         WHERE vs.vendor_id = $1
         AND (vs.service_style = $2 OR vs.service_style IS NULL)
         ORDER BY vs.created_at DESC`,
        [vendorId, serviceStyle]
      );

      // ✅ NEW: Also get available services from service_catalog for this style and role
      // This helps vendors see what services they can add
      let availableCatalogServices: any[] = [];
      try {
        if (vendor.role_id) {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            const role = roles[0];
            const roleConfig = role.config || {};
            const roleNameNorm = role.name?.toLowerCase().replace(/\s+/g, '_');
            const acceptableRoles = [
              role.name,
              role.id,
              role.display_name,
              ...(roleMappings[role.name] || []),
              ...(roleNameNorm ? (roleMappings[roleNameNorm] || []) : []),
              role.name?.toLowerCase(),
              roleNameNorm,
            ].filter(Boolean);
            const uniqueRoles = [...new Set(acceptableRoles)];

            // Query service_catalog for available services: STRICT - only services that have
            // applicable_roles set and overlapping with vendor role; service_style must match.
            const catalogQuery = await query(
              `SELECT sc.* 
               FROM service_catalog sc
               WHERE sc.status = 'active'
               AND (sc.publish_status = 'published' OR sc.publish_status IS NULL)
               AND sc.service_style = $1
               AND array_length(sc.applicable_roles, 1) > 0
               AND sc.applicable_roles && $2::text[]
               ORDER BY sc.category_name ASC, sc.service_name ASC
               LIMIT 100`,
              [serviceStyle, uniqueRoles]
            );
            availableCatalogServices = catalogQuery.rows || [];
            console.log(`[Vendor Services] Found ${availableCatalogServices.length} available ${serviceStyle} services in catalog for role ${role.name}`);
          }
        }
      } catch (catalogError: any) {
        console.warn(`[Vendor Services] Failed to load catalog services:`, catalogError.message);
        // Don't fail the request if catalog query fails
      }

      return c.json({
        success: true,
        services: services.rows,
        total: services.rows.length,
        allowedServiceStyles, // ✅ Include in response so frontend knows what's allowed
        availableCatalogServices, // ✅ NEW: Include available services from catalog
        availableCatalogCount: availableCatalogServices.length, // ✅ NEW: Count of available services
      });
    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services
   * Add a service to vendor catalog
   * Requires 'services' capability
   */
  app.post("/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const trimmedId = (paramVendorId || '').trim();
      if (!trimmedId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Resolve vendor (identity id, application id, or vendors.id) so new and existing vendors work
      const vendor = await resolveVendorById(trimmedId);
      if (!vendor?.id) {
        return c.json({ error: 'Vendor identity not found' }, 404);
      }
      const actualVendorId = vendor.id;

      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(actualVendorId, 'services') ||
        await checkVendorCapability(actualVendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      const serviceData = await c.req.json();
      const {
        serviceId,
        catalogId, // Also accept catalogId from service_catalog
        serviceStyle,
        serviceName, // Accept service name for catalog items
        categoryName, // Accept category name for catalog items
        customPrice,
        customDuration,
        basePrice,
        duration,
        isEnabled,
        publishStatus,
        isCustomService,
        description,
        // PHASE 1.1: Missing Features
        serviceRadius, // Service radius in km (for at_home)
        queueConfig, // Queue configuration JSON (for tele)
      } = serviceData;

      // Support both serviceId and catalogId
      const inputServiceId = serviceId || catalogId;

      if (!inputServiceId || !serviceStyle) {
        return c.json({ error: 'serviceId and serviceStyle are required' }, 400);
      }

      // ✅ PHASE 0.4: Validate serviceStyle against role configuration
      // Get vendor with role to check allowed service styles (vendor already resolved above)
      const vendorForValidation: any[] = vendor ? [vendor] : await select('vendors', { id: actualVendorId });

      if (vendorForValidation.length > 0 && vendorForValidation[0].role_id) {
        try {
          const roles = await select('roles', { id: vendorForValidation[0].role_id });
          if (roles.length > 0) {
            const roleConfig = roles[0].config || {};
            const serviceStylesConfig = roleConfig?.serviceStyles || roleConfig?.service_styles;
            const rawStyles = Array.isArray(serviceStylesConfig)
              ? serviceStylesConfig
              : (serviceStylesConfig?.selected ?? serviceStylesConfig?.solo ?? []);

            // Map role config styles to database styles
            // Role config may use: at_clinic, video_consultation, home_visit, online (admin UI / role-seeding)
            // Database uses: at_center, at_home, tele
            const styleMapping: Record<string, string> = {
              'at_clinic': 'at_center',
              'at_center': 'at_center',
              'video_consultation': 'tele',
              'tele': 'tele',
              'online': 'tele', // Admin/role config often stores "online" for tele-consultation
              'home_visit': 'at_home',
              'at_home': 'at_home',
            };
            let allowedServiceStyles = Array.isArray(rawStyles) && rawStyles.length > 0
              ? rawStyles.map((s: string) => styleMapping[s] || s)
              : (() => {
                const roleName = (roles[0].name || '').toLowerCase().replace(/\s+/g, '_');
                const ROLE_STYLES: Record<string, string[]> = {
                  'pet_walker': ['at_home'], 'walker': ['at_home'], 'dog_walker': ['at_home'],
                  'pet_sitter': ['at_home'], 'sitter': ['at_home'], 'pet_taxi': ['at_home'],
                  'pet_pharmacy': ['delivery', 'pickup'], 'pet_products_store': ['delivery', 'pickup'],
                };
                return ROLE_STYLES[roleName] || ['at_home', 'at_center', 'tele'];
              })();

            // Validate serviceStyle against allowed styles
            if (!allowedServiceStyles.includes(serviceStyle)) {
              return c.json({
                error: `Service style '${serviceStyle}' is not allowed for this role. Allowed styles: ${allowedServiceStyles.join(', ')}`,
                allowedStyles: allowedServiceStyles
              }, 403);
            }

            console.log(`[VendorServices] ✅ Service style validation passed: ${serviceStyle} is allowed for vendor ${actualVendorId}`);
          }
        } catch (roleError: any) {
          console.warn(`[VendorServices] Failed to validate service style against role config:`, roleError.message);
          // Continue without validation if role config lookup fails (graceful degradation)
        }
      }

      // ✅ FIX: Determine if inputServiceId is UUID or TEXT catalog ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputServiceId);
      console.log(`[VendorServices] Input service ID: ${inputServiceId}, isUUID: ${isUUID}`);

      let effectiveServiceId: string = inputServiceId;
      let baseService: any = null;

      if (isUUID) {
        // Try to get service from services table by UUID
        const baseServices = await select('services', { id: inputServiceId });
        if (baseServices.length > 0) {
          baseService = baseServices[0];
          effectiveServiceId = baseServices[0].id;
        } else {
          // Try service_catalog by UUID id
          const catalogResult = await query(
            `SELECT * FROM service_catalog WHERE id::text = $1`,
            [inputServiceId]
          );
          if (catalogResult.rows.length > 0) {
            const catalogItem = catalogResult.rows[0];
            baseService = {
              name: catalogItem.service_name || catalogItem.display_name || serviceName,
              category: catalogItem.category_name || categoryName,
              price: catalogItem.base_price || basePrice || 0,
              duration_minutes: catalogItem.duration_minutes || duration || 30,
              catalogId: catalogItem.service_id, // TEXT catalog ID
            };
            effectiveServiceId = catalogItem.id; // UUID from service_catalog
          }
        }
      } else {
        // Input is TEXT catalog ID (like "general-checkup")
        // Query service_catalog by TEXT service_id
        const catalogResult = await query(
          `SELECT * FROM service_catalog WHERE service_id = $1::text`,
          [inputServiceId]
        );

        if (catalogResult.rows.length > 0) {
          const catalogItem = catalogResult.rows[0];
          baseService = {
            name: catalogItem.service_name || catalogItem.display_name || serviceName,
            category: catalogItem.category_name || categoryName,
            price: catalogItem.base_price || basePrice || 0,
            duration_minutes: catalogItem.duration_minutes || duration || 30,
            catalogId: catalogItem.service_id,
          };
          // Use the UUID 'id' column from service_catalog for vendor_services
          effectiveServiceId = catalogItem.id;
          console.log(`[VendorServices] Resolved TEXT catalog ID ${inputServiceId} to UUID ${effectiveServiceId}`);
        }
      }

      // If still no base service, try with provided data (custom services)
      if (!baseService && serviceName) {
        baseService = {
          name: serviceName,
          category: categoryName || 'General',
          price: basePrice || 0,
          duration_minutes: duration || 30,
        };
        // Generate a new UUID for custom service
        effectiveServiceId = randomUUID();
        console.log(`[VendorServices] Creating custom service with new UUID: ${effectiveServiceId}`);
      }

      if (!baseService) {
        return c.json({ error: 'Base service not found' }, 404);
      }

      // Check if service already exists (using actualVendorId after vendor resolution above)
      const existing = await query(
        `SELECT id, publish_status, is_enabled FROM vendor_services
         WHERE vendor_id = $1 AND service_id = $2 AND service_style = $3`,
        [actualVendorId, effectiveServiceId, serviceStyle]
      );

      if (existing.rows.length > 0) {
        // ✅ FIX: Return the existing service instead of error
        // This allows frontend to gracefully handle already-added services
        return c.json({
          success: true,
          message: 'Service already exists',
          alreadyExists: true,
          vendorServiceId: existing.rows[0].id,
          publishStatus: existing.rows[0].publish_status,
          isEnabled: existing.rows[0].is_enabled
        }, 200);
      }

      // ✅ duration_minutes is NOT NULL - coerce to 5–1440, default 30
      const safeDuration = Math.max(5, Math.min(1440, Number(customDuration ?? baseService.duration_minutes ?? 30) || 30));
      const vendorService = await insert('vendor_services', {
        vendor_id: actualVendorId,
        service_id: effectiveServiceId, // Now always UUID
        service_name: baseService.name,
        category: baseService.category,
        service_style: serviceStyle,
        price: customPrice || baseService.price || 0,
        custom_price: customPrice || null,
        duration_minutes: safeDuration,
        custom_duration: (customDuration != null && customDuration !== '') ? (Number(customDuration) || 30) : null,
        is_enabled: isEnabled !== false,
        publish_status: publishStatus || 'published',
        is_custom_service: isCustomService || false,
        custom_description: description || null,
        // PHASE 1.1: Missing Features
        service_radius_km: serviceRadius || null, // Service radius in km (for at_home)
        queue_config: queueConfig ? JSON.stringify(queueConfig) : null, // Queue config JSON (for tele)
      });

      return c.json({
        success: true,
        service: vendorService[0],
        vendorServiceId: vendorService[0]?.id,
        message: 'Service added successfully',
      });
    } catch (error: any) {
      console.error('Error adding vendor service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/services/:serviceId
   * Update vendor service
   * Requires 'services' capability
   */
  app.put("/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId: paramVendorId, serviceId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') ||
        await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      const serviceData = await c.req.json();

      // ✅ FIX: Build update data object, only including defined values
      // Support multiple field name variations from frontend
      const updateData: any = {};

      if (serviceData.price !== undefined || serviceData.customPrice !== undefined) {
        updateData.price = serviceData.price || serviceData.customPrice;
      }
      if (serviceData.customPrice !== undefined) {
        updateData.custom_price = serviceData.customPrice;
      }
      // ✅ FIX: duration_minutes is NOT NULL - never set null/undefined; coerce to 5–1440, default 30
      if (serviceData.duration !== undefined || serviceData.customDuration !== undefined) {
        const raw = serviceData.duration ?? serviceData.customDuration;
        const mins = (raw != null && raw !== '') ? (Number(raw) || 30) : 30;
        updateData.duration_minutes = Math.max(5, Math.min(1440, mins));
      }
      if (serviceData.customDuration !== undefined) {
        const raw = serviceData.customDuration;
        updateData.custom_duration = (raw != null && raw !== '') ? (Number(raw) || 30) : null;
      }
      if (serviceData.isEnabled !== undefined || serviceData.is_enabled !== undefined) {
        updateData.is_enabled = serviceData.isEnabled !== undefined ? serviceData.isEnabled : serviceData.is_enabled;
      }
      if (serviceData.publishStatus !== undefined || serviceData.publish_status !== undefined) {
        updateData.publish_status = serviceData.publishStatus || serviceData.publish_status;
      }
      if (serviceData.description !== undefined) {
        updateData.custom_description = serviceData.description;
      }
      // ✅ Allow updating service name (for custom services; only when unpublished in app)
      if (serviceData.serviceName !== undefined || serviceData.service_name !== undefined) {
        const name = String(serviceData.serviceName ?? serviceData.service_name ?? '').trim();
        if (name) updateData.service_name = name;
      }

      // ✅ FIX: Validate that at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update. Please provide at least one field: serviceName, price, duration, description, isEnabled, or publishStatus' }, 400);
      }

      // ✅ FIX: Handle both UUID and text service identifiers
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);

      let updated: any[];

      if (isUUID) {
        // ✅ CRITICAL FIX: Check if UUID is a vendor_services.id FIRST (most specific)
        // This ensures we update the exact service requested, not multiple services with the same service_id
        // Only if it's NOT a vendor_services.id, then check if it's a catalog ID
        console.log(`[VendorServices PUT] UUID detected: ${serviceId}. Checking if it's a vendor_services.id first...`);
        const serviceCheck = await query(
          `SELECT id, vendor_id, service_id, service_name, service_style, is_enabled, publish_status
           FROM vendor_services 
           WHERE id = $1::uuid`,
          [serviceId]
        );

        if (serviceCheck.rows.length > 0) {
          // ✅ UUID is a vendor_services.id - update directly (most specific, updates only one service)
          const service = serviceCheck.rows[0];
          console.log(`[VendorServices PUT] Found service: id=${service.id}, vendor_id=${service.vendor_id}, requested_vendor_id=${vendorId}`);

          // Check if vendor_id matches
          if (service.vendor_id !== vendorId) {
            console.log(`[VendorServices PUT] Vendor mismatch: service belongs to ${service.vendor_id}, requested ${vendorId}`);
            return c.json({
              error: 'Service not found for this vendor or you do not have permission to update it',
              serviceId: serviceId,
              actualVendorId: service.vendor_id,
              requestedVendorId: vendorId,
              hint: `This service belongs to vendor ${service.vendor_id}, not ${vendorId}. You can only update services that belong to your vendor.`
            }, 403);
          }

          // Service exists and vendor matches - proceed with update (updates ONLY this one service)
          console.log(`[VendorServices PUT] Service found and vendor matches. Updating by id (single service)...`);
          updated = await update('vendor_services',
            { id: serviceId, vendor_id: vendorId },
            updateData
          );
          console.log(`[VendorServices PUT] Update result: ${updated.length} row(s) updated`);
        } else {
          // ✅ UUID is NOT a vendor_services.id - check if it's a service_catalog.id
          console.log(`[VendorServices PUT] UUID is not a vendor_services.id. Checking if it's a catalog ID...`);
          const catalogCheckByUuid = await query(
            `SELECT id, service_id, service_name, service_style 
             FROM service_catalog 
             WHERE id = $1::uuid`,
            [serviceId]
          );

          if (catalogCheckByUuid.rows.length > 0) {
            // ✅ UUID is a catalog ID - look up vendor's service by service_id (foreign key)
            // ⚠️ WARNING: If vendor has multiple services with same service_id, this will only update the FIRST one
            const catalogService = catalogCheckByUuid.rows[0];
            console.log(`[VendorServices PUT] UUID is a catalog ID. Looking up vendor service by service_id=${catalogService.id} for vendor ${vendorId}`);

            const vendorServiceByCatalogId = await query(
              `SELECT id, vendor_id, service_id, service_name, service_style 
               FROM vendor_services 
               WHERE service_id = $1::uuid AND vendor_id = $2::uuid
               LIMIT 1`,
              [catalogService.id, vendorId]
            );

            if (vendorServiceByCatalogId.rows.length > 0) {
              // Found vendor's service - use the actual vendor_services.id (only first match to prevent bulk updates)
              const actualServiceId = vendorServiceByCatalogId.rows[0].id;
              console.log(`[VendorServices PUT] Found vendor service by catalog ID, using vendor_services.id=${actualServiceId} (first match only)`);
              updated = await update('vendor_services',
                { id: actualServiceId, vendor_id: vendorId },
                updateData
              );
              console.log(`[VendorServices PUT] Update by catalog ID result: ${updated.length} row(s) updated`);
            } else {
              // Catalog service exists but vendor hasn't added it yet
              console.log(`[VendorServices PUT] Catalog service exists but vendor ${vendorId} hasn't added it yet`);
              return c.json({
                error: 'Service exists in catalog but has not been added to this vendor. Please add it first using POST /vendor/:vendorId/services/add-from-catalog',
                serviceId: serviceId,
                catalogServiceId: catalogService.id,
                catalogServiceName: catalogService.service_name,
                hint: 'Use POST /vendor/:vendorId/services/add-from-catalog to add this service to your offerings first'
              }, 404);
            }
          } else {
            // UUID doesn't exist in vendor_services or catalog
            console.log(`[VendorServices PUT] UUID ${serviceId} not found in vendor_services or catalog`);
            updated = [];
          }
        }
      } else {
        // ✅ FIX: Text identifier - try multiple matching strategies
        console.log(`[VendorServices PUT] Looking up text service ID: ${serviceId} for vendor ${vendorId}`);

        // Strategy 1: Look up from service_catalog by service_id (TEXT column)
        // ✅ FIX: service_catalog.service_id is TEXT, so cast parameter to TEXT to avoid type mismatch
        // ⚠️ CRITICAL: Check if multiple services exist with same service_id to prevent bulk updates
        const catalogResult = await query(
          'SELECT id FROM service_catalog WHERE service_id = $1::text',
          [serviceId]
        );

        if (catalogResult.rows.length > 0) {
          const catalogUUID = catalogResult.rows[0].id;
          // ✅ FIX: Check count first - if multiple services with same service_id, require specific id
          const vendorServiceCount = await query(
            `SELECT COUNT(*) as count FROM vendor_services 
             WHERE service_id = $1::uuid AND vendor_id = $2::uuid`,
            [catalogUUID, vendorId]
          );
          const count = parseInt(vendorServiceCount.rows[0]?.count || '0', 10);

          if (count === 0) {
            updated = [];
          } else if (count === 1) {
            // Only one service with this service_id - safe to update
            updated = await update('vendor_services',
              { service_id: catalogUUID, vendor_id: vendorId },
              updateData
            );
          } else {
            // Multiple services with same service_id - cannot safely update without specific id
            console.log(`[VendorServices PUT] ERROR: Found ${count} services with service_id=${catalogUUID} for vendor ${vendorId}. Cannot update without specific vendor_services.id`);
            return c.json({
              error: `Multiple services found with the same catalog service. Please use the specific vendor_services.id to update.`,
              serviceId: serviceId,
              catalogServiceId: catalogUUID,
              matchingServicesCount: count,
              hint: 'Use GET /vendor/:vendorId/services to find the specific service ID, then use that ID in the PUT request'
            }, 400);
          }
        } else {
          updated = [];
        }

        // Strategy 2: If not found, try matching by normalized service_name
        if (!updated || updated.length === 0) {
          // Convert underscore-separated identifiers to space-separated for fuzzy matching
          // e.g., "vet_tele_consult" -> "tele consult" (remove common prefixes)
          const normalizedSearch = serviceId
            .replace(/^vet_|^pet_/, '') // Remove common prefixes
            .replace(/_/g, ' ')          // Convert underscores to spaces
            .replace(/-/g, ' ')          // Convert hyphens to spaces
            .trim();

          console.log(`[VendorServices PUT] Trying normalized search: "${normalizedSearch}"`);

          // ✅ FIX: Check count first to prevent bulk updates
          const countCheck = await query(
            `SELECT COUNT(*) as count FROM vendor_services 
             WHERE vendor_id = $1 AND (
               LOWER(service_name) ILIKE '%' || LOWER($2) || '%'
               OR LOWER(REPLACE(REPLACE(service_name, '-', ' '), '_', ' ')) ILIKE '%' || LOWER($2) || '%'
             )`,
            [vendorId, normalizedSearch]
          );
          const matchCount = parseInt(countCheck.rows[0]?.count || '0', 10);

          if (matchCount === 0) {
            updated = [];
          } else if (matchCount === 1) {
            // Only one match - safe to update
            const vsResult = await query(
              `UPDATE vendor_services 
               SET ${Object.keys(updateData).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
               WHERE vendor_id = $1 AND (
                 LOWER(service_name) ILIKE '%' || LOWER($2) || '%'
                 OR LOWER(REPLACE(REPLACE(service_name, '-', ' '), '_', ' ')) ILIKE '%' || LOWER($2) || '%'
               )
               RETURNING *`,
              [vendorId, normalizedSearch, ...Object.values(updateData)]
            );
            updated = vsResult.rows;
          } else {
            // Multiple matches - cannot safely update without specific id
            console.log(`[VendorServices PUT] ERROR: Found ${matchCount} services matching "${normalizedSearch}" for vendor ${vendorId}. Cannot update without specific vendor_services.id`);
            return c.json({
              error: `Multiple services found matching "${serviceId}". Please use the specific vendor_services.id to update.`,
              serviceId: serviceId,
              normalizedSearch: normalizedSearch,
              matchingServicesCount: matchCount,
              hint: 'Use GET /vendor/:vendorId/services to find the specific service ID, then use that ID in the PUT request'
            }, 400);
          }
        }

        // Strategy 3: Try exact original serviceId match
        if (!updated || updated.length === 0) {
          const vsResult = await query(
            `UPDATE vendor_services 
             SET ${Object.keys(updateData).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
             WHERE vendor_id = $1 AND (
               service_name ILIKE $2 
               OR service_name ILIKE '%' || $2 || '%'
               OR LOWER(REPLACE(REPLACE(service_name, '-', ''), ' ', '')) = LOWER(REPLACE(REPLACE($2, '_', ''), '-', ''))
             )
             RETURNING *`,
            [vendorId, serviceId, ...Object.values(updateData)]
          );
          updated = vsResult.rows;
        }
      }

      if (!updated || updated.length === 0) {
        // ✅ FIX: Provide more helpful error message for PUT endpoint
        // First check if service exists in vendor_services at all (any vendor)
        const isServiceIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);

        let vendorServiceCheck;
        if (isServiceIdUuid) {
          vendorServiceCheck = await query(
            `SELECT id, vendor_id, service_id, service_name, service_style 
             FROM vendor_services 
             WHERE id = $1::uuid`,
            [serviceId]
          );
        } else {
          vendorServiceCheck = await query(
            `SELECT id, vendor_id, service_id, service_name, service_style 
             FROM vendor_services 
             WHERE id::text = $1 OR service_id::text = $1`,
            [serviceId]
          );
        }

        if (vendorServiceCheck.rows.length > 0) {
          const service = vendorServiceCheck.rows[0];
          // Service exists but vendor_id doesn't match
          if (service.vendor_id !== vendorId) {
            return c.json({
              error: 'Service not found for this vendor or you do not have permission to update it',
              serviceId: serviceId,
              actualVendorId: service.vendor_id,
              requestedVendorId: vendorId,
              hint: `This service (id=${service.id}) belongs to vendor ${service.vendor_id}, not ${vendorId}. You can only update services that belong to your vendor.`
            }, 403);
          } else {
            // Service exists and vendor matches, but update failed - this shouldn't happen
            console.error(`[VendorServices PUT] Service exists and vendor matches but update returned 0 rows. Service:`, service);
            return c.json({
              error: 'Service update failed unexpectedly',
              serviceId: serviceId,
              hint: 'The service exists but the update operation failed. Please try again or contact support.'
            }, 500);
          }
        }

        // Service doesn't exist in vendor_services - check if it exists in catalog
        let catalogCheck;
        if (isServiceIdUuid) {
          catalogCheck = await query(
            'SELECT id, service_name FROM service_catalog WHERE id = $1::uuid OR service_id = $1::text',
            [serviceId]
          );
        } else {
          catalogCheck = await query(
            'SELECT id, service_name FROM service_catalog WHERE id::text = $1 OR service_id = $1::text',
            [serviceId]
          );
        }

        if (catalogCheck.rows.length > 0) {
          return c.json({
            error: 'Service exists in catalog but has not been added to this vendor. Please add it first using POST /vendor/:vendorId/services/add-from-catalog',
            serviceId: serviceId,
            catalogService: catalogCheck.rows[0],
            hint: 'Use POST /vendor/:vendorId/services/add-from-catalog to add this service to your offerings first'
          }, 404);
        }

        // Service doesn't exist anywhere
        return c.json({
          error: 'Service not found or you do not have permission to update it',
          serviceId: serviceId,
          vendorId: vendorId,
          hint: `The service ID ${serviceId} does not exist in vendor_services or service_catalog for vendor ${vendorId}`
        }, 404);
      }

      return c.json({
        success: true,
        service: updated[0],
        message: 'Service updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating vendor service:', error);
      const msg = error?.message || String(error);
      const isTransient = msg.includes('pool exhausted') || msg.includes('try again in a moment') ||
        msg.includes('timeout') || msg.includes('Connection terminated') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED');
      if (isTransient) {
        return c.json({ error: 'Service temporarily unavailable. Please try again in a moment.' }, 503);
      }
      return c.json({ error: msg }, 500);
    }
  });

  // ============================================================================
  // IMPORTANT: Register specific POST routes BEFORE the generic :serviceId route
  // Hono matches routes in registration order
  // ============================================================================

  /**
   * POST /vendor/:vendorId/services/add-from-catalog
   * Add a platform catalog service to vendor's offerings
   * MUST be registered before the generic :serviceId route
   */
  app.post("/vendor/:vendorId/services/add-from-catalog", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const trimmedId = (paramVendorId || '').trim();
      if (!trimmedId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Resolve vendor (identity id, application id, or vendors.id) so new and existing vendors work
      const vendor = await resolveVendorById(trimmedId);
      if (!vendor?.id) {
        return c.json({ error: 'Vendor identity not found' }, 404);
      }
      const actualVendorId = vendor.id;

      // Check if vendor has services capability (use actualVendorId)
      const hasServicesCapability = await checkVendorCapability(actualVendorId, 'services') ||
        await checkVendorCapability(actualVendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      const body = await c.req.json();
      const {
        catalogServiceId,
        serviceId: bodyServiceId, // Also accept serviceId from body
        serviceStyle,
        customPrice,
        customDuration,
        isEnabled = true
      } = body;

      const finalCatalogServiceId = catalogServiceId || bodyServiceId;

      if (!finalCatalogServiceId) {
        return c.json({ error: 'catalogServiceId or serviceId is required' }, 400);
      }

      console.log(`➕ Adding catalog service ${finalCatalogServiceId} to vendor ${actualVendorId}...`);

      // ✅ CRITICAL FIX: Handle prefixed catalog IDs (catalog_<uuid>) and regular service_id (TEXT)
      // Never use raw catalog UUIDs directly - they might match another vendor's vendor_services.id
      let catalogService: any;

      // Check if it's a prefixed catalog ID (catalog_<uuid>)
      if (finalCatalogServiceId.startsWith('catalog_')) {
        const catalogUuid = finalCatalogServiceId.replace('catalog_', '');
        const catalogServices = await query(
          `SELECT * FROM service_catalog WHERE id = $1::uuid`,
          [catalogUuid]
        );
        catalogService = catalogServices.rows[0];
      } else {
        // Check if it's a raw UUID (should not happen, but handle it)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalCatalogServiceId);

        if (isUUID) {
          // ⚠️ WARNING: Raw UUID detected - this might be a catalog UUID or vendor_services.id
          // Try catalog first, but log a warning
          console.warn(`[VendorServices] Raw UUID detected for catalogServiceId: ${finalCatalogServiceId}. This might cause conflicts.`);
          const catalogServices = await query(
            `SELECT * FROM service_catalog WHERE id = $1::uuid`,
            [finalCatalogServiceId]
          );
          catalogService = catalogServices.rows[0];
        } else {
          // Look up by text service_id (preferred method)
          const catalogServices = await query(
            `SELECT * FROM service_catalog WHERE service_id = $1::text`,
            [finalCatalogServiceId]
          );
          catalogService = catalogServices.rows[0];
        }
      }

      if (!catalogService) {
        return c.json({ error: `Catalog service not found: ${finalCatalogServiceId}` }, 404);
      }

      const finalServiceStyle = serviceStyle || catalogService.service_style || 'at_home';

      // Resolve category_id to a human-readable name if it's a UUID
      // The vendor_services.category column has a CHECK constraint that rejects UUID values
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let resolvedCategoryName = catalogService.category_name || null;
      let resolvedSubCategoryName = catalogService.sub_category_name || null;

      if (!resolvedCategoryName && catalogService.category_id) {
        if (uuidRegex.test(catalogService.category_id)) {
          // Look up the name from service_categories
          const catLookup = await query(
            `SELECT name FROM service_categories WHERE id = $1::uuid LIMIT 1`,
            [catalogService.category_id]
          );
          resolvedCategoryName = catLookup.rows[0]?.name || null;
        } else {
          // category_id is a text slug (e.g. "training"), safe to use directly
          resolvedCategoryName = catalogService.category_id;
        }
      }

      if (!resolvedSubCategoryName && catalogService.sub_category_id) {
        if (uuidRegex.test(catalogService.sub_category_id)) {
          const subCatLookup = await query(
            `SELECT name FROM service_categories WHERE id = $1::uuid LIMIT 1`,
            [catalogService.sub_category_id]
          );
          resolvedSubCategoryName = subCatLookup.rows[0]?.name || null;
        } else {
          resolvedSubCategoryName = catalogService.sub_category_id;
        }
      }

      // Check if vendor already has this service (use actualVendorId)
      // ✅ FIX: Only match by service_id (catalog UUID foreign key), NOT by service_name
      // Matching by service_name caused bugs: different catalog entries with the same name
      // (e.g. "Home Visit Consultation" from 3 different catalog entries) would all match
      // the same vendor_services row, creating duplicate IDs in the frontend
      const existingServices = await query(
        `SELECT * FROM vendor_services 
         WHERE vendor_id = $1 
         AND service_id = $2
         AND service_style = $3`,
        [actualVendorId, catalogService.id, finalServiceStyle]
      );

      if (existingServices.rows.length > 0) {
        // Update existing service to enabled
        const existingService = existingServices.rows[0];
        const updated = await update('vendor_services',
          { id: existingService.id },
          {
            is_enabled: isEnabled,
            custom_price: customPrice || existingService.custom_price,
            custom_duration: customDuration || existingService.custom_duration,
          }
        );

        return c.json({
          success: true,
          message: 'Service updated/re-enabled',
          vendorServiceId: existingService.id,
          service: updated[0] || existingService
        });
      }

      // Create new vendor_services record (use actualVendorId)
      // Copy catalog metadata (e.g. isPackage, packageDetails) so admin "Mark as Package" flows to vendor and customer
      const catalogMeta = catalogService.metadata && typeof catalogService.metadata === 'object' ? catalogService.metadata : {};
      const vendorMetadata = { ...catalogMeta };
      if (catalogService.metadata && (catalogService.metadata as any).isPackage !== undefined) {
        (vendorMetadata as any).isPackage = (catalogService.metadata as any).isPackage;
      }
      if (catalogService.metadata && (catalogService.metadata as any).packageDetails) {
        (vendorMetadata as any).packageDetails = (catalogService.metadata as any).packageDetails;
      }

      const newService = await insert('vendor_services', {
        vendor_id: actualVendorId,
        service_id: catalogService.id,
        service_name: catalogService.service_name || catalogService.display_name,
        category: resolvedCategoryName,
        sub_category: resolvedSubCategoryName,
        price: customPrice || catalogService.base_price || 0,
        duration_minutes: customDuration || catalogService.duration_minutes || 30,
        service_style: finalServiceStyle,
        is_enabled: isEnabled,
        publish_status: 'draft',
        is_custom_service: false,
        custom_price: customPrice,
        custom_duration: customDuration,
        metadata: Object.keys(vendorMetadata).length > 0 ? vendorMetadata : undefined,
      });

      const createdServiceId = newService[0]?.id;
      console.log(`✅ Created vendor service ${createdServiceId} for vendor ${actualVendorId}`);

      return c.json({
        success: true,
        message: 'Service added from catalog',
        vendorServiceId: createdServiceId,
        service: newService[0]
      });
    } catch (error: any) {
      console.error('Error adding catalog service to vendor:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/custom
   * Create custom service
   * Requires 'services' capability
   * IMPORTANT: Must be registered BEFORE the generic :serviceId route
   */
  app.post("/vendor/:vendorId/services/custom", async (c) => {
    try {

      console.log('c.req.param()----------------------------------------->', c.req.param());
      const { vendorId: paramVendorId } = c.req.param();
      if (!(paramVendorId || '').trim()) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }
      // Resolve identity ID to vendor ID (same as GET /vendor/:vendorId/services) so requests
      // using JWT identity id succeed when vendor row is keyed by vendor id or matched by phone.
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') ||
        await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      // Get vendor to determine serviceStyle (use resolved vendor id)
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const vendor = vendors[0];

      const serviceData = await c.req.json();
      const {
        serviceName,
        description,
        category,
        categoryName,
        subCategory,
        subCategoryName,
        serviceStyle,
        price,
        isPackage,
        packageDetails,
        specializationIds,
        specialization_ids,
      } = serviceData;
      const duration = serviceData.duration ?? serviceData.customDuration ?? (serviceData as any).duration_minutes;
      const effectiveSpecIds = Array.isArray(specializationIds) ? specializationIds : (Array.isArray(specialization_ids) ? specialization_ids : []);

      const effectiveCategory = category || categoryName || null;
      const effectiveSubCategory = subCategory || subCategoryName || null;
      console.log('effectiveCategory----------------------------------------->', effectiveCategory, category, categoryName);
      // For packages, effective price comes from packageDetails.price or packageDetails.packagePrice
      const packagePrice =
        packageDetails && typeof packageDetails === 'object'
          ? Number(packageDetails.price ?? packageDetails.packagePrice ?? 0)
          : 0;
      const isPackageService = Boolean(isPackage);
      const effectivePriceNum = isPackageService
        ? (Number.isFinite(packagePrice) ? packagePrice : 0)
        : (price != null ? Number(price) : NaN);

      // Determine serviceStyle from vendor if not provided
      let effectiveServiceStyle: string;

      if (serviceStyle && ['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        effectiveServiceStyle = serviceStyle;
        console.log(`[VendorServices] Using explicitly provided serviceStyle: ${effectiveServiceStyle}`);
      } else {
        effectiveServiceStyle = vendor.service_style || vendor.serviceStyle || 'at_center';
        console.log(`[VendorServices] No serviceStyle provided, falling back to: ${effectiveServiceStyle}`);
      }

      // Validate serviceStyle against role configuration
      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            const roleConfig = roles[0].config || {};
            const serviceStylesConfigCat = roleConfig?.serviceStyles || roleConfig?.service_styles;
            const rawStylesCat = Array.isArray(serviceStylesConfigCat)
              ? serviceStylesConfigCat
              : (serviceStylesConfigCat?.selected ?? serviceStylesConfigCat?.solo ?? []);
            const styleMappingCat: Record<string, string> = {
              'at_clinic': 'at_center', 'at_center': 'at_center', 'video_consultation': 'tele',
              'tele': 'tele', 'online': 'tele', 'home_visit': 'at_home', 'at_home': 'at_home',
            };
            let allowedServiceStylesCat = Array.isArray(rawStylesCat) && rawStylesCat.length > 0
              ? rawStylesCat.map((s: string) => styleMappingCat[s] || s)
              : (() => {
                const rn = (roles[0].name || '').toLowerCase().replace(/\s+/g, '_');
                const RS: Record<string, string[]> = {
                  'pet_walker': ['at_home'], 'walker': ['at_home'], 'dog_walker': ['at_home'],
                  'pet_sitter': ['at_home'], 'sitter': ['at_home'], 'pet_taxi': ['at_home'],
                  'pet_pharmacy': ['delivery', 'pickup'], 'pet_products_store': ['delivery', 'pickup'],
                };
                return RS[rn] || ['at_home', 'at_center', 'tele'];
              })();

            if (!allowedServiceStylesCat.includes(effectiveServiceStyle)) {
              return c.json({
                error: `Service style '${effectiveServiceStyle}' is not allowed for this role. Allowed styles: ${allowedServiceStylesCat.join(', ')}`,
                allowedStyles: allowedServiceStylesCat
              }, 403);
            }

            console.log(`[VendorServices] Custom service style validation passed: ${effectiveServiceStyle} is allowed for vendor ${vendorId}`);
          }
        } catch (roleError: any) {
          console.warn(`[VendorServices] Failed to validate custom service style against role config:`, roleError.message);
        }
      }

      if (!effectiveCategory) {
        return c.json({ error: 'category (or categoryName) is required' }, 400);
      }

      const hasServiceName = serviceName != null && String(serviceName).trim() !== '';
      const hasValidPrice = !Number.isNaN(effectivePriceNum) && effectivePriceNum >= 0;
      if (!hasServiceName) {
        return c.json({ error: 'serviceName is required' }, 400);
      }
      if (!hasValidPrice) {
        return c.json(
          { error: isPackageService ? 'Package price (packageDetails.price or packageDetails.packagePrice) must be a non-negative number' : 'price is required and must be a non-negative number' },
          400
        );
      }

      // ✅ Duplicate name check: same vendor cannot have two custom services with the same name (case-insensitive)
      const nameTrimmed = String(serviceName).trim();
      const duplicateCheck = await query(
        `SELECT 1 FROM vendor_services 
         WHERE vendor_id = $1 AND is_custom_service = true 
         AND LOWER(TRIM(service_name)) = LOWER($2) LIMIT 1`,
        [vendorId, nameTrimmed]
      );
      if (duplicateCheck?.rows?.length > 0) {
        return c.json(
          { error: 'A service with this name already exists. Please use a different name.' },
          400
        );
      }

      // Normalize category: UUIDs resolve to service_categories.id + display name (never store raw UUID in category text)
      const { category_id: normalizedCategoryId, category_text: normalizedCategoryText } =
        await resolveCategory(query, effectiveCategory);
      if (isUuid(effectiveCategory) && (!normalizedCategoryId || !normalizedCategoryText)) {
        return c.json(
          { error: 'Unknown or inactive platform category. Pick a category from the list or use a custom name.' },
          400
        );
      }
      console.log('normalizedCategoryId----------------------------------------->', normalizedCategoryId, normalizedCategoryText, isUuid(effectiveCategory));
      const displayCategory =
        normalizedCategoryText ?? (!isUuid(effectiveCategory) ? String(effectiveCategory).trim() : null);
      // Create base service first (use effective price: package price when isPackage, else top-level price)
      const baseService = await insert('services', {
        name: serviceName,
        description: description || null,
        category: displayCategory,
        price: effectivePriceNum,
        duration_minutes: duration || 30,
        is_active: true,
      });
      console.log('baseService----------------------------------------->', baseService);
      const requestedPublishStatus = serviceData.publishStatus || 'draft';
      // Auto-approve custom services: if vendor requests 'published', set it directly to 'published' (no approval needed)
      const effectivePublishStatus = requestedPublishStatus;
      // DB constraint allows: draft, published, auto_published, pending_approval (migration 544). If DB is not yet migrated, fallback to draft.
      const allowedPublishStatuses = ['draft', 'published', 'auto_published', 'pending_approval'];
      const publishStatusForDb = allowedPublishStatuses.includes(effectivePublishStatus) ? effectivePublishStatus : 'draft';
      const isEnabled = effectivePublishStatus === 'published';

      // Duration: for packages use sessionDuration from packageDetails when present
      const durationFromDetails = packageDetails && typeof packageDetails === 'object'
        ? Number(packageDetails.sessionDuration ?? packageDetails.duration ?? duration)
        : Number(duration);
      const safeDurationMinutes = Math.max(5, Math.min(1440, (durationFromDetails || duration || 30) || 30));

      // Build metadata for packages and/or specializations (360°: custom service linked to specializations for discovery)
      const metadata: Record<string, unknown> = {};
      if (isPackageService && packageDetails && typeof packageDetails === 'object') {
        metadata.isPackage = true;
        metadata.packageType = serviceData.packageType || undefined;
        metadata.packageDetails = packageDetails;
      }
      if (effectiveSpecIds.length > 0) {
        metadata.specialization_ids = effectiveSpecIds;
      }
      const metadataToStore = Object.keys(metadata).length > 0 ? metadata : undefined;

      // Create vendor service link (use effective price; store package metadata when isPackage)
      const vendorServicePayload: Record<string, unknown> = {
        vendor_id: vendorId,
        service_id: baseService[0].id,
        service_name: serviceName,
        category_id: normalizedCategoryId || null,
        category: displayCategory,
        sub_category: effectiveSubCategory || null,
        service_style: effectiveServiceStyle,
        price: effectivePriceNum,
        custom_price: effectivePriceNum,
        duration_minutes: safeDurationMinutes,
        custom_duration: safeDurationMinutes,
        is_enabled: isEnabled,
        publish_status: publishStatusForDb,
        is_custom_service: true,
        submitted_for_approval_at: null, // No approval needed - services are auto-approved
      };
      if (metadataToStore) {
        vendorServicePayload.metadata = metadataToStore;
      }
      const vendorService = await insert('vendor_services', vendorServicePayload);

      return c.json({
        success: true,
        service: vendorService[0],
        message: effectivePublishStatus === 'draft'
          ? 'Custom service saved as draft'
          : 'Custom service submitted for admin approval',
        publishStatus: effectivePublishStatus,
      });
    } catch (error: any) {
      console.error('Error creating custom service:', error);
      const message = error?.message || (typeof error === 'string' ? error : 'Failed to create custom service');
      const isConstraint = message.includes('pending_approval') || message.includes('check constraint') || message.includes('violates check');
      return c.json({
        error: isConstraint
          ? 'Custom service could not be saved. Please ensure database migration 544 (vendor_services publish_status) has been applied.'
          : message,
      }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/bulk-update
   * Bulk update services (enable/disable, update pricing, etc.)
   * Used by solo provider service management
   * IMPORTANT: Must be registered BEFORE the generic :serviceId route
   */
  app.post("/vendor/:vendorId/services/bulk-update", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') ||
        await checkVendorCapability(vendorId, 'custom_services') ||
        await checkVendorCapability(vendorId, 'booking');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      const { services, isSoloProvider } = await c.req.json();

      if (!services || !Array.isArray(services) || services.length === 0) {
        return c.json({ error: 'services array is required' }, 400);
      }

      const results = await Promise.all(
        services.map(async (serviceData: any) => {
          try {
            const catalogServiceId = serviceData.catalogServiceId || serviceData.catalog_service_id;
            const serviceStyle = serviceData.serviceStyle || serviceData.service_style;

            // ✅ For solo providers, skip at_center services
            if (isSoloProvider && serviceStyle === 'at_center') {
              return {
                catalogServiceId,
                success: false,
                error: 'Solo providers cannot use at_center service style'
              };
            }

            // Check if vendor already has this service
            const existingService = await query(
              `SELECT id FROM vendor_services 
               WHERE vendor_id = $1 AND catalog_service_id = $2`,
              [vendorId, catalogServiceId]
            );

            if (existingService.rows.length > 0) {
              // Update existing service
              const updateData: any = {
                is_enabled: serviceData.isEnabled !== false,
                updated_at: new Date().toISOString(),
              };

              if (serviceData.customPrice !== undefined) {
                updateData.custom_price = serviceData.customPrice;
              }
              if (serviceData.customDuration !== undefined) {
                updateData.custom_duration = serviceData.customDuration;
              }

              await update('vendor_services',
                { id: existingService.rows[0].id },
                updateData
              );

              return { catalogServiceId, success: true, action: 'updated' };
            } else {
              // Create new vendor service entry
              await insert('vendor_services', {
                id: randomUUID(),
                vendor_id: vendorId,
                catalog_service_id: catalogServiceId,
                service_style: serviceStyle,
                is_enabled: serviceData.isEnabled !== false,
                custom_price: serviceData.customPrice || null,
                custom_duration: serviceData.customDuration || null,
                publish_status: 'draft',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

              return { catalogServiceId, success: true, action: 'created' };
            }
          } catch (err) {
            return {
              catalogServiceId: serviceData.catalogServiceId,
              success: false,
              error: (err as any).message
            };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;

      return c.json({
        success: true,
        results,
        message: `Updated ${successCount} of ${services.length} services`,
      });
    } catch (error: any) {
      console.error('Error bulk updating services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/publish
   * Publish enabled services (makes them visible to customers)
   * Alias for bulk-publish with publishStatus='published'
   */
  app.post("/vendor/:vendorId/services/publish", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') ||
        await checkVendorCapability(vendorId, 'custom_services') ||
        await checkVendorCapability(vendorId, 'booking');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      const { serviceIds, isSoloProvider } = await c.req.json();

      if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
        return c.json({ error: 'serviceIds array is required' }, 400);
      }

      const results = await Promise.all(
        serviceIds.map(async (serviceId: string) => {
          try {
            // First check if service belongs to solo provider and is at_center
            if (isSoloProvider) {
              const svc = await query(
                `SELECT service_style FROM vendor_services WHERE id = $1`,
                [serviceId]
              );
              if (svc.rows.length > 0 && svc.rows[0].service_style === 'at_center') {
                return {
                  serviceId,
                  success: false,
                  error: 'Solo providers cannot publish at_center services'
                };
              }
            }

            const updated = await update('vendor_services',
              { id: serviceId, vendor_id: vendorId },
              {
                publish_status: 'published',
                is_enabled: true,
                published_at: new Date().toISOString(),
              }
            );
            return { serviceId, success: updated.length > 0 };
          } catch (err) {
            return { serviceId, success: false, error: (err as any).message };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;

      return c.json({
        success: true,
        results,
        message: `Published ${successCount} of ${serviceIds.length} services`,
      });
    } catch (error: any) {
      console.error('Error publishing services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/bulk-publish
   * Bulk update publish status for multiple services
   * IMPORTANT: Must be registered BEFORE the generic :serviceId route
   */
  app.post("/vendor/:vendorId/services/bulk-publish", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') ||
        await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      const { serviceIds, publishStatus } = await c.req.json();

      if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
        return c.json({ error: 'serviceIds array is required' }, 400);
      }

      if (!publishStatus || !['draft', 'pending_approval', 'published'].includes(publishStatus)) {
        return c.json({ error: 'Valid publishStatus is required (draft, pending_approval, or published)' }, 400);
      }

      const results = await Promise.all(
        serviceIds.map(async (serviceId: string) => {
          try {
            const updated = await update('vendor_services',
              { id: serviceId, vendor_id: vendorId },
              {
                publish_status: publishStatus,
                is_enabled: publishStatus === 'published',
                submitted_for_approval_at: publishStatus === 'pending_approval' ? new Date().toISOString() : null,
              }
            );
            return { serviceId, success: updated.length > 0 };
          } catch (err) {
            return { serviceId, success: false, error: (err as any).message };
          }
        })
      );

      return c.json({
        success: true,
        results,
        message: `Updated ${results.filter(r => r.success).length} of ${serviceIds.length} services`,
      });
    } catch (error: any) {
      console.error('Error bulk publishing services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/:serviceId
   * Update vendor service (alias for PUT to support frontend using POST)
   * NOTE: This generic route MUST be registered AFTER all specific routes (custom, bulk-publish, add-from-catalog)
   */
  app.post("/vendor/:vendorId/services/:serviceId", async (c) => {
    // Skip if this is a specific route that should have been handled above
    const serviceId = c.req.param('serviceId');
    if (serviceId === 'custom' || serviceId === 'add-from-catalog' || serviceId === 'bulk-publish') {
      // These should have been handled by specific routes above
      // If we get here, something is wrong with route registration
      console.error(`⚠️ Generic :serviceId route caught specific path: ${serviceId}. This should not happen - check route registration order.`);
      return c.json({ error: 'Internal routing error - please try again' }, 500);
    }

    try {
      const { vendorId: paramVendorId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') ||
        await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      const serviceData = await c.req.json();

      const updateData: any = {};

      if (serviceData.price !== undefined || serviceData.customPrice !== undefined) {
        updateData.price = serviceData.price || serviceData.customPrice;
      }
      if (serviceData.customPrice !== undefined) {
        updateData.custom_price = serviceData.customPrice;
      }
      // ✅ FIX: duration_minutes is NOT NULL - never set null/undefined; coerce to 5–1440, default 30
      if (serviceData.duration !== undefined || serviceData.customDuration !== undefined) {
        const raw = serviceData.duration ?? serviceData.customDuration;
        const mins = (raw != null && raw !== '') ? (Number(raw) || 30) : 30;
        updateData.duration_minutes = Math.max(5, Math.min(1440, mins));
      }
      if (serviceData.customDuration !== undefined) {
        const raw = serviceData.customDuration;
        updateData.custom_duration = (raw != null && raw !== '') ? (Number(raw) || 30) : null;
      }
      if (serviceData.isEnabled !== undefined || serviceData.is_enabled !== undefined) {
        updateData.is_enabled = serviceData.isEnabled !== undefined ? serviceData.isEnabled : serviceData.is_enabled;
      }
      if (serviceData.publishStatus !== undefined || serviceData.publish_status !== undefined) {
        updateData.publish_status = serviceData.publishStatus || serviceData.publish_status;
      }
      if (serviceData.description !== undefined) {
        updateData.custom_description = serviceData.description;
      }

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update. Please provide at least one field: price, duration, isEnabled, or publishStatus' }, 400);
      }

      // ✅ FIX: Handle both UUID and text service identifiers with improved matching
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);

      let updated: any[];

      if (isUUID) {
        // ✅ FIX: Check if UUID is a vendor_services.id FIRST (most specific)
        // This ensures we update the exact service requested, not multiple services with the same service_id
        updated = await update('vendor_services',
          { id: serviceId, vendor_id: vendorId },
          updateData
        );

        if (updated.length === 0) {
          // ✅ UUID is NOT a vendor_services.id - check if it's a catalog ID
          // ⚠️ WARNING: If vendor has multiple services with same service_id, we need to update only ONE
          const catalogCheck = await query(
            `SELECT id FROM service_catalog WHERE id = $1::uuid`,
            [serviceId]
          );

          if (catalogCheck.rows.length > 0) {
            const catalogUUID = catalogCheck.rows[0].id;
            // Check count first - if multiple services with same service_id, require specific id
            const vendorServiceCount = await query(
              `SELECT COUNT(*) as count FROM vendor_services 
               WHERE service_id = $1::uuid AND vendor_id = $2::uuid`,
              [catalogUUID, vendorId]
            );
            const count = parseInt(vendorServiceCount.rows[0]?.count || '0', 10);

            if (count === 1) {
              // Only one service with this service_id - safe to update
              updated = await update('vendor_services',
                { service_id: catalogUUID, vendor_id: vendorId },
                updateData
              );
            } else if (count > 1) {
              // Multiple services with same service_id - cannot safely update without specific id
              console.log(`[VendorServices POST] ERROR: Found ${count} services with service_id=${catalogUUID} for vendor ${vendorId}. Cannot update without specific vendor_services.id`);
              return c.json({
                error: `Multiple services found with the same catalog service. Please use the specific vendor_services.id to update.`,
                serviceId: serviceId,
                catalogServiceId: catalogUUID,
                matchingServicesCount: count,
                hint: 'Use GET /vendor/:vendorId/services to find the specific service ID, then use that ID in the PUT/POST request'
              }, 400);
            }
          }
        }
      } else {
        // ✅ FIX: Text identifier - try multiple matching strategies
        console.log(`[VendorServices] Looking up text service ID: ${serviceId} for vendor ${vendorId}`);

        // Strategy 1: Look up from service_catalog by service_id (TEXT column)
        // ✅ FIX: service_catalog.service_id is TEXT, so cast parameter to TEXT to avoid type mismatch
        // ⚠️ CRITICAL: Check if multiple services exist with same service_id to prevent bulk updates
        const catalogResult = await query(
          'SELECT id FROM service_catalog WHERE service_id = $1::text',
          [serviceId]
        );

        if (catalogResult.rows.length > 0) {
          const catalogUUID = catalogResult.rows[0].id;
          // ✅ FIX: Check count first - if multiple services with same service_id, require specific id
          const vendorServiceCount = await query(
            `SELECT COUNT(*) as count FROM vendor_services 
             WHERE service_id = $1::uuid AND vendor_id = $2::uuid`,
            [catalogUUID, vendorId]
          );
          const count = parseInt(vendorServiceCount.rows[0]?.count || '0', 10);

          if (count === 0) {
            updated = [];
          } else if (count === 1) {
            // Only one service with this service_id - safe to update
            updated = await update('vendor_services',
              { service_id: catalogUUID, vendor_id: vendorId },
              updateData
            );
          } else {
            // Multiple services with same service_id - cannot safely update without specific id
            console.log(`[VendorServices POST] ERROR: Found ${count} services with service_id=${catalogUUID} for vendor ${vendorId}. Cannot update without specific vendor_services.id`);
            return c.json({
              error: `Multiple services found with the same catalog service. Please use the specific vendor_services.id to update.`,
              serviceId: serviceId,
              catalogServiceId: catalogUUID,
              matchingServicesCount: count,
              hint: 'Use GET /vendor/:vendorId/services to find the specific service ID, then use that ID in the PUT/POST request'
            }, 400);
          }
        } else {
          updated = [];
        }

        // Strategy 2: If not found, try matching by normalized service_name
        if (!updated || updated.length === 0) {
          // Convert underscore-separated identifiers to space-separated for fuzzy matching
          // e.g., "vet_tele_consult" -> "tele consult" (remove common prefixes)
          const normalizedSearch = serviceId
            .replace(/^vet_|^pet_/, '') // Remove common prefixes
            .replace(/_/g, ' ')          // Convert underscores to spaces
            .replace(/-/g, ' ')          // Convert hyphens to spaces
            .trim();

          console.log(`[VendorServices] Trying normalized search: "${normalizedSearch}"`);

          // ✅ FIX: Check count first to prevent bulk updates
          const countCheckPost = await query(
            `SELECT COUNT(*) as count FROM vendor_services 
             WHERE vendor_id = $1 AND (
               LOWER(service_name) ILIKE '%' || LOWER($2) || '%'
               OR LOWER(REPLACE(REPLACE(service_name, '-', ' '), '_', ' ')) ILIKE '%' || LOWER($2) || '%'
             )`,
            [vendorId, normalizedSearch]
          );
          const matchCountPost = parseInt(countCheckPost.rows[0]?.count || '0', 10);

          if (matchCountPost === 0) {
            updated = [];
          } else if (matchCountPost === 1) {
            // Only one match - safe to update
            const vsResult = await query(
              `UPDATE vendor_services 
               SET ${Object.keys(updateData).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
               WHERE vendor_id = $1 AND (
                 LOWER(service_name) ILIKE '%' || LOWER($2) || '%'
                 OR LOWER(REPLACE(REPLACE(service_name, '-', ' '), '_', ' ')) ILIKE '%' || LOWER($2) || '%'
               )
               RETURNING *`,
              [vendorId, normalizedSearch, ...Object.values(updateData)]
            );
            updated = vsResult.rows;
          } else {
            // Multiple matches - cannot safely update without specific id
            console.log(`[VendorServices POST] ERROR: Found ${matchCountPost} services matching "${normalizedSearch}" for vendor ${vendorId}. Cannot update without specific vendor_services.id`);
            return c.json({
              error: `Multiple services found matching "${serviceId}". Please use the specific vendor_services.id to update.`,
              serviceId: serviceId,
              normalizedSearch: normalizedSearch,
              matchingServicesCount: matchCountPost,
              hint: 'Use GET /vendor/:vendorId/services to find the specific service ID, then use that ID in the PUT/POST request'
            }, 400);
          }
        }

        // Strategy 3: Try exact original serviceId match
        if (!updated || updated.length === 0) {
          // ✅ FIX: Check count first to prevent bulk updates
          const countCheck3Post = await query(
            `SELECT COUNT(*) as count FROM vendor_services 
             WHERE vendor_id = $1 AND (
               service_name ILIKE $2 
               OR service_name ILIKE '%' || $2 || '%'
               OR LOWER(REPLACE(REPLACE(service_name, '-', ''), ' ', '')) = LOWER(REPLACE(REPLACE($2, '_', ''), '-', ''))
             )`,
            [vendorId, serviceId]
          );
          const matchCount3Post = parseInt(countCheck3Post.rows[0]?.count || '0', 10);

          if (matchCount3Post === 0) {
            updated = [];
          } else if (matchCount3Post === 1) {
            // Only one match - safe to update
            const vsResult = await query(
              `UPDATE vendor_services 
               SET ${Object.keys(updateData).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
               WHERE vendor_id = $1 AND (
                 service_name ILIKE $2 
                 OR service_name ILIKE '%' || $2 || '%'
                 OR LOWER(REPLACE(REPLACE(service_name, '-', ''), ' ', '')) = LOWER(REPLACE(REPLACE($2, '_', ''), '-', ''))
               )
               RETURNING *`,
              [vendorId, serviceId, ...Object.values(updateData)]
            );
            updated = vsResult.rows;
          } else {
            // Multiple matches - cannot safely update without specific id
            console.log(`[VendorServices POST] ERROR: Found ${matchCount3Post} services matching "${serviceId}" for vendor ${vendorId}. Cannot update without specific vendor_services.id`);
            return c.json({
              error: `Multiple services found matching "${serviceId}". Please use the specific vendor_services.id to update.`,
              serviceId: serviceId,
              matchingServicesCount: matchCount3Post,
              hint: 'Use GET /vendor/:vendorId/services to find the specific service ID, then use that ID in the PUT/POST request'
            }, 400);
          }
        }
      }

      if (!updated || updated.length === 0) {
        // ✅ FIX: Provide more helpful error message for POST endpoint
        // Check if service exists in service_catalog but not in vendor_services
        // ✅ FIX: Handle UUID casting properly
        const isServiceIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
        let catalogCheck;
        if (isServiceIdUuid) {
          catalogCheck = await query(
            'SELECT id, service_name FROM service_catalog WHERE id = $1::uuid OR service_id = $1::text',
            [serviceId]
          );
        } else {
          catalogCheck = await query(
            'SELECT id, service_name FROM service_catalog WHERE id::text = $1 OR service_id = $1::text',
            [serviceId]
          );
        }

        if (catalogCheck.rows.length > 0) {
          return c.json({
            error: 'Service exists in catalog but has not been added to this vendor. Please add it first using POST /vendor/:vendorId/services/add-from-catalog',
            serviceId: serviceId,
            catalogService: catalogCheck.rows[0],
            hint: 'Use POST /vendor/:vendorId/services/add-from-catalog to add this service to your offerings first'
          }, 404);
        }

        // Check if service exists for a different vendor
        // ✅ FIX: Handle UUID casting properly
        let otherVendorCheck;
        if (isServiceIdUuid) {
          otherVendorCheck = await query(
            'SELECT vendor_id FROM vendor_services WHERE id = $1::uuid OR service_id = $1::uuid',
            [serviceId]
          );
        } else {
          otherVendorCheck = await query(
            'SELECT vendor_id FROM vendor_services WHERE id::text = $1 OR service_id::text = $1',
            [serviceId]
          );
        }

        if (otherVendorCheck.rows.length > 0) {
          const actualVendorId = otherVendorCheck.rows[0].vendor_id;
          return c.json({
            error: 'Service not found for this vendor or you do not have permission to update it',
            serviceId: serviceId,
            actualVendorId: actualVendorId,
            requestedVendorId: vendorId,
            hint: `This service belongs to vendor ${actualVendorId}, not ${vendorId}. You can only update services that belong to your vendor.`
          }, 403); // 403 Forbidden - more appropriate than 404
        }

        return c.json({
          error: 'Service not found or you do not have permission to update it',
          serviceId: serviceId,
          hint: 'The service ID does not exist in vendor_services or service_catalog'
        }, 404);
      }

      return c.json({
        success: true,
        service: updated[0],
        message: 'Service updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating vendor service (POST):', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/services/:serviceId
   * Remove service from vendor catalog
   * Requires 'services' capability
   */
  app.delete("/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId: paramVendorId, serviceId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') ||
        await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      await query(
        'DELETE FROM vendor_services WHERE id = $1 AND vendor_id = $2',
        [serviceId, vendorId]
      );

      return c.json({
        success: true,
        message: 'Service removed successfully',
      });
    } catch (error: any) {
      console.error('Error removing vendor service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/custom/:serviceId/publish
   * Publish a draft custom service (auto-approved - no admin approval needed)
   * Changes status from 'draft' to 'published'
   */
  app.post("/vendor/:vendorId/services/custom/:serviceId/publish", async (c) => {
    try {
      const { vendorId: paramVendorId, serviceId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      if (vendorId === null) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check if vendor has services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') ||
        await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      // ✅ FIX: serviceId is the primary key 'id' of vendor_services table, not 'service_id'
      // Query by id (primary key) instead of service_id
      const services = await select('vendor_services', {
        id: serviceId,
        vendor_id: vendorId
      });

      if (services.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = services[0];

      // Verify it's a custom service
      if (!service.is_custom_service) {
        return c.json({ error: 'This endpoint is only for custom services' }, 400);
      }

      // Only draft services can be published
      if (service.publish_status !== 'draft') {
        return c.json({
          error: `Cannot publish service with status '${service.publish_status}'. Only draft services can be published.`
        }, 400);
      }

      // Auto-approve: Update directly to 'published' (no approval needed)
      await update(
        'vendor_services',
        { id: serviceId, vendor_id: vendorId },
        {
          publish_status: 'published',
          is_enabled: true,
          submitted_for_approval_at: null, // No approval needed
        }
      );

      return c.json({
        success: true,
        message: 'Service published successfully',
        publishStatus: 'published',
      });
    } catch (error: any) {
      console.error('Error publishing custom service:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

