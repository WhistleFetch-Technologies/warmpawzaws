"use strict";
/**
 * ============================================================================
 * ADMIN CATALOG ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Admin catalog management endpoints
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminCatalogEndpoints = registerAdminCatalogEndpoints;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const BASE_PATH = '/make-server-3dd53475';
function registerAdminCatalogEndpoints(app) {
    /**
     * GET /make-server-3dd53475/admin/catalog/categories
     * Get all categories
     */
    app.get(`${BASE_PATH}/admin/catalog/categories`, async (c) => {
        try {
            // ✅ SQL: Get categories from service_categories table
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT * FROM service_categories WHERE is_active = true ORDER BY display_order ASC`);
            const categories = result.rows || [];
            return (0, response_utils_1.sendSuccess)(c, { categories });
        }
        catch (error) {
            console.error('Error fetching categories:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/admin/service-catalog
     * Get all services as a flat list (for Admin UI)
     */
    app.get(`${BASE_PATH}/admin/service-catalog`, async (c) => {
        try {
            // ✅ SQL: Get service catalog from service_catalog table
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT * FROM service_catalog WHERE status = 'active' ORDER BY created_at DESC`);
            const serviceList = result.rows || [];
            // Ensure backward compatibility fields if needed
            const servicesWithDetails = serviceList.map((svc) => ({
                ...svc,
                catalogId: svc.id || svc.catalog_id,
                // Ensure numeric values are numbers
                basePrice: Number(svc.base_price || svc.basePrice || 0),
                duration: Number(svc.duration || svc.duration_minutes || 0)
            }));
            return (0, response_utils_1.sendSuccess)(c, {
                services: servicesWithDetails,
                count: serviceList.length
            });
        }
        catch (error) {
            console.error('Error fetching service catalog:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /make-server-3dd53475/admin/service-catalog
     * Create a new service (Add to platform:service_catalog)
     */
    app.post(`${BASE_PATH}/admin/service-catalog`, async (c) => {
        try {
            const data = await c.req.json();
            if (!data.serviceName || !data.categoryId) {
                return (0, response_utils_1.sendError)(c, 'Service name and Category ID are required', 400);
            }
            // ✅ SQL: Create service in service_catalog table
            const insertData = {
                service_name: data.serviceName,
                category_id: data.categoryId,
                base_price: data.basePrice || 0,
                duration: data.duration || 30,
                description: data.description || null,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            // Add any additional fields from data
            if (data.subCategoryId)
                insertData.sub_category_id = data.subCategoryId;
            if (data.serviceType)
                insertData.service_type = data.serviceType;
            if (data.icon)
                insertData.icon = data.icon;
            if (data.image)
                insertData.image = data.image;
            const result = await (0, db_1.insertQuery)('service_catalog', insertData);
            if (result.length === 0) {
                throw new Error('Failed to create service');
            }
            const newService = result[0];
            return (0, response_utils_1.sendSuccess)(c, {
                service: {
                    ...newService,
                    catalogId: newService.id,
                    serviceName: newService.service_name,
                    basePrice: newService.base_price
                },
                message: 'Service created successfully'
            });
        }
        catch (error) {
            console.error('Error creating service:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PUT /make-server-3dd53475/admin/service-catalog/:catalogId
     * Update a service
     */
    app.put(`${BASE_PATH}/admin/service-catalog/:catalogId`, async (c) => {
        try {
            const catalogId = c.req.param('catalogId');
            const updates = await c.req.json();
            // ✅ SQL: Update service in service_catalog table
            const updateData = {
                updated_at: new Date().toISOString()
            };
            if (updates.serviceName)
                updateData.service_name = updates.serviceName;
            if (updates.basePrice !== undefined)
                updateData.base_price = updates.basePrice;
            if (updates.duration !== undefined)
                updateData.duration = updates.duration;
            if (updates.description !== undefined)
                updateData.description = updates.description;
            if (updates.categoryId)
                updateData.category_id = updates.categoryId;
            if (updates.status)
                updateData.status = updates.status;
            if (updates.subCategoryId)
                updateData.sub_category_id = updates.subCategoryId;
            if (updates.serviceType)
                updateData.service_type = updates.serviceType;
            if (updates.icon)
                updateData.icon = updates.icon;
            if (updates.image)
                updateData.image = updates.image;
            const result = await (0, db_1.updateQuery)('service_catalog', { id: catalogId }, updateData);
            if (result.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Service not found', 404);
            }
            const updatedService = result[0];
            return (0, response_utils_1.sendSuccess)(c, {
                service: {
                    ...updatedService,
                    catalogId: updatedService.id,
                    serviceName: updatedService.service_name,
                    basePrice: updatedService.base_price
                },
                message: 'Service updated successfully'
            });
        }
        catch (error) {
            console.error('Error updating service:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * DELETE /make-server-3dd53475/admin/service-catalog/:catalogId
     * Delete a service
     */
    app.delete(`${BASE_PATH}/admin/service-catalog/:catalogId`, async (c) => {
        try {
            const catalogId = c.req.param('catalogId');
            // ✅ SQL: Soft delete service in service_catalog table (set status = 'deleted')
            const result = await (0, db_1.updateQuery)('service_catalog', { id: catalogId }, {
                status: 'deleted',
                updated_at: new Date().toISOString()
            });
            if (result.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Service not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Service deleted successfully'
            });
        }
        catch (error) {
            console.error('Error deleting service:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /make-server-3dd53475/admin/catalog/update-realistic-prices
     * Update prices in V2 catalog
     */
    app.post(`${BASE_PATH}/admin/catalog/update-realistic-prices`, async (c) => {
        try {
            // ✅ SQL: Get all services from service_catalog table
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT id, base_price FROM service_catalog WHERE status = 'active'`);
            const allServices = result.rows || [];
            let updatedCount = 0;
            // Update services with string prices
            for (const svc of allServices) {
                if (typeof svc.base_price === 'string') {
                    await (0, db_1.updateQuery)('service_catalog', { id: svc.id }, { base_price: parseFloat(svc.base_price) || 0 });
                    updatedCount++;
                }
            }
            return (0, response_utils_1.sendSuccess)(c, {
                stats: {
                    updated: updatedCount,
                    skipped: allServices.length - updatedCount
                }
            });
        }
        catch (error) {
            console.error('Error updating prices:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=admin-catalog-endpoints-sql.js.map