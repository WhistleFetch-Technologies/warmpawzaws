import type { Context } from 'hono';
import { executeDiscoveryByCategoryGet } from '../services/discovery_by_category_get.service';

export async function discoveryByCategoryGetHandler(c: Context) {
  return executeDiscoveryByCategoryGet(c);
}
