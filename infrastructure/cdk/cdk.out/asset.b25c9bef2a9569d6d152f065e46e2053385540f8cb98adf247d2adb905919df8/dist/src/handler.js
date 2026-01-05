"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
/**
 * ============================================================================
 * ENDPOINT REGISTRATIONS
 * ============================================================================
 *
 * Agent 2: Lambda Migration Agent
 * Date: 2025-01-27
 *
 * NOTE: Endpoint files currently use Deno imports (npm:hono@4, jsr:)
 * These will be converted to Node.js imports in Week 10-11.
 *
 * For now, endpoint registrations are commented out until Deno conversion.
 * ============================================================================
 */
// TODO (Week 10-11): Convert Deno imports to Node.js
// Core Endpoints (Priority 1-6)
// import { registerAuthEndpoints } from '../../supabase/functions/make-server-3dd53475/auth-endpoints';
// import { bookingEndpointsSQL } from '../../supabase/functions/make-server-3dd53475/booking-endpoints-sql';
// import { paymentEndpointsSQL } from '../../supabase/functions/make-server-3dd53475/payment-endpoints-sql';
// import { registerCustomerRoutes } from '../../supabase/functions/make-server-3dd53475/customer-routes';
// import { registerVendorRoutes } from '../../supabase/functions/make-server-3dd53475/vendor-routes';
// import { staffCrudEndpoints } from '../../supabase/functions/make-server-3dd53475/staff-crud-endpoints';
// Secondary Endpoints (Priority 11-50)
// import { regionEndpoints } from '../../supabase/functions/make-server-3dd53475/region-endpoints';
// import { onboardingFormAPI } from '../../supabase/functions/make-server-3dd53475/onboarding-form-api';
// import { roleConfigEndpoints } from '../../supabase/functions/make-server-3dd53475/role-config-endpoints';
// import { catalogEndpointsSQL } from '../../supabase/functions/make-server-3dd53475/catalog-endpoints-sql';
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
         * Register all endpoints here. Currently commented out until Deno conversion.
         * After Week 10-11 conversion, uncomment and register all endpoints.
         */
        // Core Endpoints (Priority 1-6) - CRITICAL BUSINESS LOGIC
        // TODO: Uncomment after Deno → Node.js conversion
        // try {
        //   console.log('✅ Registering auth endpoints...');
        //   registerAuthEndpoints(app);
        // } catch (error) {
        //   console.error('❌ Error registering auth endpoints:', error);
        // }
        // try {
        //   console.log('✅ Registering booking endpoints...');
        //   bookingEndpointsSQL(app);
        // } catch (error) {
        //   console.error('❌ Error registering booking endpoints:', error);
        // }
        // try {
        //   console.log('✅ Registering payment endpoints...');
        //   paymentEndpointsSQL(app);
        // } catch (error) {
        //   console.error('❌ Error registering payment endpoints:', error);
        // }
        // Secondary Endpoints (Priority 11-50)
        // try {
        //   console.log('✅ Registering region endpoints...');
        //   regionEndpoints(app);
        // } catch (error) {
        //   console.error('❌ Error registering region endpoints:', error);
        // }
        // try {
        //   console.log('✅ Registering onboarding form API...');
        //   onboardingFormAPI(app);
        // } catch (error) {
        //   console.error('❌ Error registering onboarding form API:', error);
        // }
        // Health check endpoint (always available)
        app.get('/health', (c) => {
            return c.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'warmpawz-api',
                version: '1.0.0',
            });
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