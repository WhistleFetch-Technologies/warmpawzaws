import type { Context } from 'hono';
import { executecustomerServices } from '../services/customer-services.service';

/** HTTP adapter — delegates to service layer. */
export async function customerServicesHandler(c: Context) {
  return executecustomerServices(c);
}
