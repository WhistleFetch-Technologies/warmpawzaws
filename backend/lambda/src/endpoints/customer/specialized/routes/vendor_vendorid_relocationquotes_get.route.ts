import type { Hono } from 'hono';
import { vendorVendoridRelocationquotesGetHandler } from '../handlers/vendor_vendorid_relocationquotes_get.handler';

export function registerVendorVendoridRelocationquotesGetRoute(app: Hono) {
  app.get("/vendor/:vendorId/relocation-quotes", vendorVendoridRelocationquotesGetHandler);
}
