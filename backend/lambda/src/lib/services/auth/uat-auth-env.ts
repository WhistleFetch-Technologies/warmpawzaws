/**
 * Shared UAT / dev auth detection for password bypass and JWT issuer selection.
 * Keep in sync with customer-web / vendor-web: `X-UAT-Mode: true` when NEXT_PUBLIC_UAT_MODE=true.
 */

export function uatModeEnvEnabled(): boolean {
  const v = String(process.env.UAT_MODE ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export function hasUatClientHeader(headers: Record<string, string> | undefined): boolean {
  if (!headers) return false;
  const x = String(headers['x-uat-mode'] ?? '').trim().toLowerCase();
  return x === 'true' || x === '1';
}

export function isProductionLikeNodeEnv(): boolean {
  const node = String(process.env.NODE_ENV ?? '').trim().toLowerCase();
  return ['production', 'prod', 'prd', 'live'].includes(node);
}

/**
 * Explicit Serverless stage (set in provider.environment). When present, overrides misleading NODE_ENV.
 */
export function isNonProdDeployment(): boolean {
  const stage = String(process.env.WPZ_API_STAGE || process.env.STAGE || '').trim().toLowerCase();
  if (stage && ['production', 'prod', 'prd', 'live'].includes(stage)) return false;
  if (stage.length > 0) return true;
  return !isProductionLikeNodeEnv();
}

/**
 * Relaxed UAT context: env UAT_MODE, or client `X-UAT-Mode` on a non-prod deployment/stage.
 * Used for password bypass (with matching dev secret) and UAT JWT issuer selection.
 */
export function isUatRelaxedAuthContext(headers?: Record<string, string>): boolean {
  if (uatModeEnvEnabled()) return true;
  if (headers && hasUatClientHeader(headers) && isNonProdDeployment()) return true;
  return false;
}

/**
 * Use `generateUATJWTToken` (warmpawz-uat issuer) instead of Cognito / prod JWT.
 */
export function shouldUseUatJwtIssuer(
  headers?: Record<string, string>,
  preferUatJwt?: boolean
): boolean {
  if (preferUatJwt === true) return true;
  return isUatRelaxedAuthContext(headers);
}
