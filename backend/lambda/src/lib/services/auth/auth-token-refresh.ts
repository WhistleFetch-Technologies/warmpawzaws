/**
 * POST /auth/refresh — accepts custom JWT refresh (warmpawz-uat / warmpawz-api)
 * or AWS Cognito opaque refresh tokens via AdminInitiateAuth REFRESH_TOKEN_AUTH.
 */

import { decodeTokenUnsafe } from '../../../utils/jwt-verification';
import { refreshCognitoUserSession } from '../../../utils/cognito-client';

/** Machine-readable hint for logs / optional client telemetry (avoid leaking PII). */
export type RefreshFailureCode =
  | 'missing_refresh_token'
  | 'jwt_decode_failed'
  | 'jwt_not_refresh_claim'
  | 'jwt_refresh_expired'
  | 'jwt_refresh_invalid_signature'
  | 'jwt_issuer_unknown'
  | 'cognito_not_configured'
  | 'cognito_refresh_failed'
  | 'unexpected_error';

function isJwtShape(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/** JWT peek (issuer / token_use). `decodeTokenUnsafe` narrows Cognito-ish claims; `iss` is omitted from that interface. */
type JwtRefreshPeek = { iss?: string; token_use?: string };

/**
 * Produce new access + id tokens plus expiresIn seconds.
 */
export async function executeAuthRefresh(refreshToken: string): Promise<{
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
  failureCode?: RefreshFailureCode;
}> {
  const rt = typeof refreshToken === 'string' ? refreshToken.trim() : '';
  if (!rt) {
    return {
      ok: false,
      status: 401,
      failureCode: 'missing_refresh_token',
      body: { error: 'Invalid or expired refresh token', refreshFailureCode: 'missing_refresh_token' },
    };
  }

  const decodedRaw = isJwtShape(rt) ? decodeTokenUnsafe(rt) : null;
  const decoded = decodedRaw as (JwtRefreshPeek | null);

  const iss = decoded && typeof decoded.iss === 'string' ? decoded.iss : '';
  const tokenUse = decoded?.token_use;

  /** Custom JWT from our issuers — must refresh with signed refresh claims, not Cognito */
  const isWarmpawzJwt =
    !!decoded &&
    !!iss &&
    (iss === 'warmpawz-uat' || iss === 'warmpawz-api');

  if (isWarmpawzJwt && tokenUse !== 'refresh') {
    return {
      ok: false,
      status: 401,
      failureCode: 'jwt_not_refresh_claim',
      body: { error: 'Invalid or expired refresh token', refreshFailureCode: 'jwt_not_refresh_claim' },
    };
  }

  const tryJwtBranch = isWarmpawzJwt && tokenUse === 'refresh';

  if (tryJwtBranch) {
    try {
      let verified: { valid: boolean; payload?: any; error?: string };

      if (iss === 'warmpawz-uat') {
        const { verifyUATJWTToken } = await import('../../../utils/jwt-generator');
        verified = await verifyUATJWTToken(rt);
      } else {
        const { verifyProductionJWTToken } = await import('../../../utils/jwt-generator');
        verified = await verifyProductionJWTToken(rt);
      }

      if (!verified.valid || !verified.payload) {
        const msg = verified.error || '';
        const expired =
          typeof msg === 'string' &&
          (/\bexpired\b/i.test(msg) ||
            /\bexpiration\b/i.test(msg) ||
            /"exp"\b/i.test(msg) ||
            /exp claim/i.test(msg));
        const code: RefreshFailureCode = expired ? 'jwt_refresh_expired' : 'jwt_refresh_invalid_signature';
        console.warn('[auth/refresh] JWT refresh verification failed:', code, msg?.slice?.(0, 120));
        return {
          ok: false,
          status: 401,
          failureCode: code,
          body: {
            error: 'Invalid or expired refresh token',
            refreshFailureCode: code,
          },
        };
      }

      const payload = verified.payload;
      if (payload.token_use !== 'refresh') {
        return {
          ok: false,
          status: 401,
          failureCode: 'jwt_not_refresh_claim',
          body: { error: 'Invalid or expired refresh token', refreshFailureCode: 'jwt_not_refresh_claim' },
        };
      }

      const sub: string = payload.sub;
      const phone: string = payload['cognito:username'] || '';
      const roleRaw = payload['custom:user_type'];
      const role: 'customer' | 'vendor' | 'admin' =
        roleRaw === 'vendor' || roleRaw === 'admin' || roleRaw === 'customer' ? roleRaw : 'customer';
      const authVersion: number | undefined = payload.auth_version;
      const expiresIn = 24 * 60 * 60;

      let accessToken: string;
      let idToken: string;

      if (iss === 'warmpawz-uat') {
        const { generateUATJWTToken } = await import('../../../utils/jwt-generator');
        const result = await generateUATJWTToken({ userId: sub, phone, role, expiresIn, authVersion });
        accessToken = result.accessToken;
        idToken = result.idToken;
      } else {
        const { generateProductionJWTToken } = await import('../../../utils/jwt-generator');
        const result = await generateProductionJWTToken({ userId: sub, phone, role, expiresIn, authVersion });
        accessToken = result.accessToken;
        idToken = result.idToken;
      }

      console.log('[auth/refresh] ok path=jwt iss=%s sub=%s', iss, sub);
      return {
        ok: true,
        status: 200,
        body: { accessToken, idToken, expiresIn },
      };
    } catch (e: any) {
      console.error('[auth/refresh] JWT branch unexpected:', e?.message || e);
      return {
        ok: false,
        status: 401,
        failureCode: 'unexpected_error',
        body: {
          error: 'Invalid or expired refresh token',
          refreshFailureCode: 'unexpected_error',
        },
      };
    }
  }

  /** Not a recognizable custom JWT refresh — try Cognito when pool + client are configured */
  const poolId =
    process.env.COGNITO_USER_POOL_ID ||
    process.env.COGNITO_VENDOR_POOL_ID ||
    process.env.COGNITO_CUSTOMER_POOL_ID ||
    '';
  const clientId = process.env.COGNITO_CLIENT_ID || '';

  if (!poolId || !clientId) {
    console.warn('[auth/refresh] no JWT refresh path matched and Cognito not configured');
    return {
      ok: false,
      status: 401,
      failureCode: decoded?.iss ? 'jwt_issuer_unknown' : 'jwt_decode_failed',
      body: {
        error: 'Invalid or expired refresh token',
        refreshFailureCode: decoded?.iss ? 'jwt_issuer_unknown' : 'jwt_decode_failed',
      },
    };
  }

  try {
    const tokens = await refreshCognitoUserSession(rt);
    console.log('[auth/refresh] ok path=cognito');
    return {
      ok: true,
      status: 200,
      body: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        expiresIn: tokens.expiresIn,
      },
    };
  } catch (e: any) {
    const name = e?.name || '';
    const msg = e?.message || String(e);
    console.warn('[auth/refresh] Cognito refresh failed:', name, msg.slice(0, 200));
    return {
      ok: false,
      status: 401,
      failureCode: 'cognito_refresh_failed',
      body: {
        error: 'Invalid or expired refresh token',
        refreshFailureCode: 'cognito_refresh_failed',
      },
    };
  }
}
