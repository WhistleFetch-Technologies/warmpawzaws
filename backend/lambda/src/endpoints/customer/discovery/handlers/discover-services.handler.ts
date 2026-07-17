import type { Context } from 'hono';
import { executediscoverServices } from '../services/discover-services.service';

/** HTTP adapter — delegates to service layer. */
export async function discoverServicesHandler(c: Context) {
  return executediscoverServices(c);
}
