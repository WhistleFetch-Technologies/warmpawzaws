import type { Hono } from 'hono';
import {
  requireWarmpawzPayAdminEnabled,
  requireWarmpawzPayEnabled,
} from '../../shared/wpay-admin-route-guards';
import { WPAY_DASHBOARD_VIEW } from '../../dashboard/authorization/permissions';
import { requireDashboardAdminPermission } from '../../dashboard/middleware/require-dashboard-admin-permission.middleware';
import { paymentsListHandler } from '../handlers/payments-list.handler';
import type { WarmpawzPayPaymentsService } from '../services/warmpawz-pay-payments.service';

export interface PaymentsAdminRouteDeps {
  readonly paymentsService: WarmpawzPayPaymentsService;
}

export function registerPaymentsAdminRoutes(app: Hono, deps: PaymentsAdminRouteDeps): void {
  app.get(
    '/admin/warmpawz-pay/payments',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireDashboardAdminPermission(WPAY_DASHBOARD_VIEW),
    (c) => paymentsListHandler(c, deps),
  );
}
