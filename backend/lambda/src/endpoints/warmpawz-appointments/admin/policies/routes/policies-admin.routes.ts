import type { Hono } from 'hono';
import {
  requireWarmpawzAppointmentsAdminEnabled,
  requireWarmpawzAppointmentsEnabled,
} from '../../shared/wappt-admin-route-guards';
import { requireAdminPermission } from '../../catalogue/middleware/require-admin-permission.middleware';
import { WAPPT_POLICIES_EDIT, WAPPT_POLICIES_VIEW } from '../authorization/permissions';
import {
  wapptPoliciesCategoryGetHandler,
  wapptPoliciesCategoryPutHandler,
  wapptPoliciesListHandler,
  wapptPoliciesPlatformGetHandler,
  wapptPoliciesPlatformPutHandler,
  wapptPoliciesTierDeleteHandler,
} from '../handlers/wappt-policies.handlers';

export function registerWapptPoliciesAdminRoutes(app: Hono): void {
  const base = '/admin/warmpawz-appointments/policies';
  app.get(
    base,
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_POLICIES_VIEW),
    wapptPoliciesListHandler,
  );
  app.get(
    `${base}/platform-default`,
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_POLICIES_VIEW),
    wapptPoliciesPlatformGetHandler,
  );
  app.put(
    `${base}/platform-default`,
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_POLICIES_EDIT),
    wapptPoliciesPlatformPutHandler,
  );
  app.get(
    `${base}/categories/:category`,
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_POLICIES_VIEW),
    wapptPoliciesCategoryGetHandler,
  );
  app.put(
    `${base}/categories/:category`,
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_POLICIES_EDIT),
    wapptPoliciesCategoryPutHandler,
  );
  app.delete(
    `${base}/tiers/:tierId`,
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_POLICIES_EDIT),
    wapptPoliciesTierDeleteHandler,
  );
}
