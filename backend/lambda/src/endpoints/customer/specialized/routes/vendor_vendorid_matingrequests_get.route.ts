import type { Hono } from 'hono';
import { vendorVendoridMatingrequestsGetHandler } from '../handlers/vendor_vendorid_matingrequests_get.handler';

export function registerVendorVendoridMatingrequestsGetRoute(app: Hono) {
  app.get("/vendor/:vendorId/mating-requests", vendorVendoridMatingrequestsGetHandler);
}
