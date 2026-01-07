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

import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

// Cache for Cognito public keys
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

interface CognitoTokenPayload extends JWTPayload {
  'cognito:username'?: string;
  sub: string;
  phone_number?: string;
  email?: string;
  'custom:user_type'?: string;
  exp?: number;  // Token expiration time
  iat?: number;  // Token issued at time
}

/**
 * Get JWKS URI for Cognito user pool
 */
function getJwksUri(userPoolId: string, region: string = 'ap-south-1'): string {
  return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
}

/**
 * Get or create JWKS client for a user pool
 */
function getJwksClient(userPoolId: string, region: string = 'ap-south-1') {
  const cacheKey = `${region}:${userPoolId}`;
  
  if (!jwksCache.has(cacheKey)) {
    const jwksUri = getJwksUri(userPoolId, region);
    jwksCache.set(cacheKey, createRemoteJWKSet(new URL(jwksUri)));
  }
  
  return jwksCache.get(cacheKey)!;
}

/**
 * Verify Cognito JWT token with signature validation
 */
export async function verifyCognitoToken(
  token: string,
  userPoolId?: string,
  clientId?: string,
  region: string = 'ap-south-1'
): Promise<CognitoTokenPayload | null> {
  try {
    // Use environment variables if not provided
    userPoolId = userPoolId || process.env.COGNITO_USER_POOL_ID;
    clientId = clientId || process.env.COGNITO_CLIENT_ID;

    if (!userPoolId) {
      console.error('[JWT] COGNITO_USER_POOL_ID not configured');
      return null;
    }

    // Get JWKS client
    const JWKS = getJwksClient(userPoolId, region);

    // Verify token signature and claims
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      audience: clientId, // Optional: verify audience if client ID provided
    });

    return payload as CognitoTokenPayload;
  } catch (error: any) {
    console.error('[JWT] Token verification failed:', error.message);
    return null;
  }
}

/**
 * Verify access token
 */
export async function verifyAccessToken(accessToken: string): Promise<CognitoTokenPayload | null> {
  return verifyCognitoToken(accessToken);
}

/**
 * Verify ID token
 */
export async function verifyIdToken(idToken: string): Promise<CognitoTokenPayload | null> {
  return verifyCognitoToken(idToken);
}

/**
 * Extract user info from token without verification (for non-critical operations)
 */
export function decodeTokenUnsafe(token: string): CognitoTokenPayload | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    return payload as CognitoTokenPayload;
  } catch (error) {
    console.error('[JWT] Token decode failed:', error);
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeTokenUnsafe(token);
    if (!payload || !payload.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    return true;
  }
}

/**
 * Extract user ID from token (with verification)
 */
export async function getUserIdFromToken(token: string): Promise<string | null> {
  const payload = await verifyCognitoToken(token);
  return payload?.sub || null;
}

/**
 * Extract user type from token (with verification)
 */
export async function getUserTypeFromToken(token: string): Promise<string | null> {
  const payload = await verifyCognitoToken(token);
  return payload?.['custom:user_type'] || null;
}

/**
 * Middleware helper to extract and verify auth token from headers
 */
export async function extractAndVerifyAuthToken(
  headers: Record<string, string | undefined>
): Promise<{ valid: boolean; payload?: CognitoTokenPayload; error?: string }> {
  const authHeader = headers['authorization'] || headers['Authorization'];
  
  if (!authHeader) {
    return { valid: false, error: 'No authorization header' };
  }

  // Extract token from "Bearer <token>"
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return { valid: false, error: 'Invalid authorization format' };
  }

  const token = match[1];

  // Check expiry first (fast)
  if (isTokenExpired(token)) {
    return { valid: false, error: 'Token expired' };
  }

  // Verify signature (slower)
  const payload = await verifyCognitoToken(token);
  if (!payload) {
    return { valid: false, error: 'Invalid token signature' };
  }

  return { valid: true, payload };
}

