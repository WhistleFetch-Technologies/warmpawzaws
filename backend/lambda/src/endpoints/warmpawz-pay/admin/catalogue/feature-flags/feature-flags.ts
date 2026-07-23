/**
 * Warmpawz Pay feature flag identifiers.
 * Each flag maps to an environment variable of the same name.
 */
export const FeatureFlag = {
  WARMPAWZ_PAY_ENABLED: 'WARMPAWZ_PAY_ENABLED',
  WARMPAWZ_PAY_ADMIN_ENABLED: 'WARMPAWZ_PAY_ADMIN_ENABLED',
} as const;

export type FeatureFlagId = (typeof FeatureFlag)[keyof typeof FeatureFlag];

/** Environment variable key for each feature flag. */
export const FEATURE_FLAG_ENV_KEYS: Readonly<Record<FeatureFlagId, string>> = {
  [FeatureFlag.WARMPAWZ_PAY_ENABLED]: FeatureFlag.WARMPAWZ_PAY_ENABLED,
  [FeatureFlag.WARMPAWZ_PAY_ADMIN_ENABLED]: FeatureFlag.WARMPAWZ_PAY_ADMIN_ENABLED,
};
