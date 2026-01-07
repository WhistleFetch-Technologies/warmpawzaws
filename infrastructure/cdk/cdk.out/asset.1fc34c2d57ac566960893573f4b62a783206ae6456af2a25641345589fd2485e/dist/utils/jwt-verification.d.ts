/**
 * ============================================================================
 * JWT TOKEN VERIFICATION UTILITIES
 * ============================================================================
 *
 * Implements proper JWT signature verification for Cognito tokens
 *
 * Date: 2026-01-03
 * ============================================================================
 */
import { JWTPayload } from 'jose';
interface CognitoTokenPayload extends JWTPayload {
    'cognito:username'?: string;
    sub: string;
    phone_number?: string;
    email?: string;
    'custom:user_type'?: string;
    exp?: number;
    iat?: number;
}
/**
 * Verify Cognito JWT token with signature validation
 */
export declare function verifyCognitoToken(token: string, userPoolId?: string, clientId?: string, region?: string): Promise<CognitoTokenPayload | null>;
/**
 * Verify access token
 */
export declare function verifyAccessToken(accessToken: string): Promise<CognitoTokenPayload | null>;
/**
 * Verify ID token
 */
export declare function verifyIdToken(idToken: string): Promise<CognitoTokenPayload | null>;
/**
 * Extract user info from token without verification (for non-critical operations)
 */
export declare function decodeTokenUnsafe(token: string): CognitoTokenPayload | null;
/**
 * Check if token is expired
 */
export declare function isTokenExpired(token: string): boolean;
/**
 * Extract user ID from token (with verification)
 */
export declare function getUserIdFromToken(token: string): Promise<string | null>;
/**
 * Extract user type from token (with verification)
 */
export declare function getUserTypeFromToken(token: string): Promise<string | null>;
/**
 * Middleware helper to extract and verify auth token from headers
 */
export declare function extractAndVerifyAuthToken(headers: Record<string, string | undefined>): Promise<{
    valid: boolean;
    payload?: CognitoTokenPayload;
    error?: string;
}>;
export {};
//# sourceMappingURL=jwt-verification.d.ts.map