import type { Hono } from 'hono';
import { vendorVendoridAdoptionapplicationsGetHandler } from '../handlers/vendor_vendorid_adoptionapplications_get.handler';

export function registerVendorVendoridAdoptionapplicationsGetRoute(app: Hono) {
  app.get("/vendor/:vendorId/adoption-applications", vendorVendoridAdoptionapplicationsGetHandler);
}
