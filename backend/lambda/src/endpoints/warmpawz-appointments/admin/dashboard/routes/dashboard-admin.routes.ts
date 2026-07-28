import type { Hono } from 'hono';
import { WAPPT_CATALOGUE_VIEW } from '../../catalogue/authorization/permissions';
import { requireAdminPermission } from '../../catalogue/middleware/require-admin-permission.middleware';
import {
  requireWarmpawzAppointmentsAdminEnabled,
  requireWarmpawzAppointmentsEnabled,
} from '../../shared/wappt-admin-route-guards';
import {
  wapptBookingsListHandler,
  wapptDashboardGetHandler,
} from '../handlers/dashboard.handlers';

export function registerWarmpawzAppointmentsDashboardAdminRoutes(app: Hono): void {
  app.get(
    '/admin/warmpawz-appointments/dashboard',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_VIEW),
    wapptDashboardGetHandler,
  );
  app.get(
    '/admin/warmpawz-appointments/bookings',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_VIEW),
    wapptBookingsListHandler,
  );
}
