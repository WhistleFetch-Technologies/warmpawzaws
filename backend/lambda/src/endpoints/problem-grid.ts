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
      const mappingsResult = await query(
        `SELECT DISTINCT 
           sub_category_id, 
           role_id,
           COALESCE(allowed_service_styles, '["at_home", "at_center", "tele"]'::jsonb) as allowed_service_styles
         FROM problem_grid_mappings
         WHERE problem_id = $1`,
        [problemId]
      );

      if (mappingsResult.rows.length === 0) {
        return c.json({
          success: true,
          services: [],
          total: 0,
        });
      }

      // Check if requested serviceStyle is allowed for this problem
      if (serviceStyle) {
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

      const subCategoryIds = mappingsResult.rows.map((r: any) => r.sub_category_id);
      let roleIds = [...new Set(mappingsResult.rows.map((r: any) => r.role_id))];

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

      // Get vendors with matching specializations or roles
      // Use rev for reviews (is_published works when is_approved column is missing); join roles for role name filter (problem_grid_mappings.role_id is role name TEXT, vendors.role_id is UUID)
      // Note: Do not use SELECT DISTINCT with GROUP BY + ORDER BY - PostgreSQL requires ORDER BY columns in select list when using DISTINCT. GROUP BY already deduplicates.
      let servicesQuery = `
        SELECT
          vs.id as service_id,
          vs.service_name as name,
          vs.service_name as description,
          vs.price,
          vs.duration_minutes as duration,
          vs.service_style,
          vs.vendor_id,
          v.business_name as vendor_name,
          COALESCE(AVG(rev.rating), 0) as vendor_rating,
          COUNT(DISTINCT rev.id) as vendor_reviews,
          v.city,
          v.state,
          vs.created_at
        FROM vendor_services vs
        INNER JOIN vendors v ON vs.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        LEFT JOIN reviews rev ON rev.vendor_id = v.id AND (rev.is_published = true OR rev.is_published IS NULL)
        WHERE v.status = 'approved' 
          AND v.is_active = true
          AND vs.is_enabled = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by service_style if provided
      if (serviceStyle) {
        servicesQuery += ` AND vs.service_style = $${paramIndex}`;
        params.push(serviceStyle);
        paramIndex++;
      }

      // Match by subcategory: ILIKE on service_name (with %), exact match on vendor_specializations.specialization (no %)
      if (subCategoryIds.length > 0) {
        const searchTerms = subCategoryIds.map((id: string) => `%${id}%`);
        servicesQuery += ` AND (
          vs.service_name ILIKE ANY($${paramIndex}::text[]) OR
          vs.vendor_id IN (
            SELECT vendor_id 
            FROM vendor_specializations 
            WHERE specialization = ANY($${paramIndex + 1}::text[])
          )
        )`;
        params.push(searchTerms, subCategoryIds);
        paramIndex += 2;
      }

      // Filter by role: problem_grid_mappings.role_id is role name (TEXT); match via roles.name
      if (roleIds.length > 0) {
        servicesQuery += ` AND r.name = ANY($${paramIndex}::text[])`;
        params.push(roleIds);
        paramIndex++;
      }

      servicesQuery += `
        GROUP BY vs.id, vs.service_name, vs.price, vs.duration_minutes, vs.service_style,
                 vs.vendor_id, v.business_name, v.city, v.state, vs.created_at
        ORDER BY vendor_rating DESC, vs.created_at DESC
        LIMIT 50
      `;

      const servicesResult = await query(servicesQuery, params);

      // Calculate distance if location provided
      let services = servicesResult.rows.map((service: any) => {
        const serviceData: any = {
          serviceId: service.service_id,
          name: service.name,
          description: service.description,
          price: parseFloat(service.price || '0'),
          duration: parseInt(service.duration || '0'),
          serviceStyle: service.service_style,
          vendorId: service.vendor_id,
          vendorName: service.vendor_name,
          vendorRating: parseFloat(service.vendor_rating || '0'),
          vendorReviews: parseInt(service.vendor_reviews || '0'),
          distance: null as number | null,
          relevanceScore: 1.0, // Default relevance
        };

        // Calculate distance if coordinates available
        if (latitude && longitude && service.latitude && service.longitude) {
          serviceData.distance = calculateDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            parseFloat(service.latitude),
            parseFloat(longitude)
          );
        }

        return serviceData;
      });

      // Sort by relevance (rating + distance if available)
      services.sort((a: any, b: any) => {
        const aScore = a.vendorRating * 0.7 + (a.distance ? (1 / (a.distance + 1)) * 0.3 : 0);
        const bScore = b.vendorRating * 0.7 + (b.distance ? (1 / (b.distance + 1)) * 0.3 : 0);
        return bScore - aScore;
      });

      return c.json({
        success: true,
        services,
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

      const subCategoryIds = mappingsResult.rows.length > 0
        ? mappingsResult.rows.map((r: any) => r.sub_category_id)
        : [problemId]; // When no mapping, problemId is specialization_id from specialization_master
      let roleIds = mappingsResult.rows.length > 0
        ? [...new Set(mappingsResult.rows.map((r: any) => r.role_id))]
        : []; // When no mapping, no role filter unless roleId query provided

      if (roleId) {
        roleIds = [roleId];
      }

      // Get vendors with matching specializations (vendor_specializations.specialization = problemId or sub_category_id)
      let vendorsQuery = `
        SELECT DISTINCT
          v.*,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(AVG(rev.rating), 0) as avg_rating,
          COUNT(DISTINCT rev.id) as total_reviews,
          COUNT(DISTINCT b.id) as total_bookings
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        LEFT JOIN reviews rev ON rev.vendor_id = v.id AND rev.is_approved = true
        LEFT JOIN bookings b ON b.vendor_id = v.id AND b.status = 'completed'
        WHERE v.status = 'approved' 
          AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Match by role (when from mappings or when roleId query provided)
      if (roleIds.length > 0) {
        vendorsQuery += ` AND (r.id::text = ANY($${paramIndex}::text[]) OR r.name = ANY($${paramIndex + 1}::text[]))`;
        params.push(roleIds, roleIds);
        paramIndex += 2;
      }

      // Match by specialization: vendor_specializations.specialization = problemId or sub_category_id
      if (subCategoryIds.length > 0) {
        vendorsQuery += ` AND v.id IN (
          SELECT vendor_id 
          FROM vendor_specializations 
          WHERE specialization = ANY($${paramIndex}::text[])
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
            AND vs.publish_status = 'published'
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
        GROUP BY v.id, r.name, r.display_name
        ORDER BY avg_rating DESC, total_bookings DESC
        LIMIT 50
      `;

      const vendorsResult = await query(vendorsQuery, params);

      // Enrich vendors with distance, services, schedule, and specialists
      const vendors = await Promise.all(
        vendorsResult.rows.map(async (vendor: any) => {
          // Get services for this vendor
          const servicesResult = await query(
            `SELECT id, service_id, service_name, price, duration_minutes, service_style, category, sub_category
             FROM vendor_services
             WHERE vendor_id = $1 AND is_enabled = true AND publish_status = 'published'
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
              s.specialization,
              s.rating as staff_rating,
              s.is_active,
              NULL as photo
             FROM staff s
             WHERE s.vendor_id = $1 AND s.is_active = true
             ORDER BY s.rating DESC NULLS LAST, s.experience_years DESC
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
      });
    } catch (error: any) {
      console.error('Error fetching vendors by problem:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /public/problems
   * Get problems for problem grid selector (used by ProblemGridSelector.tsx)
   * Query params: roleId (required) - e.g., 'vet', 'groomer', 'trainer'
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

      // Query problem_grid_mappings for problems matching the role
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
          WHERE role_id = $1
          GROUP BY problem_id, problem_name, problem_display_name, role_id
          ORDER BY MIN(order_index) ASC, problem_name ASC`,
          [roleId]
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

  return defaultProblems[roleId] || [
    { id: 'general', name: 'General Service', displayName: 'General Service', icon: '🐾', description: 'General pet services' }
  ];
}
