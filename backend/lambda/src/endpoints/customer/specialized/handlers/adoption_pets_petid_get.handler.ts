import type { Context } from 'hono';
import { executeadoptionPetsPetidGet } from '../services/adoption_pets_petid_get.service';

/** HTTP adapter — delegates to service layer. */
export async function adoptionPetsPetidGetHandler(c: Context) {
  return executeadoptionPetsPetidGet(c);
}
