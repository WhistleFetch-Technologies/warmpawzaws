/**
 * ============================================================================
 * PROBLEM GRID ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles problem-based service discovery:
 * - Get all problems for grid display
 * - Get problems by vendor type
 * - Get services by problem
 * - Get vendors by problem
 * - Get trending problems
 * - Track problem searches
 * 
 * Date: 2026-01-12
 * Purpose: Support problem grid navigation in customer app
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from '../utils/s3-media-presign';
import { regeneratePresignedUrl } from './constants/helper';

/** Clean service description: strip wrapping quotes, trim whitespace */
function cleanDescription(desc: string | null | undefined): string | undefined {
  if (!desc || typeof desc !== 'string') return undefined;
  let cleaned = desc.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/\\"/g, '"');
  return cleaned || undefined;
}

/**
 * Vendors often store profile_photo_url as a bare S3 key (no https://).
 * Same pattern as customer-profile + service-discovery getVendorPhotoUrl.
 */
async function resolveVendorPhotoForByProblemRow(raw: string | null | undefined): Promise<string | null> {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  if (s.startsWith('data:')) return s;

  const stripped = stripS3PresignQueryFromUrl(s);

  if (!stripped.includes('://')) {
    return (await regeneratePresignedUrl(stripped)) || null;
  }

  const presigned = (await presignS3GetUrlIfApplicable(stripped)) ?? stripped;
  if (presigned && presigned !== stripped) {
    return presigned;
  }
  return (await regeneratePresignedUrl(stripped)) || presigned || stripped;
}

/** Optional image on vendor_services.metadata (or catalog) for customer cards */
function pickServiceImageFromMetadata(metadata: unknown): string | null {
  if (metadata == null) return null;
  let m: Record<string, unknown>;
  if (typeof metadata === 'string') {
    try {
      m = JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    m = metadata as Record<string, unknown>;
  } else {
    return null;
  }
  for (const k of ['imageUrl', 'image_url', 'photoUrl', 'photo', 'thumbnail', 'thumbnail_url', 'cover', 'icon']) {
    const v = m[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export function registerProblemGridEndpoints(app: Hono) {
  /**
   * GET /vendor/problem-grid/all
   * Get all problems for problem grid navigation
   */
  app.get("/vendor/problem-grid/all", async (c) => {
    try {
      const vendorType = c.req.query('vendorType'); // Optional filter

      let problemsQuery = `
        SELECT DISTINCT
          problem_id,
          problem_name,
          problem_display_name,
          role_id,
          MIN(order_index) as min_order
        FROM problem_grid_mappings
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorType) {
        problemsQuery += ` AND role_id = $${paramIndex}`;
        params.push(vendorType);
        paramIndex++;
      }

      problemsQuery += `
        GROUP BY problem_id, problem_name, problem_display_name, role_id
        ORDER BY min_order ASC, problem_name ASC
      `;

      let problemsResult;
      try {
        problemsResult = await query(problemsQuery, params);
      } catch (dbError: any) {
        console.error('Database query error for problem-grid:', dbError.message);
        // Return empty array if table doesn't exist or query fails
        return c.json({
          success: true,
          problems: [],
          count: 0,
          message: 'Problem grid not yet populated'
        });
      }

      if (!problemsResult.rows || problemsResult.rows.length === 0) {
        // Return default problems if none exist
        return c.json({
          success: true,
          problems: [
            { id: 'health-checkup', name: 'Health Checkup', displayName: 'Health Checkup', icon: '🏥', category: 'vet' },
            { id: 'vaccination', name: 'Vaccination', displayName: 'Vaccination', icon: '💉', category: 'vet' },
            { id: 'grooming', name: 'Grooming', displayName: 'Full Grooming', icon: '✂️', category: 'grooming' },
            { id: 'bath', name: 'Bath', displayName: 'Bath & Clean', icon: '🛁', category: 'grooming' },
            { id: 'training', name: 'Training', displayName: 'Basic Training', icon: '🎓', category: 'training' },
            { id: 'walking', name: 'Walking', displayName: 'Dog Walking', icon: '🐕', category: 'walker' },
          ],
          count: 6,
          message: 'Default problems (no custom mappings yet)'
        });
      }

      // Legacy handling continues below

      // Enrich problems with vendor types and categories
      const problems = await Promise.all(
        problemsResult.rows.map(async (row: any) => {
          // Get all vendor types for this problem
          const vendorTypesResult = await query(
            `SELECT DISTINCT role_id 
             FROM problem_grid_mappings 
             WHERE problem_id = $1`,
            [row.problem_id]
          );

          // Get subcategories for this problem
          const subcategoriesResult = await query(
            `SELECT DISTINCT sub_category_id, sub_category_name 
             FROM problem_grid_mappings 
             WHERE problem_id = $1
             ORDER BY order_index ASC`,
            [row.problem_id]
          );

          return {
            problemId: row.problem_id,
            title: row.problem_display_name || row.problem_name,
            description: `${row.problem_display_name || row.problem_name} services`,
            icon: getProblemIcon(row.problem_id),
            category: getProblemCategory(row.problem_id),
            vendorTypes: vendorTypesResult.rows.map((r: any) => r.role_id),
            subcategories: subcategoriesResult.rows.map((r: any) => ({
              id: r.sub_category_id,
              name: r.sub_category_name,
            })),
          };
        })
      );

      return c.json({
        success: true,
        problems,
        total: problems.length,
      });
    } catch (error: any) {
      console.error('Error fetching problem grid:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/problem-grid-specializations/:roleId
   * Get specializations (problems) for a vendor role - used for center profile specialization selection
   * ✅ FIX: Added missing endpoint for SpecializationSelector component
   * ✅ FIX: Handle roleId as UUID (foreign key) - lookup role name from roles table
   */
  app.get("/vendor/problem-grid-specializations/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log('[PROBLEM-GRID-SPEC] Fetching specializations for roleId:', roleId);
      
      // Clean roleId (remove 'role_' prefix if present)
      let cleanRoleId = roleId.replace(/^role_/, '');
      let roleName = cleanRoleId;
      
      // ✅ FIX: Check if roleId is a UUID - if so, look up the role name from roles table
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRoleId);
      if (isUUID) {
        console.log('[PROBLEM-GRID-SPEC] roleId is a UUID, looking up role name...');
        try {
          // Try lookup by id first
          let roleResult = await query(
            `SELECT id, name, display_name, vendor_type FROM roles WHERE id = $1`,
            [cleanRoleId]
          );
          
          // If not found by id, maybe it's stored as text - try by id::text or name
          if (roleResult.rows.length === 0) {
            console.log('[PROBLEM-GRID-SPEC] UUID not found by id, trying alternative lookups...');
            roleResult = await query(
              `SELECT id, name, display_name, vendor_type FROM roles WHERE id::text = $1 OR name = $1 LIMIT 1`,
              [cleanRoleId]
            );
          }
          
          if (roleResult.rows.length > 0) {
            const role = roleResult.rows[0];
            roleName = role.name || role.vendor_type || cleanRoleId;
            console.log('[PROBLEM-GRID-SPEC] Found role name:', roleName, 'from UUID:', cleanRoleId);
          } else {
            console.warn('[PROBLEM-GRID-SPEC] No role found for UUID:', cleanRoleId);
            // ✅ FIX: Try multiple fallback lookups
            let foundRole = false;
            
            // Try 1: Look up via vendors table
            try {
              const vendorResult = await query(
                `SELECT v.role_id, r.name as role_name 
                 FROM vendors v 
                 LEFT JOIN roles r ON v.role_id = r.id 
                 WHERE v.role_id = $1 OR v.role_id::text = $1 
                 LIMIT 1`,
                [cleanRoleId]
              );
              if (vendorResult.rows.length > 0 && vendorResult.rows[0].role_name) {
                roleName = vendorResult.rows[0].role_name;
                console.log('[PROBLEM-GRID-SPEC] Found role name via vendors table:', roleName);
                foundRole = true;
              }
            } catch (vendorErr) {
              console.warn('[PROBLEM-GRID-SPEC] Vendors table lookup failed:', vendorErr);
            }
            
            // Try 2: Look up via vendor_identity table's selected_role_id
            if (!foundRole) {
              try {
                const identityResult = await query(
                  `SELECT vi.selected_role_id, r.name as role_name 
                   FROM vendor_identity vi 
                   LEFT JOIN roles r ON vi.selected_role_id = r.id 
                   WHERE vi.selected_role_id = $1 OR vi.selected_role_id::text = $1 
                   LIMIT 1`,
                  [cleanRoleId]
                );
                if (identityResult.rows.length > 0 && identityResult.rows[0].role_name) {
                  roleName = identityResult.rows[0].role_name;
                  console.log('[PROBLEM-GRID-SPEC] Found role name via vendor_identity:', roleName);
                  foundRole = true;
                }
              } catch (identityErr) {
                console.warn('[PROBLEM-GRID-SPEC] Vendor identity lookup failed:', identityErr);
              }
            }
            
            // Try 3: Look up role by name matching the roleId (maybe it's actually a role name, not UUID)
            if (!foundRole) {
              try {
                const nameResult = await query(
                  `SELECT name FROM roles WHERE LOWER(name) LIKE $1 OR LOWER(display_name) LIKE $1 LIMIT 1`,
                  [`%${cleanRoleId.toLowerCase().replace(/-/g, '_').substring(0, 20)}%`]
                );
                if (nameResult.rows.length > 0) {
                  roleName = nameResult.rows[0].name;
                  console.log('[PROBLEM-GRID-SPEC] Found role name by partial match:', roleName);
                  foundRole = true;
                }
              } catch (nameErr) {
                console.warn('[PROBLEM-GRID-SPEC] Partial name lookup failed:', nameErr);
              }
            }
            
            // Try 4: Default to veterinarian for vet-related UUIDs (fallback)
            if (!foundRole) {
              console.log('[PROBLEM-GRID-SPEC] All lookups failed, defaulting to veterinarian');
              roleName = 'veterinarian';
            }
          }
        } catch (err) {
          console.error('[PROBLEM-GRID-SPEC] Error looking up role:', err);
        }
      }
      
      // ✅ CRITICAL FIX: If roleName is still a UUID after all lookups, default to veterinarian
      // This ensures centers always get some specializations even if role lookup fails
      const stillIsUUID = /^[0-9a-f]{8}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{12}$/i.test(roleName.replace(/_/g, '-'));
      if (stillIsUUID) {
        console.log('[PROBLEM-GRID-SPEC] roleName is still a UUID after lookups, defaulting to veterinarian');
        roleName = 'veterinarian';
      }
      
      // ✅ FIX: Map vendor types/role names to the EXACT role_id values used in problem_grid_mappings
      // The problem_grid_mappings table uses these role_ids:
      // veterinarian, groomer, trainer, walker, behaviourist, boarding, nutritionist
      const vendorTypeToMappingRoleId: Record<string, string> = {
        // Veterinary/Clinic variations → veterinarian
        'veterinary': 'veterinarian',
        'veterinarian': 'veterinarian',
        'veterinary_clinic': 'veterinarian',
        'vet_clinic': 'veterinarian',
        'pet_clinic': 'veterinarian',
        'clinic': 'veterinarian',
        'vet': 'veterinarian',
        'animal_hospital': 'veterinarian',
        'vet_solo': 'veterinarian',
        'vet_center': 'veterinarian',
        'veterinarian_solo': 'veterinarian',
        'veterinarian_center': 'veterinarian',
        
        // Grooming variations → groomer
        'grooming': 'groomer',
        'groomer': 'groomer',
        'pet_grooming': 'groomer',
        'grooming_center': 'groomer',
        'grooming_salon': 'groomer',
        'pet_salon': 'groomer',
        'groomer_solo': 'groomer',
        'groomer_center': 'groomer',
        
        // Training variations → trainer
        'training': 'trainer',
        'trainer': 'trainer',
        'pet_training': 'trainer',
        'dog_training': 'trainer',
        'obedience': 'trainer',
        'trainer_solo': 'trainer',
        'trainer_center': 'trainer',
        
        // Walking variations → walker
        'walking': 'walker',
        'walker': 'walker',
        'pet_walking': 'walker',
        'dog_walking': 'walker',
        'walker_solo': 'walker',
        'walker_center': 'walker',
        
        // Behavioral variations → behaviourist
        'behavior': 'behaviourist',
        'behaviorist': 'behaviourist',
        'behaviourist': 'behaviourist',
        'behaviour': 'behaviourist',
        'pet_behavior': 'behaviourist',
        'behaviourist_solo': 'behaviourist',
        'behaviourist_center': 'behaviourist',
        'pet_behaviorist': 'trainer',
        'behaviorist_solo': 'trainer',
        'behaviorist_center': 'trainer',
        
        // Boarding variations → boarding
        'boarding': 'boarding',
        'pet_boarding': 'boarding',
        'pet_hotel': 'boarding',
        'pet_resort': 'boarding',
        'daycare': 'boarding',
        'pet_daycare': 'boarding',
        'boarding_solo': 'boarding',
        'boarding_center': 'boarding',
        
        // Nutrition variations → nutritionist
        'nutrition': 'nutritionist',
        'nutritionist': 'nutritionist',
        'pet_nutrition': 'nutritionist',
        'diet': 'nutritionist',
        'nutritionist_solo': 'nutritionist',
        'nutritionist_center': 'nutritionist',
        
        // Cafe variations - no direct mapping but try boarding for now
        'cafe': 'boarding',
        'pet_cafe': 'boarding',
        
        // Pharmacy - try veterinarian as closest match
        'pharmacy': 'veterinarian',
        'pet_pharmacy': 'veterinarian',
        
        // Store - no direct mapping
        'pet_store': 'veterinarian',
        'store': 'veterinarian',
      };
      
      // Build list of role IDs to try
      const roleVariations: string[] = [];
      
      // First, add the mapped role_id if we have a mapping
      const lowercaseRoleName = roleName.toLowerCase().replace(/-/g, '_');
      if (vendorTypeToMappingRoleId[lowercaseRoleName]) {
        roleVariations.push(vendorTypeToMappingRoleId[lowercaseRoleName]);
        console.log('[PROBLEM-GRID-SPEC] Mapped', roleName, '→', vendorTypeToMappingRoleId[lowercaseRoleName]);
      }
      
      // Also check cleanRoleId
      const lowercaseCleanRoleId = cleanRoleId.toLowerCase().replace(/-/g, '_');
      if (vendorTypeToMappingRoleId[lowercaseCleanRoleId]) {
        roleVariations.push(vendorTypeToMappingRoleId[lowercaseCleanRoleId]);
      }
      
      // ✅ FIX: Strip _solo and _center suffixes and try to map those as well
      // This handles cases like 'groomer_center' → 'groomer' → maps to 'groomer'
      const strippedSoloCenter = lowercaseRoleName.replace(/_solo$|_center$/, '');
      if (strippedSoloCenter !== lowercaseRoleName) {
        console.log('[PROBLEM-GRID-SPEC] Stripped suffix:', lowercaseRoleName, '→', strippedSoloCenter);
        if (vendorTypeToMappingRoleId[strippedSoloCenter]) {
          roleVariations.push(vendorTypeToMappingRoleId[strippedSoloCenter]);
          console.log('[PROBLEM-GRID-SPEC] Mapped stripped', strippedSoloCenter, '→', vendorTypeToMappingRoleId[strippedSoloCenter]);
        } else {
          // Maybe the stripped version is already the correct role_id
          roleVariations.push(strippedSoloCenter);
        }
      }
      
      // Add variations to try
      roleVariations.push(
        roleName,
        cleanRoleId,
        roleId,
        lowercaseRoleName,
        lowercaseCleanRoleId,
        roleName.replace(/_/g, '-'),
        roleName.replace(/-/g, '_'),
        strippedSoloCenter, // Add stripped version as fallback
      );
      
      // Remove duplicates and filter out UUIDs (they won't match in problem_grid_mappings)
      const uniqueRoles = [...new Set(roleVariations)].filter(r => 
        r && r.length > 0 && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(r)
      );

      // 1) Prefer specializations from specialization_master (Catalog > Categories) so admin-created specs appear
      let specializations: any[] = [];
      try {
        const specMasterResult = await query(
          `SELECT specialization_id, name, display_name, icon_name, icon_color, display_order
           FROM specialization_master
           WHERE is_active = true AND show_in_vendor_profile = true
           AND applicable_roles && $1::text[]
           ORDER BY display_order ASC, name ASC`,
          [uniqueRoles]
        );
        if (specMasterResult.rows && specMasterResult.rows.length > 0) {
          console.log('[PROBLEM-GRID-SPEC] Using specialization_master:', specMasterResult.rows.length, 'for roles:', uniqueRoles);
          specializations = specMasterResult.rows.map((row: any) => ({
            id: row.specialization_id,
            name: row.name,
            displayName: row.display_name || row.name,
            icon: getProblemIconEmoji(row.specialization_id),
            iconName: row.icon_name,
            iconColor: row.icon_color,
            shortDescription: `${row.display_name || row.name} services`,
          }));
        }
      } catch (specErr: any) {
        console.warn('[PROBLEM-GRID-SPEC] specialization_master query failed, falling back to problem_grid_mappings:', specErr.message);
      }

      // 2) Fallback to problem_grid_mappings if no rows from specialization_master
      if (specializations.length === 0) {
        const placeholders = uniqueRoles.map((_, i) => `$${i + 1}`).join(', ');
        const problemsResult = await query(
          `SELECT DISTINCT
            problem_id as id,
            problem_name as name,
            problem_display_name as displayName,
            MIN(order_index) as min_order
          FROM problem_grid_mappings
          WHERE role_id IN (${placeholders})
          GROUP BY problem_id, problem_name, problem_display_name
          ORDER BY min_order ASC, problem_name ASC`,
          uniqueRoles
        ).catch((err) => {
          console.error('[PROBLEM-GRID-SPEC] Query error:', err);
          return { rows: [] };
        });
        console.log('[PROBLEM-GRID-SPEC] Fallback problem_grid_mappings:', problemsResult.rows.length, 'for roles:', uniqueRoles);
        specializations = (problemsResult.rows || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          displayName: row.displayName || row.name,
          icon: getProblemIconEmoji(row.id),
          shortDescription: `${row.displayName || row.name} services`,
        }));
      }

      if (specializations.length === 0) {
        return c.json({
          success: true,
          specializations: [],
          roleId: cleanRoleId,
          roleName: roleName,
          triedRoles: uniqueRoles,
          message: 'No specializations available for this vendor type'
        });
      }

      return c.json({
        success: true,
        specializations,
        count: specializations.length,
      });
    } catch (error: any) {
      console.error('Error fetching problem grid specializations:', error);
      return c.json({ 
        success: false,
        error: error.message,
        specializations: []
      }, 500);
    }
  });

  /**
   * GET /vendor/problem-grid/:vendorType
   * Get problems filtered by vendor type
   */
  app.get("/vendor/problem-grid/:vendorType", async (c) => {
    try {
      const { vendorType } = c.req.param();

      const problemsResult = await query(
        `SELECT DISTINCT
          problem_id,
          problem_name,
          problem_display_name,
          MIN(order_index) as min_order
        FROM problem_grid_mappings
        WHERE role_id = $1
        GROUP BY problem_id, problem_name, problem_display_name
        ORDER BY min_order ASC, problem_name ASC`,
        [vendorType]
      );

      const problems = problemsResult.rows.map((row: any) => ({
        problemId: row.problem_id,
        title: row.problem_display_name || row.problem_name,
        description: `${row.problem_display_name || row.problem_name} services`,
        icon: getProblemIcon(row.problem_id),
        category: getProblemCategory(row.problem_id),
        vendorTypes: [vendorType],
      }));

      return c.json({
        success: true,
        problems,
        total: problems.length,
      });
    } catch (error: any) {
      console.error('Error fetching problem grid by vendor type:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/services/by-problem
   * Get services that match a specific problem
   * Query params:
   *   - problemId or problemGridId (required): The problem to find services for
   *   - serviceStyle (optional): Filter by service style (at_home, at_center, tele)
   *   - lat/lng (optional): Customer location for distance calculation
   */
  app.get("/customer/services/by-problem", async (c) => {
    try {
      // Support both problemId and problemGridId for compatibility
      const problemId = c.req.query('problemId') || c.req.query('problemGridId');
      const serviceStyle = c.req.query('serviceStyle');
      const latitude = c.req.query('lat') || c.req.query('latitude');
      const longitude = c.req.query('lng') || c.req.query('longitude');

      if (!problemId) {
        return c.json({ error: 'problemId or problemGridId is required' }, 400);
      }

      // Validate serviceStyle if provided
      const validServiceStyles = ['at_home', 'at_center', 'tele'];
      if (serviceStyle && !validServiceStyles.includes(serviceStyle)) {
        return c.json({ 
          error: `Invalid serviceStyle. Must be one of: ${validServiceStyles.join(', ')}` 
        }, 400);
      }

      // Get problem mappings to find relevant subcategories and allowed service styles
      // When empty, treat problemId as specialization_id (specialization_master) for single source compatibility
      const mappingsResult = await query(
        `SELECT DISTINCT 
           sub_category_id, 
           role_id,
           COALESCE(allowed_service_styles, '["at_home", "at_center", "tele"]'::jsonb) as allowed_service_styles
         FROM problem_grid_mappings
         WHERE problem_id = $1`,
        [problemId]
      );

      console.log(`[BY-PROBLEM] problemId: ${problemId}, serviceStyle: ${serviceStyle}, mappings found: ${mappingsResult.rows.length}`);

      let subCategoryIds: string[];
      let roleIds: string[];

      // ✅ CRITICAL FIX: Always include the original problemId in search, not just mapped subCategoryIds
      // Vendors store specializations as "dermatology" (from specialization_master), not "sub_dermatology"
      // So we need to search for BOTH the original problemId AND any mapped subCategoryIds
      if (mappingsResult.rows.length === 0) {
        // Fallback: problemId may be specialization_id from specialization_master - use for vendor_specializations match
        // Also try to infer role from problemId (e.g., potty_training -> trainer)
        subCategoryIds = [problemId];
        roleIds = [];
        
        // ✅ FIX: Infer role from problemId for common training/behavioral problems
        const problemToRoleMap: Record<string, string[]> = {
          'potty_training': ['trainer', 'trainer_solo', 'trainer_center'],
          'basic_obedience': ['trainer', 'trainer_solo', 'trainer_center'],
          'socialization': ['trainer', 'trainer_solo', 'trainer_center'],
          'aggression': ['trainer', 'trainer_solo', 'trainer_center', 'behaviorist_solo', 'behaviorist_center'],
          'separation_anxiety': ['trainer', 'trainer_solo', 'trainer_center', 'behaviorist_solo', 'behaviorist_center'],
          'barking': ['behaviorist_solo', 'behaviorist_center'],
          'destructive': ['behaviorist_solo', 'behaviorist_center'],
          'fear_phobia': ['behaviorist_solo', 'behaviorist_center'],
        };
        
        if (problemToRoleMap[problemId]) {
          roleIds = problemToRoleMap[problemId];
          console.log(`[BY-PROBLEM] No mappings found, inferred role from problemId - roleIds: ${roleIds.join(', ')}`);
        } else {
          console.log(`[BY-PROBLEM] No mappings found, using fallback - subCategoryIds: ${subCategoryIds.join(', ')}, roleIds: []`);
        }
      } else {
        // ✅ CRITICAL: Include original problemId along with mapped subCategoryIds
        const mappedSubCategoryIds = mappingsResult.rows.map((r: any) => r.sub_category_id);
        subCategoryIds = [...new Set([problemId, ...mappedSubCategoryIds])];
        // ✅ FIX: Don't use roleIds from mappings - they're just hints, not filters
        // Only use roleIds if explicitly provided via roleId query param
        // This allows vendors with any role to appear if they have the specialization
        roleIds = []; // Clear roleIds from mappings - don't filter by role unless explicitly requested
        console.log(`[BY-PROBLEM] Mappings found - original problemId: ${problemId}, mappedSubCategoryIds: ${JSON.stringify(mappedSubCategoryIds)}, final subCategoryIds: ${JSON.stringify(subCategoryIds)}, roleIds from mappings (ignored): ${JSON.stringify(mappingsResult.rows.map((r: any) => r.role_id))}`);
      }
      
      // ✅ FIX: Only apply role filter if explicitly requested via roleId query param
      // Don't filter by role if roleIds come from problem_grid_mappings (those are just hints)
      const roleIdQueryParam = c.req.query('roleId');
      if (roleIdQueryParam) {
        roleIds = [roleIdQueryParam];
        console.log(`[BY-PROBLEM] 🔍 Role filter applied from query param: ${roleIdQueryParam}`);
      } else {
        console.log(`[BY-PROBLEM] 🔍 No role filter applied (roleIds from mappings ignored)`);
      }

      // Check if requested serviceStyle is allowed for this problem (only when we have mappings)
      if (serviceStyle && mappingsResult.rows.length > 0) {
        let isStyleAllowed = false;
        for (const mapping of mappingsResult.rows) {
          let allowedStyles: string[] = ['at_home', 'at_center', 'tele'];
          try {
            if (mapping.allowed_service_styles) {
              if (typeof mapping.allowed_service_styles === 'string') {
                allowedStyles = JSON.parse(mapping.allowed_service_styles);
              } else if (Array.isArray(mapping.allowed_service_styles)) {
                allowedStyles = mapping.allowed_service_styles;
              }
            }
          } catch (e) {
            console.warn('Failed to parse allowed_service_styles');
          }
          
          if (allowedStyles.includes(serviceStyle)) {
            isStyleAllowed = true;
            break;
          }
        }

        if (!isStyleAllowed) {
          return c.json({
            success: false,
            error: `Service style '${serviceStyle}' is not available for this problem`,
            services: [],
            total: 0,
          }, 400);
        }
      }

      // ✅ FIX: Only expand roleIds if they were explicitly provided via query param
      // Don't expand roleIds from mappings (we're not using them as filters)
      if (roleIds.length > 0) {
      // Expand problem_grid role_id to actual roles.name values so trainer problems also match behaviorist vendors
      const problemRoleToVendorRoleNames: Record<string, string[]> = {
        trainer: ['trainer', 'trainer_solo', 'trainer_center', 'behaviorist_solo', 'behaviorist_center'],
        behaviourist: ['behaviourist', 'behaviorist_solo', 'behaviorist_center'],
        behaviorist: ['behaviorist_solo', 'behaviorist_center'],
      };
      let expandedRoleIds = [...roleIds];
      for (const rid of roleIds) {
        if (problemRoleToVendorRoleNames[rid]) {
          expandedRoleIds = expandedRoleIds.concat(problemRoleToVendorRoleNames[rid]);
        }
      }
      roleIds = [...new Set(expandedRoleIds)];
      console.log(`[BY-PROBLEM] After expansion - roleIds: ${roleIds.join(', ')}`);
      } else {
        console.log(`[BY-PROBLEM] No roleIds to expand (role filter not applied)`);
      }

      // Normalize legacy service styles: at_vendor → at_center, online → tele
      const styleToDbValues: Record<string, string[]> = {
        at_center: ['at_center', 'at_vendor', 'at_clinic'],
        at_home: ['at_home', 'home_visit'],
        tele: ['tele', 'online', 'video_consultation'],
      };
      const acceptableStyles = serviceStyle ? (styleToDbValues[serviceStyle] || [serviceStyle]) : null;

      const hasLogoUrl = await query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'logo_url'
         ) as exists`
      ).then(r => r.rows[0]?.exists).catch(() => false);
      const logoColumn = hasLogoUrl ? 'v.logo_url' : 'NULL';
      const logoGroupBy = hasLogoUrl ? ', v.logo_url' : '';

      // Get vendors with matching specializations or roles
      // Enforce publish_status: published or auto_published (exclude draft/unpublished)
      // Use rev for reviews (is_published works when is_approved column is missing); join roles for role name filter
      // ✅ DEV/UAT FIX: Include pending vendors in dev/UAT environment for testing
      // More permissive check - allow pending in all non-production environments
      const isProduction = process.env.ENVIRONMENT === 'prod' || 
                          process.env.ENVIRONMENT === 'production' ||
                          process.env.NODE_ENV === 'production' ||
                          process.env.STAGE === 'prod' ||
                          process.env.STAGE === 'production';
      const isDevOrUatEnvironment = !isProduction; // Allow pending in all non-prod environments
      const statusFilter = isDevOrUatEnvironment 
        ? `(v.status = 'approved' OR v.status = 'pending')`
        : `v.status = 'approved'`;
      
      console.log(`[BY-PROBLEM] 🔧 Environment check - isProduction: ${isProduction}, isDevOrUat: ${isDevOrUatEnvironment}`);
      console.log(`[BY-PROBLEM] 🔧 ENV vars - ENVIRONMENT: ${process.env.ENVIRONMENT || 'not set'}, NODE_ENV: ${process.env.NODE_ENV || 'not set'}, STAGE: ${process.env.STAGE || 'not set'}`);
      if (isDevOrUatEnvironment) {
        console.log(`[BY-PROBLEM] 🔧 DEV/UAT MODE: Including pending vendors in search results`);
      }
      
      // ✅ CRITICAL FIX: Start from vendors table (same schema as profile API)
      // Profile API shows: specializations: ["dermatology"] in vendors.specializations
      // First find vendors with matching specialization, then join to their services
      let servicesQuery = `
        SELECT
          vs.id as service_id,
          vs.service_name as name,
          COALESCE(vs.custom_description, (SELECT sc.description FROM service_catalog sc WHERE sc.service_name = vs.service_name AND sc.service_style = vs.service_style LIMIT 1), vs.service_name) as description,
          vs.metadata as vendor_service_metadata,
          vs.price,
          vs.duration_minutes as duration,
          vs.service_style,
          vs.vendor_id,
          v.business_name as vendor_name,
          v.profile_photo_url,
          ${logoColumn} as logo_url,
          v.metadata as vendor_metadata,
          v.vendor_type,
          r.name as role_name,
          COALESCE(AVG(rev.rating), 0) as vendor_rating,
          COUNT(DISTINCT rev.id) as vendor_reviews,
          v.city,
          v.state,
          v.latitude,
          v.longitude,
          vs.created_at
        FROM vendors v
        -- ✅ PRIMARY SCHEMA: Start from vendors table (same as profile API)
        -- This is where specializations array is stored: v.specializations = ["dermatology", ...]
        -- Profile API fetches from this same table: GET /vendor/:vendorId/profile returns v.specializations
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        LEFT JOIN reviews rev ON rev.vendor_id = v.id AND (rev.is_published = true OR rev.is_published IS NULL)
        WHERE ${statusFilter}
          AND v.is_active = true
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // ✅ FIX: Business/clinic vendors CAN offer at_home services (e.g., vaccinations at home)
      // Do NOT filter them out - the backend already returns only vendors with matching service styles
      
      // ✅ FIX: For at_center, exclude at_home services in query
      if (serviceStyle === 'at_center') {
        servicesQuery += ` AND vs.service_style != 'at_home'`;
      }

      // Filter by service_style if provided (include legacy aliases: at_vendor, online)
      if (acceptableStyles && acceptableStyles.length > 0) {
        servicesQuery += ` AND vs.service_style = ANY($${paramIndex}::text[])`;
        params.push(acceptableStyles);
        paramIndex++;
      }

      // Match by subcategory: ILIKE on service_name (with %), exact match on vendor_specializations.specialization (no %)
      // ✅ FIX: If we have roleIds, we can be less strict on subcategory matching
      if (subCategoryIds.length > 0) {
        const searchTerms = subCategoryIds.map((id: string) => `%${id}%`);
        // If we have roleIds, make subcategory matching optional (OR condition)
        // If no roleIds, require subcategory match
        if (roleIds.length > 0) {
          // Has role filter: subcategory is optional (OR)
          // ✅ CRITICAL FIX: Prioritize vendors.specializations JSONB column (same schema as profile API)
          // Profile API shows: specializations: ["dermatology"] - this is in vendors.specializations
          servicesQuery += ` AND (
            r.name = ANY($${paramIndex}::text[]) OR
            -- ✅ PRIMARY: Check vendors.specializations JSONB column (same schema as profile API)
            -- This is where the profile API gets specializations from: GET /vendor/:vendorId/profile returns v.specializations
            (v.specializations IS NOT NULL 
             AND jsonb_typeof(v.specializations) = 'array'
             AND jsonb_array_length(v.specializations) > 0
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
               WHERE spec = ANY($${paramIndex + 2}::text[])
             )) OR
            -- ✅ SECONDARY: Check vendor_specializations table (where vendors store specializations from profile)
            vs.vendor_id IN (
              SELECT vendor_id 
              FROM vendor_specializations 
              WHERE specialization = ANY($${paramIndex + 2}::text[])
            ) OR
            -- ✅ FALLBACK: Check vendors.metadata.specializations
            (v.metadata IS NOT NULL 
             AND v.metadata->'specializations' IS NOT NULL
             AND jsonb_typeof(v.metadata->'specializations') = 'array'
             AND jsonb_array_length(v.metadata->'specializations') > 0
             AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(v.metadata->'specializations') AS spec 
              WHERE spec = ANY($${paramIndex + 2}::text[])
            )) OR
            -- Fallback: Check service name (partial match)
            vs.service_name ILIKE ANY($${paramIndex + 1}::text[])
          )`;
          params.push(roleIds, searchTerms, subCategoryIds);
          paramIndex += 3;
        } else {
          // No role filter: require subcategory match
          // ✅ CRITICAL FIX: Prioritize vendor_specializations table AND vendors.specializations JSONB column
          // The profile API shows: specializations: ["dermatology"] - this is in vendors.specializations
          // We need to check if the problemId (specialization ID) exists in this array
          servicesQuery += ` AND (
            -- ✅ PRIMARY: Check vendor_specializations table (where profile API loads from first)
            vs.vendor_id IN (
              SELECT vendor_id 
              FROM vendor_specializations 
              WHERE specialization = ANY($${paramIndex + 1}::text[])
            ) OR
            -- ✅ SECONDARY: Check vendors.specializations JSONB column (same schema as profile API)
            -- This is where the profile API gets specializations from
            (v.specializations IS NOT NULL 
             AND jsonb_typeof(v.specializations) = 'array'
             AND jsonb_array_length(v.specializations) > 0
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
               WHERE spec = ANY($${paramIndex + 1}::text[])
             )) OR
            -- ✅ FALLBACK: Check vendors.metadata.specializations
            (v.metadata IS NOT NULL 
             AND v.metadata->'specializations' IS NOT NULL
             AND jsonb_typeof(v.metadata->'specializations') = 'array'
             AND jsonb_array_length(v.metadata->'specializations') > 0
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(v.metadata->'specializations') AS spec 
               WHERE spec = ANY($${paramIndex + 1}::text[])
             )) OR
            -- Fallback: Check service name (partial match)
            vs.service_name ILIKE ANY($${paramIndex}::text[])
          )`;
          params.push(searchTerms, subCategoryIds);
          paramIndex += 2;
        }
      } else {
        // No subcategoryIds: only filter by role if available
        if (roleIds.length > 0) {
          servicesQuery += ` AND r.name = ANY($${paramIndex}::text[])`;
          params.push(roleIds);
          paramIndex++;
        }
      }

      servicesQuery += `
        GROUP BY vs.id, vs.service_name, vs.custom_description, vs.metadata, vs.price, vs.duration_minutes, vs.service_style,
                 vs.vendor_id, v.business_name, v.city, v.state, vs.created_at,
                 v.profile_photo_url, v.metadata, v.latitude, v.longitude${logoGroupBy},
                 v.vendor_type, r.name
        ORDER BY vendor_rating DESC, vs.created_at DESC
        LIMIT 50
      `;

      // ✅ SIMPLE TEST: First check if we can find vendors with the specialization
      console.log(`[BY-PROBLEM] 🔍 Testing simple vendor lookup with specialization: ${JSON.stringify(subCategoryIds)}`);
      try {
        const simpleVendorTest = await query(`
          SELECT v.id, v.business_name, v.status, v.is_active, v.specializations, v.vendor_type
          FROM vendors v
          WHERE v.specializations IS NOT NULL
            AND jsonb_typeof(v.specializations) = 'array'
            AND jsonb_array_length(v.specializations) > 0
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
              WHERE spec = ANY($1::text[])
            )
            AND (v.status = 'approved' OR v.status = 'pending')
            AND v.is_active = true
          LIMIT 5
        `, [subCategoryIds]);
        console.log(`[BY-PROBLEM] 🔍 SIMPLE TEST: Found ${simpleVendorTest.rows.length} vendors with matching specialization:`, 
          simpleVendorTest.rows.map((r: any) => ({
            id: r.id,
            name: r.business_name,
            status: r.status,
            specializations: r.specializations,
            vendor_type: r.vendor_type
          }))
        );
      } catch (simpleErr: any) {
        console.error(`[BY-PROBLEM] Simple test error:`, simpleErr.message);
      }
      
      console.log(`[BY-PROBLEM] Executing query with params:`, JSON.stringify(params));
      console.log(`[BY-PROBLEM] Full Query: ${servicesQuery}`);
      console.log(`[BY-PROBLEM] subCategoryIds: ${JSON.stringify(subCategoryIds)}, roleIds: ${JSON.stringify(roleIds)}`);
      console.log(`[BY-PROBLEM] serviceStyle: ${serviceStyle}, acceptableStyles: ${JSON.stringify(acceptableStyles)}`);
      console.log(`[BY-PROBLEM] statusFilter: ${statusFilter}`);
      console.log(`[BY-PROBLEM] isDevOrUatEnvironment: ${isDevOrUatEnvironment}, ENVIRONMENT: ${process.env.ENVIRONMENT || 'not set'}, NODE_ENV: ${process.env.NODE_ENV || 'not set'}, STAGE: ${process.env.STAGE || 'not set'}`);
      
      const servicesResult = await query(servicesQuery, params);
      
      console.log(`[BY-PROBLEM] Query returned ${servicesResult.rows.length} services`);
      
      // ✅ FIX: If no results, try a fallback query to find vendors that should match but weren't returned
      // This handles cases where the main query might have a logic issue
      if (servicesResult.rows.length === 0 && subCategoryIds.length > 0) {
        try {
          console.log(`[BY-PROBLEM] 🔍 No results from main query, trying fallback query for matching vendors...`);
          // Build fallback query - start from vendors table (same schema as profile API)
          let fallbackQuery = `
            SELECT DISTINCT vs.id, vs.service_name, vs.service_style, vs.is_enabled, vs.publish_status,
                   vs.price, vs.duration_minutes, vs.created_at, vs.metadata as vendor_service_metadata,
                   v.id as vendor_id, v.business_name, v.status, v.is_active, v.vendor_type, v.specializations,
                   v.profile_photo_url, v.city, v.state, v.latitude, v.longitude, v.metadata,
                   v.role_id, r.name as role_name
            FROM vendors v
            -- ✅ Start from vendors table (same as profile API) - where specializations array is stored
            INNER JOIN vendor_services vs ON vs.vendor_id = v.id
            LEFT JOIN roles r ON v.role_id = r.id
            WHERE ${statusFilter}
              AND v.is_active = true
              AND vs.is_enabled = true
              AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
          `;
          
          const fallbackParams: any[] = [];
          let fallbackParamIndex = 1;
          
          // ✅ FIX: Business/clinic vendors CAN offer at_home services - do not exclude them
          
          if (acceptableStyles && acceptableStyles.length > 0) {
            fallbackQuery += ` AND vs.service_style = ANY($${fallbackParamIndex}::text[])`;
            fallbackParams.push(acceptableStyles);
            fallbackParamIndex++;
          }
          
          fallbackQuery += ` AND (
            -- PRIMARY: Check vendors.specializations JSONB column (same as profile API)
            -- Profile API shows: specializations: ["dermatology"] - check if problemId is in this array
            (v.specializations IS NOT NULL 
             AND jsonb_typeof(v.specializations) = 'array'
             AND jsonb_array_length(v.specializations) > 0
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
               WHERE spec = ANY($${fallbackParamIndex}::text[])
             )) OR
            -- Fallback: Check vendor_specializations table
            v.id IN (
              SELECT vendor_id FROM vendor_specializations WHERE specialization = ANY($${fallbackParamIndex}::text[])
            ) OR
            -- Fallback: Check vendors.metadata.specializations
            (v.metadata IS NOT NULL 
             AND v.metadata->'specializations' IS NOT NULL
             AND jsonb_typeof(v.metadata->'specializations') = 'array'
             AND jsonb_array_length(v.metadata->'specializations') > 0
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(v.metadata->'specializations') AS spec 
               WHERE spec = ANY($${fallbackParamIndex}::text[])
             ))
          )
          LIMIT 50
          `;
          
          fallbackParams.push(subCategoryIds);
          
          const fallbackResult = await query(fallbackQuery, fallbackParams);
          console.log(`[BY-PROBLEM] 🔍 Fallback query returned ${fallbackResult.rows.length} services`);
          
          if (fallbackResult.rows.length > 0) {
            // Add fallback results to main results
            for (const row of fallbackResult.rows) {
              servicesResult.rows.push({
                service_id: row.id,
                id: row.id,
                service_name: row.service_name,
                name: row.service_name,
                description: row.service_name,
                vendor_service_metadata: row.vendor_service_metadata,
                price: row.price || '0',
                duration_minutes: row.duration_minutes || 30,
                duration: row.duration_minutes || 30,
                service_style: row.service_style,
                vendor_id: row.vendor_id,
                business_name: row.business_name,
                vendor_name: row.business_name,
                profile_photo_url: row.profile_photo_url,
                logo_url: null,
                metadata: row.metadata || {},
                vendor_metadata: row.metadata || {},
                vendor_type: row.vendor_type,
                vendorType: row.vendor_type,
                role_name: row.role_name || '',
                roleName: row.role_name || '',
                vendor_rating: 0,
                vendorRating: 0,
                vendor_reviews: 0,
                vendorReviews: 0,
                city: row.city,
                state: row.state,
                latitude: row.latitude,
                longitude: row.longitude,
                created_at: row.created_at
              });
            }
            console.log(`[BY-PROBLEM] ✅ Added ${fallbackResult.rows.length} services from fallback query - Total results: ${servicesResult.rows.length}`);
          }
        } catch (fallbackErr: any) {
          console.error(`[BY-PROBLEM] Fallback query error:`, fallbackErr.message);
        }
      }
      
      // ✅ ADDITIONAL DEBUG: Test if vendor would match by checking directly
      if (servicesResult.rows.length === 0 && subCategoryIds.length > 0) {
        const testVendorId = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45'; // The vendor we're testing
        const testQuery = `
          SELECT 
            v.id, v.business_name, v.status, v.is_active, v.vendor_type, v.specializations,
            COUNT(vs.id) as service_count,
            array_agg(DISTINCT vs.service_style) FILTER (WHERE vs.service_style IS NOT NULL) as service_styles,
            array_agg(DISTINCT vs.is_enabled) FILTER (WHERE vs.is_enabled IS NOT NULL) as service_enabled,
            array_agg(DISTINCT vs.publish_status) FILTER (WHERE vs.publish_status IS NOT NULL) as service_publish_status,
            EXISTS (
              SELECT 1 FROM vendor_specializations vs2 
              WHERE vs2.vendor_id = v.id AND vs2.specialization = ANY($1::text[])
            ) as has_spec_in_table,
            EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
              WHERE spec = ANY($1::text[])
            ) as has_spec_in_jsonb,
            -- Test the actual query conditions
            COUNT(vs_match.id) as matching_service_count
          FROM vendors v
          LEFT JOIN vendor_services vs ON vs.vendor_id = v.id
          LEFT JOIN vendor_services vs_match ON vs_match.vendor_id = v.id 
            AND vs_match.is_enabled = true 
            AND (vs_match.publish_status IN ('published', 'auto_published', 'draft') OR vs_match.publish_status IS NULL)
            AND (${serviceStyle ? `vs_match.service_style = '${serviceStyle}'` : 'true'})
            AND (
              v.id IN (
                SELECT vendor_id FROM vendor_specializations WHERE specialization = ANY($1::text[])
              ) OR
              (v.specializations IS NOT NULL AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
                WHERE spec = ANY($1::text[])
              ))
            )
          WHERE v.id = $2
          GROUP BY v.id, v.business_name, v.status, v.is_active, v.vendor_type, v.specializations
        `;
        try {
          const testResult = await query(testQuery, [subCategoryIds, testVendorId]);
          if (testResult.rows.length > 0) {
            const vendor = testResult.rows[0];
            console.log(`[BY-PROBLEM] 🔍 TEST VENDOR DEBUG:`, JSON.stringify({
              id: vendor.id,
              name: vendor.business_name,
              status: vendor.status,
              is_active: vendor.is_active,
              vendor_type: vendor.vendor_type,
              specializations: vendor.specializations,
              service_count: vendor.service_count,
              matching_service_count: vendor.matching_service_count,
              service_styles: vendor.service_styles,
              service_enabled: vendor.service_enabled,
              service_publish_status: vendor.service_publish_status,
              has_spec_in_table: vendor.has_spec_in_table,
              has_spec_in_jsonb: vendor.has_spec_in_jsonb,
              would_match_status: isDevOrUatEnvironment ? (vendor.status === 'approved' || vendor.status === 'pending') : vendor.status === 'approved',
              would_match_active: vendor.is_active === true,
              would_match_vendor_type: true, // Business/clinic vendors can offer at_home services
              would_match_service: vendor.service_count > 0 && 
                                   (vendor.service_enabled && vendor.service_enabled.includes(true)) &&
                                   (vendor.service_publish_status && (vendor.service_publish_status.includes('published') || vendor.service_publish_status.includes('auto_published') || vendor.service_publish_status.includes(null))),
              would_match_service_style: serviceStyle ? (vendor.service_styles && vendor.service_styles.includes(serviceStyle)) : true,
              would_match_specialization: vendor.has_spec_in_table || vendor.has_spec_in_jsonb,
              subCategoryIds: subCategoryIds
            }, null, 2));
          }
        } catch (testErr: any) {
          console.error(`[BY-PROBLEM] Test query error:`, testErr.message);
        }
      }
      
      // ✅ DEBUG: If no results, check if vendors with matching specializations exist (regardless of status/services)
      if (servicesResult.rows.length === 0 && subCategoryIds.length > 0) {
        const debugQuery = `
          SELECT v.id, v.business_name, v.status, v.is_active, v.vendor_type, v.specializations, 
                 COUNT(vs.id) as service_count,
                 array_agg(DISTINCT vs.service_style) FILTER (WHERE vs.service_style IS NOT NULL) as service_styles,
                 array_agg(DISTINCT vs.is_enabled) FILTER (WHERE vs.is_enabled IS NOT NULL) as service_enabled_flags,
                 array_agg(DISTINCT vs.publish_status) FILTER (WHERE vs.publish_status IS NOT NULL) as service_publish_statuses,
                 array_agg(DISTINCT vs.service_style || ':' || vs.is_enabled::text || ':' || COALESCE(vs.publish_status, 'null')) 
                   FILTER (WHERE vs.service_style = $2 OR vs.service_style IS NULL) as matching_services
          FROM vendors v
          LEFT JOIN vendor_services vs ON vs.vendor_id = v.id
          WHERE (
            (v.specializations IS NOT NULL AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
              WHERE spec = ANY($1::text[])
            )) OR
            v.id IN (
              SELECT vendor_id 
              FROM vendor_specializations 
              WHERE specialization = ANY($1::text[])
            )
          )
          GROUP BY v.id, v.business_name, v.status, v.is_active, v.vendor_type, v.specializations
          LIMIT 10
        `;
        const debugServiceStyle = serviceStyle || 'at_home';
        const debugResult = await query(debugQuery, [subCategoryIds, debugServiceStyle]).catch((err: any) => {
          console.error(`[BY-PROBLEM] DEBUG query error:`, err.message);
          return { rows: [] };
        });
        console.log(`[BY-PROBLEM] DEBUG: Found ${debugResult.rows.length} vendors with matching specializations:`, 
          debugResult.rows.map((r: any) => ({
            id: r.id,
            name: r.business_name,
            status: r.status,
            is_active: r.is_active,
            vendor_type: r.vendor_type,
            specializations: r.specializations,
            service_count: r.service_count,
            service_styles: r.service_styles,
            service_enabled: r.service_enabled_flags,
            service_publish_statuses: r.service_publish_statuses,
            matching_services: r.matching_services
          }))
        );
      }

      const vendorIds = [...new Set(servicesResult.rows.map((r: any) => r.vendor_id))];
      const specMap: Record<string, string[]> = {};
      if (vendorIds.length > 0) {
        try {
          const placeholders = vendorIds.map((_, i) => `$${i + 1}`).join(', ');
          const specResult = await query(
            `SELECT vendor_id, specialization FROM vendor_specializations WHERE vendor_id IN (${placeholders})`,
            vendorIds
          );
          for (const row of specResult.rows || []) {
            if (!specMap[row.vendor_id]) specMap[row.vendor_id] = [];
            specMap[row.vendor_id].push(row.specialization);
          }
        } catch (_) { /* non-fatal */ }
      }

      // Calculate distance if location provided
      let services = servicesResult.rows.map((service: any) => {
        const nameStr = String(service.name || '').trim();
        const descRaw = cleanDescription(service.description);
        const descTrim = (descRaw || '').trim();
        const description =
          descTrim && descTrim !== nameStr ? descRaw : undefined;
        const serviceImageRaw = pickServiceImageFromMetadata(service.vendor_service_metadata);
        const serviceData: any = {
          serviceId: service.service_id,
          name: service.name,
          description,
          price: parseFloat(service.price || '0'),
          duration: parseInt(service.duration || '0'),
          serviceStyle: service.service_style,
          vendorId: service.vendor_id,
          vendorName: service.vendor_name,
          vendorRating: parseFloat(service.vendor_rating || '0'),
          vendorReviews: parseInt(service.vendor_reviews || '0'),
          distance: null as number | null,
          relevanceScore: 1.0,
          id: `${service.vendor_id}_${service.service_id}`,
          type: 'vendor',
          photo: service.profile_photo_url || service.logo_url || (service.vendor_metadata && (service.vendor_metadata.logo_url || (Array.isArray(service.vendor_metadata.facility_photos) && service.vendor_metadata.facility_photos[0]) || null)) || null,
          photoUrl: service.profile_photo_url || service.logo_url || (service.vendor_metadata && (service.vendor_metadata.logo_url || (Array.isArray(service.vendor_metadata.facility_photos) && service.vendor_metadata.facility_photos[0]) || null)) || null,
          rating: parseFloat(service.vendor_rating || '0'),
          reviewCount: parseInt(service.vendor_reviews || '0'),
          specializations: specMap[service.vendor_id] || [],
          vendorType: service.vendor_type === 'solo' ? 'solo' : 'business',
          roleName: service.role_name || '',
          distanceFormatted: 'N/A',
          priceFormatted: `₹${parseFloat(service.price || '0').toLocaleString('en-IN')}`,
          serviceName: service.name,
          serviceImageRaw,
        };

        // Calculate distance if coordinates available
        if (latitude && longitude && service.latitude && service.longitude) {
          serviceData.distance = calculateDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            parseFloat(service.latitude),
            parseFloat(service.longitude)
          );
        }
        if (serviceData.distance != null) {
          serviceData.distanceFormatted = serviceData.distance < 1 ? `${Math.round(serviceData.distance * 1000)} m` : `${serviceData.distance.toFixed(1)} km`;
        }

        return serviceData;
      });

      // ✅ FIX: Post-query filter to ensure serviceStyle matches (safety filter)
      // Business/clinic vendors CAN offer at_home services - do not exclude them
      if (serviceStyle && acceptableStyles && acceptableStyles.length > 0) {
        services = services.filter((service: any) => {
          const serviceStyleValue = service.serviceStyle || service.service_style;
          return acceptableStyles.includes(serviceStyleValue);
        });
        console.log(`[BY-PROBLEM] After post-query filter for ${serviceStyle}: ${services.length} services remaining`);
      }

      // Sort by relevance (rating + distance if available)
      services.sort((a: any, b: any) => {
        const aScore = a.vendorRating * 0.7 + (a.distance ? (1 / (a.distance + 1)) * 0.3 : 0);
        const bScore = b.vendorRating * 0.7 + (b.distance ? (1 / (b.distance + 1)) * 0.3 : 0);
        return bScore - aScore;
      });

      // Vendor + per-service images: bare S3 keys + HTTPS URLs → fresh https URL for <img src>
      services = await Promise.all(
        services.map(async (service: any) => {
          const raw = service.photo || service.photoUrl;
          const photo = await resolveVendorPhotoForByProblemRow(raw);
          const serviceImageUrl = await resolveVendorPhotoForByProblemRow(service.serviceImageRaw);
          const { serviceImageRaw, ...rest } = service;
          return {
            ...rest,
            photo,
            photoUrl: photo,
            profile_photo_url: photo,
            serviceImageUrl: serviceImageUrl || null,
          };
        })
      );

      return c.json({
        success: true,
        services,
        providers: services,
        total: services.length,
        problemId,
        serviceStyle: serviceStyle || 'all',
      });
    } catch (error: any) {
      console.error('Error fetching services by problem:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendors/by-problem
   * Get vendors that can solve a specific problem
   * Also returns specialists/staff for vendor types that support them (vets, trainers, etc.)
   */
  app.get("/customer/vendors/by-problem", async (c) => {
    try {
      // Support both problemId and problemGridId for compatibility
      const problemId = c.req.query('problemId') || c.req.query('problemGridId');
      const roleId = c.req.query('roleId');
      const latitude = c.req.query('lat') || c.req.query('latitude');
      const longitude = c.req.query('lng') || c.req.query('longitude');
      const sortBy = c.req.query('sortBy') || 'rating';
      const feeMin = c.req.query('feeMin');
      const feeMax = c.req.query('feeMax');

      if (!problemId) {
        return c.json({ error: 'problemId or problemGridId is required' }, 400);
      }

      // Get problem mappings (legacy); when empty, treat problemId as specialization_id from Categories
      const mappingsResult = await query(
        `SELECT DISTINCT sub_category_id, role_id
         FROM problem_grid_mappings
         WHERE problem_id = $1`,
        [problemId]
      );

      // ✅ CRITICAL FIX: Always include the original problemId in search, not just mapped subCategoryIds
      // Vendors store specializations as "dermatology" (from specialization_master), not "sub_dermatology"
      // So we need to search for BOTH the original problemId AND any mapped subCategoryIds
      const mappedSubCategoryIds = mappingsResult.rows.length > 0
        ? mappingsResult.rows.map((r: any) => r.sub_category_id)
        : [];
      // Always include the original problemId (this is what vendors store in specializations)
      const subCategoryIds = [...new Set([problemId, ...mappedSubCategoryIds])];
      let roleIds = mappingsResult.rows.length > 0
        ? [...new Set(mappingsResult.rows.map((r: any) => r.role_id))]
        : []; // When no mapping, no role filter unless roleId query provided

      if (roleId) {
        roleIds = [roleId];
      }

      console.log(`[VENDORS-BY-PROBLEM] 🔍 problemId: ${problemId}, mappedSubCategoryIds: ${JSON.stringify(mappedSubCategoryIds)}, final subCategoryIds: ${JSON.stringify(subCategoryIds)}`);

      // Get vendors with matching specializations (vendor_specializations.specialization = problemId or sub_category_id)
      // ✅ FIX: Calculate aggregations in subqueries, then join to vendors to avoid GROUP BY issues
      let vendorsQuery = `
        SELECT 
          v.*,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(rev_stats.avg_rating, 0) as avg_rating,
          COALESCE(rev_stats.total_reviews, 0) as total_reviews,
          COALESCE(b_stats.total_bookings, 0) as total_bookings
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        LEFT JOIN (
          SELECT 
            vendor_id,
            AVG(rating) as avg_rating,
            COUNT(DISTINCT id) as total_reviews
          FROM reviews
          WHERE is_approved = true
          GROUP BY vendor_id
        ) rev_stats ON rev_stats.vendor_id = v.id
        LEFT JOIN (
          SELECT 
            vendor_id,
            COUNT(DISTINCT id) as total_bookings
          FROM bookings
          WHERE status = 'completed'
          GROUP BY vendor_id
        ) b_stats ON b_stats.vendor_id = v.id
        WHERE (v.status = 'approved' OR v.status = 'pending')
          AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Match by role (when from mappings or when roleId query provided)
      // ✅ FIX: Only apply role filter if roleId is explicitly provided via query param
      // Don't filter by role if roleIds come from problem_grid_mappings (those are just hints)
      // This allows vendors with any role to appear if they have the specialization
      if (roleId) {
        // Only filter by role if explicitly requested via roleId query param
        vendorsQuery += ` AND (r.id::text = ANY($${paramIndex}::text[]) OR r.name = ANY($${paramIndex + 1}::text[]))`;
        params.push(roleIds, roleIds);
        paramIndex += 2;
        console.log(`[VENDORS-BY-PROBLEM] 🔍 Filtering by roleIds (from query param): ${JSON.stringify(roleIds)}`);
      } else {
        // No role filter - allow vendors with any role
        console.log(`[VENDORS-BY-PROBLEM] 🔍 No role filter applied (roleIds from mappings ignored): ${JSON.stringify(roleIds)}`);
      }

      // Match by specialization: vendor_specializations.specialization = problemId or sub_category_id
      // ✅ CRITICAL FIX: Prioritize vendors.specializations JSONB column (same schema as profile API)
      // Profile API shows: specializations: ["dermatology"] - this is in vendors.specializations JSONB
      // We need to query the same schema where profile API gets its data from
      if (subCategoryIds.length > 0) {
        console.log(`[VENDORS-BY-PROBLEM] 🔍 Searching for vendors with specialization IDs: ${JSON.stringify(subCategoryIds)}`);
        // ✅ CRITICAL: Check BOTH vendor_specializations table AND vendors.specializations JSONB
        // Profile API loads from vendor_specializations table first, then falls back to JSONB
        // So we need to check BOTH to match what profile API returns
        vendorsQuery += ` AND (
          -- ✅ PRIMARY: Check vendor_specializations table (where profile API loads from first)
          -- Profile API: SELECT specialization FROM vendor_specializations WHERE vendor_id = $1
          v.id IN (
            SELECT vendor_id 
            FROM vendor_specializations 
            WHERE specialization = ANY($${paramIndex}::text[])
          ) OR
          -- ✅ SECONDARY: Check vendors.specializations JSONB column (profile API fallback)
          -- This is where the profile API gets specializations from: GET /vendor/:vendorId/profile returns v.specializations
          (v.specializations IS NOT NULL 
           AND jsonb_typeof(v.specializations) = 'array'
           AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
            WHERE spec = ANY($${paramIndex}::text[])
          )) OR
          -- ✅ FALLBACK: Check vendors.metadata.specializations
          (v.metadata IS NOT NULL 
           AND v.metadata->'specializations' IS NOT NULL
           AND jsonb_typeof(v.metadata->'specializations') = 'array'
           AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(v.metadata->'specializations') AS spec 
            WHERE spec = ANY($${paramIndex}::text[])
          ))
        )`;
        params.push(subCategoryIds);
        paramIndex++;
      }
      
      // Filter by price range if provided
      if (feeMin || feeMax) {
        vendorsQuery += ` AND v.id IN (
          SELECT DISTINCT vs.vendor_id
          FROM vendor_services vs
          WHERE vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published','draft') OR vs.publish_status IS NULL)
            ${feeMin ? `AND vs.price >= $${paramIndex}` : ''}
            ${feeMax ? `AND vs.price <= $${paramIndex + (feeMin ? 1 : 0)}` : ''}
        )`;
        if (feeMin) {
          params.push(parseFloat(feeMin));
          paramIndex++;
        }
        if (feeMax) {
          params.push(parseFloat(feeMax));
          paramIndex++;
        }
      }

      vendorsQuery += `
        ORDER BY rev_stats.avg_rating DESC NULLS LAST, b_stats.total_bookings DESC NULLS LAST
        LIMIT 50
      `;

      // ✅ DEBUG: Log query and params for troubleshooting
      console.log(`[VENDORS-BY-PROBLEM] 🔍 Executing query with params:`, JSON.stringify(params));
      console.log(`[VENDORS-BY-PROBLEM] 🔍 Query: ${vendorsQuery.substring(0, 500)}...`);
      console.log(`[VENDORS-BY-PROBLEM] 🔍 problemId: ${problemId}, subCategoryIds: ${JSON.stringify(subCategoryIds)}, roleIds: ${JSON.stringify(roleIds)}`);

      // ✅ TEST: First check if we can find vendors with the specialization directly
      if (subCategoryIds.length > 0) {
        try {
          // Test 1: Check vendor_specializations table
          const checkTableQuery = `SELECT COUNT(*) as count, array_agg(vendor_id) as vendor_ids FROM vendor_specializations WHERE specialization = ANY($1::text[])`;
          const tableResult = await query(checkTableQuery, [subCategoryIds]);
          console.log(`[VENDORS-BY-PROBLEM] 🔍 TEST: vendor_specializations table has ${tableResult.rows[0]?.count || 0} rows with spec ${JSON.stringify(subCategoryIds)}`);
          if (tableResult.rows[0]?.vendor_ids) {
            console.log(`[VENDORS-BY-PROBLEM] 🔍 TEST: Vendor IDs in table: ${JSON.stringify(tableResult.rows[0].vendor_ids)}`);
          }

          // Test 2: Check vendors.specializations JSONB
          const checkJsonbQuery = `
            SELECT COUNT(*) as count, array_agg(id) as vendor_ids 
            FROM vendors 
            WHERE specializations IS NOT NULL 
              AND jsonb_typeof(specializations) = 'array'
              AND jsonb_array_length(specializations) > 0
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(specializations) AS spec 
                WHERE spec = ANY($1::text[])
              )
          `;
          const jsonbResult = await query(checkJsonbQuery, [subCategoryIds]);
          console.log(`[VENDORS-BY-PROBLEM] 🔍 TEST: vendors.specializations JSONB has ${jsonbResult.rows[0]?.count || 0} vendors with spec ${JSON.stringify(subCategoryIds)}`);
          if (jsonbResult.rows[0]?.vendor_ids) {
            console.log(`[VENDORS-BY-PROBLEM] 🔍 TEST: Vendor IDs in JSONB: ${JSON.stringify(jsonbResult.rows[0].vendor_ids)}`);
          }

          // Test 3: Full query with all conditions
          const testQuery = `
            SELECT v.id, v.business_name, v.status, v.is_active, v.specializations, v.vendor_type, v.role_id,
                   EXISTS (
                     SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
                     WHERE spec = ANY($1::text[])
                   ) as has_spec_in_jsonb,
                   EXISTS (
                     SELECT 1 FROM vendor_specializations vs 
                     WHERE vs.vendor_id = v.id AND vs.specialization = ANY($1::text[])
                   ) as has_spec_in_table,
                   (SELECT COUNT(*) FROM vendor_specializations vs WHERE vs.vendor_id = v.id) as total_specs_in_table
            FROM vendors v
            WHERE (
              (v.specializations IS NOT NULL 
               AND jsonb_typeof(v.specializations) = 'array'
               AND jsonb_array_length(v.specializations) > 0
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
                 WHERE spec = ANY($1::text[])
               )) OR
              v.id IN (
                SELECT vendor_id FROM vendor_specializations WHERE specialization = ANY($1::text[])
              )
            )
            AND (v.status = 'approved' OR v.status = 'pending')
            AND v.is_active = true
            LIMIT 10
          `;
          const testResult = await query(testQuery, [subCategoryIds]);
          console.log(`[VENDORS-BY-PROBLEM] 🔍 TEST QUERY: Found ${testResult.rows.length} vendors with matching specialization`);
          if (testResult.rows.length > 0) {
            testResult.rows.forEach((r: any) => {
              console.log(`[VENDORS-BY-PROBLEM] 🔍 Vendor: ${r.business_name} (${r.id})`);
              console.log(`[VENDORS-BY-PROBLEM] 🔍   Status: ${r.status}, Active: ${r.is_active}, Role: ${r.role_id}`);
              console.log(`[VENDORS-BY-PROBLEM] 🔍   Specializations JSONB: ${JSON.stringify(r.specializations)}`);
              console.log(`[VENDORS-BY-PROBLEM] 🔍   Has spec in JSONB: ${r.has_spec_in_jsonb}, Has spec in table: ${r.has_spec_in_table}`);
              console.log(`[VENDORS-BY-PROBLEM] 🔍   Total specs in table: ${r.total_specs_in_table}`);
            });
          } else {
            console.log(`[VENDORS-BY-PROBLEM] ⚠️ TEST QUERY: No vendors found with specialization ${JSON.stringify(subCategoryIds)}`);
          }
        } catch (testErr: any) {
          console.error(`[VENDORS-BY-PROBLEM] Test query error:`, testErr.message, testErr.stack);
        }
      }

      const vendorsResult = await query(vendorsQuery, params);
      console.log(`[VENDORS-BY-PROBLEM] ✅ Query returned ${vendorsResult.rows.length} vendors`);

      // ✅ DEBUG: Check if specific vendor appears in results
      const targetVendorId = 'd19d9358-c9c0-4a44-9c93-bd2e2d592320';
      const foundTargetVendor = vendorsResult.rows.find((v: any) => v.id === targetVendorId);
      if (foundTargetVendor) {
        console.log(`[VENDORS-BY-PROBLEM] ✅ Found target vendor ${targetVendorId} in results!`);
      } else {
        console.log(`[VENDORS-BY-PROBLEM] ⚠️ Target vendor ${targetVendorId} NOT found in results. Checking why...`);
        // Debug why target vendor didn't appear
        try {
          const debugQuery = `
            SELECT 
              v.id, v.business_name, v.status, v.is_active, v.specializations, v.vendor_type, v.role_id,
              r.name as role_name,
              EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(v.specializations) AS spec 
                WHERE spec = ANY($1::text[])
              ) as has_spec_in_jsonb,
              EXISTS (
                SELECT 1 FROM vendor_specializations vs 
                WHERE vs.vendor_id = v.id AND vs.specialization = ANY($1::text[])
              ) as has_spec_in_table,
              (v.status = 'approved' OR v.status = 'pending') as status_ok,
              v.is_active as is_active_ok
            FROM vendors v
            LEFT JOIN roles r ON v.role_id = r.id
            WHERE v.id = $2
          `;
          const debugResult = await query(debugQuery, [subCategoryIds, targetVendorId]);
          if (debugResult.rows.length > 0) {
            const vendor = debugResult.rows[0];
            console.log(`[VENDORS-BY-PROBLEM] 🔍 DEBUG target vendor:`, JSON.stringify({
              id: vendor.id,
              name: vendor.business_name,
              status: vendor.status,
              is_active: vendor.is_active,
              specializations: vendor.specializations,
              has_spec_in_jsonb: vendor.has_spec_in_jsonb,
              has_spec_in_table: vendor.has_spec_in_table,
              status_ok: vendor.status_ok,
              is_active_ok: vendor.is_active_ok,
              role_id: vendor.role_id,
              role_name: vendor.role_name,
              would_match: vendor.has_spec_in_jsonb || vendor.has_spec_in_table,
              would_pass_status: vendor.status_ok && vendor.is_active_ok,
              subCategoryIds: subCategoryIds
            }, null, 2));
          } else {
            console.log(`[VENDORS-BY-PROBLEM] ⚠️ Target vendor ${targetVendorId} not found in database`);
          }
        } catch (debugErr: any) {
          console.error(`[VENDORS-BY-PROBLEM] Debug query error:`, debugErr.message);
        }
      }

      // Enrich vendors with distance, services, schedule, and specialists
      const vendors = await Promise.all(
        vendorsResult.rows.map(async (vendor: any) => {
          // Get services for this vendor
          const servicesResult = await query(
            `SELECT id, service_id, service_name, price, duration_minutes, service_style, category, sub_category
             FROM vendor_services
             WHERE vendor_id = $1 AND is_enabled = true AND (publish_status IN ('published','auto_published','draft') OR publish_status IS NULL)
             ORDER BY price ASC
             LIMIT 10`,
            [vendor.id]
          );

          // Get staff/specialists for this vendor (for vet clinics, training centers, etc.)
          // Note: photo column may not exist in all deployments, so we use a safe query
          const staffResult = await query(
            `SELECT 
              s.id as staff_id,
              s.name as full_name,
              s.role,
              s.experience_years,
              NULL as specialization,
              0 as staff_rating,
              s.is_active,
              NULL as photo
             FROM staff s
             WHERE s.vendor_id = $1 AND s.is_active = true
             ORDER BY s.experience_years DESC NULLS LAST
             LIMIT 20`,
            [vendor.id]
          );

          // Get specializations for staff
          const specialists: any[] = [];
          for (const staff of staffResult.rows) {
            // Get staff specializations - try multiple approaches for compatibility
            let staffSpecsResult: any = { rows: [] };
            try {
              // Try staff_specializations table first
              staffSpecsResult = await query(
                `SELECT specialization, display_name, icon
                 FROM staff_specializations ss
                 LEFT JOIN specializations sp ON ss.specialization_id = sp.id
                 WHERE ss.staff_id = $1`,
                [staff.staff_id]
              );
            } catch (specError: any) {
              // If table doesn't exist, try getting from staff.specialization column
              console.warn('staff_specializations table not found, using staff.specialization column');
              if (staff.specialization) {
                // Parse specialization if it's JSON or comma-separated
                const specs = typeof staff.specialization === 'string' 
                  ? (staff.specialization.includes(',') ? staff.specialization.split(',').map((s: string) => s.trim()) : [staff.specialization])
                  : Array.isArray(staff.specialization) ? staff.specialization : [];
                
                staffSpecsResult.rows = specs.map((spec: string) => ({
                  specialization: spec,
                  display_name: spec,
                  icon: '👨‍⚕️'
                }));
              }
            }

            // Get services offered by this staff member
            let staffServicesResult: any = { rows: [] };
            try {
              staffServicesResult = await query(
                `SELECT vs.id, vs.service_name, vs.price, vs.duration_minutes, vs.service_style
                 FROM vendor_services vs
                 INNER JOIN staff_services sts ON vs.id = sts.service_id
                 WHERE sts.staff_id = $1 AND vs.is_enabled = true
                 LIMIT 5`,
                [staff.staff_id]
              );
            } catch (serviceError: any) {
              // If staff_services table doesn't exist, get all vendor services
              console.warn('staff_services table not found, using all vendor services');
              try {
                staffServicesResult = await query(
                  `SELECT id, service_name, price, duration_minutes, service_style
                   FROM vendor_services
                   WHERE vendor_id = $1 AND is_enabled = true
                   LIMIT 5`,
                  [vendor.id]
                );
              } catch (fallbackError: any) {
                console.warn('Could not fetch services for staff:', fallbackError.message);
              }
            }

            specialists.push({
              staffId: staff.staff_id,
              id: staff.staff_id,
              fullName: staff.full_name,
              role: staff.role,
              experienceYears: staff.experience_years || 0,
              rating: parseFloat(staff.staff_rating || '0'),
              photoUrl: staff.photo_url,
              clinicId: vendor.id,
              clinicName: vendor.business_name,
              clinicAddress: vendor.address,
              specializationDetails: staffSpecsResult.rows.map((spec: any) => ({
                id: spec.specialization,
                displayName: spec.display_name || spec.specialization,
                icon: spec.icon || '👨‍⚕️'
              })),
              services: staffServicesResult.rows.map((s: any) => ({
                id: s.id,
                name: s.service_name,
                price: parseFloat(s.price || '0'),
                duration: parseInt(s.duration_minutes || '0'),
                serviceStyle: s.service_style
              }))
            });
          }

          // Get schedule/availability data - use vendor_availability_v2 (canonical table)
          let nextAvailableSlot = null;
          let isAvailableToday = false;
          try {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            // Check vendor_availability_v2 (primary - used by most vendors)
            const va2TodayCheck = await query(
              `SELECT 1 FROM vendor_availability_v2 
               WHERE vendor_id = $1 
                 AND day_of_week = $2 
                 AND COALESCE(is_enabled, is_available, true) = true 
               LIMIT 1`,
              [vendor.id, dayOfWeek]
            );
            isAvailableToday = va2TodayCheck.rows.length > 0;

            // Get next available slot from vendor_availability_v2
            const nextSlotResult = await query(
              `SELECT day_of_week, COALESCE(time_window_start, start_time) as start_time
               FROM vendor_availability_v2
               WHERE vendor_id = $1
                 AND COALESCE(is_enabled, is_available, true) = true
               ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC
               LIMIT 1`,
              [vendor.id]
            );

            if (nextSlotResult.rows.length > 0) {
              const slot = nextSlotResult.rows[0];
              nextAvailableSlot = {
                date: days[slot.day_of_week] ?? 'Soon',
                time: (slot.start_time || '09:00').toString().substring(0, 5)
              };
            }
          } catch (scheduleError: any) {
            console.warn('Schedule check failed:', scheduleError.message);
            isAvailableToday = true;
          }

          const vendorData: any = {
            id: vendor.id,
            vendorId: vendor.id,
            name: vendor.business_name,
            businessName: vendor.business_name,
            ownerName: vendor.owner_name,
            role: vendor.role_name,
            roleId: vendor.role_id,
            roleDisplayName: vendor.role_display_name,
            city: vendor.city,
            state: vendor.state,
            address: vendor.address,
            phone: vendor.phone,
            email: vendor.email,
            rating: parseFloat(vendor.avg_rating || '0'),
            reviews: parseInt(vendor.total_reviews || '0'),
            bookings: parseInt(vendor.total_bookings || '0'),
            services: servicesResult.rows.map((s: any) => ({
              id: s.id,
              serviceId: s.service_id,
              name: s.service_name,
              price: parseFloat(s.price || '0'),
              duration: parseInt(s.duration_minutes || '0'),
              serviceStyle: s.service_style,
              category: s.category,
              subCategory: s.sub_category
            })),
            vendorServices: servicesResult.rows.map((s: any) => ({
              id: s.id,
              name: s.service_name,
              price: parseFloat(s.price || '0'),
              duration: parseInt(s.duration_minutes || '0')
            })),
            specialistCount: specialists.length,
            specialists: specialists,
            distance: null as number | null,
            nextAvailable: nextAvailableSlot,
            isAvailableToday: isAvailableToday,
            availableServiceStyles: [...new Set(servicesResult.rows.map((s: any) => s.service_style).filter(Boolean))]
          };

          // Calculate distance
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            vendorData.distance = calculateDistance(
              parseFloat(latitude),
              parseFloat(longitude),
              parseFloat(vendor.latitude),
              parseFloat(vendor.longitude)
            );
          }

          return vendorData;
        })
      );

      // Sort by specified criteria
      if (sortBy === 'distance' && latitude && longitude) {
        vendors.sort((a: any, b: any) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
      } else if (sortBy === 'rating') {
        vendors.sort((a: any, b: any) => {
          const aScore = a.rating * 0.7 + (a.distance ? (1 / (a.distance + 1)) * 0.3 : 0);
          const bScore = b.rating * 0.7 + (b.distance ? (1 / (b.distance + 1)) * 0.3 : 0);
          return bScore - aScore;
        });
      } else if (sortBy === 'price') {
        vendors.sort((a: any, b: any) => {
          const aPrice = a.services[0]?.price || 999999;
          const bPrice = b.services[0]?.price || 999999;
          return aPrice - bPrice;
        });
      }

      // Extract specialists if any exist (for staff-only display mode)
      const allSpecialists = vendors.flatMap((v: any) => 
        (v.specialists || []).map((s: any) => ({
          ...s,
          vendorId: v.vendorId,
          vendorName: v.businessName
        }))
      );

      // ✅ DEBUG: Include test query results in response for debugging
      let debugInfo: any = null;
      if (subCategoryIds.length > 0 && vendors.length === 0) {
        try {
          const debugTableQuery = `SELECT COUNT(*) as count FROM vendor_specializations WHERE specialization = ANY($1::text[])`;
          const debugTableResult = await query(debugTableQuery, [subCategoryIds]);
          const debugJsonbQuery = `
            SELECT COUNT(*) as count FROM vendors 
            WHERE specializations IS NOT NULL 
              AND jsonb_typeof(specializations) = 'array'
              AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(specializations) AS spec WHERE spec = ANY($1::text[]))
          `;
          const debugJsonbResult = await query(debugJsonbQuery, [subCategoryIds]);
          debugInfo = {
            subCategoryIds,
            vendor_specializations_count: debugTableResult.rows[0]?.count || 0,
            vendors_jsonb_count: debugJsonbResult.rows[0]?.count || 0,
          };
        } catch (e) {
          debugInfo = { error: (e as Error).message };
        }
      }

      return c.json({
        success: true,
        vendors,
        specialists: allSpecialists.length > 0 ? allSpecialists : undefined,
        data: {
          vendors,
          specialists: allSpecialists.length > 0 ? allSpecialists : undefined
        },
        total: vendors.length,
        problemId,
        ...(debugInfo && { debug: debugInfo }),
      });
    } catch (error: any) {
      console.error('Error fetching vendors by problem:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /public/problems
   * Get problems for problem grid selector (used by ProblemGridSelector.tsx)
   * Query params: roleId (required) — e.g. 'groomer', 'trainer', 'veterinarian', or 'all' for full catalog (home View All)
   * Note: This is a PUBLIC endpoint (no auth required) since problem grid is shown to all users
   * Returns: { id, name, displayName, icon, description, roleId, allowedServiceStyles: [...] }
   */
  app.get("/public/problems", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      
      if (!roleId) {
        return c.json({ 
          success: false, 
          error: 'roleId is required',
          problems: [] 
        }, 400);
      }

      const roleIdNorm = roleId.toLowerCase().trim();
      /** Home "View All" uses roleId=all — must return every specialization, not a single generic row */
      const isAllRoles = roleIdNorm === 'all' || roleIdNorm === '*' || roleIdNorm === 'every';

      // Query problem_grid_mappings for problems matching the role (or all roles when roleId=all)
      // Include allowed_service_styles for service style filtering
      let problemsResult;
      try {
        problemsResult = await query(
          `SELECT DISTINCT
            problem_id as id,
            problem_name as name,
            problem_display_name as "displayName",
            role_id as "roleId",
            COALESCE(
              (SELECT allowed_service_styles FROM problem_grid_mappings pgm2 
               WHERE pgm2.problem_id = problem_grid_mappings.problem_id 
               AND pgm2.role_id = problem_grid_mappings.role_id 
               LIMIT 1),
              '["at_home", "at_center", "tele"]'::jsonb
            ) as allowed_service_styles,
            MIN(order_index) as order_index
          FROM problem_grid_mappings
          ${isAllRoles ? '' : 'WHERE role_id = $1'}
          GROUP BY problem_id, problem_name, problem_display_name, role_id
          ORDER BY MIN(order_index) ASC, role_id ASC, problem_name ASC`,
          isAllRoles ? [] : [roleId]
        );
      } catch (dbError: any) {
        console.error('Database error fetching problems:', dbError.message);
        // Return default problems if table doesn't exist
        return c.json({
          success: true,
          problems: getDefaultProblemsForRole(roleId),
          count: getDefaultProblemsForRole(roleId).length,
          message: 'Default problems (database not available)'
        });
      }

      if (!problemsResult.rows || problemsResult.rows.length === 0) {
        // Return default problems for the role if no mappings exist
        const defaultProblems = getDefaultProblemsForRole(roleId);
        return c.json({
          success: true,
          problems: defaultProblems,
          count: defaultProblems.length,
          message: 'Default problems (no custom mappings yet)'
        });
      }

      // Combined catalog (home View All): use mapping styles as-is — each row may be a different role
      if (isAllRoles) {
        const problems = problemsResult.rows.map((row: any) => {
          let mappingStyles: string[] = ['at_home', 'at_center', 'tele'];
          try {
            if (row.allowed_service_styles) {
              if (typeof row.allowed_service_styles === 'string') {
                mappingStyles = JSON.parse(row.allowed_service_styles);
              } else if (Array.isArray(row.allowed_service_styles)) {
                mappingStyles = row.allowed_service_styles;
              }
            }
          } catch (e) {
            console.warn('Failed to parse allowed_service_styles for problem:', row.id);
          }
          const rId = row.roleId;
          const finalStyles = mappingStyles.length > 0 ? mappingStyles : ['at_home', 'at_center', 'tele'];
          return {
            id: row.id,
            name: row.name,
            displayName: row.displayName || row.name,
            icon: getProblemEmoji(row.id, rId),
            description: `Find ${row.displayName || row.name} specialists`,
            roleId: rId,
            allowedServiceStyles: finalStyles,
            keywords: [row.name.toLowerCase(), row.id.toLowerCase()],
          };
        });
        return c.json({
          success: true,
          problems,
          count: problems.length,
        });
      }

      // Get role's allowed service styles from role config (Walker = at_home only; solo = At Home + Tele per admin)
      let roleAllowedStyles: string[] = ['at_home', 'at_center', 'tele'];
      try {
        const roleNameNorm = (roleId || '').toLowerCase().trim().replace(/\s+/g, '_');
        const rolesByKey = await query(
          `SELECT id, name, config FROM roles WHERE (name = $1 OR id::text = $1) AND (is_active = true OR is_active IS NULL) LIMIT 1`,
          [roleNameNorm]
        ).catch(() => ({ rows: [] }));
        const roleRow = rolesByKey.rows?.[0];
        if (roleRow?.config) {
          const config = typeof roleRow.config === 'string' ? JSON.parse(roleRow.config) : roleRow.config;
          const serviceStylesConfig = config.serviceStyles || config.service_styles;
          const selected = serviceStylesConfig?.selected ?? (Array.isArray(serviceStylesConfig) ? serviceStylesConfig : []);
          if (Array.isArray(selected) && selected.length > 0) {
            const toKey = (s: string) => {
              const k = (s || '').toLowerCase().replace(/\s+/g, '_');
              if (k === 'at_clinic' || k === 'at_center') return 'at_center';
              if (k === 'video_consultation' || k === 'video' || k === 'tele_consultation') return 'tele';
              return k;
            };
            roleAllowedStyles = [...new Set(selected.map((s: string) => toKey(s)).filter(Boolean))];
            if (roleAllowedStyles.length === 0) roleAllowedStyles = ['at_home', 'at_center', 'tele'];
          }
        }
      } catch (e) {
        console.warn('Could not load role config for allowed service styles:', (e as Error).message);
      }

      // Format problems with icons, descriptions, and allowed service styles (intersect with role config)
      const problems = problemsResult.rows.map((row: any) => {
        // Parse allowed_service_styles from problem mapping
        let mappingStyles: string[] = ['at_home', 'at_center', 'tele'];
        try {
          if (row.allowed_service_styles) {
            if (typeof row.allowed_service_styles === 'string') {
              mappingStyles = JSON.parse(row.allowed_service_styles);
            } else if (Array.isArray(row.allowed_service_styles)) {
              mappingStyles = row.allowed_service_styles;
            }
          }
        } catch (e) {
          console.warn('Failed to parse allowed_service_styles for problem:', row.id);
        }
        // Intersect with role's allowed styles so Walker only shows At Home (and Tele if configured)
        const allowedServiceStyles = mappingStyles.filter((s: string) =>
          roleAllowedStyles.includes((s || '').toLowerCase().replace(/\s+/g, '_'))
        );
        const finalStyles = allowedServiceStyles.length > 0 ? allowedServiceStyles : ['at_home'];

        return {
          id: row.id,
          name: row.name,
          displayName: row.displayName || row.name,
          icon: getProblemEmoji(row.id, roleId),
          description: `Find ${row.displayName || row.name} specialists`,
          roleId: row.roleId,
          allowedServiceStyles: finalStyles,
          keywords: [row.name.toLowerCase(), row.id.toLowerCase()]
        };
      });

      return c.json({
        success: true,
        problems,
        count: problems.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer problems:', error);
      return c.json({ 
        success: false,
        error: error.message,
        problems: [] 
      }, 500);
    }
  });

  /**
   * GET /customer/problems/trending
   * Get trending problems based on search/booking activity
   */
  app.get("/customer/problems/trending", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10', 10);

      // Get trending problems from search_index or booking activity
      // For now, return problems with most vendor specializations
      let trendingResult: any;
      try {
        trendingResult = await query(
          `SELECT 
            pgm.problem_id,
            pgm.problem_name,
            pgm.problem_display_name,
            pgm.role_id,
            pgm.sub_category_name,
            COUNT(DISTINCT vs.vendor_id) as vendor_count,
            COALESCE(COUNT(DISTINCT b.id), 0) as booking_count
          FROM problem_grid_mappings pgm
          LEFT JOIN vendor_specializations vs ON vs.specialization = pgm.problem_id
          LEFT JOIN bookings b ON b.service_id IN (
            SELECT id FROM vendor_services WHERE vendor_id = vs.vendor_id
          ) AND b.status = 'completed'
          WHERE pgm.problem_id IS NOT NULL
            AND pgm.problem_name IS NOT NULL
            AND TRIM(pgm.problem_name) != ''
          GROUP BY pgm.problem_id, pgm.problem_name, pgm.problem_display_name, pgm.role_id, pgm.sub_category_name
          HAVING COUNT(DISTINCT vs.vendor_id) > 0 OR COUNT(DISTINCT b.id) > 0
          ORDER BY booking_count DESC, vendor_count DESC
          LIMIT $1`,
          [limit]
        );
      } catch (error: any) {
        console.warn('Error fetching trending problems (returning empty):', error.message);
        // Return empty array if query fails (table might not exist or schema issue)
        return c.json({
          success: true,
          trending: [],
          total: 0,
        });
      }

      // Return properly structured objects for frontend
      const trending = ((trendingResult as any)?.rows || []).map((row: any, index: number) => ({
        problemId: row.problem_id,
        title: row.problem_display_name || row.problem_name || '',
        description: row.sub_category_name || '',
        searchCount: parseInt(row.booking_count || '0', 10) + parseInt(row.vendor_count || '0', 10),
        trend: index < 3 ? 'up' : 'stable',  // Top 3 are trending up
        category: row.role_id || 'general',
      }));

      // Only return if we have actual data with valid titles
      const validTrending = trending.filter((t: any) => t.title && t.title.trim() !== '');

      return c.json({
        success: true,
        trending: validTrending,
        total: validTrending.length,
      });
    } catch (error: any) {
      console.error('Error fetching trending problems:', error);
      // Return empty array on error (non-critical)
      return c.json({
        success: true,
        trending: [],
        total: 0,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * POST /customer/search/track
   * Track problem searches for analytics
   */
  app.post("/customer/search/track", async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, query: searchQuery, type } = body;

      // Log search to database (if search_tracking table exists)
      try {
        await query(
          `INSERT INTO search_tracking (customer_id, query, query_type, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [customerId || 'guest', searchQuery, type || 'problem']
        );
      } catch (dbError) {
        // Silently fail - tracking is not critical
        console.warn('Search tracking failed (table may not exist):', dbError);
      }

      return c.json({
        success: true,
        message: 'Search tracked',
      });
    } catch (error: any) {
      // Silently fail - tracking is not critical
      return c.json({
        success: true,
        message: 'Search tracking failed (non-critical)',
      });
    }
  });
}

/**
 * Helper: Get problem icon based on problem ID
 */
function getProblemIcon(problemId: string): string {
  const iconMap: Record<string, string> = {
    'surgery': 'stethoscope',
    'dermatology': 'stethoscope',
    'dentistry': 'stethoscope',
    'ophthalmology': 'stethoscope',
    'cardiology': 'stethoscope',
    'neurology': 'stethoscope',
    'medicine': 'stethoscope',
    'emergency': 'stethoscope',
    'orthopedic': 'stethoscope',
    'physiotherapy': 'stethoscope',
    'full_grooming': 'scissors',
    'bath_only': 'scissors',
    'haircut_styling': 'scissors',
    'nail_care': 'scissors',
    'deshedding': 'scissors',
    'spa_treatment': 'scissors',
    'basic_obedience': 'graduation-cap',
    'potty_training': 'graduation-cap',
    'socialization': 'graduation-cap',
    'aggression': 'heart',
    'advanced_training': 'graduation-cap',
    'leash_training': 'graduation-cap',
    'daily_walk': 'home',
    'puppy_walk': 'home',
    'senior_walk': 'home',
    'multiple_dogs': 'home',
    'long_walk': 'home',
    'separation_anxiety': 'heart',
    'barking': 'heart',
    'destructive': 'heart',
    'fear_phobia': 'heart',
    'resource_guarding': 'heart',
    'short_stay': 'home',
    'long_stay': 'home',
    'daycare': 'home',
    'luxury_boarding': 'home',
    'medical_boarding': 'home',
    'weight_management': 'bone',
    'allergies_sensitivities': 'bone',
    'digestive_issues': 'bone',
    'puppy_kitten_nutrition': 'bone',
    'senior_nutrition': 'bone',
    'medical_conditions': 'bone',
    'raw_fresh_food': 'bone',
    'performance_nutrition': 'bone',
  };

  return iconMap[problemId] || 'stethoscope';
}

/**
 * Helper: Get problem category
 */
function getProblemCategory(problemId: string): string {
  if (problemId.includes('grooming') || problemId.includes('bath') || problemId.includes('nail')) {
    return 'grooming';
  }
  if (problemId.includes('training') || problemId.includes('obedience') || problemId.includes('socialization')) {
    return 'training';
  }
  if (problemId.includes('walk') || problemId.includes('walker')) {
    return 'walking';
  }
  if (problemId.includes('boarding') || problemId.includes('stay') || problemId.includes('daycare')) {
    return 'boarding';
  }
  if (problemId.includes('nutrition') || problemId.includes('diet') || problemId.includes('food')) {
    return 'nutrition';
  }
  if (problemId.includes('anxiety') || problemId.includes('barking') || problemId.includes('behavior')) {
    return 'behavioral';
  }
  return 'veterinary';
}

/**
 * Helper: Get problem icon emoji for UI display
 */
function getProblemIconEmoji(problemId: string): string {
  const emojiMap: Record<string, string> = {
    'health_checkup': '🏥',
    'vaccination': '💉',
    'deworming': '🐛',
    'dental_care': '🦷',
    'skin_allergies': '🔴',
    'ear_infection': '👂',
    'eye_problems': '👁️',
    'digestive_issues': '🤢',
    'respiratory': '🫁',
    'orthopedic': '🦴',
    'neurological': '🧠',
    'cardiac': '❤️',
    'cancer_treatment': '🎗️',
    'surgery': '⚕️',
    'emergency': '🚨',
    'grooming': '✂️',
    'bath': '🛁',
    'nail_care': '💅',
    'training': '🎓',
    'walking': '🐕',
    'boarding': '🏠',
    'nutrition': '🥗',
  };
  
  // Try exact match first
  if (emojiMap[problemId]) {
    return emojiMap[problemId];
  }
  
  // Try partial matches
  if (problemId.includes('health') || problemId.includes('checkup')) return '🏥';
  if (problemId.includes('vaccine')) return '💉';
  if (problemId.includes('groom') || problemId.includes('bath')) return '✂️';
  if (problemId.includes('train')) return '🎓';
  if (problemId.includes('walk')) return '🐕';
  if (problemId.includes('board')) return '🏠';
  if (problemId.includes('nutrition') || problemId.includes('diet')) return '🥗';
  
  return '🏥'; // Default icon
}

/**
 * Helper: Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Helper: Get emoji icon for problem display in UI
 */
function getProblemEmoji(problemId: string, roleId: string): string {
  const emojiMap: Record<string, string> = {
    // Vet problems
    'health_checkup': '🏥', 'vaccination': '💉', 'deworming': '🐛',
    'dental_care': '🦷', 'skin_allergies': '🔴', 'ear_infection': '👂',
    'eye_problems': '👁️', 'digestive_issues': '🤢', 'respiratory': '🫁',
    'orthopedic': '🦴', 'neurological': '🧠', 'cardiac': '❤️',
    'surgery': '⚕️', 'emergency': '🚨', 'general_consultation': '👨‍⚕️',
    // Grooming
    'full_grooming': '✂️', 'bath_only': '🛁', 'haircut_styling': '💇',
    'nail_care': '💅', 'deshedding': '🐕', 'spa_treatment': '💆',
    // Training
    'basic_obedience': '🎓', 'potty_training': '🏠', 'socialization': '🐾',
    'aggression': '⚠️', 'advanced_training': '🏆', 'leash_training': '🦮',
    // Walking
    'daily_walk': '🚶', 'puppy_walk': '🐶', 'senior_walk': '🐕‍🦺',
    'multiple_dogs': '🐕🐕', 'long_walk': '🏃',
    // Behavioral
    'separation_anxiety': '😢', 'barking': '🔊', 'destructive': '💥',
    'fear_phobia': '👻', 'resource_guarding': '🛡️',
    // Boarding
    'short_stay': '🏨', 'long_stay': '🏡', 'daycare': '☀️',
    'luxury_boarding': '⭐', 'medical_boarding': '💊',
    // Nutrition
    'weight_management': '⚖️', 'allergies_sensitivities': '🚫',
    'puppy_kitten_nutrition': '🍼', 'senior_nutrition': '🦴',
    'raw_fresh_food': '🥩', 'performance_nutrition': '💪',
  };
  
  if (emojiMap[problemId]) return emojiMap[problemId];
  
  // Role-based defaults
  const roleDefaults: Record<string, string> = {
    'vet': '🏥', 'groomer': '✂️', 'trainer': '🎓',
    'walker': '🚶', 'behavioral': '🧠', 'boarding': '🏨',
    'nutritionist': '🥗', 'cafe': '☕', 'resort': '🏖️'
  };
  
  return roleDefaults[roleId] || '🐾';
}

/**
 * Helper: Get default problems for a role when database has no mappings
 * roleId "all" merges every catalog role (matches home "What's your pet needs?" View All).
 */
function getDefaultProblemsForRole(roleId: string): any[] {
  const defaultProblems: Record<string, any[]> = {
    'vet': [
      { id: 'general_consultation', name: 'General Consultation', displayName: 'General Consultation', icon: '👨‍⚕️', description: 'General health checkup and consultation' },
      { id: 'vaccination', name: 'Vaccination', displayName: 'Vaccination', icon: '💉', description: 'Vaccines and immunizations' },
      { id: 'dental_care', name: 'Dental Care', displayName: 'Dental Care', icon: '🦷', description: 'Teeth cleaning and dental issues' },
      { id: 'skin_allergies', name: 'Skin & Allergies', displayName: 'Skin & Allergies', icon: '🔴', description: 'Skin conditions and allergy treatment' },
      { id: 'digestive_issues', name: 'Digestive Issues', displayName: 'Digestive Issues', icon: '🤢', description: 'Stomach and digestive problems' },
      { id: 'emergency', name: 'Emergency', displayName: 'Emergency', icon: '🚨', description: 'Urgent care needed' },
    ],
    'groomer': [
      { id: 'full_grooming', name: 'Full Grooming', displayName: 'Full Grooming', icon: '✂️', description: 'Complete grooming package' },
      { id: 'bath_only', name: 'Bath & Brush', displayName: 'Bath & Brush', icon: '🛁', description: 'Bath with brushing' },
      { id: 'haircut_styling', name: 'Haircut & Styling', displayName: 'Haircut & Styling', icon: '💇', description: 'Haircut and styling' },
      { id: 'nail_care', name: 'Nail Care', displayName: 'Nail Care', icon: '💅', description: 'Nail trimming and care' },
      { id: 'deshedding', name: 'De-shedding', displayName: 'De-shedding', icon: '🐕', description: 'Remove excess fur' },
      { id: 'spa_treatment', name: 'Spa Treatment', displayName: 'Spa Treatment', icon: '💆', description: 'Relaxing spa experience' },
    ],
    'trainer': [
      { id: 'basic_obedience', name: 'Basic Obedience', displayName: 'Basic Obedience', icon: '🎓', description: 'Basic commands training' },
      { id: 'potty_training', name: 'Potty Training', displayName: 'Potty Training', icon: '🏠', description: 'House training' },
      { id: 'socialization', name: 'Socialization', displayName: 'Socialization', icon: '🐾', description: 'Social skills with other pets' },
      { id: 'aggression', name: 'Aggression Management', displayName: 'Aggression Management', icon: '⚠️', description: 'Aggression correction' },
      { id: 'leash_training', name: 'Leash Training', displayName: 'Leash Training', icon: '🦮', description: 'Walking on leash' },
      { id: 'advanced_training', name: 'Advanced Training', displayName: 'Advanced Training', icon: '🏆', description: 'Advanced commands and tricks' },
    ],
    'walker': [
      { id: 'daily_walk', name: 'Daily Walk', displayName: 'Daily Walk', icon: '🚶', description: 'Regular daily walks' },
      { id: 'puppy_walk', name: 'Puppy Walking', displayName: 'Puppy Walking', icon: '🐶', description: 'Gentle walks for puppies' },
      { id: 'senior_walk', name: 'Senior Walking', displayName: 'Senior Walking', icon: '🐕‍🦺', description: 'Slow walks for senior pets' },
      { id: 'long_walk', name: 'Long Walk', displayName: 'Long Walk', icon: '🏃', description: 'Extended walking sessions' },
    ],
    'behavioral': [
      { id: 'separation_anxiety', name: 'Separation Anxiety', displayName: 'Separation Anxiety', icon: '😢', description: 'Anxiety when alone' },
      { id: 'barking', name: 'Excessive Barking', displayName: 'Excessive Barking', icon: '🔊', description: 'Barking control' },
      { id: 'destructive', name: 'Destructive Behavior', displayName: 'Destructive Behavior', icon: '💥', description: 'Chewing and destroying items' },
      { id: 'fear_phobia', name: 'Fear & Phobias', displayName: 'Fear & Phobias', icon: '👻', description: 'Fear of sounds, objects' },
    ],
    'behaviorist': [
      { id: 'separation_anxiety', name: 'Separation Anxiety', displayName: 'Separation Anxiety', icon: '😢', description: 'Anxiety when alone' },
      { id: 'barking', name: 'Excessive Barking', displayName: 'Excessive Barking', icon: '🔊', description: 'Barking control' },
      { id: 'destructive', name: 'Destructive Behavior', displayName: 'Destructive Behavior', icon: '💥', description: 'Chewing and destroying items' },
      { id: 'fear_phobia', name: 'Fear & Phobias', displayName: 'Fear & Phobias', icon: '👻', description: 'Fear of sounds, objects' },
    ],
    'boarding': [
      { id: 'short_stay', name: 'Short Stay', displayName: 'Short Stay', icon: '🏨', description: '1-3 days boarding' },
      { id: 'long_stay', name: 'Long Stay', displayName: 'Long Stay', icon: '🏡', description: 'Extended boarding' },
      { id: 'daycare', name: 'Day Care', displayName: 'Day Care', icon: '☀️', description: 'Daily care service' },
      { id: 'luxury_boarding', name: 'Luxury Boarding', displayName: 'Luxury Boarding', icon: '⭐', description: 'Premium boarding experience' },
    ],
    'nutritionist': [
      { id: 'weight_management', name: 'Weight Management', displayName: 'Weight Management', icon: '⚖️', description: 'Weight loss/gain plans' },
      { id: 'allergies_sensitivities', name: 'Food Allergies', displayName: 'Food Allergies', icon: '🚫', description: 'Allergy-safe diet plans' },
      { id: 'puppy_kitten_nutrition', name: 'Puppy/Kitten Nutrition', displayName: 'Puppy/Kitten Nutrition', icon: '🍼', description: 'Young pet nutrition' },
      { id: 'senior_nutrition', name: 'Senior Nutrition', displayName: 'Senior Nutrition', icon: '🦴', description: 'Elderly pet diet' },
    ],
  };

  const norm = (roleId || '').toLowerCase().trim();
  if (norm === 'all' || norm === '*' || norm === 'every') {
    const stdStyles = ['at_home', 'at_center', 'tele'];
    const withRole = (items: any[], apiRole: string) =>
      items.map((p) => ({
        ...p,
        roleId: apiRole,
        allowedServiceStyles: stdStyles,
        keywords: [p.name.toLowerCase(), String(p.id).toLowerCase()],
      }));
    return [
      ...withRole(defaultProblems.vet, 'veterinarian'),
      ...withRole(defaultProblems.groomer, 'groomer'),
      ...withRole(defaultProblems.trainer, 'trainer'),
      ...withRole(defaultProblems.walker, 'walker'),
      ...withRole(defaultProblems.boarding, 'boarding'),
      ...withRole(defaultProblems.nutritionist, 'nutritionist'),
      ...withRole(defaultProblems.behaviorist, 'behaviorist'),
    ];
  }

  return defaultProblems[roleId] || [
    { id: 'general', name: 'General Service', displayName: 'General Service', icon: '🐾', description: 'General pet services' }
  ];
}
