import type { Context } from 'hono';
import { executerelocationServicesGet } from '../services/relocation_services_get.service';

/** HTTP adapter — delegates to service layer. */
export async function relocationServicesGetHandler(c: Context) {
  return executerelocationServicesGet(c);
}
