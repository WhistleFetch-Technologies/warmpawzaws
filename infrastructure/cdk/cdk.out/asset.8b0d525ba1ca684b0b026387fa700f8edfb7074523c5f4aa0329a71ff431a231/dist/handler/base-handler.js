"use strict";
/**
 * ============================================================================
 * BASE LAMBDA HANDLER
 * ============================================================================
 *
 * Base class for all Lambda handlers with common functionality:
 * - Error handling
 * - Logging
 * - Response formatting
 * - Authentication middleware
 * - Validation middleware
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseHandler = void 0;
exports.createHandler = createHandler;
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// BASE HANDLER CLASS
// ============================================================================
class BaseHandler {
    /**
     * Wrapper that provides common functionality
     */
    async execute(event, lambdaContext) {
        const startTime = Date.now();
        try {
            // Parse request
            const body = this.parseBody(event);
            const headers = this.getHeaders(event);
            // Create handler context
            const handlerContext = {
                event,
                context: lambdaContext,
                userId: this.extractUserId(event),
                userRole: this.extractUserRole(event),
            };
            // Execute handler
            const response = await this.handle(handlerContext);
            // Log request
            const duration = Date.now() - startTime;
            this.logRequest(event, response, duration);
            // Return response
            return {
                statusCode: response.statusCode,
                body: response.body,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    ...response.headers,
                },
            };
        }
        catch (error) {
            return this.handleError(error, event, lambdaContext);
        }
    }
    /**
     * Parse request body
     */
    parseBody(event) {
        if (!event.body)
            return {};
        try {
            const rawBody = 'isBase64Encoded' in event && event.isBase64Encoded && event.body
                ? Buffer.from(event.body, 'base64').toString()
                : event.body;
            return rawBody ? JSON.parse(rawBody) : {};
        }
        catch (error) {
            throw new Error('Invalid JSON in request body');
        }
    }
    /**
     * Get request headers
     */
    getHeaders(event) {
        return event.headers || {};
    }
    /**
     * Extract user ID from request (from Cognito JWT or Authorization header)
     */
    extractUserId(event) {
        // Check Cognito authorizer (v1 or v2)
        const authorizerClaims = event?.requestContext?.authorizer?.claims;
        if (authorizerClaims?.sub) {
            return authorizerClaims.sub;
        }
        // Check Authorization header
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (authHeader) {
            // Parse JWT token (simplified - in production use proper JWT library)
            try {
                const token = authHeader.replace('Bearer ', '');
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                return payload.sub;
            }
            catch {
                // Invalid token format
            }
        }
        return undefined;
    }
    /**
     * Extract user role from request
     */
    extractUserRole(event) {
        const authorizerClaims = event?.requestContext?.authorizer?.claims;
        if (authorizerClaims?.['cognito:groups']) {
            const groups = authorizerClaims['cognito:groups'];
            return Array.isArray(groups) ? groups[0] : groups;
        }
        return undefined;
    }
    /**
     * Log request for monitoring
     */
    logRequest(event, response, duration) {
        const method = event.httpMethod ||
            event.requestContext?.http?.method ||
            'UNKNOWN';
        const path = event.path ||
            event.rawPath ||
            '/';
        console.log(JSON.stringify({
            method,
            path,
            statusCode: response.statusCode,
            duration,
            requestId: event.requestContext?.requestId,
        }));
    }
    /**
     * Handle errors consistently
     */
    handleError(error, event, context) {
        const method = event.httpMethod ||
            event.requestContext?.http?.method ||
            'UNKNOWN';
        const path = event.path ||
            event.rawPath ||
            '/';
        console.error('Handler error:', {
            error: error.message,
            stack: error.stack,
            path,
            method,
            requestId: context.awsRequestId || 'unknown',
        });
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Internal server error';
        return {
            statusCode,
            body: JSON.stringify({
                error: message,
                requestId: context.awsRequestId || 'unknown',
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        };
    }
    /**
     * Create success response
     */
    success(data, statusCode = 200) {
        return {
            statusCode,
            body: JSON.stringify(data),
        };
    }
    /**
     * Create error response
     */
    error(message, statusCode = 400) {
        return {
            statusCode,
            body: JSON.stringify({ error: message }),
        };
    }
    /**
     * Validate required fields
     */
    validateRequired(data, fields) {
        const missing = fields.filter(field => !data[field]);
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
    }
    /**
     * Check database health
     */
    async checkDatabase() {
        try {
            await (0, rds_connection_1.query)('SELECT 1');
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.BaseHandler = BaseHandler;
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Create a handler function from a BaseHandler instance
 */
function createHandler(handler) {
    return async (event, context) => {
        return handler.execute(event, context);
    };
}
//# sourceMappingURL=base-handler.js.map