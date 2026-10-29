import type { Hono } from 'hono';
import { WPAY_PRICING_VIEW, WPAY_PRICING_WRITE } from '../../pricing/authorization/permissions';
import { requirePricingAdminPermission } from '../../pricing/middleware/require-pricing-admin-permission.middleware';
import {
  requireWarmpawzPayAdminEnabled,
  requireWarmpawzPayEnabled,
} from '../../shared/wpay-admin-route-guards';
import { vendorExportSettingsGetHandler } from '../handlers/vendor-export-get.handler';
import { vendorExportSettingsPutHandler } from '../handlers/vendor-export-put.handler';
import type { WpayVendorExportSettingsService } from '../services/wpay-vendor-export-settings.service';

export interface VendorExportSettingsRouteDeps {
  readonly vendorExportSettingsService: WpayVendorExportSettingsService;
}

export function registerVendorExportSettingsRoutes(
  app: Hono,
  deps: VendorExportSettingsRouteDeps,
): void {
  app.get(
    '/admin/warmpawz-pay/settings/vendor-export',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requirePricingAdminPermission(WPAY_PRICING_VIEW),
    (c) => vendorExportSettingsGetHandler(c, deps),
  );

  app.put(
    '/admin/warmpawz-pay/settings/vendor-export',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requirePricingAdminPermission(WPAY_PRICING_WRITE),
    (c) => vendorExportSettingsPutHandler(c, deps),
  );
}
