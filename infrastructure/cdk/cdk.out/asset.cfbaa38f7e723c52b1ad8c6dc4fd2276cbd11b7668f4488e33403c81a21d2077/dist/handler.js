"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
// Import route handlers (to be converted from Deno code)
// import { regionEndpoints } from './region-endpoints';
// import { onboardingFormAPI } from './onboarding-form-api';
// ... other imports
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
        // Register routes (to be added after conversion)
        // app.route('/api/v1/regions', regionEndpoints);
        // app.route('/api/v1/onboarding', onboardingFormAPI);
        // ... other routes
        // Health check endpoint
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