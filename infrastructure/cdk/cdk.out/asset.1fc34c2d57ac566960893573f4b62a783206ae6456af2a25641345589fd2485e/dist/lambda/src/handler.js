"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const db_1 = require("./lib/db");
/**
 * ============================================================================
 * ENDPOINT REGISTRATIONS
 * ============================================================================
 *
 * Agent 3: Cognito Integration
 * Date: 2025-01-28
 *
 * All endpoints are registered via the endpoint registry system.
 * Endpoints are converted to Node.js and located in src/endpoints/
 *
 * ❌ NO DENO CODE - All endpoints use Node.js imports only
 * ============================================================================
 */
// Database connection is initialized lazily via getDbClient() in lib/db.ts
// No explicit initialization needed - connection pooling handles it
/**
 * Main Lambda Handler
 * Converts API Gateway events to Hono requests
 */
const handler = async (event, context) => {
    try {
        // Create Hono app
        const app = new hono_1.Hono();
        // Configure CORS
        app.use('*', (0, cors_1.cors)({
            origin: process.env.ALLOW_ORIGIN || '*',
            allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
            maxAge: 86400,
        }));
        /**
         * ============================================================================
         * ENDPOINT REGISTRATIONS
         * ============================================================================
         *
         * Register all endpoints using the endpoint registry system.
         *
         * All endpoints are Node.js-converted and located in src/endpoints/
         * ❌ NO DENO CODE - Only Node.js endpoints are registered
         * ❌ NO KV ENDPOINTS - Only SQL-migrated endpoints are registered
         */
        // Use dynamic endpoint registry for auto-discovery
        try {
            const { registerAllEndpoints } = await Promise.resolve().then(() => __importStar(require('./endpoint-registry')));
            await registerAllEndpoints(app);
            console.log('✅ All endpoints registered via registry');
        }
        catch (error) {
            console.error('❌ Failed to register endpoints via registry:', error);
            // Fallback: Register core endpoints manually
            try {
                console.log('✅ Fallback: Registering auth endpoints...');
                const { registerAuthEndpoints } = await Promise.resolve().then(() => __importStar(require('./endpoints/auth-endpoints')));
                registerAuthEndpoints(app);
                console.log('✅ Auth endpoints registered');
            }
            catch (authError) {
                console.error('❌ Failed to register auth endpoints:', authError);
            }
            try {
                console.log('✅ Fallback: Registering booking endpoints...');
                const { bookingEndpointsSQL } = await Promise.resolve().then(() => __importStar(require('./endpoints/booking-endpoints')));
                bookingEndpointsSQL(app);
                console.log('✅ Booking endpoints registered');
            }
            catch (bookingError) {
                console.error('❌ Failed to register booking endpoints:', bookingError);
            }
            try {
                console.log('✅ Fallback: Registering customer routes...');
                const { registerCustomerRoutes } = await Promise.resolve().then(() => __importStar(require('./endpoints/customer-routes')));
                registerCustomerRoutes(app);
                console.log('✅ Customer routes registered');
            }
            catch (customerError) {
                console.error('❌ Failed to register customer routes:', customerError);
            }
        }
        // Health check endpoint (always available)
        app.get('/health', async (c) => {
            try {
                const dbHealthy = await (0, db_1.checkDbHealth)();
                return c.json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    service: 'warmpawz-api',
                    version: '1.0.0',
                    database: dbHealthy ? 'connected' : 'disconnected',
                });
            }
            catch (error) {
                return c.json({
                    status: 'degraded',
                    timestamp: new Date().toISOString(),
                    service: 'warmpawz-api',
                    version: '1.0.0',
                    database: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                }, 503);
            }
        });
        // Convert API Gateway event to Request
        const url = `https://${event.requestContext.domainName}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ''}`;
        const request = new Request(url, {
            method: event.requestContext.http.method,
            headers: new Headers(event.headers),
            body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body) : undefined,
        });
        // Handle request with Hono
        const response = await app.fetch(request);
        // Convert Response to API Gateway format
        const responseBody = await response.text();
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });
        return {
            statusCode: response.status,
            headers: responseHeaders,
            body: responseBody,
            isBase64Encoded: false,
        };
    }
    catch (error) {
        console.error('Lambda handler error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=handler.js.map