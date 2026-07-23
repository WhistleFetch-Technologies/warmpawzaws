import { FeatureFlag } from '../catalogue/feature-flags/feature-flags';
import { requireFeatureFlag } from '../catalogue/middleware/require-feature-flag.middleware';

/** Shared Warmpawz Pay admin route guards (catalogue, dashboard, …). */
export const requireWarmpawzPayEnabled = requireFeatureFlag(FeatureFlag.WARMPAWZ_PAY_ENABLED);
export const requireWarmpawzPayAdminEnabled = requireFeatureFlag(
  FeatureFlag.WARMPAWZ_PAY_ADMIN_ENABLED,
);
