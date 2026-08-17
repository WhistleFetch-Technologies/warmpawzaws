/**
 * Backend-authoritative GST for service bookings (and package reuse via quotePackagePricing).
 */

import { query, select } from '../database/rds-connection';
import { taxCalculationService } from '../lib/services/tax-calculation-service';
import {
  snapshotFromTaxResult,
  type CanonicalGstSnapshot,
  type GstLocation,
} from './canonical-gst-snapshot';
import { resolveServiceBookingTaxItem } from './resolve-service-booking-tax-item';

function parseJsonStateCity(raw: unknown): GstLocation | undefined {
  if (raw == null || raw === '') return undefined;
  try {
    let addr: Record<string, unknown> | null = null;
    if (typeof raw === 'string') {
      if (raw.startsWith('{') || raw.startsWith('[')) addr = JSON.parse(raw) as Record<string, unknown>;
      else return undefined;
    } else if (typeof raw === 'object' && !Array.isArray(raw)) {
      addr = raw as Record<string, unknown>;
    }
    if (!addr?.state && !addr?.city) return undefined;
    return {
      state: addr.state != null ? String(addr.state) : undefined,
      city: addr.city != null ? String(addr.city) : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function resolveVendorGstLocation(vendorId: string | null | undefined): Promise<{
  location?: GstLocation;
  roleId?: string;
}> {
  const vid = String(vendorId || '').trim();
  if (!vid) return {};
  const r = await query(
    `SELECT state, city, address, role_id::text AS role_id FROM vendors WHERE id = $1::uuid LIMIT 1`,
    [vid],
  ).catch(() => ({ rows: [] }));
  const row = r.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return {};
  const st = row.state != null ? String(row.state).trim() : '';
  if (st) {
    return {
      location: { state: st, city: row.city != null ? String(row.city) : undefined },
      roleId: row.role_id ? String(row.role_id) : undefined,
    };
  }
  return {
    location: parseJsonStateCity(row.address),
    roleId: row.role_id ? String(row.role_id) : undefined,
  };
}

export async function resolveCustomerGstLocation(params: {
  customerId?: string | null;
  addressId?: string | null;
  state?: string | null;
  city?: string | null;
}): Promise<GstLocation | undefined> {
  if (params.state && String(params.state).trim()) {
    return { state: String(params.state).trim(), city: params.city ? String(params.city).trim() : undefined };
  }
  const addressId = params.addressId ? String(params.addressId).trim() : '';
  if (addressId) {
    const r = await query(
      `SELECT state, city FROM customer_addresses WHERE id = $1::uuid LIMIT 1`,
      [addressId],
    ).catch(() => ({ rows: [] }));
    const row = r.rows?.[0] as { state?: string; city?: string } | undefined;
    if (row?.state) return { state: String(row.state), city: row.city != null ? String(row.city) : undefined };
  }
  const cid = params.customerId ? String(params.customerId).trim() : '';
  if (cid) {
    const def = await query(
      `SELECT state, city FROM customer_addresses
       WHERE customer_id = $1::uuid AND is_default = true LIMIT 1`,
      [cid],
    ).catch(() => ({ rows: [] }));
    const drow = def.rows?.[0] as { state?: string; city?: string } | undefined;
    if (drow?.state) return { state: String(drow.state), city: drow.city != null ? String(drow.city) : undefined };

    const customers = await select('customers', { id: cid }).catch(() => []);
    const fromProfile = parseJsonStateCity(customers[0]?.address);
    if (fromProfile?.state) return fromProfile;
    if (customers[0]?.state) {
      return {
        state: String(customers[0].state),
        city: customers[0].city != null ? String(customers[0].city) : undefined,
      };
    }
  }
  return undefined;
}

export async function calculateAuthoritativeServiceGst(params: {
  taxableAmount: number;
  vendorId?: string | null;
  serviceId?: string | null;
  bookingId?: string | null;
  customerId?: string | null;
  addressId?: string | null;
  customerState?: string | null;
  customerCity?: string | null;
  serviceStyle?: string | null;
  category?: string | null;
}): Promise<CanonicalGstSnapshot> {
  const taxable = Math.max(0, Number(params.taxableAmount) || 0);
  const vendor = await resolveVendorGstLocation(params.vendorId);
  const customerLocation = await resolveCustomerGstLocation({
    customerId: params.customerId,
    addressId: params.addressId,
    state: params.customerState,
    city: params.customerCity,
  });

  const { taxItem } = await resolveServiceBookingTaxItem({
    serviceId: params.serviceId || undefined,
    vendorId: params.vendorId || undefined,
    bookingId: params.bookingId || undefined,
    vendorRoleId: vendor.roleId,
    amount: taxable,
    quantity: 1,
    category: params.category || undefined,
    serviceStyle: params.serviceStyle || undefined,
    itemId: params.serviceId || params.bookingId || 'service-booking',
  });

  const taxResult = await taxCalculationService.calculateTax({
    items: [taxItem],
    customerLocation: customerLocation?.state
      ? { state: customerLocation.state, city: customerLocation.city }
      : undefined,
    vendorLocation: vendor.location?.state
      ? { state: vendor.location.state, city: vendor.location.city }
      : undefined,
    vendorId: params.vendorId || undefined,
    serviceType: taxItem.category || params.category || undefined,
    category: taxItem.category || params.category || undefined,
  });

  return snapshotFromTaxResult(taxResult, taxable);
}
