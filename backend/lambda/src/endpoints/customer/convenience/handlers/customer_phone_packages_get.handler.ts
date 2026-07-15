import type { Context } from 'hono';
import { executecustomerPhonePackagesGet } from '../services/customer_phone_packages_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhonePackagesGetHandler(c: Context) {
  return executecustomerPhonePackagesGet(c);
}
