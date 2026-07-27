/**
 * Warmpawz Pay feature flag identifiers.
 * Each flag maps to an environment variable of the same name.
 */
export const FeatureFlag = {
  WARMPAWZ_APPOINTMENTS_ENABLED: 'WARMPAWZ_APPOINTMENTS_ENABLED',
  WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED: 'WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED',
} as const;

export type FeatureFlagId = (typeof FeatureFlag)[keyof typeof FeatureFlag];

/** Environment variable key for each feature flag. */
export const FEATURE_FLAG_ENV_KEYS: Readonly<Record<FeatureFlagId, string>> = {
  [FeatureFlag.WARMPAWZ_APPOINTMENTS_ENABLED]: FeatureFlag.WARMPAWZ_APPOINTMENTS_ENABLED,
  [FeatureFlag.WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED]: FeatureFlag.WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED,
};
