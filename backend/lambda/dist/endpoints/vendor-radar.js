"use strict";
/**
 * ============================================================================
 * VENDOR RADAR DISTANCE ENDPOINTS
 * ============================================================================
 *
 * Handles vendor radar distance configuration:
 * - Get radar distance
 * - Update radar distance
 *
 * Date: 2026-01-07
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorRadarEndpoints = registerVendorRadarEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// GET /vendor/:id/radar-distance - Get radar distance configuration
// ============================================================================
class GetRadarDistanceHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        try {
            const vendorId = context.event.pathParameters?.id ||
                context.event.pathParameters?.vendorId ||
                context.userId;
            if (!vendorId) {
                return this.error('Vendor ID is required', 400);
            }
            // Get radar distance from vendor settings
            const settings = await (0, rds_connection_1.query)(`
        SELECT 
          radar_distance_km,
          radar_enabled,
          service_style_radar_distances
        FROM vendor_settings
        WHERE vendor_id = $1
      `, [vendorId]);
            if (settings.rows.length === 0) {
                // Return default if no settings exist
                return this.success({
                    vendorId,
                    radarDistanceKm: 10, // Default 10km
                    radarEnabled: true,
                    serviceStyleRadarDistances: {}
                });
            }
            const setting = settings.rows[0];
            return this.success({
                vendorId,
                radarDistanceKm: setting.radar_distance_km || 10,
                radarEnabled: setting.radar_enabled !== false,
                serviceStyleRadarDistances: setting.service_style_radar_distances || {}
            });
        }
        catch (error) {
            console.error('Error fetching radar distance:', error);
            return this.error(error.message || 'Failed to fetch radar distance', 500);
        }
    }
}
// ============================================================================
// PUT /vendor/:id/radar-distance - Update radar distance configuration
// ============================================================================
class UpdateRadarDistanceHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        try {
            const vendorId = context.event.pathParameters?.id ||
                context.event.pathParameters?.vendorId ||
                context.userId;
            const body = this.parseBody(context.event);
            const { radarDistanceKm, radarEnabled, serviceStyleRadarDistances } = body;
            if (!vendorId) {
                return this.error('Vendor ID is required', 400);
            }
            if (radarDistanceKm !== undefined && (radarDistanceKm < 0 || radarDistanceKm > 100)) {
                return this.error('Radar distance must be between 0 and 100 km', 400);
            }
            // Check if settings exist
            const existing = await (0, rds_connection_1.query)(`
        SELECT id FROM vendor_settings
        WHERE vendor_id = $1
      `, [vendorId]);
            if (existing.rows.length === 0) {
                // Create new settings
                const newSettings = await (0, rds_connection_1.query)(`
          INSERT INTO vendor_settings (
            vendor_id,
            radar_distance_km,
            radar_enabled,
            service_style_radar_distances,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING *
        `, [
                    vendorId,
                    radarDistanceKm || 10,
                    radarEnabled !== false,
                    serviceStyleRadarDistances || {}
                ]);
                return this.success({
                    settings: newSettings.rows[0],
                    message: 'Radar distance configured successfully'
                });
            }
            else {
                // Update existing settings
                const updates = [];
                const values = [];
                let paramIndex = 1;
                if (radarDistanceKm !== undefined) {
                    updates.push(`radar_distance_km = $${paramIndex++}`);
                    values.push(radarDistanceKm);
                }
                if (radarEnabled !== undefined) {
                    updates.push(`radar_enabled = $${paramIndex++}`);
                    values.push(radarEnabled);
                }
                if (serviceStyleRadarDistances !== undefined) {
                    updates.push(`service_style_radar_distances = $${paramIndex++}`);
                    values.push(JSON.stringify(serviceStyleRadarDistances));
                }
                if (updates.length === 0) {
                    return this.error('No fields to update', 400);
                }
                updates.push(`updated_at = NOW()`);
                values.push(vendorId);
                const updated = await (0, rds_connection_1.query)(`
          UPDATE vendor_settings
          SET ${updates.join(', ')}
          WHERE vendor_id = $${paramIndex}
          RETURNING *
        `, values);
                return this.success({
                    settings: updated.rows[0],
                    message: 'Radar distance updated successfully'
                });
            }
        }
        catch (error) {
            console.error('Error updating radar distance:', error);
            return this.error(error.message || 'Failed to update radar distance', 500);
        }
    }
}
// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================
function registerVendorRadarEndpoints(app) {
    const getHandler = new GetRadarDistanceHandler();
    const updateHandler = new UpdateRadarDistanceHandler();
    app.get('/vendor/:id/radar-distance', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await getHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/vendor/:id/radar-distance', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await updateHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req) {
    return {
        pathParameters: req.param ? Object.fromEntries(Object.entries(req.param())) : {},
        queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
        body: req.body ? JSON.stringify(req.body) : null,
        headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
        requestContext: {
            authorizer: {
                claims: {
                    sub: req.header?.('x-user-id') || 'test-user'
                }
            }
        }
    };
}
function createLambdaContext() {
    return {};
}
//# sourceMappingURL=vendor-radar.js.map