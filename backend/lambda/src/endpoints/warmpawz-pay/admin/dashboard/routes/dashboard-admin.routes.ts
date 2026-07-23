import type { Hono } from 'hono';
import {
  requireWarmpawzPayAdminEnabled,
  requireWarmpawzPayEnabled,
} from '../../shared/wpay-admin-route-guards';
import { WPAY_DASHBOARD_VIEW } from '../authorization/permissions';
import type { WarmpawzPayDashboardService } from '../services/warmpawz-pay-dashboard.service';
import { requireDashboardAdminPermission } from '../middleware/require-dashboard-admin-permission.middleware';
import { dashboardGetHandler } from '../handlers/dashboard-get.handler';

export interface DashboardAdminRouteDeps {
  readonly dashboardService: WarmpawzPayDashboardService;
}

export function registerDashboardAdminRoutes(app: Hono, deps: DashboardAdminRouteDeps): void {
  app.get(
    '/admin/warmpawz-pay/dashboard',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireDashboardAdminPermission(WPAY_DASHBOARD_VIEW),
    (c) => dashboardGetHandler(c, deps),
  );
}
