import type { Hono } from 'hono';
import {
  INSURANCE_ADMIN_COMPANIES_WRITE,
  INSURANCE_ADMIN_PAYOUTS_WRITE,
  INSURANCE_ADMIN_VIEW,
} from '../authorization/permissions';
import {
  createCompanyHandler,
  listCompaniesHandler,
  updateCompanyHandler,
} from '../handlers/companies.handlers';
import {
  dashboardHandler,
  listApplicationEventsHandler,
  listOutreachHandler,
} from '../handlers/outreach.handlers';
import {
  getPayoutScheduleHandler,
  payoutOverviewHandler,
  payoutReceiptHandler,
  payoutRemindHandler,
  savePayoutScheduleHandler,
} from '../handlers/payouts.handlers';
import {
  addVendorLinkTermsHandler,
  createVendorLinkHandler,
  listVendorCandidatesHandler,
  listVendorLinksHandler,
  listVendorLinkTermsHandler,
  setVendorLinkScheduleHandler,
  updateVendorLinkHandler,
} from '../handlers/vendor-links.handlers';
import { requireInsuranceAdminPermission as can } from '../middleware/require-insurance-admin-permission.middleware';

const BASE = '/admin/warmpawz-insurance';

export function registerInsuranceAdminRoutes(app: Hono): void {
  const view = can(INSURANCE_ADMIN_VIEW);
  const companiesWrite = can(INSURANCE_ADMIN_COMPANIES_WRITE);
  const payoutsWrite = can(INSURANCE_ADMIN_PAYOUTS_WRITE);

  app.get(`${BASE}/dashboard`, view, dashboardHandler);
  app.get(`${BASE}/outreach`, view, listOutreachHandler);
  app.get(`${BASE}/applications/:id/events`, view, listApplicationEventsHandler);

  app.get(`${BASE}/companies`, view, listCompaniesHandler);
  app.post(`${BASE}/companies`, companiesWrite, createCompanyHandler);
  app.put(`${BASE}/companies/:id`, companiesWrite, updateCompanyHandler);

  app.get(`${BASE}/vendor-candidates`, view, listVendorCandidatesHandler);
  app.get(`${BASE}/vendor-links`, view, listVendorLinksHandler);
  app.post(`${BASE}/vendor-links`, companiesWrite, createVendorLinkHandler);
  app.put(`${BASE}/vendor-links/:id`, companiesWrite, updateVendorLinkHandler);
  app.get(`${BASE}/vendor-links/:id/terms`, view, listVendorLinkTermsHandler);
  app.post(`${BASE}/vendor-links/:id/terms`, companiesWrite, addVendorLinkTermsHandler);
  app.put(`${BASE}/vendor-links/:id/payout-schedule`, payoutsWrite, setVendorLinkScheduleHandler);

  app.get(`${BASE}/payout-schedule`, view, getPayoutScheduleHandler);
  app.put(`${BASE}/payout-schedule`, payoutsWrite, savePayoutScheduleHandler);
  app.get(`${BASE}/payouts`, view, payoutOverviewHandler);
  app.post(`${BASE}/payouts/remind`, payoutsWrite, payoutRemindHandler);
  app.post(`${BASE}/payouts/receipt`, payoutsWrite, payoutReceiptHandler);
}
