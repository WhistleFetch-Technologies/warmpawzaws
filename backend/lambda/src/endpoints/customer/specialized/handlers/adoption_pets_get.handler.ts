import type { Context } from 'hono';
import { executeadoptionPetsGet } from '../services/adoption_pets_get.service';

/** HTTP adapter — delegates to service layer. */
export async function adoptionPetsGetHandler(c: Context) {
  return executeadoptionPetsGet(c);
}
