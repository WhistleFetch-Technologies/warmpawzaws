"use strict";
/**
 * ============================================================================
 * REGION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Backend API for multi-region configuration
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionEndpoints = regionEndpoints;
const response_utils_1 = require("./response-utils");
const regions_1 = require("../lib/repositories/regions");
const region_types_1 = require("./region-types");
const BASE_PATH = '/make-server-3dd53475';
function regionEndpoints(app) {
    try {
        console.log('🌍 [REGION] Registering region endpoints...');
        // Health check endpoint to verify region endpoints are loaded
        app.get(`${BASE_PATH}/region-health`, async (c) => {
            console.log('🌍 [REGION] Health check called');
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Region endpoints are loaded and working!',
                timestamp: new Date().toISOString(),
            });
        });
        // Get all regions
        app.get(`${BASE_PATH}/regions`, async (c) => {
            try {
                console.log('🌍 [REGION] GET /regions called');
                // ✅ SQL: Get all regions from repository
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const regions = await regionsRepo.findAll();
                // Map SQL schema to expected format
                const mappedRegions = regions.map(r => ({
                    regionId: r.code,
                    regionName: r.name,
                    regionCode: r.code,
                    country: r.country || 'India',
                    serviceCatalog: r.region_config?.serviceCatalog || {},
                    isActive: r.is_active,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    ...r.region_config
                }));
                console.log(`🌍 [REGION] Found ${mappedRegions.length} regions`);
                return (0, response_utils_1.sendSuccess)(c, {
                    regions: mappedRegions,
                    count: mappedRegions.length,
                });
            }
            catch (error) {
                console.error('❌ [REGION] Error fetching regions:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Get active regions only
        app.get(`${BASE_PATH}/regions/active`, async (c) => {
            try {
                console.log('🌍 [REGION] GET /regions/active called');
                // ✅ SQL: Get active regions from repository
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const regions = await regionsRepo.findActive();
                // Map SQL schema to expected format
                const mappedRegions = regions.map(r => ({
                    regionId: r.code,
                    regionName: r.name,
                    regionCode: r.code,
                    country: r.country || 'India',
                    serviceCatalog: r.region_config?.serviceCatalog || {},
                    isActive: r.is_active,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    ...r.region_config
                }));
                return (0, response_utils_1.sendSuccess)(c, {
                    regions: mappedRegions,
                });
            }
            catch (error) {
                console.error('Error fetching active regions:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Get specific region by ID
        app.get(`${BASE_PATH}/regions/:regionId`, async (c) => {
            try {
                const regionId = c.req.param('regionId');
                // ✅ SQL: Get region from repository
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const regionRaw = await regionsRepo.findByCode(regionId);
                if (!regionRaw) {
                    return (0, response_utils_1.sendError)(c, 'Region not found', 404);
                }
                // Map to expected format
                const region = {
                    regionId: regionRaw.code,
                    regionName: regionRaw.name,
                    regionCode: regionRaw.code,
                    country: regionRaw.country || 'India',
                    serviceCatalog: regionRaw.region_config?.serviceCatalog || {},
                    isActive: regionRaw.is_active,
                    createdAt: regionRaw.created_at,
                    updatedAt: regionRaw.updated_at,
                    ...regionRaw.region_config
                };
                return (0, response_utils_1.sendSuccess)(c, { region });
            }
            catch (error) {
                console.error('Error fetching region:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Get region services (enabled services for a region)
        app.get(`${BASE_PATH}/region-services`, async (c) => {
            try {
                const regionId = c.req.query('regionId') || 'india';
                // ✅ SQL: Get region from repository
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const regionRaw = await regionsRepo.findByCode(regionId);
                if (!regionRaw) {
                    return (0, response_utils_1.sendError)(c, 'Region not found', 404);
                }
                const serviceCatalog = regionRaw.region_config?.serviceCatalog || {};
                return (0, response_utils_1.sendSuccess)(c, {
                    services: serviceCatalog,
                    regionId: regionRaw.code,
                    regionName: regionRaw.name,
                });
            }
            catch (error) {
                console.error('Error fetching region services:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Get all regions (Admin) - same as /regions but under /admin prefix
        app.get(`${BASE_PATH}/admin/regions`, async (c) => {
            try {
                console.log('🌍 [REGION] GET /admin/regions called');
                // ✅ SQL: Get all regions from repository
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const regions = await regionsRepo.findAll();
                // Map to expected format
                const mappedRegions = regions.map(r => ({
                    regionId: r.code,
                    regionName: r.name,
                    regionCode: r.code,
                    country: r.country || 'India',
                    serviceCatalog: r.region_config?.serviceCatalog || {},
                    isActive: r.is_active,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    ...r.region_config
                }));
                return (0, response_utils_1.sendSuccess)(c, {
                    regions: mappedRegions || [],
                });
            }
            catch (error) {
                console.error('Error fetching regions:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Create new region (Admin only)
        app.post(`${BASE_PATH}/admin/regions`, async (c) => {
            try {
                const body = await c.req.json();
                const { regionId, templateId } = body;
                if (!regionId) {
                    return (0, response_utils_1.sendError)(c, 'Region ID is required', 400);
                }
                // ✅ SQL: Check if region already exists
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const existing = await regionsRepo.findByCode(regionId);
                if (existing) {
                    return (0, response_utils_1.sendError)(c, 'Region already exists', 400);
                }
                // Get template or use provided data
                let regionConfig = {};
                let regionData;
                if (templateId && region_types_1.REGION_TEMPLATES[templateId]) {
                    const template = region_types_1.REGION_TEMPLATES[templateId];
                    regionConfig = template;
                    regionData = {
                        code: regionId,
                        name: template.regionName || regionId,
                        country: template.country || 'India',
                        region_config: template,
                        is_active: template.isActive !== false,
                    };
                }
                else {
                    regionConfig = body;
                    regionData = {
                        code: regionId,
                        name: body.name || body.regionName || regionId,
                        country: body.country || 'India',
                        region_config: body,
                        is_active: body.isActive !== false,
                    };
                }
                // ✅ SQL: Create region using repository
                const created = await regionsRepo.create(regionData);
                return (0, response_utils_1.sendSuccess)(c, {
                    region: {
                        regionId: created.code,
                        regionName: created.name,
                        regionCode: created.code,
                        country: created.country,
                        serviceCatalog: created.region_config?.serviceCatalog || {},
                        isActive: created.is_active,
                        createdAt: created.created_at,
                        updatedAt: created.updated_at,
                        ...created.region_config
                    },
                    message: `Region ${regionId} created successfully`,
                });
            }
            catch (error) {
                console.error('Error creating region:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Update region (Admin only)
        app.put(`${BASE_PATH}/admin/regions/:regionId`, async (c) => {
            try {
                const regionId = c.req.param('regionId');
                const updates = await c.req.json();
                // ✅ SQL: Check if region exists
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const existing = await regionsRepo.findByCode(regionId);
                if (!existing) {
                    return (0, response_utils_1.sendError)(c, 'Region not found', 404);
                }
                // ✅ SQL: Update region using repository
                const updateData = {
                    ...updates,
                    region_config: updates.region_config || existing.region_config,
                };
                const updated = await regionsRepo.update(regionId, updateData);
                return (0, response_utils_1.sendSuccess)(c, {
                    region: {
                        regionId: updated.code,
                        regionName: updated.name,
                        regionCode: updated.code,
                        country: updated.country,
                        serviceCatalog: updated.region_config?.serviceCatalog || {},
                        isActive: updated.is_active,
                        createdAt: updated.created_at,
                        updatedAt: updated.updated_at,
                        ...updated.region_config
                    },
                    message: `Region ${regionId} updated successfully`,
                });
            }
            catch (error) {
                console.error('Error updating region:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Activate/Deactivate region (Admin only)
        app.patch(`${BASE_PATH}/admin/regions/:regionId/status`, async (c) => {
            try {
                const regionId = c.req.param('regionId');
                const { isActive } = await c.req.json();
                // ✅ SQL: Update region status using repository
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const existing = await regionsRepo.findByCode(regionId);
                if (!existing) {
                    return (0, response_utils_1.sendError)(c, 'Region not found', 404);
                }
                const updated = await regionsRepo.setActive(regionId, isActive);
                return (0, response_utils_1.sendSuccess)(c, {
                    region: {
                        regionId: updated.code,
                        regionName: updated.name,
                        regionCode: updated.code,
                        country: updated.country,
                        serviceCatalog: updated.region_config?.serviceCatalog || {},
                        isActive: updated.is_active,
                        createdAt: updated.created_at,
                        updatedAt: updated.updated_at,
                        ...updated.region_config
                    },
                    message: `Region ${regionId} ${isActive ? 'activated' : 'deactivated'} successfully`,
                });
            }
            catch (error) {
                console.error('Error updating region status:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Get available templates
        app.get(`${BASE_PATH}/admin/region-templates`, async (c) => {
            try {
                console.log('🌍 [REGION] GET /admin/region-templates called');
                return (0, response_utils_1.sendSuccess)(c, {
                    templates: Object.keys(region_types_1.REGION_TEMPLATES).map(key => ({
                        id: key,
                        name: region_types_1.REGION_TEMPLATES[key].regionName,
                        code: region_types_1.REGION_TEMPLATES[key].regionCode,
                    })),
                });
            }
            catch (error) {
                console.error('Error fetching templates:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Initialize region from template (seed data)
        app.post(`${BASE_PATH}/admin/regions/init-:templateId`, async (c) => {
            try {
                const templateId = c.req.param('templateId');
                console.log(`🌍 [REGION] POST /admin/regions/init-${templateId} called`);
                // Check if template exists
                if (!region_types_1.REGION_TEMPLATES[templateId]) {
                    return (0, response_utils_1.sendError)(c, `Template "${templateId}" not found`, 404);
                }
                const regionId = templateId; // Template ID is the region ID
                // ✅ SQL: Check if region already exists
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                const existing = await regionsRepo.findByCode(regionId);
                if (existing) {
                    return (0, response_utils_1.sendSuccess)(c, {
                        message: `${region_types_1.REGION_TEMPLATES[templateId].regionName} region already exists`,
                        region: {
                            regionId: existing.code,
                            regionName: existing.name,
                            regionCode: existing.code,
                            country: existing.country,
                            serviceCatalog: existing.region_config?.serviceCatalog || {},
                            isActive: existing.is_active,
                            createdAt: existing.created_at,
                            updatedAt: existing.updated_at,
                            ...existing.region_config
                        },
                    });
                }
                // ✅ SQL: Create region from template using repository
                const template = region_types_1.REGION_TEMPLATES[templateId];
                const created = await regionsRepo.create({
                    code: regionId,
                    name: template.regionName || regionId,
                    country: template.country || 'India',
                    region_config: template,
                    is_active: templateId === 'india', // Only India is active by default
                });
                console.log(`✅ Region ${regionId} initialized successfully`);
                return (0, response_utils_1.sendSuccess)(c, {
                    message: `${template.regionName} region initialized successfully`,
                    region: {
                        regionId: created.code,
                        regionName: created.name,
                        regionCode: created.code,
                        country: created.country,
                        serviceCatalog: created.region_config?.serviceCatalog || {},
                        isActive: created.is_active,
                        createdAt: created.created_at,
                        updatedAt: created.updated_at,
                        ...created.region_config
                    },
                });
            }
            catch (error) {
                console.error('Error initializing region:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        // Seed ALL regions (Singapore, UAE, EMEA, UK, US, Australia)
        app.post(`${BASE_PATH}/admin/regions/seed-all`, async (c) => {
            try {
                console.log('🌍 [REGION] POST /admin/regions/seed-all called');
                const results = [];
                const templateKeys = Object.keys(region_types_1.REGION_TEMPLATES);
                const regionsRepo = (0, regions_1.getRegionsRepository)();
                for (const templateId of templateKeys) {
                    const template = region_types_1.REGION_TEMPLATES[templateId];
                    const regionId = template.regionId || templateId; // e.g. 'india', 'singapore'
                    try {
                        // ✅ SQL: Check if exists
                        const existing = await regionsRepo.findByCode(regionId);
                        if (existing) {
                            results.push({ regionId, status: 'skipped', message: 'Already exists' });
                            continue;
                        }
                        // ✅ SQL: Create from template using repository
                        await regionsRepo.create({
                            code: regionId,
                            name: template.regionName || regionId,
                            country: template.country || 'India',
                            region_config: template,
                            is_active: templateId === 'india', // Ensure ONLY India is active by default
                        });
                        results.push({ regionId, status: 'created', message: 'Seeded successfully' });
                        console.log(`✅ Region ${regionId} seeded.`);
                    }
                    catch (err) {
                        results.push({ regionId, status: 'error', message: String(err) });
                        console.error(`❌ Error seeding region ${regionId}:`, err);
                    }
                }
                return (0, response_utils_1.sendSuccess)(c, {
                    message: 'Multi-region seeding complete',
                    results,
                });
            }
            catch (error) {
                console.error('Error seeding all regions:', error);
                return (0, response_utils_1.sendError)(c, error, 500);
            }
        });
        console.log('✅ [REGION] All region endpoints registered successfully');
    }
    catch (error) {
        console.error('❌❌❌ [REGION] FATAL ERROR registering region endpoints:', error);
        if (error instanceof Error) {
            console.error('❌❌❌ [REGION] Stack:', error.stack);
        }
        throw error;
    }
}
//# sourceMappingURL=region-endpoints-sql.js.map