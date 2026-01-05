import { Context } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
/**
 * Standardized Success Response
 * @param c Hono Context
 * @param data Data object to return (spread into response)
 * @param message Optional success message
 * @param status HTTP status code (default 200)
 */
export declare const sendSuccess: (c: Context, data?: Record<string, any>, message?: string, status?: ContentfulStatusCode) => Response & import("hono").TypedResponse<{
    success: true;
    message: string;
}, ContentfulStatusCode, "json">;
/**
 * Standardized Error Response
 * @param c Hono Context
 * @param error Error message or object
 * @param status HTTP status code (default 500)
 * @param details Additional error details
 */
export declare const sendError: (c: Context, error: string | Error, status?: ContentfulStatusCode, details?: any) => Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    details: any;
}, ContentfulStatusCode, "json">;
//# sourceMappingURL=response-utils.d.ts.map