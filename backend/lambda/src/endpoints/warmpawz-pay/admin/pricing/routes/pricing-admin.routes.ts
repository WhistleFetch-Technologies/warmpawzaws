import type { Hono } from 'hono';
import {
  requireWarmpawzPayAdminEnabled,
  requireWarmpawzPayEnabled,
} from '../../shared/wpay-admin-route-guards';
import { WPAY_PRICING_VIEW, WPAY_PRICING_WRITE } from '../authorization/permissions';
import { pricingCreateHandler } from '../handlers/pricing-create.handler';
import { pricingDeleteHandler } from '../handlers/pricing-delete.handler';
import { pricingDetailHandler } from '../handlers/pricing-detail.handler';
import { pricingUpdateHandler } from '../handlers/pricing-update.handler';
import { requirePricingAdminPermission } from '../middleware/require-pricing-admin-permission.middleware';
import type { WarmpawzPayPricingService } from '../services/warmpawz-pay-pricing.service';

export interface PricingAdminRouteDeps {
  readonly pricingService: WarmpawzPayPricingService;
}

export function registerPricingAdminRoutes(app: Hono, deps: PricingAdminRouteDeps): void {
  app.get(
    '/admin/warmpawz-pay/pricing/:merchantId',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requirePricingAdminPermission(WPAY_PRICING_VIEW),
    (c) => pricingDetailHandler(c, deps),
  );

  app.post(
    '/admin/warmpawz-pay/pricing',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requirePricingAdminPermission(WPAY_PRICING_WRITE),
    (c) => pricingCreateHandler(c, deps),
  );

  app.put(
    '/admin/warmpawz-pay/pricing/:merchantId',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requirePricingAdminPermission(WPAY_PRICING_WRITE),
    (c) => pricingUpdateHandler(c, deps),
  );

  app.delete(
    '/admin/warmpawz-pay/pricing/:merchantId',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requirePricingAdminPermission(WPAY_PRICING_WRITE),
    (c) => pricingDeleteHandler(c, deps),
  );
}
