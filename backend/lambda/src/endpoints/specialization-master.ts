/**
 * ============================================================================
 * SPECIALIZATION MASTER ENDPOINTS
 * ============================================================================
 * 
 * API endpoints for managing specializations (problem grid items):
 * - Admin: CRUD operations for specializations and symptoms
 * - Public: Problem grid data for customer app
 * - Vendor: Specialization options for profile configuration
 * 
 * Date: 2026-01-29
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';

// ============================================================================
// TYPES
// ============================================================================

interface Specialization {
  id: string;
  specialization_id: string;
  name: string;
  display_name: string;
  description: string;
  category_id: string;
  applicable_roles: string[];
  icon_name: string;
  icon_color: string;
  display_order: number;
  is_active: boolean;
  show_in_problem_grid: boolean;
  show_in_vendor_profile: boolean;
  show_in_services_dashboard: boolean;
  allowed_service_styles: string[];
  symptoms?: Symptom[];
  symptom_count?: number;
}

interface Symptom {
  id: string;
  specialization_id: string;
  symptom_name: string;
  symptom_display_name: string;
  symptom_keywords: string[];
  display_order: number;
  is_active: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get role display name from role ID
 */
function getRoleDisplayName(roleId: string): string {
  const roleNames: Record<string, string> = {
    'vet_solo': 'Veterinarian (Solo)',
    'vet_clinic': 'Veterinary Clinic',
    'veterinarian': 'Veterinarian',
    'groomer_solo': 'Groomer (Solo)',
    'groomer_center': 'Grooming Center',
    'pet_groomer': 'Pet Groomer',
    'trainer_solo': 'Trainer (Solo)',
    'trainer_center': 'Training Center',
    'pet_trainer': 'Pet Trainer',
    'walker': 'Pet Walker',
    'pet_walker': 'Pet Walker',
    'boarding': 'Pet Boarding',
    'pet_boarder': 'Pet Boarder',
    'pet_boarding': 'Pet Boarding',
    'nutritionist': 'Pet Nutritionist',
    'nutritionist_center': 'Nutritionist Center',
    'pet_behaviorist': 'Pet Behaviorist',
    'behaviorist_solo': 'Behaviorist (Solo)',
    'behaviorist_center': 'Behaviorist Center',
  };
  return roleNames[roleId] || roleId;
}

/**
 * Get category display name
 */
function getCategoryDisplayName(categoryId: string): string {
  const categoryNames: Record<string, string> = {
    'veterinary': 'Veterinary',
    'grooming': 'Grooming',
    'training': 'Training',
    'walking': 'Walking',
    'boarding': 'Boarding',
    'behavioral': 'Behavioral',
    'wellness': 'Wellness & Nutrition',
    'diagnostic': 'Diagnostics',
    'pharmacy': 'Pharmacy',
    'emergency': 'Emergency',
  };
  return categoryNames[categoryId] || categoryId;
}

/** Map service_catalog category_id to specialization_master category_id (some differ) */
const CATEGORY_TO_SPEC: Record<string, string> = {
  veterinary: 'veterinary',
  grooming: 'grooming',
  training: 'training',
  walking: 'walking',
  diagnostic: 'veterinary',
  diagnostics: 'veterinary',
  pharmacy: 'veterinary',
  emergency: 'veterinary',
  wellness: 'wellness',
  specialty: 'veterinary',
  boarding: 'boarding',
  nutrition: 'wellness',
  behavioral: 'behavioral',
  behaviour: 'behavioral',
};

/** Expand role names for overlap matching (sitter → sitter,pet_sitter so we match specs with either) */
const ROLE_EXPANSIONS: Record<string, string[]> = {
  sitter: ['sitter', 'pet_sitter'],
  pet_sitter: ['sitter', 'pet_sitter'],
  boarding: ['boarding', 'pet_boarder', 'pet_daycare', 'pet_sitter', 'pet_boarding'],
  pet_boarding: ['boarding', 'pet_boarder', 'pet_daycare', 'pet_sitter', 'pet_boarding'],
  pet_boarding_daycare: ['boarding', 'pet_boarder', 'pet_daycare', 'pet_sitter', 'pet_boarding'],
  pet_boarder: ['boarding', 'pet_boarder', 'pet_daycare'],
  pet_daycare: ['boarding', 'pet_daycare', 'pet_sitter'],
  walker: ['walker', 'pet_walker', 'dog_walker'],
  pet_walker: ['walker', 'pet_walker', 'dog_walker'],
  vet_solo: ['vet_solo', 'vet', 'veterinarian', 'vet_clinic'],
  vet_clinic: ['vet_clinic', 'veterinary_clinic', 'vet', 'veterinarian'],
  veterinarian: ['vet', 'veterinarian', 'vet_clinic', 'vet_solo'],
  groomer_solo: ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo'],
  groomer_center: ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo'],
  pet_groomer: ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo'],
  trainer_solo: ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  trainer_center: ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  pet_trainer: ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  resort: ['resort', 'pet_resort'],
  pet_resort: ['resort', 'pet_resort'],
  sunset: ['sunset', 'pet_sunset_services'],
  pet_sunset_services: ['sunset', 'pet_sunset_services'],
  nutritionist: ['nutritionist', 'pet_nutritionist', 'nutritionist_center'],
  nutritionist_center: ['nutritionist', 'pet_nutritionist', 'nutritionist_center'],
  pet_nutritionist: ['nutritionist', 'pet_nutritionist', 'nutritionist_center'],
};

/** Normalize display names / variants to canonical codes (frontend may send "Pet Sitter" or "Groomer (Center)" etc) */
const ROLE_DISPLAY_TO_CODE: Record<string, string> = {
  'pet sitter': 'sitter', 'pet_sitter': 'sitter',
  'pet walker': 'walker', 'pet_walker': 'walker',
  'pet resort': 'resort', 'pet_resort': 'resort',
  'pet boarding': 'pet_boarding', 'pet_boarding': 'pet_boarding',
  'pet boarding & daycare': 'pet_boarding_daycare', 'pet_boarding_daycare': 'pet_boarding_daycare',
  'boarding': 'boarding', 'pet_boarder': 'pet_boarder', 'pet_daycare': 'pet_daycare',
  'sunset care': 'sunset', 'pet_sunset_services': 'sunset',
  'trainer (center)': 'trainer_center', 'trainer (solo)': 'trainer_solo', 'trainer_center': 'trainer_center', 'trainer_solo': 'trainer_solo',
  'veterinarian (solo)': 'vet_solo', 'veterinary clinic': 'vet_clinic', 'vet_solo': 'vet_solo', 'vet_clinic': 'vet_clinic',
  'veterinarian': 'vet_solo', 'vet': 'vet_solo',
  'groomer (center)': 'groomer_center', 'groomer (solo)': 'groomer_solo', 'groomer_center': 'groomer_center', 'groomer_solo': 'groomer_solo',
  'groomer_(center)': 'groomer_center', 'groomer_(solo)': 'groomer_solo',
  'pet groomer': 'pet_groomer', 'pet_groomer': 'pet_groomer', 'grooming center': 'groomer_center',
  'nutritionist (center)': 'nutritionist_center', 'nutritionist (solo)': 'nutritionist',
  'nutritionist_center': 'nutritionist_center', 'nutritionist': 'nutritionist',
  'nutritionist_(center)': 'nutritionist_center', 'nutritionist_(solo)': 'nutritionist',
  'pet nutritionist': 'pet_nutritionist', 'pet_nutritionist': 'pet_nutritionist',
};

function normalizeRoleForApi(r: string): string {
  const s = (r || '').toString().trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_DISPLAY_TO_CODE[s] ?? ROLE_DISPLAY_TO_CODE[(r || '').toString().trim().toLowerCase()] ?? s;
}

function expandRoleIdsForOverlap(roleIds: string[]): string[] {
  const seen = new Set<string>();
  for (const r of roleIds) {
    const norm = normalizeRoleForApi(r);
    if (!norm) continue;
    seen.add(norm);
    const expanded = ROLE_EXPANSIONS[norm];
    if (expanded) expanded.forEach((x) => seen.add(x));
  }
  return Array.from(seen);
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function registerSpecializationMasterEndpoints(app: Hono) {
  
  // ========================================================================
  // ADMIN: LIST ALL SPECIALIZATIONS
  // ========================================================================
  
  /**
   * GET /admin/specializations
   * List all specializations with optional filtering
   * By default, only returns active specializations unless includeInactive=true
   */
  app.get('/admin/specializations', async (c) => {
    try {
      const categoryId = c.req.query('categoryId');
      const roleIdsRaw = c.req.query('roleIds'); // comma-separated; filter to specializations whose applicable_roles overlap
      const includeSymptoms = c.req.query('includeSymptoms') === 'true';
      const includeInactive = c.req.query('includeInactive') === 'true';
      
      const roleIds = roleIdsRaw && typeof roleIdsRaw === 'string' && roleIdsRaw.trim()
        ? roleIdsRaw.split(',').map((r: string) => r.trim()).filter(Boolean)
        : [];
      const expandedRoleIds = roleIds.length > 0 ? expandRoleIdsForOverlap(roleIds) : [];
      // Forensic: log incoming params
      console.log('[SPEC-MASTER] GET /admin/specializations', { categoryId: categoryId ?? '(none)', roleIdsRaw: roleIdsRaw ?? '(none)', roleIds, expandedRoleIds });
      
      // ✅ API CONTRACT: When roleIds provided but no categoryId, derive categories from service_catalog (role config → services → categories → specializations)
      let effectiveCategoryId: string | null = null;
      let categoriesFromRoles: string[] = [];
      if (!categoryId && expandedRoleIds.length > 0) {
        try {
          const catResult = await query(
            `SELECT DISTINCT category_id FROM service_catalog
             WHERE status = 'active' AND category_id IS NOT NULL AND category_id != ''
               AND applicable_roles && $1::text[]`,
            [expandedRoleIds]
          );
          categoriesFromRoles = (catResult.rows || []).map((r: any) => r.category_id).filter(Boolean);
          // Map to specialization_master convention
          categoriesFromRoles = [...new Set(categoriesFromRoles.map((cid: string) =>
            CATEGORY_TO_SPEC[(cid || '').toLowerCase()] || cid
          ))];
        } catch (e: any) {
          console.warn('[SPEC-MASTER] Could not get categories from service_catalog:', e.message);
        }
      } else if (categoryId) {
        const raw = (categoryId as string).trim();
        const bySlug = CATEGORY_TO_SPEC[raw.toLowerCase()] ?? raw;
        // Admin UI may send service_categories.id (UUID) not slug; specialization_master uses slugs
        const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
        if (looksLikeUuid || !CATEGORY_TO_SPEC[raw.toLowerCase()]) {
          try {
            const resolved = await query(
              `SELECT category_id FROM service_categories WHERE id::text = $1 OR category_id = $2 LIMIT 1`,
              [raw, raw]
            );
            if (resolved.rows?.length > 0 && resolved.rows[0].category_id) {
              const slug = String(resolved.rows[0].category_id).trim();
              effectiveCategoryId = CATEGORY_TO_SPEC[slug.toLowerCase()] || slug;
            } else {
              effectiveCategoryId = bySlug;
            }
          } catch (e: any) {
            console.warn('[SPEC-MASTER] Resolve categoryId from service_categories:', e.message);
            effectiveCategoryId = bySlug;
          }
        } else {
          effectiveCategoryId = bySlug;
        }
      }
      console.log('[SPEC-MASTER] Resolved', { effectiveCategoryId, categoriesFromRoles });
      
      let sqlQuery = `
        SELECT 
          sm.*,
          (SELECT COUNT(*) FROM specialization_symptoms ss WHERE ss.specialization_id = sm.specialization_id AND ss.is_active = true) as symptom_count
        FROM specialization_master sm
        WHERE 1=1
      `;
      const params: any[] = [];
      
      // ✅ FIX: Filter out inactive by default
      if (!includeInactive) {
        sqlQuery += ` AND sm.is_active = true`;
      }
      
      if (effectiveCategoryId) {
        params.push(effectiveCategoryId);
        sqlQuery += ` AND (sm.category_id = $${params.length} OR LOWER(sm.category_id) = LOWER($${params.length}))`;
      } else if (categoriesFromRoles.length > 0) {
        params.push(categoriesFromRoles);
        sqlQuery += ` AND (sm.category_id = ANY($${params.length}::text[]) OR EXISTS (SELECT 1 FROM unnest($${params.length}::text[]) AS x WHERE LOWER(sm.category_id) = LOWER(x)))`;
      }
      
      // Filter by roles: expand role names (sitter→sitter,pet_sitter) so we match specs with legacy roles
      if (expandedRoleIds.length > 0) {
        params.push(expandedRoleIds);
        sqlQuery += ` AND (sm.applicable_roles = '{}' OR sm.applicable_roles IS NULL OR array_length(sm.applicable_roles, 1) IS NULL OR sm.applicable_roles && $${params.length}::text[])`;
      }
      
      sqlQuery += ` ORDER BY sm.category_id, sm.display_order, sm.name`;
      
      let result = await query(sqlQuery, params);
      console.log('[SPEC-MASTER] Query result', { effectiveCategoryId, categoriesFromRoles: categoriesFromRoles.length, expandedRoleIdsCount: expandedRoleIds.length, rowCount: result.rows.length });
      
      // Fallback: when we have a category (or categories from roles) and role filter returned 0, return all specs for that category so UI shows something
      if (result.rows.length === 0 && expandedRoleIds.length > 0 && (effectiveCategoryId || categoriesFromRoles.length > 0)) {
        let fallbackQuery = `
          SELECT sm.*, (SELECT COUNT(*) FROM specialization_symptoms ss WHERE ss.specialization_id = sm.specialization_id AND ss.is_active = true) as symptom_count
          FROM specialization_master sm WHERE sm.is_active = true
        `;
        const fallbackParams: any[] = [];
        if (effectiveCategoryId) {
          fallbackParams.push(effectiveCategoryId);
          fallbackQuery += ` AND (sm.category_id = $${fallbackParams.length} OR LOWER(sm.category_id) = LOWER($${fallbackParams.length}))`;
        } else if (categoriesFromRoles.length > 0) {
          fallbackParams.push(categoriesFromRoles);
          fallbackQuery += ` AND (sm.category_id = ANY($${fallbackParams.length}::text[]) OR EXISTS (SELECT 1 FROM unnest($${fallbackParams.length}::text[]) AS x WHERE LOWER(sm.category_id) = LOWER(x)))`;
        }
        fallbackQuery += ` ORDER BY sm.category_id, sm.display_order, sm.name`;
        const fallbackResult = await query(fallbackQuery, fallbackParams);
        if (fallbackResult.rows.length > 0) {
          console.log('[SPEC-MASTER] Fallback (no role filter) returned', fallbackResult.rows.length, 'rows');
          result = fallbackResult;
        }
      }
      
      let specializations = result.rows.map((row: any) => ({
        id: row.id,
        specializationId: row.specialization_id,
        name: row.name,
        displayName: row.display_name || row.name,
        description: row.description,
        categoryId: row.category_id,
        categoryName: getCategoryDisplayName(row.category_id),
        applicableRoles: row.applicable_roles || [],
        applicableRoleNames: (row.applicable_roles || []).map(getRoleDisplayName),
        iconName: row.icon_name,
        iconColor: row.icon_color,
        displayOrder: row.display_order,
        isActive: row.is_active,
        showInProblemGrid: row.show_in_problem_grid,
        showInVendorProfile: row.show_in_vendor_profile,
        showInServicesDashboard: row.show_in_services_dashboard,
        allowedServiceStyles: row.allowed_service_styles || ['at_home', 'at_center', 'tele'],
        symptomCount: parseInt(row.symptom_count) || 0,
      }));
      
      // Include symptoms if requested
      if (includeSymptoms) {
        const symptomsResult = await query(`
          SELECT * FROM specialization_symptoms 
          WHERE is_active = true 
          ORDER BY specialization_id, display_order
        `);
        
        const symptomsBySpec: Record<string, any[]> = {};
        symptomsResult.rows.forEach((row: any) => {
          if (!symptomsBySpec[row.specialization_id]) {
            symptomsBySpec[row.specialization_id] = [];
          }
          symptomsBySpec[row.specialization_id].push({
            id: row.id,
            symptomName: row.symptom_name,
            symptomDisplayName: row.symptom_display_name || row.symptom_name,
            symptomKeywords: row.symptom_keywords || [],
            displayOrder: row.display_order,
          });
        });
        
        specializations = specializations.map((spec: any) => ({
          ...spec,
          symptoms: symptomsBySpec[spec.specializationId] || [],
        }));
      }
      
      // Group by category for admin UI
      const byCategory: Record<string, any[]> = {};
      specializations.forEach((spec: any) => {
        if (!byCategory[spec.categoryId]) {
          byCategory[spec.categoryId] = [];
        }
        byCategory[spec.categoryId].push(spec);
      });
      
      return c.json({
        success: true,
        data: specializations,
        specializations,
        byCategory,
        total: specializations.length,
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] List error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  // ========================================================================
  // ADMIN: GET SINGLE SPECIALIZATION
  // ========================================================================
  
  /**
   * GET /admin/specializations/:id
   * Get single specialization with symptoms
   */
  app.get('/admin/specializations/:id', async (c) => {
    try {
      const id = c.req.param('id');
      
      const result = await query(`
        SELECT * FROM specialization_master 
        WHERE specialization_id = $1 OR id::text = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return c.json({ success: false, error: 'Specialization not found' }, 404);
      }
      
      const row = result.rows[0];
      
      // Get symptoms
      const symptomsResult = await query(`
        SELECT * FROM specialization_symptoms 
        WHERE specialization_id = $1 
        ORDER BY display_order
      `, [row.specialization_id]);
      
      return c.json({
        success: true,
        data: {
          id: row.id,
          specializationId: row.specialization_id,
          name: row.name,
          displayName: row.display_name || row.name,
          description: row.description,
          categoryId: row.category_id,
          categoryName: getCategoryDisplayName(row.category_id),
          applicableRoles: row.applicable_roles || [],
          applicableRoleNames: (row.applicable_roles || []).map(getRoleDisplayName),
          iconName: row.icon_name,
          iconColor: row.icon_color,
          displayOrder: row.display_order,
          isActive: row.is_active,
          showInProblemGrid: row.show_in_problem_grid,
          showInVendorProfile: row.show_in_vendor_profile,
          showInServicesDashboard: row.show_in_services_dashboard,
          allowedServiceStyles: row.allowed_service_styles || ['at_home', 'at_center', 'tele'],
          symptoms: symptomsResult.rows.map((s: any) => ({
            id: s.id,
            symptomName: s.symptom_name,
            symptomDisplayName: s.symptom_display_name || s.symptom_name,
            symptomKeywords: s.symptom_keywords || [],
            displayOrder: s.display_order,
            isActive: s.is_active,
          })),
        },
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Get error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  // ========================================================================
  // ADMIN: CREATE SPECIALIZATION
  // ========================================================================
  
  /**
   * POST /admin/specializations
   * Create new specialization
   */
  app.post('/admin/specializations', async (c) => {
    try {
      const body = await c.req.json();
      const {
        specializationId,
        name,
        displayName,
        description,
        categoryId,
        applicableRoles,
        iconName,
        iconColor,
        displayOrder,
        showInProblemGrid = true,
        showInVendorProfile = true,
        showInServicesDashboard = true,
        allowedServiceStyles = ['at_home', 'at_center', 'tele'],
      } = body;
      
      if (!specializationId || !name || !categoryId) {
        return c.json({
          success: false,
          error: 'specializationId, name, and categoryId are required',
        }, 400);
      }
      
      // Check if specialization ID already exists
      const existing = await query(
        'SELECT id FROM specialization_master WHERE specialization_id = $1',
        [specializationId]
      );
      
      if (existing.rows.length > 0) {
        return c.json({
          success: false,
          error: 'Specialization ID already exists',
        }, 400);
      }
      
      const result = await query(`
        INSERT INTO specialization_master (
          specialization_id, name, display_name, description, category_id,
          applicable_roles, icon_name, icon_color, display_order,
          show_in_problem_grid, show_in_vendor_profile, show_in_services_dashboard,
          allowed_service_styles
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        specializationId,
        name,
        displayName || name,
        description,
        categoryId,
        applicableRoles || [],
        iconName,
        iconColor,
        displayOrder || 0,
        showInProblemGrid,
        showInVendorProfile,
        showInServicesDashboard,
        JSON.stringify(allowedServiceStyles),
      ]);
      
      return c.json({
        success: true,
        message: 'Specialization created',
        data: {
          id: result.rows[0].id,
          specializationId: result.rows[0].specialization_id,
        },
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Create error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  // ========================================================================
  // ADMIN: UPDATE SPECIALIZATION
  // ========================================================================
  
  /**
   * PUT /admin/specializations/:id
   * Update specialization
   */
  app.put('/admin/specializations/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      const fields = [
        'name', 'display_name', 'description', 'category_id',
        'applicable_roles', 'icon_name', 'icon_color', 'display_order',
        'is_active', 'show_in_problem_grid', 'show_in_vendor_profile',
        'show_in_services_dashboard', 'allowed_service_styles'
      ];
      
      const fieldMapping: Record<string, string> = {
        displayName: 'display_name',
        categoryId: 'category_id',
        applicableRoles: 'applicable_roles',
        iconName: 'icon_name',
        iconColor: 'icon_color',
        displayOrder: 'display_order',
        isActive: 'is_active',
        showInProblemGrid: 'show_in_problem_grid',
        showInVendorProfile: 'show_in_vendor_profile',
        showInServicesDashboard: 'show_in_services_dashboard',
        allowedServiceStyles: 'allowed_service_styles',
      };
      
      for (const [key, value] of Object.entries(body)) {
        const dbField = fieldMapping[key] || key;
        if (fields.includes(dbField) && value !== undefined) {
          updates.push(`${dbField} = $${paramIndex}`);
          if (dbField === 'allowed_service_styles') {
            values.push(JSON.stringify(value));
          } else if (Array.isArray(value)) {
            values.push(value);
          } else {
            values.push(value);
          }
          paramIndex++;
        }
      }
      
      if (updates.length === 0) {
        return c.json({ success: false, error: 'No fields to update' }, 400);
      }
      
      values.push(id);
      
      await query(`
        UPDATE specialization_master 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE specialization_id = $${paramIndex} OR id::text = $${paramIndex}
      `, values);
      
      return c.json({
        success: true,
        message: 'Specialization updated',
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Update error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  // ========================================================================
  // ADMIN: DELETE SPECIALIZATION
  // ========================================================================
  
  /**
   * DELETE /admin/specializations/:id
   * Soft delete specialization
   */
  app.delete('/admin/specializations/:id', async (c) => {
    try {
      const id = c.req.param('id');
      
      await query(`
        UPDATE specialization_master 
        SET is_active = false, updated_at = NOW()
        WHERE specialization_id = $1 OR id::text = $1
      `, [id]);
      
      return c.json({
        success: true,
        message: 'Specialization deactivated',
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Delete error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  // ========================================================================
  // ADMIN: MANAGE SYMPTOMS
  // ========================================================================
  
  /**
   * GET /admin/specializations/:id/symptoms
   * List symptoms for a specialization
   */
  app.get('/admin/specializations/:id/symptoms', async (c) => {
    try {
      const id = c.req.param('id');
      
      const result = await query(`
        SELECT * FROM specialization_symptoms 
        WHERE specialization_id = $1 
        ORDER BY display_order, symptom_name
      `, [id]);
      
      return c.json({
        success: true,
        data: result.rows.map((row: any) => ({
          id: row.id,
          specializationId: row.specialization_id,
          symptomName: row.symptom_name,
          symptomDisplayName: row.symptom_display_name || row.symptom_name,
          symptomKeywords: row.symptom_keywords || [],
          petTypes: row.pet_types || [],
          displayOrder: row.display_order,
          isActive: row.is_active,
        })),
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] List symptoms error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  /**
   * POST /admin/specializations/:id/symptoms
   * Add symptom to specialization
   */
  app.post('/admin/specializations/:id/symptoms', async (c) => {
    try {
      const specializationId = c.req.param('id');
      const body = await c.req.json();
      const { symptomName, symptomDisplayName, symptomKeywords, petTypes, displayOrder } = body;
      
      if (!symptomName) {
        return c.json({ success: false, error: 'symptomName is required' }, 400);
      }
      
      const result = await query(`
        INSERT INTO specialization_symptoms (
          specialization_id, symptom_name, symptom_display_name, 
          symptom_keywords, pet_types, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (specialization_id, symptom_name) DO UPDATE SET
          symptom_display_name = EXCLUDED.symptom_display_name,
          symptom_keywords = EXCLUDED.symptom_keywords,
          pet_types = EXCLUDED.pet_types,
          display_order = EXCLUDED.display_order
        RETURNING *
      `, [
        specializationId,
        symptomName,
        symptomDisplayName || symptomName,
        symptomKeywords || [],
        petTypes || [],
        displayOrder || 0,
      ]);
      
      return c.json({
        success: true,
        message: 'Symptom added',
        data: { id: result.rows[0].id },
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Add symptom error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  /**
   * DELETE /admin/symptoms/:id
   * Delete symptom
   */
  app.delete('/admin/symptoms/:id', async (c) => {
    try {
      const id = c.req.param('id');
      
      await query('DELETE FROM specialization_symptoms WHERE id = $1', [id]);
      
      return c.json({
        success: true,
        message: 'Symptom deleted',
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Delete symptom error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  // ========================================================================
  // PUBLIC: PROBLEM GRID FOR CUSTOMERS
  // ========================================================================
  
  /**
   * GET /public/problem-grid
   * Get ALL problem grid items for customer home "What's your need?" (no auth).
   * Shows items where show_in_problem_grid OR show_in_services_dashboard = true
   * so admin-created specializations with "show on customer app" appear.
   * Optional query: categoryId to filter by category.
   */
  app.get('/public/problem-grid', async (c) => {
    try {
      const categoryId = c.req.query('categoryId');
      let sqlQuery = `
        SELECT sm.specialization_id, sm.name, sm.display_name, sm.description,
               sm.category_id, sm.icon_name, sm.icon_color, sm.display_order,
               sm.applicable_roles, sm.allowed_service_styles
        FROM specialization_master sm
        WHERE sm.is_active = true
          AND (sm.show_in_problem_grid = true OR sm.show_in_services_dashboard = true)
      `;
      const params: any[] = [];
      if (categoryId) {
        params.push(categoryId);
        sqlQuery += ` AND sm.category_id = $${params.length}`;
      }
      sqlQuery += ` ORDER BY sm.category_id, sm.display_order, sm.name`;
      const result = await query(sqlQuery, params);
      const problems = result.rows.map((row: any) => ({
        id: row.specialization_id,
        problemId: row.specialization_id,
        name: row.name,
        displayName: row.display_name || row.name,
        description: row.description,
        categoryId: row.category_id,
        categoryName: getCategoryDisplayName(row.category_id),
        iconName: row.icon_name,
        iconColor: row.icon_color,
        displayOrder: row.display_order,
        applicableRoles: row.applicable_roles || [],
        allowedServiceStyles: row.allowed_service_styles || ['at_home', 'at_center', 'tele'],
      }));
      return c.json({ success: true, problems, byCategory: problems.reduce((acc: any, p: any) => {
        if (!acc[p.categoryId]) acc[p.categoryId] = [];
        acc[p.categoryId].push(p);
        return acc;
      }, {}) });
    } catch (err: any) {
      console.error('[SPEC-MASTER] Public problem-grid all error:', err.message);
      // Return 200 with empty so customer home loads gracefully (non-critical)
      return c.json({ success: true, problems: [], byCategory: {} });
    }
  });

  /**
   * GET /public/problem-grid/:roleId
   * Get problem grid items for customer app (filtered by role).
   * Shows items where show_in_problem_grid OR show_in_services_dashboard = true.
   */
  app.get('/public/problem-grid/:roleId', async (c) => {
    try {
      const roleId = c.req.param('roleId');
      
      const result = await query(`
        SELECT sm.*, 
          (SELECT json_agg(json_build_object(
            'name', ss.symptom_name,
            'displayName', COALESCE(ss.symptom_display_name, ss.symptom_name)
          ) ORDER BY ss.display_order)
          FROM specialization_symptoms ss 
          WHERE ss.specialization_id = sm.specialization_id AND ss.is_active = true
          ) as symptoms
        FROM specialization_master sm
        WHERE sm.is_active = true 
          AND (sm.show_in_problem_grid = true OR sm.show_in_services_dashboard = true)
          AND $1 = ANY(sm.applicable_roles)
        ORDER BY sm.display_order, sm.name
      `, [roleId]);
      
      return c.json({
        success: true,
        problems: result.rows.map((row: any) => ({
          id: row.specialization_id,
          problemId: row.specialization_id,
          name: row.name,
          displayName: row.display_name || row.name,
          description: row.description,
          iconName: row.icon_name,
          iconColor: row.icon_color,
          allowedServiceStyles: row.allowed_service_styles || ['at_home', 'at_center', 'tele'],
          symptoms: row.symptoms || [],
          categoryId: row.category_id,
        })),
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Public problem grid error:', error.message);
      // Return 200 with empty so customer app loads gracefully (non-critical)
      return c.json({ success: true, problems: [] });
    }
  });
  
  // ========================================================================
  // PUBLIC: SEARCH SYMPTOMS
  // ========================================================================
  
  /**
   * GET /public/search/symptoms
   * Search symptoms and return matching specializations
   */
  app.get('/public/search/symptoms', async (c) => {
    try {
      const q = c.req.query('q') || '';
      const roleId = c.req.query('roleId');
      
      if (!q || q.length < 2) {
        return c.json({ success: true, results: [] });
      }
      
      let sqlQuery = `
        SELECT DISTINCT 
          sm.specialization_id,
          sm.name,
          sm.display_name,
          sm.display_order,
          sm.icon_name,
          sm.icon_color,
          sm.category_id,
          ss.symptom_name as matched_symptom
        FROM specialization_master sm
        JOIN specialization_symptoms ss ON ss.specialization_id = sm.specialization_id
        WHERE sm.is_active = true 
          AND sm.show_in_problem_grid = true
          AND ss.is_active = true
          AND (
            ss.symptom_name ILIKE $1 
            OR ss.symptom_display_name ILIKE $1
            OR $2 = ANY(ss.symptom_keywords)
          )
      `;
      const params: any[] = [`%${q}%`, q.toLowerCase()];
      
      if (roleId) {
        params.push(roleId);
        sqlQuery += ` AND $${params.length} = ANY(sm.applicable_roles)`;
      }
      
      sqlQuery += ` ORDER BY sm.display_order, sm.name LIMIT 10`;
      
      const result = await query(sqlQuery, params);
      
      return c.json({
        success: true,
        results: result.rows.map((row: any) => ({
          specializationId: row.specialization_id,
          name: row.display_name || row.name,
          matchedSymptom: row.matched_symptom,
          iconName: row.icon_name,
          iconColor: row.icon_color,
          categoryId: row.category_id,
        })),
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Search symptoms error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  // ========================================================================
  // VENDOR: SPECIALIZATION OPTIONS FOR PROFILE
  // ========================================================================
  
  /**
   * Role → category_id(s) for filtering vendor specializations by Catalog category.
   * Master for specializations is defined per Category in Admin Catalog; vendor profile must show only that role's category.
   */
  function getCategoriesForRole(roleName: string): string[] {
    const normalized = (roleName || '').toLowerCase().replace(/\s+/g, '_');
    const roleToCategories: Record<string, string[]> = {
      veterinarian: ['veterinary'],
      vet_solo: ['veterinary'],
      veterinary_clinic: ['veterinary'],
      vet_clinic: ['veterinary'],
      diagnostics_center: ['diagnostic', 'veterinary'],
      pet_groomer: ['grooming'],
      groomer_center: ['grooming'],
      groomer_solo: ['grooming'],
      pet_trainer: ['training'],
      trainer_center: ['training'],
      trainer_solo: ['training'],
      pet_behaviorist: ['training', 'behavioral'],
      behaviorist_solo: ['training', 'behavioral'],
      behaviorist_center: ['training', 'behavioral'],
      pet_walker: ['walking'],
      walker: ['walking'],
      pet_sitter: ['boarding'],
      sitter: ['boarding'],
      pet_boarding: ['boarding'],
      boarding: ['boarding'],
      nutritionist: ['nutrition'],
      nutritionist_center: ['nutrition'],
      pet_pharmacy: ['pharmacy'],
      pharmacy: ['pharmacy'],
      pet_ambulance: ['emergency'],
      ambulance: ['emergency'],
      pet_photographer: ['specialty'],
      photographer: ['specialty'],
    };
    return roleToCategories[normalized] || [];
  }

  /**
   * Role names for service_catalog.applicable_roles overlap (align with service-catalog.ts roleMappings).
   * Used to find services mapped to this role, then load specializations from those services' category.
   */
  function getRoleNamesForCatalog(roleName: string): string[] {
    const normalized = (roleName || '').toLowerCase().replace(/\s+/g, '_');
    const map: Record<string, string[]> = {
      veterinarian: ['vet', 'veterinarian', 'vet_clinic', 'vet_solo'],
      vet_solo: ['vet', 'veterinarian', 'vet_clinic', 'vet_solo', 'solo_vet'],
      veterinary_clinic: ['vet_clinic', 'veterinary_clinic', 'vet', 'veterinarian'],
      vet_clinic: ['vet_clinic', 'veterinary_clinic', 'vet', 'veterinarian', 'vet_solo'],
      diagnostics_center: ['diagnostics_center', 'vet_clinic', 'veterinarian'],
      nutritionist: ['nutritionist', 'pet_nutritionist'],
      nutritionist_center: ['nutritionist', 'pet_nutritionist', 'nutritionist_center'],
      pet_pharmacy: ['pharmacy', 'pet_pharmacy'],
      pet_ambulance: ['ambulance', 'pet_ambulance'],
      ambulance: ['ambulance', 'pet_ambulance'],
      pharmacy: ['pharmacy', 'pet_pharmacy'],
      insurance: ['insurance', 'pet_insurance'],
      center: ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'center'],
      testing_center: ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'testing_center', 'center'],
      clinic: ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'clinic'],
      pet_groomer: ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
      groomer_center: ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
      groomer_solo: ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
      pet_walker: ['walker', 'pet_walker', 'dog_walker'],
      walker: ['walker', 'pet_walker', 'dog_walker'],
      pet_trainer: ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
      trainer_center: ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
      trainer_solo: ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
      pet_behaviorist: ['behaviorist', 'pet_behaviorist', 'behaviorist_solo', 'behaviorist_center'],
      behaviorist_solo: ['behaviorist_solo', 'pet_behaviorist', 'behaviorist'],
      behaviorist_center: ['behaviorist_center', 'pet_behaviorist', 'behaviorist'],
      pet_sitter: ['sitter', 'pet_sitter'],
      sitter: ['sitter', 'pet_sitter'],
      pet_taxi: ['transport', 'pet_transport', 'pet_taxi', 'relocation'],
      relocation: ['pet_transport', 'relocation', 'pet_relocation'],
      pet_boarding: ['boarding', 'pet_boarder', 'pet_hotel', 'pet_boarding', 'pet_daycare'],
      boarding: ['boarding', 'pet_boarder', 'pet_daycare', 'pet_sitter'],
      pet_resort: ['resort', 'pet_resort'],
      resort: ['resort', 'pet_resort'],
      pet_cafe: ['cafe', 'pet_cafe'],
      cafe: ['cafe', 'pet_cafe'],
      pet_photographer: ['photographer', 'pet_photographer'],
      photographer: ['photographer', 'pet_photographer'],
      pet_sunset_services: ['sunset', 'pet_sunset_services', 'sunset_services'],
      sunset: ['sunset', 'pet_sunset_services'],
      holiday: ['holiday'],
      pet_products_store: ['store', 'pet_store', 'retailer', 'seller', 'pet_products_store'],
      seller: ['store', 'pet_store', 'seller', 'pet_products_store'],
      pet_breeder: ['breeder', 'pet_breeder'],
      breeder: ['breeder', 'pet_breeder'],
      pet_shelter: ['shelter', 'pet_shelter', 'adoption_center', 'pet_adoption_center'],
      adoption_center: ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
    };
    const variants = map[normalized];
    return variants && variants.length > 0 ? [...new Set([normalized, ...variants])] : [normalized];
  }

  /**
   * GET /vendor/specializations/:roleId
   * 360° dynamic: Role → services (service_catalog) → categories (service masters) → specializations.
   * Vendor has role ID; role has services (service_catalog.applicable_roles). Categories are service masters
   * with specializations per category. Same categories drive service catalog and "What's your pet needs?" discovery.
   */
  app.get('/vendor/specializations/:roleId', async (c) => {
    try {
      const roleId = c.req.param('roleId');
      
      // Resolve role name (UUID → name from roles table)
      let actualRoleId = roleId;
      if (roleId.includes('-')) {
        const roleResult = await query(
          'SELECT name FROM roles WHERE id::text = $1 AND is_active = true',
          [roleId]
        );
        if (roleResult.rows.length > 0) {
          actualRoleId = (roleResult.rows[0].name || actualRoleId).toString().toLowerCase().replace(/\s+/g, '_');
        }
      } else {
        actualRoleId = actualRoleId.toLowerCase().replace(/\s+/g, '_');
      }

      const roleNames = getRoleNamesForCatalog(actualRoleId);
      let rows: any[] = [];

      // 1) DYNAMIC: Get categories from services attached to this role (service_catalog = same as Catalog in admin)
      //    Role → services (where applicable_roles contains role) → distinct category_id = "service masters"
      let categoriesFromServices: string[] = [];
      try {
        const catResult = await query(
          `SELECT DISTINCT category_id
           FROM service_catalog
           WHERE status = 'active'
             AND (publish_status = 'published' OR publish_status IS NULL)
             AND applicable_roles && $1::text[]
             AND array_length(applicable_roles, 1) > 0
             AND category_id IS NOT NULL AND category_id != ''`,
          [roleNames]
        );
        categoriesFromServices = (catResult.rows || []).map((r: any) => r.category_id).filter(Boolean);
      } catch (e: any) {
        console.warn('[SPEC-MASTER] Could not get categories from service_catalog:', e.message);
      }

      // 2) Get specializations for those categories from specialization_master, filtered by role (applicable_roles overlap)
      if (categoriesFromServices.length > 0) {
        const smResult = await query(
          `SELECT sm.*
           FROM specialization_master sm
           WHERE sm.is_active = true
             AND (sm.show_in_vendor_profile = true OR sm.show_in_vendor_profile IS NULL)
             AND sm.category_id = ANY($1::text[])
             AND (sm.applicable_roles = '{}' OR sm.applicable_roles && $2::text[])
           ORDER BY sm.display_order, sm.name`,
          [categoriesFromServices, roleNames]
        );
        rows = smResult.rows || [];
        if (rows.length > 0) {
          console.log('[SPEC-MASTER] Vendor specializations from role→services→categories (360):', rows.length, 'role:', actualRoleId, 'categories:', categoriesFromServices);
        }
      }

      // 3) Fallback: no services for role yet, or no categories – use role→category mapping then specialization_master
      if (rows.length === 0) {
        const categoriesForRole = getCategoriesForRole(actualRoleId);
        if (categoriesForRole.length > 0) {
          const result = await query(
            `SELECT sm.*
             FROM specialization_master sm
             WHERE sm.is_active = true
               AND (sm.show_in_vendor_profile = true OR sm.show_in_vendor_profile IS NULL)
               AND sm.category_id = ANY($1::text[])
               AND (sm.applicable_roles = '{}' OR sm.applicable_roles && $2::text[])
             ORDER BY sm.display_order, sm.name`,
            [categoriesForRole, roleNames]
          );
          rows = result.rows || [];
        }
        if (rows.length === 0) {
          const result = await query(
            `SELECT sm.*
             FROM specialization_master sm
             WHERE sm.is_active = true
               AND (sm.show_in_vendor_profile = true OR sm.show_in_vendor_profile IS NULL)
               AND (sm.applicable_roles && $1::text[] OR $2 = ANY(sm.applicable_roles))
             ORDER BY sm.display_order, sm.name`,
            [roleNames, actualRoleId]
          );
          rows = result.rows || [];
        }
        if (rows.length > 0) {
          console.log('[SPEC-MASTER] Vendor specializations from fallback (role→category or applicable_roles):', rows.length, 'role:', actualRoleId);
        }
      }
      
      return c.json({
        success: true,
        specializations: rows.map((row: any) => ({
          id: row.specialization_id,
          name: row.name,
          displayName: row.display_name || row.name,
          description: row.description,
          iconName: row.icon_name,
          iconColor: row.icon_color,
          categoryId: row.category_id,
          shortDescription: row.short_description || row.description,
        })),
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Vendor specializations error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  // ========================================================================
  // ADMIN: CATEGORIES WITH SPECIALIZATION COUNTS
  // ========================================================================
  
  /**
   * GET /admin/categories/with-specializations
   * Get categories with specialization and symptom counts for admin UI
   */
  app.get('/admin/categories/with-specializations', async (c) => {
    try {
      const result = await query(`
        SELECT 
          sc.id,
          sc.category_id,
          sc.name,
          sc.description,
          sc.icon,
          sc.icon_color,
          sc.is_active,
          sc.display_order,
          COUNT(DISTINCT sm.id) as specialization_count,
          COUNT(DISTINCT ss.id) as symptom_count
        FROM service_categories sc
        LEFT JOIN specialization_master sm ON sm.category_id = sc.category_id AND sm.is_active = true
        LEFT JOIN specialization_symptoms ss ON ss.specialization_id = sm.specialization_id AND ss.is_active = true
        WHERE sc.is_active = true
        GROUP BY sc.id, sc.category_id, sc.name, sc.description, sc.icon, sc.icon_color, sc.is_active, sc.display_order
        ORDER BY sc.display_order NULLS LAST, sc.name
      `);
      
      return c.json({
        success: true,
        categories: result.rows.map((row: any) => ({
          id: row.id,
          categoryId: row.category_id,
          name: row.name,
          description: row.description,
          icon: row.icon,
          iconColor: row.icon_color,
          isActive: row.is_active,
          specializationCount: parseInt(row.specialization_count) || 0,
          symptomCount: parseInt(row.symptom_count) || 0,
        })),
      });
    } catch (error: any) {
      console.error('[SPEC-MASTER] Categories with specializations error:', error.message);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
  
  console.log('[SPEC-MASTER] Specialization Master endpoints registered');
}
