import type { Hono } from 'hono';
import { registerInsuranceAdminRoutes } from './routes/insurance-admin.routes';

/** Admin APIs for Warmpawz Insurance (companies, vendor links, outreach, premium payout). */
export function registerWarmpawzInsuranceAdminRoutes(app: Hono): void {
  registerInsuranceAdminRoutes(app);
}
