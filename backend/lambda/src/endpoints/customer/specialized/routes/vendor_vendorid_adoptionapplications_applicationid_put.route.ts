import type { Hono } from 'hono';
import { vendorVendoridAdoptionapplicationsApplicationidPutHandler } from '../handlers/vendor_vendorid_adoptionapplications_applicationid_put.handler';

export function registerVendorVendoridAdoptionapplicationsApplicationidPutRoute(app: Hono) {
  app.put("/vendor/:vendorId/adoption-applications/:applicationId", vendorVendoridAdoptionapplicationsApplicationidPutHandler);
}
