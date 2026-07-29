import type { Context } from 'hono';
import { executeDiscoveryByStyleGet } from '../services/discovery_by_style_get.service';

/** HTTP adapter — delegates to service layer. */
export async function discoveryByStyleGetHandler(c: Context) {
  return executeDiscoveryByStyleGet(c);
}
