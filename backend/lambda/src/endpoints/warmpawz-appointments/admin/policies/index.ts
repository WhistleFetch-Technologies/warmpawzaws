import type { Hono } from 'hono';
import { registerWapptPoliciesAdminRoutes } from './routes/policies-admin.routes';

export function registerWarmpawzAppointmentsPoliciesAdminRoutes(app: Hono): void {
  registerWapptPoliciesAdminRoutes(app);
}
