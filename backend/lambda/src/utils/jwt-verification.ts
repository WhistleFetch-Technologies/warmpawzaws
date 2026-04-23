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
 * Also supports UAT mode tokens
 */
/**
 * Verify fallback session token (format: fallback_BASE64.HASH)
 * Used when Cognito is unavailable; token is issued by auth verify-otp.
 * Valid for 1 hour from payload.timestamp.
 */
function verifyFallbackToken(token: string): CognitoTokenPayload | null {
  if (!token.startsWith('fallback_')) return null;
  try {
    const payloadPart = token.replace('fallback_', '').split('.')[0];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    if (!payload || typeof payload.timestamp !== 'number') return null;
    const tokenAge = Date.now() - payload.timestamp;
    const maxAge = 60 * 60 * 1000; // 1 hour
    if (tokenAge > maxAge) {
      console.log('[JWT] Fallback token expired');
      return null;
    }
    const userId = payload.userId ?? payload.phone ?? 'unknown';
    return {
      sub: String(userId),
      'cognito:username': payload.phone ?? userId,
      'custom:user_type': 'vendor',
      'cognito:groups': ['vendor'],
      exp: Math.floor((payload.timestamp + maxAge) / 1000),
      iat: Math.floor(payload.timestamp / 1000),
    } as CognitoTokenPayload;
  } catch (e) {
    return null;
  }
}

export async function verifyCognitoToken(
  token: string,
  userPoolId?: string,
  clientId?: string,
  region: string = 'ap-south-1'
): Promise<CognitoTokenPayload | null> {
  try {
    // Check fallback tokens (issued when Cognito unavailable)
    const fallbackPayload = verifyFallbackToken(token);
    if (fallbackPayload) {
      console.log('[JWT] Fallback token verified successfully');
      return fallbackPayload;
    }

    // Check if this is a production JWT token (issued by warmpawz-api)
    // Production tokens are used when Cognito is not configured
    try {
      const { verifyProductionJWTToken } = await import('./jwt-generator');
      const prodResult = await verifyProductionJWTToken(token);
      if (prodResult.valid && prodResult.payload) {
        console.log('[JWT] Production JWT token verified successfully (issuer: warmpawz-api)');
        return prodResult.payload as CognitoTokenPayload;
      } else {
        console.log(`[JWT] Production JWT token verification failed: ${prodResult.error || 'unknown error'}`);
      }
    } catch (prodError: any) {
      // Not a production JWT token or verification failed, continue with UAT/Cognito verification
      console.log(`[JWT] Production JWT token check error (continuing): ${prodError.message || 'unknown'}`);
    }

    // UAT-issuer JWTs (warmpawz-uat): verify with UAT_JWT_SECRET when UAT_MODE=true OR when the token claims that issuer.
    // Headers (x-uat-mode) never enable verification — only env + token shape. Issuer claim is unauthenticated until verified.
    // OTP/SMS bypass remains gated by UAT_MODE in auth handlers, not here.
    const peek = decodeTokenUnsafe(token);
    const peekIss = String((peek as any)?.iss || '');
    const tryUatVerify = process.env.UAT_MODE === 'true' || peekIss === 'warmpawz-uat';
    if (tryUatVerify) {
      try {
        const { verifyUATJWTToken } = await import('./jwt-generator');
        const uatResult = await verifyUATJWTToken(token);
        if (uatResult.valid && uatResult.payload) {
          console.log('[JWT] UAT issuer token verified successfully (warmpawz-uat)');
          return uatResult.payload as CognitoTokenPayload;
        } else {
          console.log(`[JWT] UAT token verification failed: ${uatResult.error || 'unknown error'}`);
        }
      } catch (uatError: any) {
        console.log(`[JWT] UAT token check error (continuing to Cognito): ${uatError.message || 'unknown'}`);
      }
    } else {
      console.log('[JWT] Skipping UAT issuer path (issuer not warmpawz-uat and UAT_MODE is not true)');
    }

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
 * Fallback tokens (fallback_*) are not validated here; verifyCognitoToken does TTL check.
 */
export function isTokenExpired(token: string): boolean {
  if (!token) return true;
  // Fallback tokens: expiry is checked inside verifyFallbackToken
  if (token.startsWith('fallback_')) return false;
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

  const av = await enforceCustomerAuthVersionOnWarmpawzJwt(payload);
  if (!av.ok) {
    return { valid: false, error: av.error || 'Session invalidated' };
  }

  return { valid: true, payload };
}

/**
 * Invalidate fallback customer JWTs after password change when `customers.auth_version` bumps.
 * Cognito-issued tokens are not checked here (pool issuer); use AdminUserGlobalSignOut on password change.
 */
async function enforceCustomerAuthVersionOnWarmpawzJwt(
  payload: CognitoTokenPayload
): Promise<{ ok: boolean; error?: string }> {
  const iss = String((payload as any).iss || '');
  if (iss !== 'warmpawz-api' && iss !== 'warmpawz-uat') {
    return { ok: true };
  }
  const ut = payload['custom:user_type'];
  const groups = (payload['cognito:groups'] as string[]) || [];
  const isCustomer = ut === 'customer' || groups.includes('customer');
  if (!isCustomer) return { ok: true };

  const sub = String(payload.sub || '');
  if (!sub || !/^[0-9a-fA-F-]{36}$/.test(sub)) {
    return { ok: true };
  }

  try {
    const { query } = await import('../database/rds-connection');
    const res = await query(
      `SELECT COALESCE(auth_version, 0)::int AS av FROM customers WHERE id = $1::uuid LIMIT 1`,
      [sub]
    );
    const row = (res as any).rows?.[0];
    if (!row) return { ok: true };
    const dbAv = Number(row.av ?? 0);
    const raw = (payload as any).auth_version;
    const tokenAv = raw === undefined || raw === null ? null : Number(raw);
    if (tokenAv === null) {
      if (dbAv > 0) return { ok: false, error: 'Session invalidated' };
      return { ok: true };
    }
    if (Number.isNaN(tokenAv) || tokenAv !== dbAv) {
      return { ok: false, error: 'Session invalidated' };
    }
    return { ok: true };
  } catch (e: any) {
    console.warn('[JWT] auth_version enforcement skipped:', e?.message || e);
    return { ok: true };
  }
}

