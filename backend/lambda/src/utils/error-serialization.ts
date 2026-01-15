/**
 * ============================================================================
 * ERROR SERIALIZATION UTILITY
 * ============================================================================
 * 
 * Safely serialize errors to JSON-compatible strings
 * Prevents "[object Object]" errors in API responses
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

/**
 * Safely extract error message from any error type
 * Handles Error objects, strings, and unknown types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || 'Unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    // Try to extract message from object
    const errorObj = error as any;
    if (errorObj.message && typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (errorObj.error && typeof errorObj.error === 'string') {
      return errorObj.error;
    }
    // Last resort: try JSON.stringify, but limit length
    try {
      const str = JSON.stringify(error);
      return str.length > 500 ? str.substring(0, 500) + '...' : str;
    } catch {
      return 'Unknown error (failed to serialize)';
    }
  }
  return 'Unknown error';
}

/**
 * Valid HTTP status codes for error responses
 */
export type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;

/**
 * Create a safe error response object
 * Always returns a valid JSON-serializable object
 */
export function createSafeErrorResponse(
  error: unknown,
  defaultMessage: string = 'Internal server error',
  statusCode: ErrorStatusCode = 500
): { success: false; error: string; statusCode: ErrorStatusCode } {
  const message = getErrorMessage(error);
  return {
    success: false,
    error: message || defaultMessage,
    statusCode,
  };
}

/**
 * Safely serialize error for logging
 */
export function serializeErrorForLogging(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
