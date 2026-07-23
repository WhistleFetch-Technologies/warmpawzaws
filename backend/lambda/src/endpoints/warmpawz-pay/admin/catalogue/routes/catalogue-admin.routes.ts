import type { Hono } from 'hono';
import type { IVendorEligibilityRepository } from '../../../repositories/interfaces/IVendorEligibilityRepository';
import type { VendorCatalogAdminService } from '../services/vendor-catalog-admin.service';
import {
  WPAY_CATALOGUE_BULK,
  WPAY_CATALOGUE_CREATE,
  WPAY_CATALOGUE_DELETE,
  WPAY_CATALOGUE_PUBLISH,
  WPAY_CATALOGUE_UNPUBLISH,
  WPAY_CATALOGUE_VIEW,
} from '../authorization/permissions';
import {
  requireWarmpawzPayAdminEnabled,
  requireWarmpawzPayEnabled,
} from '../../shared/wpay-admin-route-guards';
import { requireAdminPermission } from '../middleware/require-admin-permission.middleware';
import { catalogueBulkDeleteHandler } from '../handlers/catalogue-bulk-delete.handler';
import { catalogueBulkPublishHandler } from '../handlers/catalogue-bulk-publish.handler';
import { catalogueBulkUnpublishHandler } from '../handlers/catalogue-bulk-unpublish.handler';
import { catalogueCreateHandler } from '../handlers/catalogue-create.handler';
import { catalogueDeleteHandler } from '../handlers/catalogue-delete.handler';
import { catalogueDetailHandler } from '../handlers/catalogue-detail.handler';
import { catalogueListHandler } from '../handlers/catalogue-list.handler';
import { cataloguePublishHandler } from '../handlers/catalogue-publish.handler';
import { catalogueUnpublishHandler } from '../handlers/catalogue-unpublish.handler';
import { vendorCandidatesHandler } from '../handlers/vendor-candidates.handler';

export interface CatalogueAdminRouteDeps {
  readonly adminService: VendorCatalogAdminService;
  readonly eligibilityRepository: IVendorEligibilityRepository;
}

export function registerCatalogueAdminRoutes(app: Hono, deps: CatalogueAdminRouteDeps): void {
  app.get(
    '/admin/warmpawz-pay/catalogue',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_VIEW),
    (c) => catalogueListHandler(c, deps),
  );
  app.get(
    '/admin/warmpawz-pay/catalogue/vendor-candidates',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_VIEW),
    (c) => vendorCandidatesHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/bulk/publish',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_BULK),
    (c) => catalogueBulkPublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/bulk/unpublish',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_BULK),
    (c) => catalogueBulkUnpublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/bulk/delete',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_BULK),
    (c) => catalogueBulkDeleteHandler(c, deps),
  );
  app.get(
    '/admin/warmpawz-pay/catalogue/:catalogueId',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_VIEW),
    (c) => catalogueDetailHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_CREATE),
    (c) => catalogueCreateHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/:catalogueId/publish',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_PUBLISH),
    (c) => cataloguePublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/:catalogueId/unpublish',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_UNPUBLISH),
    (c) => catalogueUnpublishHandler(c, deps),
  );
  app.delete(
    '/admin/warmpawz-pay/catalogue/:catalogueId',
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    requireAdminPermission(WPAY_CATALOGUE_DELETE),
    (c) => catalogueDeleteHandler(c, deps),
  );
}
