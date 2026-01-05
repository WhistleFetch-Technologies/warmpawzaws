"use strict";
/**
 * ============================================================================
 * ROLE CONFIG ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-vendor/vendor-role-config.tsx
 *
 * Endpoints:
 * - GET /config/roles - Get all roles
 * - GET /config/roles/:id - Get role by ID
 * - POST /config/roles - Create role (admin only)
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoleEndpoints = registerRoleEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// ROLE HANDLERS
// ============================================================================
class GetRolesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        // ✅ SQL: Get all active roles
        const roles = await (0, rds_connection_1.select)('roles', { is_active: true }, {
            orderBy: 'display_name',
            orderDirection: 'ASC',
        });
        // Get capabilities for each role
        const rolesWithCapabilities = await Promise.all(roles.map(async (role) => {
            const permissions = await (0, rds_connection_1.select)('role_permissions', { role_id: role.id });
            const capabilities = permissions.map(p => p.permission_name);
            return {
                ...role,
                capabilities,
            };
        }));
        return this.success({ roles: rolesWithCapabilities });
    }
}
class GetRoleByIdHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const roleId = context.event.pathParameters?.roleId;
        if (!roleId) {
            return this.error('Role ID is required', 400);
        }
        const roles = await (0, rds_connection_1.select)('roles', { id: roleId });
        if (roles.length === 0) {
            return this.error('Role not found', 404);
        }
        const role = roles[0];
        const permissions = await (0, rds_connection_1.select)('role_permissions', { role_id: roleId });
        const capabilities = permissions.map(p => p.permission_name);
        return this.success({
            ...role,
            capabilities,
        });
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerRoleEndpoints(app) {
    const getRolesHandler = new GetRolesHandler();
    const getRoleByIdHandler = new GetRoleByIdHandler();
    app.get('/config/roles', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await getRolesHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/config/roles/:roleId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { roleId: c.req.param('roleId') };
        const context = createLambdaContext();
        const result = await getRoleByIdHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
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
        functionName: 'role-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=roles.js.map