import type { Context } from 'hono';
import { executediscoveryCount } from '../services/discovery-count.service';

/** HTTP adapter — delegates to service layer. */
export async function discoveryCountHandler(c: Context) {
  return executediscoveryCount(c);
}
