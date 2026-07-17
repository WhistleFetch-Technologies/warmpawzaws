import type { Context } from 'hono';
import { executeradarProviders } from '../services/radar-providers.service';

/** HTTP adapter — delegates to service layer. */
export async function radarProvidersHandler(c: Context) {
  return executeradarProviders(c);
}
