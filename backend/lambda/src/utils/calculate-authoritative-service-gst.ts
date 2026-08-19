/**
 * Backend-authoritative GST for service bookings (and package reuse via quotePackagePricing).
 */

import { query, select } from '../database/rds-connection';
import {
  classifyGstPlaceOfSupply,
  locationFromStoredFields,
  missingGstPlaceOfSupplyError,
  resolveGstStateKey,
} from '../lib/gst-place-of-supply';
import { taxCalculationService } from '../lib/services/tax-calculation-service';
import {
  snapshotFromTaxResult,
  type CanonicalGstSnapshot,
  type GstLocation,
} from './canonical-gst-snapshot';
import { resolveServiceBookingTaxItem } from './resolve-service-booking-tax-item';

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
  return {
    location: locationFromStoredFields({
      state: row.state,
      city: row.city,
      address: row.address,
    }),
    roleId: row.role_id ? String(row.role_id) : undefined,
  };
}

export async function resolveCustomerGstLocation(params: {
  customerId?: string | null;
  addressId?: string | null;
  state?: string | null;
  city?: string | null;
}): Promise<GstLocation | undefined> {
  const explicit = locationFromStoredFields({ state: params.state, city: params.city });
  if (explicit) return explicit;
  const addressId = params.addressId ? String(params.addressId).trim() : '';
  if (addressId) {
    const r = await query(
      `SELECT state, city FROM customer_addresses WHERE id = $1::uuid LIMIT 1`,
      [addressId],
    ).catch(() => ({ rows: [] }));
    const row = r.rows?.[0] as { state?: string; city?: string } | undefined;
    const fromSelected = locationFromStoredFields({ state: row?.state, city: row?.city });
    if (fromSelected) return fromSelected;
  }
  const cid = params.customerId ? String(params.customerId).trim() : '';
  if (cid) {
    const def = await query(
      `SELECT state, city FROM customer_addresses
       WHERE customer_id = $1::uuid AND is_default = true LIMIT 1`,
      [cid],
    ).catch(() => ({ rows: [] }));
    const drow = def.rows?.[0] as { state?: string; city?: string } | undefined;
    const fromDefault = locationFromStoredFields({ state: drow?.state, city: drow?.city });
    if (fromDefault) return fromDefault;

    const customers = await select('customers', { id: cid }).catch(() => []);
    const profile = customers[0] as Record<string, unknown> | undefined;
    const fromProfile = locationFromStoredFields({
      state: profile?.state,
      city: profile?.city,
      address: profile?.address,
    });
    if (fromProfile) return fromProfile;
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

  const customerKey = resolveGstStateKey(customerLocation?.state, customerLocation?.city);
  const vendorKey = resolveGstStateKey(vendor.location?.state, vendor.location?.city);
  if (classifyGstPlaceOfSupply(customerKey, vendorKey) === 'unknown') {
    throw missingGstPlaceOfSupplyError();
  }

  const taxResult = await taxCalculationService.calculateTax({
    items: [taxItem],
    customerLocation: customerLocation
      ? { state: customerLocation.state || customerLocation.city || '', city: customerLocation.city }
      : undefined,
    vendorLocation: vendor.location
      ? { state: vendor.location.state || vendor.location.city || '', city: vendor.location.city }
      : undefined,
    vendorId: params.vendorId || undefined,
    serviceType: taxItem.category || params.category || undefined,
    category: taxItem.category || params.category || undefined,
  });

  return snapshotFromTaxResult(taxResult, taxable);
}
