import type { Hono } from 'hono';
import { vendorVendoridAdoptionPetsGetHandler } from '../handlers/vendor_vendorid_adoption_pets_get.handler';

export function registerVendorVendoridAdoptionPetsGetRoute(app: Hono) {
  app.get("/vendor/:vendorId/adoption/pets", vendorVendoridAdoptionPetsGetHandler);
}
