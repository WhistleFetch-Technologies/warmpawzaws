import type { Context } from 'hono';
import { executevendorAvailableSlots } from '../services/vendor-available-slots.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorAvailableSlotsHandler(c: Context) {
  return executevendorAvailableSlots(c);
}
