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
import { z } from 'zod';
export declare const ApiSuccessSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodUnknown;
    error: z.ZodOptional<z.ZodNull>;
    meta: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        requestId: z.ZodOptional<z.ZodString>;
        version: z.ZodLiteral<"v1">;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    }, {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data?: unknown;
    error?: null | undefined;
    meta?: {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    } | undefined;
}, {
    success: true;
    data?: unknown;
    error?: null | undefined;
    meta?: {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    } | undefined;
}>;
export type ApiSuccess<T = any> = z.infer<typeof ApiSuccessSchema> & {
    data: T;
};
export declare const ApiErrorSchema: z.ZodObject<{
    success: z.ZodLiteral<false>;
    data: z.ZodOptional<z.ZodNull>;
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    }>;
    meta: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        requestId: z.ZodOptional<z.ZodString>;
        version: z.ZodLiteral<"v1">;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    }, {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    };
    data?: null | undefined;
    meta?: {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    } | undefined;
}, {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    };
    data?: null | undefined;
    meta?: {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    } | undefined;
}>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export declare const ApiResponseSchema: z.ZodUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodUnknown;
    error: z.ZodOptional<z.ZodNull>;
    meta: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        requestId: z.ZodOptional<z.ZodString>;
        version: z.ZodLiteral<"v1">;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    }, {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data?: unknown;
    error?: null | undefined;
    meta?: {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    } | undefined;
}, {
    success: true;
    data?: unknown;
    error?: null | undefined;
    meta?: {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    } | undefined;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    data: z.ZodOptional<z.ZodNull>;
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    }>;
    meta: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        requestId: z.ZodOptional<z.ZodString>;
        version: z.ZodLiteral<"v1">;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    }, {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    };
    data?: null | undefined;
    meta?: {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    } | undefined;
}, {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    };
    data?: null | undefined;
    meta?: {
        timestamp: string;
        version: "v1";
        requestId?: string | undefined;
    } | undefined;
}>]>;
export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;
export declare function createSuccessResponse<T>(data: T, requestId?: string): ApiSuccess<T>;
export declare function createErrorResponse(code: string, message: string, details?: Record<string, unknown>, requestId?: string): ApiError;
export declare const ERROR_CODES: {
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly ALREADY_EXISTS: "ALREADY_EXISTS";
    readonly CONFLICT: "CONFLICT";
    readonly BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION";
    readonly INVALID_STATE: "INVALID_STATE";
    readonly OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED";
    readonly EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR";
    readonly PAYMENT_ERROR: "PAYMENT_ERROR";
    readonly NOTIFICATION_ERROR: "NOTIFICATION_ERROR";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly TIMEOUT: "TIMEOUT";
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
};
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
//# sourceMappingURL=response.d.ts.map