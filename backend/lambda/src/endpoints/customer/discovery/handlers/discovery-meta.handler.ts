import type { Context } from 'hono';
import { executediscoveryMeta } from '../services/discovery-meta.service';

/** HTTP adapter — delegates to service layer. */
export async function discoveryMetaHandler(c: Context) {
  return executediscoveryMeta(c);
}
