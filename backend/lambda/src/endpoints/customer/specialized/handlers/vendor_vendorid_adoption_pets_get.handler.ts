import type { Context } from 'hono';
import { executevendorVendoridAdoptionPetsGet } from '../services/vendor_vendorid_adoption_pets_get.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridAdoptionPetsGetHandler(c: Context) {
  return executevendorVendoridAdoptionPetsGet(c);
}
