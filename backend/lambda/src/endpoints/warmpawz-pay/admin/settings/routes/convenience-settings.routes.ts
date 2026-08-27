import type { Hono } from 'hono';
import { WPAY_PRICING_VIEW, WPAY_PRICING_WRITE } from '../../pricing/authorization/permissions';
import { requirePricingAdminPermission } from '../../pricing/middleware/require-pricing-admin-permission.middleware';
import {
  requireWarmpawzPayAdminEnabled,
  requireWarmpawzPayEnabled,
} from '../../shared/wpay-admin-route-guards';
import { convenienceSettingsGetHandler } from '../handlers/convenience-get.handler';
import { convenienceSettingsPutHandler } from '../handlers/convenience-put.handler';
import type { WpayConvenienceSettingsService } from '../services/wpay-convenience-settings.service';

export interface ConvenienceSettingsRouteDeps {
  readonly convenienceSettingsService: WpayConvenienceSettingsService;
}

export function registerConvenienceSettingsRoutes(
  app: Hono,
  deps: ConvenienceSettingsRouteDeps,
): void {
  app.get(
    '/admin/warmpawz-pay/settings/convenience',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requirePricingAdminPermission(WPAY_PRICING_VIEW),
    (c) => convenienceSettingsGetHandler(c, deps),
  );

  app.put(
    '/admin/warmpawz-pay/settings/convenience',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requirePricingAdminPermission(WPAY_PRICING_WRITE),
    (c) => convenienceSettingsPutHandler(c, deps),
  );
}
