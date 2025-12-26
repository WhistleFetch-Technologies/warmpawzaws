
import { Context } from "npm:hono";
import { ContentfulStatusCode } from "npm:hono/utils/http-status";

/**
 * Standardized Success Response
 * @param c Hono Context
 * @param data Data object to return (spread into response)
 * @param message Optional success message
 * @param status HTTP status code (default 200)
 */
export const sendSuccess = (c: Context, data: Record<string, any> = {}, message?: string, status: ContentfulStatusCode = 200) => {
  return c.json({
    success: true,
    message,
    ...data
  }, status);
};

/**
 * Standardized Error Response
 * @param c Hono Context
 * @param error Error message or object
 * @param status HTTP status code (default 500)
 * @param details Additional error details
 */
export const sendError = (c: Context, error: string | Error, status: ContentfulStatusCode = 500, details?: any) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return c.json({
    success: false,
    error: errorMessage,
    details
  }, status);
};
