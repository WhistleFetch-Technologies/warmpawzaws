/**
 * ============================================================================
 * INPUT VALIDATION MIDDLEWARE
 * ============================================================================
 * 
 * Provides middleware functions for validating request inputs:
 * - validateBody: Validates request body against a Zod schema
 * - validateQuery: Validates query parameters
 * - validateParams: Validates path parameters
 * - Common validators for UUIDs, phone numbers, emails, dates
 * 
 * Date: 2025-01-28
 * Security Enhancement
 * ============================================================================
 */

import { Context, Next } from 'hono';
import { z, ZodSchema, ZodError } from 'zod';

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

/**
 * UUID validation - accepts standard UUID format
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Phone number validation - accepts Indian phone numbers
 * Formats: +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX
 */
export const phoneSchema = z.string()
  .regex(/^(\+91|91)?[6-9]\d{9}$/, 'Invalid phone number format');

/**
 * Email validation
 */
export const emailSchema = z.string().email('Invalid email format');

/**
 * Date validation (ISO format)
 */
export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)');

/**
 * Datetime validation (ISO format)
 */
export const datetimeSchema = z.string()
  .datetime('Invalid datetime format');

/**
 * Time validation (HH:MM format)
 */
export const timeSchema = z.string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (expected HH:MM)');

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Safe string - trimmed, no excessive length
 */
export const safeStringSchema = (maxLength: number = 1000) => 
  z.string().max(maxLength).transform(s => s.trim());

/**
 * Amount/price validation (positive decimal)
 */
export const amountSchema = z.coerce.number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount can have at most 2 decimal places');

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Format Zod errors into a user-friendly message
 */
function formatZodError(error: ZodError): string {
  return error.errors.map(e => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  }).join('; ');
}

/**
 * Middleware: Validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      
      // Store validated body for use in handlers
      c.set('validatedBody', validated);
      
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json({
          success: false,
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: formatZodError(error),
          errors: error.errors,
        }, 400);
      }
      
      // JSON parsing error
      if (error instanceof SyntaxError) {
        return c.json({
          success: false,
          error: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        }, 400);
      }
      
      throw error;
    }
  };
}

/**
 * Middleware: Validate query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();
      const validated = schema.parse(query);
      
      // Store validated query for use in handlers
      c.set('validatedQuery', validated);
      
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json({
          success: false,
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: formatZodError(error),
        }, 400);
      }
      
      throw error;
    }
  };
}

/**
 * Middleware: Validate path parameters against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const validated = schema.parse(params);
      
      // Store validated params for use in handlers
      c.set('validatedParams', validated);
      
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json({
          success: false,
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: formatZodError(error),
        }, 400);
      }
      
      throw error;
    }
  };
}

/**
 * Middleware: Validate that a parameter is a valid UUID
 */
export function validateUuidParam(paramName: string) {
  return async (c: Context, next: Next) => {
    const value = c.req.param(paramName);
    
    if (!value) {
      return c.json({
        success: false,
        error: `Missing required parameter: ${paramName}`,
        code: 'MISSING_PARAM',
      }, 400);
    }
    
    const result = uuidSchema.safeParse(value);
    
    if (!result.success) {
      return c.json({
        success: false,
        error: `Invalid ${paramName}: must be a valid UUID`,
        code: 'INVALID_UUID',
      }, 400);
    }
    
    return next();
  };
}

/**
 * Middleware: Sanitize and validate common inputs
 * Removes potentially dangerous characters from string inputs
 */
export function sanitizeInput() {
  return async (c: Context, next: Next) => {
    // Skip for non-JSON content types
    const contentType = c.req.header('content-type');
    if (!contentType?.includes('application/json')) {
      return next();
    }
    
    try {
      const body = await c.req.json();
      
      // Recursive sanitization function
      function sanitize(obj: any): any {
        if (typeof obj === 'string') {
          // Remove null bytes and other potentially dangerous characters
          return obj
            .replace(/\0/g, '')           // Null bytes
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Control characters
        }
        
        if (Array.isArray(obj)) {
          return obj.map(sanitize);
        }
        
        if (obj && typeof obj === 'object') {
          const sanitized: Record<string, any> = {};
          for (const [key, value] of Object.entries(obj)) {
            // Sanitize keys too
            const sanitizedKey = key.replace(/[^\w\s.-]/g, '');
            sanitized[sanitizedKey] = sanitize(value);
          }
          return sanitized;
        }
        
        return obj;
      }
      
      const sanitized = sanitize(body);
      c.set('sanitizedBody', sanitized);
      
      return next();
    } catch (error) {
      // If JSON parsing fails, let the request continue
      // The actual handler will deal with it
      return next();
    }
  };
}

// ============================================================================
// COMMON BOOKING VALIDATION SCHEMAS
// ============================================================================

export const bookingCreateSchema = z.object({
  vendorId: uuidSchema,
  serviceId: uuidSchema.optional(),
  services: z.array(z.object({
    serviceId: uuidSchema,
    quantity: z.number().int().min(1).default(1),
  })).optional(),
  customerId: uuidSchema.optional(),
  customerPhone: phoneSchema.optional(),
  petId: uuidSchema.optional(),
  date: dateSchema,
  time: timeSchema,
  serviceStyle: z.enum(['at_center', 'at_home', 'tele_consultation']).optional(),
  notes: safeStringSchema(2000).optional(),
  addressId: uuidSchema.optional(),
});

export const vendorIdParamSchema = z.object({
  vendorId: uuidSchema,
});

export const bookingIdParamSchema = z.object({
  bookingId: uuidSchema,
});
