import type { Hono } from 'hono';
import type { IVendorEligibilityRepository } from '../../../repositories/interfaces/IVendorEligibilityRepository';
import type { VendorCatalogAdminService } from '../services/vendor-catalog-admin.service';
import {
  WAPPT_CATALOGUE_BULK,
  WAPPT_CATALOGUE_CREATE,
  WAPPT_CATALOGUE_DELETE,
  WAPPT_CATALOGUE_FEE_WRITE,
  WAPPT_CATALOGUE_PUBLISH,
  WAPPT_CATALOGUE_UNPUBLISH,
  WAPPT_CATALOGUE_VIEW,
} from '../authorization/permissions';
import {
  requireWarmpawzAppointmentsAdminEnabled,
  requireWarmpawzAppointmentsEnabled,
} from '../../shared/wappt-admin-route-guards';
import { requireAdminPermission } from '../middleware/require-admin-permission.middleware';
import { catalogueBulkDeleteHandler } from '../handlers/catalogue-bulk-delete.handler';
import { catalogueBulkFeeHandler } from '../handlers/catalogue-bulk-fee.handler';
import { catalogueBulkPublishHandler } from '../handlers/catalogue-bulk-publish.handler';
import { catalogueBulkUnpublishHandler } from '../handlers/catalogue-bulk-unpublish.handler';
import { catalogueCreateHandler } from '../handlers/catalogue-create.handler';
import { catalogueDeleteHandler } from '../handlers/catalogue-delete.handler';
import { catalogueDetailHandler } from '../handlers/catalogue-detail.handler';
import { catalogueFeeUpdateHandler } from '../handlers/catalogue-fee-update.handler';
import { catalogueListHandler } from '../handlers/catalogue-list.handler';
import { catalogueServiceCategoriesHandler } from '../handlers/catalogue-service-categories.handler';
import { cataloguePublishHandler } from '../handlers/catalogue-publish.handler';
import { catalogueUnpublishHandler } from '../handlers/catalogue-unpublish.handler';
import { vendorCandidatesHandler } from '../handlers/vendor-candidates.handler';

export interface CatalogueAdminRouteDeps {
  readonly adminService: VendorCatalogAdminService;
  readonly eligibilityRepository: IVendorEligibilityRepository;
}

export function registerCatalogueAdminRoutes(app: Hono, deps: CatalogueAdminRouteDeps): void {
  app.get(
    '/admin/warmpawz-appointments/catalogue',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_VIEW),
    (c) => catalogueListHandler(c, deps),
  );
  app.get(
    '/admin/warmpawz-appointments/catalogue/service-categories',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_VIEW),
    (c) => catalogueServiceCategoriesHandler(c, deps),
  );
  app.get(
    '/admin/warmpawz-appointments/catalogue/vendor-candidates',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_VIEW),
    (c) => vendorCandidatesHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-appointments/catalogue/bulk/publish',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_BULK),
    (c) => catalogueBulkPublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-appointments/catalogue/bulk/unpublish',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_BULK),
    (c) => catalogueBulkUnpublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-appointments/catalogue/bulk/delete',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_BULK),
    (c) => catalogueBulkDeleteHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-appointments/catalogue/bulk-fee',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_FEE_WRITE),
    (c) => catalogueBulkFeeHandler(c, deps),
  );
  app.get(
    '/admin/warmpawz-appointments/catalogue/:catalogueId',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_VIEW),
    (c) => catalogueDetailHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-appointments/catalogue',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_CREATE),
    (c) => catalogueCreateHandler(c, deps),
  );
  app.put(
    '/admin/warmpawz-appointments/catalogue/:catalogueId/fee',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_FEE_WRITE),
    (c) => catalogueFeeUpdateHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-appointments/catalogue/:catalogueId/publish',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_PUBLISH),
    (c) => cataloguePublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-appointments/catalogue/:catalogueId/unpublish',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_UNPUBLISH),
    (c) => catalogueUnpublishHandler(c, deps),
  );
  app.delete(
    '/admin/warmpawz-appointments/catalogue/:catalogueId',
    requireWarmpawzAppointmentsEnabled,
    requireWarmpawzAppointmentsAdminEnabled,
    requireAdminPermission(WAPPT_CATALOGUE_DELETE),
    (c) => catalogueDeleteHandler(c, deps),
  );
}
