import type { Hono } from 'hono';
import { registerWarmpawzAppointmentsDashboardAdminRoutes } from './routes/dashboard-admin.routes';

export function registerWarmpawzAppointmentsDashboardAdmin(app: Hono): void {
  registerWarmpawzAppointmentsDashboardAdminRoutes(app);
}
