"use strict";
/**
 * ============================================================================
 * VENDOR SETUP ENDPOINTS - PHASES 12-13
 * ============================================================================
 *
 * Endpoints for:
 * - Phase 12: Post-Approval Setup
 * - Phase 13: Dashboard & Landing
 *
 * Date: 2025-01-28
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorSetupEndpoints = registerVendorSetupEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// PHASE 12: POST-APPROVAL SETUP
// ============================================================================
class GetVendorSetupStatusHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        return this.success({
            setupStatus: {
                servicesConfigured: vendor.services_configured || false,
                availabilityConfigured: vendor.availability_configured || false,
                setupCompleted: vendor.setup_completed || false,
                setupStage: vendor.setup_stage || 'services_pending',
            },
        });
    }
}
class CompleteVendorSetupHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        await (0, rds_connection_1.update)('vendors', { id: vendorId }, {
            setup_completed: true,
            setup_stage: 'completed',
            updated_at: new Date().toISOString(),
        });
        return this.success({ success: true });
    }
}
class GetVendorAvailabilityHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        const availability = await (0, rds_connection_1.select)('vendor_availability', { vendor_id: vendorId });
        return this.success({ availability: availability[0] || null });
    }
}
class UpdateVendorAvailabilityHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        const body = this.parseBody(context.event);
        if (!vendorId || !body.availability) {
            return this.error('Vendor ID and availability are required', 400);
        }
        const existing = await (0, rds_connection_1.select)('vendor_availability', { vendor_id: vendorId });
        if (existing.length > 0) {
            await (0, rds_connection_1.update)('vendor_availability', { vendor_id: vendorId }, body.availability);
        }
        else {
            await (0, rds_connection_1.insert)('vendor_availability', {
                ...body.availability,
                vendor_id: vendorId,
                created_at: new Date().toISOString(),
            });
        }
        await (0, rds_connection_1.update)('vendors', { id: vendorId }, {
            availability_configured: true,
            updated_at: new Date().toISOString(),
        });
        return this.success({ success: true });
    }
}
class GetAvailableServicesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        const roleId = vendor.role_id;
        const services = await (0, rds_connection_1.select)('services', { role_id: roleId, is_active: true });
        return this.success({ services });
    }
}
class SelectVendorServicesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        const body = this.parseBody(context.event);
        if (!vendorId || !body.serviceIds) {
            return this.error('Vendor ID and service IDs are required', 400);
        }
        // Store selected services
        for (const serviceId of body.serviceIds) {
            await (0, rds_connection_1.insert)('vendor_services', {
                vendor_id: vendorId,
                service_id: serviceId,
                is_active: true,
                created_at: new Date().toISOString(),
            });
        }
        await (0, rds_connection_1.update)('vendors', { id: vendorId }, {
            services_configured: true,
            setup_stage: 'availability_pending',
            updated_at: new Date().toISOString(),
        });
        return this.success({ success: true });
    }
}
class GetServiceConfigsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const serviceIds = context.event.queryStringParameters?.serviceIds;
        if (!serviceIds) {
            return this.error('Service IDs are required', 400);
        }
        const ids = serviceIds.split(',');
        // Use query for IN clause
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const result = await (0, rds_connection_1.query)(`SELECT * FROM service_configs WHERE service_id IN (${placeholders})`, ids);
        return this.success({ services: result.rows });
    }
}
class ConfigureVendorServicesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        if (!body.vendorId || !body.configurations) {
            return this.error('Vendor ID and configurations are required', 400);
        }
        for (const config of body.configurations) {
            await (0, rds_connection_1.update)('service_configs', { service_id: config.serviceId }, config);
        }
        return this.success({ success: true });
    }
}
// ============================================================================
// PHASE 13: DASHBOARD & LANDING
// ============================================================================
class GetVendorStatusHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        return this.success({ vendor });
    }
}
class GetSoloProviderInfoHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        const centers = await (0, rds_connection_1.select)('centers', { vendor_id: vendorId });
        const staff = await (0, rds_connection_1.select)('staff', { vendor_id: vendorId });
        return this.success({
            vendor,
            center: centers[0] || null,
            staff: staff[0] || null,
        });
    }
}
class GetCenterStatsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        const today = new Date().toISOString().split('T')[0];
        const bookings = await (0, rds_connection_1.select)('bookings', {
            vendor_id: vendorId,
            booking_date: today,
        });
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
        return this.success({
            stats: {
                todayBookings: bookings.length,
                todayRevenue: totalRevenue,
            },
        });
    }
}
class GetStaffStatsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        const staffId = context.event.pathParameters?.staffId;
        if (!vendorId || !staffId) {
            return this.error('Vendor ID and Staff ID are required', 400);
        }
        const bookings = await (0, rds_connection_1.select)('bookings', {
            vendor_id: vendorId,
            staff_id: staffId,
        });
        const completed = bookings.filter(b => b.status === 'completed').length;
        return this.success({
            stats: {
                appointments: bookings.length,
                completed,
            },
        });
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerVendorSetupEndpoints(app) {
    // Phase 12: Post-Approval Setup
    app.get('/vendor/:vendorId/setup-status', async (c) => {
        const handler = new GetVendorSetupStatusHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/vendor/:vendorId/setup/complete', async (c) => {
        const handler = new CompleteVendorSetupHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/:vendorId/availability', async (c) => {
        const handler = new GetVendorAvailabilityHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/vendor/:vendorId/availability', async (c) => {
        const handler = new UpdateVendorAvailabilityHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/:vendorId/services/available', async (c) => {
        const handler = new GetAvailableServicesHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/vendor/:vendorId/services/select', async (c) => {
        const handler = new SelectVendorServicesHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/services/config', async (c) => {
        const handler = new GetServiceConfigsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/vendor/services/configure', async (c) => {
        const handler = new ConfigureVendorServicesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Phase 13: Dashboard & Landing
    app.get('/vendor/status/:vendorId', async (c) => {
        const handler = new GetVendorStatusHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/:vendorId/solo-info', async (c) => {
        const handler = new GetSoloProviderInfoHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/:vendorId/center/stats', async (c) => {
        const handler = new GetCenterStatsHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/:vendorId/staff/:staffId/stats', async (c) => {
        const handler = new GetStaffStatsHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = {
            vendorId: c.req.param('vendorId'),
            staffId: c.req.param('staffId'),
        };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
// Helper functions
function createApiGatewayEvent(req) {
    return {
        httpMethod: req.method,
        path: req.url,
        headers: req.headers,
        body: JSON.stringify(req.body || {}),
        pathParameters: req.param() || {},
        queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
        requestContext: {
            requestId: crypto.randomUUID(),
        },
    };
}
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'vendor-setup-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=vendor-setup.js.map