import type { Hono } from 'hono';
import {
  requireWarmpawzPayAdminEnabled,
  requireWarmpawzPayEnabled,
} from '../../shared/wpay-admin-route-guards';
import { WPAY_MERCHANTS_VIEW } from '../authorization/permissions';
import { merchantsListHandler } from '../handlers/merchants-list.handler';
import { requireMerchantsAdminPermission } from '../middleware/require-merchants-admin-permission.middleware';
import type { WarmpawzPayMerchantsService } from '../services/warmpawz-pay-merchants.service';

export interface MerchantsAdminRouteDeps {
  readonly merchantsService: WarmpawzPayMerchantsService;
}

export function registerMerchantsAdminRoutes(app: Hono, deps: MerchantsAdminRouteDeps): void {
  app.get(
    '/admin/warmpawz-pay/merchants',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireMerchantsAdminPermission(WPAY_MERCHANTS_VIEW),
    (c) => merchantsListHandler(c, deps),
  );
}
