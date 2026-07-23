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
import { FeatureFlag } from '../feature-flags/feature-flags';
import { requireAdminPermission } from '../middleware/require-admin-permission.middleware';
import { requireFeatureFlag } from '../middleware/require-feature-flag.middleware';
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

const requireWarmpawzPayEnabled = requireFeatureFlag(FeatureFlag.WARMPAWZ_PAY_ENABLED);
const requireWarmpawzPayAdminEnabled = requireFeatureFlag(FeatureFlag.WARMPAWZ_PAY_ADMIN_ENABLED);

export function registerCatalogueAdminRoutes(app: Hono, deps: CatalogueAdminRouteDeps): void {
  app.get(
    '/admin/warmpawz-pay/catalogue',
    requireAdminPermission(WPAY_CATALOGUE_VIEW),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => catalogueListHandler(c, deps),
  );
  app.get(
    '/admin/warmpawz-pay/catalogue/vendor-candidates',
    requireAdminPermission(WPAY_CATALOGUE_VIEW),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => vendorCandidatesHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/bulk/publish',
    requireAdminPermission(WPAY_CATALOGUE_BULK),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => catalogueBulkPublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/bulk/unpublish',
    requireAdminPermission(WPAY_CATALOGUE_BULK),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => catalogueBulkUnpublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/bulk/delete',
    requireAdminPermission(WPAY_CATALOGUE_BULK),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => catalogueBulkDeleteHandler(c, deps),
  );
  app.get(
    '/admin/warmpawz-pay/catalogue/:catalogueId',
    requireAdminPermission(WPAY_CATALOGUE_VIEW),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => catalogueDetailHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue',
    requireAdminPermission(WPAY_CATALOGUE_CREATE),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => catalogueCreateHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/:catalogueId/publish',
    requireAdminPermission(WPAY_CATALOGUE_PUBLISH),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => cataloguePublishHandler(c, deps),
  );
  app.post(
    '/admin/warmpawz-pay/catalogue/:catalogueId/unpublish',
    requireAdminPermission(WPAY_CATALOGUE_UNPUBLISH),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => catalogueUnpublishHandler(c, deps),
  );
  app.delete(
    '/admin/warmpawz-pay/catalogue/:catalogueId',
    requireAdminPermission(WPAY_CATALOGUE_DELETE),
    requireWarmpawzPayEnabled,
    requireWarmpawzPayAdminEnabled,
    (c) => catalogueDeleteHandler(c, deps),
  );
}
