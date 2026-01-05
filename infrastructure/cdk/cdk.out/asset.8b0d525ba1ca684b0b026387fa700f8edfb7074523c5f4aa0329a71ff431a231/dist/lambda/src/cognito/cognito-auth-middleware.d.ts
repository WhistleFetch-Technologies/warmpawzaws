/**
 * COGNITO AUTHENTICATION MIDDLEWARE (Lambda Version)
 *
 * Validates Cognito JWT tokens for protected routes in AWS Lambda
 * Replaces Supabase Auth validation
 *
 * Database: Aurora RDS PostgreSQL (via RDS Proxy)
 * Compute: AWS Lambda (Node.js 20.x)
 */
import { Context } from 'hono';
/**
 * Validate Cognito JWT token from Authorization header
 * Returns token data if valid, null otherwise
 */
export declare function validateCognitoAuth(c: Context): Promise<{
    valid: boolean;
    userId?: string;
    username?: string;
    role?: 'customer' | 'vendor' | 'admin';
    attributes?: Record<string, string>;
}>;
/**
 * Middleware to require authentication for protected routes
 */
export declare function requireCognitoAuth(c: Context, next: () => Promise<void>): Promise<Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    details: any;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
/**
 * Middleware to require admin authentication
 */
export declare function requireAdminCognitoAuth(c: Context, next: () => Promise<void>): Promise<Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    details: any;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
/**
 * Optional auth - sets auth status but doesn't fail if missing
 */
export declare function optionalCognitoAuth(c: Context, next: () => Promise<void>): Promise<void>;
/**
 * Get authenticated user from context
 */
export declare function getAuthenticatedUser(c: Context): {
    userId?: string;
    username?: string;
    role?: 'customer' | 'vendor' | 'admin';
    attributes?: Record<string, string>;
} | null;
//# sourceMappingURL=cognito-auth-middleware.d.ts.map