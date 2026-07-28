import type { Hono } from 'hono';
import { vendorCatalogRepository } from '../../repositories/vendor-catalog.repository';
import { vendorEligibilityRepository } from '../../repositories/vendor-eligibility.repository';
import { VendorCatalogAdminService } from './services/vendor-catalog-admin.service';
import { VendorEligibilityService } from './services/vendor-eligibility.service';
import {
  registerCatalogueAdminRoutes,
  type CatalogueAdminRouteDeps,
} from './routes/catalogue-admin.routes';

export type { CatalogueAdminRouteDeps };

export { cataloguePublishHandler } from './handlers/catalogue-publish.handler';
export { catalogueUnpublishHandler } from './handlers/catalogue-unpublish.handler';
export { catalogueBulkPublishHandler } from './handlers/catalogue-bulk-publish.handler';
export { catalogueBulkUnpublishHandler } from './handlers/catalogue-bulk-unpublish.handler';
export { catalogueBulkDeleteHandler } from './handlers/catalogue-bulk-delete.handler';
export { catalogueBulkFeeHandler } from './handlers/catalogue-bulk-fee.handler';
export { catalogueFeeUpdateHandler } from './handlers/catalogue-fee-update.handler';

export interface RegisterWarmpawzAppointmentsCatalogueAdminRoutesOptions {
  readonly deps?: CatalogueAdminRouteDeps;
}

function createDefaultCatalogueAdminDeps(): CatalogueAdminRouteDeps {
  const eligibilityService = new VendorEligibilityService(vendorEligibilityRepository);

  return {
    adminService: new VendorCatalogAdminService(
      vendorCatalogRepository,
      vendorEligibilityRepository,
      eligibilityService,
    ),
    eligibilityRepository: vendorEligibilityRepository,
  };
}

export function registerWarmpawzAppointmentsCatalogueAdminRoutes(
  app: Hono,
  options: RegisterWarmpawzAppointmentsCatalogueAdminRoutesOptions = {},
): void {
  registerCatalogueAdminRoutes(app, options.deps ?? createDefaultCatalogueAdminDeps());
}
