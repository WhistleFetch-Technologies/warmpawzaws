import type { Context } from 'hono';
import { resolveCustomerIdFromHonoContext } from '../../../utils/customer-id-from-auth';
import { resolveVendorId } from '../../../utils/vendor-resolve';
import { isValidUUID } from '../../../types/entities';
import { dbHasVendorEventsCapability } from '../repos/event-payments.repo';

export async function executeResolveCustomerId(c: Context): Promise<string | null> {
  return resolveCustomerIdFromHonoContext(c);
}

export async function executeResolveVendorId(c: Context): Promise<string | null> {
  const userId = String(c.get('userId') || '').trim();
  if (!userId || !isValidUUID(userId)) return null;
  const resolved = await resolveVendorId(userId);
  return resolved && isValidUUID(resolved) ? resolved : null;
}

export function executeResolveAdminId(c: Context): string | null {
  const userId = String(c.get('userId') || '').trim();
  const role = String(c.get('userRole') || '').toLowerCase();
  if (role !== 'admin' || !userId) return null;
  return userId;
}

export async function executeRequireVendorEvents(c: Context): Promise<
  { ok: true; vendorId: string } | { ok: false; status: 401 | 403; error: string }
> {
  const vendorId = await executeResolveVendorId(c);
  if (!vendorId) return { ok: false, status: 401, error: 'Vendor authentication required' };
  const capable = await dbHasVendorEventsCapability(vendorId);
  if (!capable) return { ok: false, status: 403, error: 'Vendor does not have events management capability' };
  return { ok: true, vendorId };
}
