import type { Context } from 'hono';
import { executevendorVendoridAdoptionPetsPost } from '../services/vendor_vendorid_adoption_pets_post.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridAdoptionPetsPostHandler(c: Context) {
  return executevendorVendoridAdoptionPetsPost(c);
}
