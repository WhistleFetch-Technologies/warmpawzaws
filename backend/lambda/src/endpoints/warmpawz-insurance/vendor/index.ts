import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { listVendorLinks } from '../admin/services/insurance-vendor-links.service';
import { getPlanReadiness, listCompanyPlans } from '../admin/services/insurance-plans.service';
import { requireWarmpawzInsuranceEnabled } from '../admin/middleware/require-insurance-flag.middleware';
import { insuranceAdminError, insuranceAdminOk } from '../admin/shared/insurance-admin-response';
import {
  changeRequestHandler,
  confirmFormHandler,
  createFormHandler,
  formRequestHandler,
  listApplicationsHandler,
  listFormsHandler,
  listSlugsHandler,
  listVersionsHandler,
  publishFormHandler,
  quoteHandler,
  updateFormHandler,
} from './library.handlers';

const vendorIdParam = z.string().uuid();

export async function vendorWorkspaceHandler(c: Context): Promise<Response> {
  try {
    const vendorId = vendorIdParam.parse(c.req.param('vendorId'));
    const links = await listVendorLinks({ vendorId });
    const companyIds = [...new Set(links.map((link) => link.companyId))];
    const [plans, readiness] = await Promise.all([
      Promise.all(companyIds.map((companyId) => listCompanyPlans(companyId))),
      Promise.all(companyIds.map((companyId) => getPlanReadiness(companyId))),
    ]);
    return insuranceAdminOk(c, { links, plans: plans.flat(), readiness });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export function registerWarmpawzInsuranceVendorRoutes(app: Hono): void {
  const gate = requireWarmpawzInsuranceEnabled();
  app.get('/vendor/:vendorId/insurance/workspace', gate, vendorWorkspaceHandler);
  app.get('/vendor/:vendorId/insurance/forms', gate, listFormsHandler);
  app.post('/vendor/:vendorId/insurance/forms', gate, createFormHandler);
  app.put('/vendor/:vendorId/insurance/forms/:id', gate, updateFormHandler);
  app.post('/vendor/:vendorId/insurance/forms/:id/publish', gate, publishFormHandler);
  app.get('/vendor/:vendorId/insurance/forms/:id/versions', gate, listVersionsHandler);
  app.get('/vendor/:vendorId/insurance/slugs', gate, listSlugsHandler);
  app.get('/vendor/:vendorId/insurance/applications', gate, listApplicationsHandler);
  app.post('/vendor/:vendorId/insurance/applications/:id/quote', gate, quoteHandler);
  app.post('/vendor/:vendorId/insurance/applications/:id/form-request', gate, formRequestHandler);
  app.post('/vendor/:vendorId/insurance/applications/:id/change-request', gate, changeRequestHandler);
  app.post('/vendor/:vendorId/insurance/applications/:id/transition', gate, confirmFormHandler);
}
