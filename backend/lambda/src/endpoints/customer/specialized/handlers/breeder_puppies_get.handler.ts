import type { Context } from 'hono';
import { executebreederPuppiesGet } from '../services/breeder_puppies_get.service';

/** HTTP adapter — delegates to service layer. */
export async function breederPuppiesGetHandler(c: Context) {
  return executebreederPuppiesGet(c);
}
