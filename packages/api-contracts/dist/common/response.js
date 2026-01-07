"use strict";
/**
 * ============================================================================
 * COMMON API RESPONSE CONTRACTS
 * ============================================================================
 *
 * Standardized response format for all API endpoints
 * AWS Lambda compatible
 *
 * Date: 2026-01-28
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = exports.ApiResponseSchema = exports.ApiErrorSchema = exports.ApiSuccessSchema = void 0;
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
const zod_1 = require("zod");
// ============================================================================
// SUCCESS RESPONSE
// ============================================================================
exports.ApiSuccessSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.unknown(),
    error: zod_1.z.null().optional(),
    meta: zod_1.z.object({
        timestamp: zod_1.z.string().datetime(),
        requestId: zod_1.z.string().optional(),
        version: zod_1.z.literal('v1'),
    }).optional(),
});
// ============================================================================
// ERROR RESPONSE
// ============================================================================
exports.ApiErrorSchema = zod_1.z.object({
    success: zod_1.z.literal(false),
    data: zod_1.z.null().optional(),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
    meta: zod_1.z.object({
        timestamp: zod_1.z.string().datetime(),
        requestId: zod_1.z.string().optional(),
        version: zod_1.z.literal('v1'),
    }).optional(),
});
// ============================================================================
// UNIFIED RESPONSE
// ============================================================================
exports.ApiResponseSchema = zod_1.z.union([exports.ApiSuccessSchema, exports.ApiErrorSchema]);
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function createSuccessResponse(data, requestId) {
    return {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            requestId,
            version: 'v1',
        },
    };
}
function createErrorResponse(code, message, details, requestId) {
    return {
        success: false,
        error: {
            code,
            message,
            details,
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId,
            version: 'v1',
        },
    };
}
// ============================================================================
// ERROR CODES
// ============================================================================
exports.ERROR_CODES = {
    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    // Authentication
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    // Resources
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',
    // Business Logic
    BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
    INVALID_STATE: 'INVALID_STATE',
    OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
    // External Services
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    PAYMENT_ERROR: 'PAYMENT_ERROR',
    NOTIFICATION_ERROR: 'NOTIFICATION_ERROR',
    // System
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    TIMEOUT: 'TIMEOUT',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
};
