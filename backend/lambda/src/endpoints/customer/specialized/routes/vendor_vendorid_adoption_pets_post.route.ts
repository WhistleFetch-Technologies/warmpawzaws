import type { Hono } from 'hono';
import { vendorVendoridAdoptionPetsPostHandler } from '../handlers/vendor_vendorid_adoption_pets_post.handler';

export function registerVendorVendoridAdoptionPetsPostRoute(app: Hono) {
  app.post("/vendor/:vendorId/adoption/pets", vendorVendoridAdoptionPetsPostHandler);
}
