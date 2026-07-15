import type { Context } from 'hono';
import { executecustomerHolidaypackagesGet } from '../services/customer_holidaypackages_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerHolidaypackagesGetHandler(c: Context) {
  return executecustomerHolidaypackagesGet(c);
}
