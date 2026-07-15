import type { Hono } from 'hono';
import { vendorVendoridAdoptionPetsPetidPutHandler } from '../handlers/vendor_vendorid_adoption_pets_petid_put.handler';

export function registerVendorVendoridAdoptionPetsPetidPutRoute(app: Hono) {
  app.put("/vendor/:vendorId/adoption/pets/:petId", vendorVendoridAdoptionPetsPetidPutHandler);
}
