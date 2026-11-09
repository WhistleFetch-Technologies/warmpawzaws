/**
 * Object-level authorization helpers for customer/vendor resources.
 * Prefer JWT-derived identity; never treat phone/path IDs as capability tokens alone.
 */
import type { Context } from 'hono';
import { query } from '../database/rds-connection';
import { resolveCustomerIdFromPhone } from './customer-coordinates';
import { resolveCustomerIdFromHonoContext } from './customer-id-from-auth';
import { resolveVendorId, resolveVendorIdsForLedger } from './vendor-resolve';

export type AuthzFail = { ok: false; status: 400 | 401 | 403 | 404; error: string };
export type AuthzCustomerOk = { ok: true; customerId: string };
export type AuthzVendorOk = { ok: true; vendorId: string; vendorIds: string[] };

export async function requireAuthenticatedCustomer(
  c: Context,
): Promise<AuthzCustomerOk | AuthzFail> {
  const customerId = await resolveCustomerIdFromHonoContext(c);
  if (!customerId) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  return { ok: true, customerId };
}

/**
 * Phone may be supplied for UX, but must resolve to the same customer as the JWT.
 */
export async function requireCustomerPhoneMatch(
  c: Context,
  phone: string,
): Promise<AuthzCustomerOk | AuthzFail> {
  const auth = await requireAuthenticatedCustomer(c);
  if (!auth.ok) return auth;

  const trimmed = String(phone || '').trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: 'Phone is required' };
  }

  const phoneCustomerId = await resolveCustomerIdFromPhone(trimmed);
  if (!phoneCustomerId) {
    return { ok: false, status: 404, error: 'Customer not found' };
  }
  if (phoneCustomerId !== auth.customerId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, customerId: auth.customerId };
}

/**
 * Path/query customerId may be UUID or phone; must match JWT customer.
 */
export async function requireCustomerIdentifierMatch(
  c: Context,
  rawIdentifier: string,
): Promise<AuthzCustomerOk | AuthzFail> {
  const auth = await requireAuthenticatedCustomer(c);
  if (!auth.ok) return auth;

  const raw = String(rawIdentifier || '').trim();
  if (!raw) {
    return { ok: false, status: 400, error: 'Customer id is required' };
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let resolved = raw;
  if (!uuidRe.test(raw)) {
    const byPhone = await resolveCustomerIdFromPhone(raw);
    if (!byPhone) {
      return { ok: false, status: 404, error: 'Customer not found' };
    }
    resolved = byPhone;
  }

  if (resolved.toLowerCase() !== auth.customerId.toLowerCase()) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, customerId: auth.customerId };
}

export async function assertBookingOwnedByCustomer(
  bookingId: string,
  customerId: string,
): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM bookings WHERE id = $1::uuid AND customer_id = $2::uuid LIMIT 1`,
    [bookingId, customerId],
  );
  return (result.rows?.length ?? 0) > 0;
}

export async function requireBookingOwnedByAuthCustomer(
  c: Context,
  bookingId: string,
): Promise<AuthzCustomerOk | AuthzFail> {
  const auth = await requireAuthenticatedCustomer(c);
  if (!auth.ok) return auth;
  const id = String(bookingId || '').trim();
  if (!id) {
    return { ok: false, status: 400, error: 'Booking ID is required' };
  }
  const owned = await assertBookingOwnedByCustomer(id, auth.customerId);
  if (!owned) {
    return { ok: false, status: 404, error: 'Booking not found' };
  }
  return auth;
}

export async function assertPetOwnedByCustomer(
  petId: string,
  customerId: string,
): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM pets WHERE id = $1::uuid AND customer_id = $2::uuid LIMIT 1`,
    [petId, customerId],
  );
  return (result.rows?.length ?? 0) > 0;
}

export async function requirePetOwnedByAuthCustomer(
  c: Context,
  petId: string,
): Promise<AuthzCustomerOk | AuthzFail> {
  const auth = await requireAuthenticatedCustomer(c);
  if (!auth.ok) return auth;
  const id = String(petId || '').trim();
  if (!id) {
    return { ok: false, status: 400, error: 'Pet ID is required' };
  }
  const owned = await assertPetOwnedByCustomer(id, auth.customerId);
  if (!owned) {
    return { ok: false, status: 404, error: 'Pet not found' };
  }
  return auth;
}

/**
 * Path vendorId must resolve to the same vendor identity as the JWT subject.
 * Rejects customer JWTs.
 */
export async function requirePathVendorMatchesAuth(
  c: Context,
  pathVendorId: string,
): Promise<AuthzVendorOk | AuthzFail> {
  const role = String(c.get('userRole') || '');
  const groups = (c.get('userGroups') as string[] | undefined) || [];
  const isVendor =
    role === 'vendor' || role === 'staff' || groups.includes('vendor') || groups.includes('staff');
  if (!isVendor) {
    return { ok: false, status: 403, error: 'Vendor access required' };
  }

  const authUserId = String(c.get('userId') || '').trim();
  if (!authUserId) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const param = String(pathVendorId || '').trim();
  if (!param) {
    return { ok: false, status: 400, error: 'Vendor ID is required' };
  }

  const pathResolved = await resolveVendorId(param);
  const authResolved = await resolveVendorId(authUserId);
  let pathIds = await resolveVendorIdsForLedger(param).catch(() => [] as string[]);
  let authIds = await resolveVendorIdsForLedger(authUserId).catch(() => [] as string[]);
  if (pathIds.length === 0) pathIds = [pathResolved];
  if (authIds.length === 0) authIds = [authResolved];

  const allowed = new Set(authIds.map((id) => id.toLowerCase()));
  const pathOk = pathIds.some((id) => allowed.has(String(id).toLowerCase()));
  if (!pathOk && pathResolved.toLowerCase() !== authResolved.toLowerCase()) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, vendorId: pathResolved, vendorIds: pathIds };
}

/** Strip sensitive customer columns before API responses. */
export function projectPublicCustomer(row: Record<string, unknown> | null | undefined) {
  if (!row) return row;
  const {
    password_hash: _ph,
    passwordHash: _pH,
    password: _p,
    ...safe
  } = row;
  return safe;
}
