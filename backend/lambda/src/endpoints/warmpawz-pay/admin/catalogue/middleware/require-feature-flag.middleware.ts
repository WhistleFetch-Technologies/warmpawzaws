import type { Context, MiddlewareHandler } from 'hono';
import { CatalogueErrorCode, type CatalogueErrorResponse } from '../dto/catalogue.errors';
import { FeatureFlag, type FeatureFlagId } from '../feature-flags/feature-flags';
import { FeatureFlagService } from '../feature-flags/feature-flags.service';

function isFeatureEnabled(service: FeatureFlagService, flag: FeatureFlagId): boolean {
  switch (flag) {
    case FeatureFlag.WARMPAWZ_PAY_ENABLED:
      return service.isWarmpawzPayEnabled();
    case FeatureFlag.WARMPAWZ_PAY_ADMIN_ENABLED:
      return service.isWarmpawzPayAdminEnabled();
    default:
      return false;
  }
}

function featureDisabledResponse(c: Context): Response {
  const body: CatalogueErrorResponse = {
    success: false,
    error: {
      code: CatalogueErrorCode.FEATURE_DISABLED,
      message: 'Feature is disabled',
    },
  };
  return c.json(body, 503);
}

export function requireFeatureFlag(
  flag: FeatureFlagId,
  featureFlagService: FeatureFlagService = new FeatureFlagService(),
): MiddlewareHandler {
  return async (c, next) => {
    if (!isFeatureEnabled(featureFlagService, flag)) {
      return featureDisabledResponse(c);
    }

    await next();
  };
}
