export type AnalyticsMode = 'OFF' | 'SHADOW' | 'AUTHORITATIVE';

const VALID_MODES: AnalyticsMode[] = ['OFF', 'SHADOW', 'AUTHORITATIVE'];

/**
 * Resolves analytics rollout from `DISCOUNT_ENGINE_V2_ANALYTICS_MODE`.
 * Default: OFF — no analytics generation or public exposure.
 */
export function getAnalyticsMode(): AnalyticsMode {
  const raw = process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE?.trim().toUpperCase();
  if (raw && VALID_MODES.includes(raw as AnalyticsMode)) {
    return raw as AnalyticsMode;
  }
  return 'OFF';
}

export function isAnalyticsEnabled(): boolean {
  return getAnalyticsMode() !== 'OFF';
}

export function isAnalyticsShadowMode(): boolean {
  return getAnalyticsMode() === 'SHADOW';
}

export function isAnalyticsAuthoritative(): boolean {
  return getAnalyticsMode() === 'AUTHORITATIVE';
}

/** When true, HTTP handlers may return analytics payloads to clients. */
export function isAnalyticsPubliclyExposed(): boolean {
  return isAnalyticsAuthoritative();
}
