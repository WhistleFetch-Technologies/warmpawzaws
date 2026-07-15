import type { Context } from 'hono';
import { executevendorVendoridAdoptionPetsPetidPut } from '../services/vendor_vendorid_adoption_pets_petid_put.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridAdoptionPetsPetidPutHandler(c: Context) {
  return executevendorVendoridAdoptionPetsPetidPut(c);
}
