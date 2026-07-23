import type { Hono } from 'hono';
import {
  registerDashboardAdminRoutes,
  type DashboardAdminRouteDeps,
} from './routes/dashboard-admin.routes';
import { WarmpawzPayDashboardService } from './services/warmpawz-pay-dashboard.service';

export type { DashboardAdminRouteDeps };

export interface RegisterWarmpawzPayDashboardAdminRoutesOptions {
  readonly deps?: DashboardAdminRouteDeps;
}

function createDefaultDashboardAdminDeps(): DashboardAdminRouteDeps {
  return {
    dashboardService: new WarmpawzPayDashboardService(),
  };
}

export function registerWarmpawzPayDashboardAdminRoutes(
  app: Hono,
  options: RegisterWarmpawzPayDashboardAdminRoutesOptions = {},
): void {
  registerDashboardAdminRoutes(app, options.deps ?? createDefaultDashboardAdminDeps());
}
