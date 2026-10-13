import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { listVendorLinks } from '../admin/services/insurance-vendor-links.service';
import { getPlanReadiness, listCompanyPlans } from '../admin/services/insurance-plans.service';
import { requireWarmpawzInsuranceEnabled } from '../admin/middleware/require-insurance-flag.middleware';
import { insuranceAdminError, insuranceAdminOk } from '../admin/shared/insurance-admin-response';

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
  app.get('/vendor/:vendorId/insurance/workspace', requireWarmpawzInsuranceEnabled(), vendorWorkspaceHandler);
}
