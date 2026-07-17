import type { Hono } from 'hono';
import { vendorVendoridHolidaycustomrequestsGetHandler } from '../handlers/vendor_vendorid_holidaycustomrequests_get.handler';

export function registerVendorVendoridHolidaycustomrequestsGetRoute(app: Hono) {
  app.get("/vendor/:vendorId/holiday-custom-requests", vendorVendoridHolidaycustomrequestsGetHandler);
}
