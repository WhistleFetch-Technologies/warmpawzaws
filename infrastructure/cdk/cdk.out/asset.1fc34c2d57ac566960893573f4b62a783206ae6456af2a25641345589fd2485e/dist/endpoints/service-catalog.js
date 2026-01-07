"use strict";
/**
 * ============================================================================
 * SERVICE CATALOG ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles platform service catalog:
 * - Get services by role
 * - Get service categories
 * - Get service details
 *
 * Migrated from: supabase/functions/make-server-3dd53475/vendor-catalog-api-v2.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerServiceCatalogEndpoints = registerServiceCatalogEndpoints;
const rds_connection_1 = require("../database/rds-connection");
/**
 * Map role IDs to service catalog roles
 */
const roleMappings = {
    'pet_groomer': ['groomer', 'pet_groomer'],
    'veterinarian': ['vet', 'veterinarian', 'role_veterinarian'],
    'vet_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'role_vet_clinic'],
    'veterinary_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'role_vet_clinic'],
    'ambulance': ['ambulance', 'ambulance_service', 'role_ambulance'],
    'diagnostics_center': ['diagnostics_center', 'diagnostic_lab', 'role_diagnostics_center'],
    'pharmacy': ['pharmacy', 'pet_pharmacy', 'role_pharmacy'],
    'pet_trainer': ['trainer', 'pet_trainer'],
    'pet_walker': ['walker', 'pet_walker', 'dog_walker'],
    'pet_sitter': ['sitter', 'pet_sitter'],
    'pet_boarder': ['boarding', 'pet_boarder', 'pet_hotel'],
    'pet_cafe': ['cafe', 'pet_cafe'],
    'pet_transport': ['transport', 'pet_transport'],
    'pet_photographer': ['photographer', 'pet_photographer'],
};
function registerServiceCatalogEndpoints(app) {
    /**
     * GET /service-catalog/role/:roleId
     * Get services for a specific role
     */
    app.get("/service-catalog/role/:roleId", async (c) => {
        try {
            const { roleId } = c.req.param();
            const serviceStyle = c.req.query('serviceStyle');
            const acceptableRoles = roleMappings[roleId] || [roleId];
            let catalogQuery = `
        SELECT * FROM service_catalog
        WHERE status = 'active'
        AND publish_status = 'published'
        AND (applicable_roles && $1::text[])
      `;
            const params = [acceptableRoles];
            let paramIndex = 2;
            if (serviceStyle) {
                catalogQuery += ` AND (service_style = $${paramIndex} OR service_style = 'all')`;
                params.push(serviceStyle);
                paramIndex++;
            }
            catalogQuery += ` ORDER BY display_order ASC`;
            const services = await (0, rds_connection_1.query)(catalogQuery, params);
            const filteredServices = services.rows.map((service) => ({
                id: service.service_id || service.id,
                serviceId: service.service_id || service.id,
                serviceName: service.service_name,
                displayName: service.display_name || service.service_name,
                name: service.service_name,
                description: service.description,
                categoryId: service.category_id,
                categoryName: service.category_name,
                subCategoryId: service.sub_category_id,
                subCategoryName: service.sub_category_name,
                applicableRoles: service.applicable_roles || [],
                serviceStyle: service.service_style || 'at_center',
                basePrice: parseFloat(service.base_price || '0'),
                price: parseFloat(service.base_price || '0'),
                duration: service.duration_minutes || 30,
                durationMinutes: service.duration_minutes || 30,
                status: service.status,
                publishStatus: service.publish_status,
                metadata: service.metadata || {},
            }));
            return c.json({
                success: true,
                roleId,
                serviceStyle: serviceStyle || 'all',
                services: filteredServices,
                total: filteredServices.length,
            });
        }
        catch (error) {
            console.error('Error fetching service catalog:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /service-catalog/:serviceId
     * Get service details
     */
    app.get("/service-catalog/:serviceId", async (c) => {
        try {
            const { serviceId } = c.req.param();
            const services = await (0, rds_connection_1.query)(`SELECT * FROM service_catalog
         WHERE (service_id = $1 OR id = $1)
         AND status = 'active'`, [serviceId]);
            if (services.rows.length === 0) {
                return c.json({ error: 'Service not found' }, 404);
            }
            const service = services.rows[0];
            return c.json({
                success: true,
                service: {
                    id: service.service_id || service.id,
                    serviceId: service.service_id || service.id,
                    serviceName: service.service_name,
                    displayName: service.display_name || service.service_name,
                    description: service.description,
                    categoryId: service.category_id,
                    categoryName: service.category_name,
                    subCategoryId: service.sub_category_id,
                    subCategoryName: service.sub_category_name,
                    applicableRoles: service.applicable_roles || [],
                    serviceStyle: service.service_style,
                    basePrice: parseFloat(service.base_price || '0'),
                    duration: service.duration_minutes || 30,
                    status: service.status,
                    publishStatus: service.publish_status,
                    metadata: service.metadata || {},
                },
            });
        }
        catch (error) {
            console.error('Error fetching service:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /service-catalog/categories
     * Get all service categories
     */
    app.get("/service-catalog/categories", async (c) => {
        try {
            const categories = await (0, rds_connection_1.query)(`SELECT * FROM service_categories
         WHERE is_active = true
         ORDER BY display_order ASC, name ASC`);
            return c.json({
                success: true,
                categories: categories.rows,
                total: categories.rows.length,
            });
        }
        catch (error) {
            console.error('Error fetching categories:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=service-catalog.js.map