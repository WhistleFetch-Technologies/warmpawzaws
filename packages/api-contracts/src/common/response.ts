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

// ============================================================================
// SUCCESS RESPONSE
// ============================================================================

export const ApiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  error: z.null().optional(),
  meta: z.object({
    timestamp: z.string().datetime(),
    requestId: z.string().optional(),
    version: z.literal('v1'),
  }).optional(),
});

export type ApiSuccess<T = any> = z.infer<typeof ApiSuccessSchema> & {
  data: T;
};

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  data: z.null().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  meta: z.object({
    timestamp: z.string().datetime(),
    requestId: z.string().optional(),
    version: z.literal('v1'),
  }).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// UNIFIED RESPONSE
// ============================================================================

export const ApiResponseSchema = z.union([ApiSuccessSchema, ApiErrorSchema]);

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createSuccessResponse<T>(
  data: T,
  requestId?: string
): ApiSuccess<T> {
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

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): ApiError {
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

export const ERROR_CODES = {
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
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

