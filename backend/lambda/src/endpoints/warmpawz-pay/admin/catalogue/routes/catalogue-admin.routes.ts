import type { Hono } from 'hono';
import type { IVendorEligibilityRepository } from '../../../repositories/interfaces/IVendorEligibilityRepository';
import type { VendorCatalogAdminService } from '../services/vendor-catalog-admin.service';
import { catalogueCreateHandler } from '../handlers/catalogue-create.handler';
import { catalogueDeleteHandler } from '../handlers/catalogue-delete.handler';
import { catalogueDetailHandler } from '../handlers/catalogue-detail.handler';
import { catalogueListHandler } from '../handlers/catalogue-list.handler';
import { vendorCandidatesHandler } from '../handlers/vendor-candidates.handler';

export interface CatalogueAdminRouteDeps {
  readonly adminService: VendorCatalogAdminService;
  readonly eligibilityRepository: IVendorEligibilityRepository;
}

export function registerCatalogueAdminRoutes(app: Hono, deps: CatalogueAdminRouteDeps): void {
  app.get('/admin/warmpawz-pay/catalogue', (c) => catalogueListHandler(c, deps));
  app.get('/admin/warmpawz-pay/catalogue/vendor-candidates', (c) =>
    vendorCandidatesHandler(c, deps),
  );
  app.get('/admin/warmpawz-pay/catalogue/:catalogueId', (c) => catalogueDetailHandler(c, deps));
  app.post('/admin/warmpawz-pay/catalogue', (c) => catalogueCreateHandler(c, deps));
  app.delete('/admin/warmpawz-pay/catalogue/:catalogueId', (c) => catalogueDeleteHandler(c, deps));
}
