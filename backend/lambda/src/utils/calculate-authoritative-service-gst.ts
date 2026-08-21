/**
 * Backend-authoritative GST for service bookings (and package reuse via quotePackagePricing).
 *
 * GST-PROTECTED-CHANGE: calculate GST per selected service/package line before aggregation
 * GST-PROTECTED-INVARIANT: 0% lines stay 0%; 18% GST never leaks across service lines
 * GST-PROTECTED-TESTS: test:gst-financial
 */

import { query, select } from '../database/rds-connection';
import {
  classifyGstPlaceOfSupply,
  locationFromStoredFields,
  missingGstPlaceOfSupplyError,
  resolveGstStateKey,
} from '../lib/gst-place-of-supply';
import { taxCalculationService, type TaxItem } from '../lib/services/tax-calculation-service';
import type { CanonicalGstSnapshot, GstLocation } from './canonical-gst-snapshot';
import {
  allocateTaxableAcrossLines,
  aggregateGstLines,
  gstLinesFromEngineItems,
  type AuthoritativeGstLine,
  type AuthoritativeGstLineInput,
} from './gst-tax-lines';
import { resolveServiceBookingTaxItem } from './resolve-service-booking-tax-item';

export type { AuthoritativeGstLine, AuthoritativeGstLineInput };

export type AuthoritativeMultiServiceGst = CanonicalGstSnapshot & {
  gstLines: AuthoritativeGstLine[];
};

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

export async function calculateAuthoritativeMultiServiceGst(params: {
  lines: AuthoritativeGstLineInput[];
  postDiscountTaxable?: number;
  vendorId?: string | null;
  bookingId?: string | null;
  customerId?: string | null;
  addressId?: string | null;
  customerState?: string | null;
  customerCity?: string | null;
}): Promise<AuthoritativeMultiServiceGst> {
  const lineInputs = params.lines.length > 0
    ? params.lines
    : [{ listAmount: Math.max(0, Number(params.postDiscountTaxable) || 0) }];
  const listAmounts = lineInputs.map((line) => Math.max(0, Number(line.listAmount) || 0));
  const listSum = listAmounts.reduce((sum, n) => sum + n, 0);
  const postDiscount =
    params.postDiscountTaxable != null && Number.isFinite(Number(params.postDiscountTaxable))
      ? Math.max(0, Number(params.postDiscountTaxable) || 0)
      : listSum;
  const allocated = allocateTaxableAcrossLines(listAmounts, postDiscount);

  const vendor = await resolveVendorGstLocation(params.vendorId);
  const customerLocation = await resolveCustomerGstLocation({
    customerId: params.customerId,
    addressId: params.addressId,
    state: params.customerState,
    city: params.customerCity,
  });

  const taxItems: TaxItem[] = [];
  for (let i = 0; i < lineInputs.length; i += 1) {
    const line = lineInputs[i];
    const { taxItem, category } = await resolveServiceBookingTaxItem({
      serviceId: line.vendorServiceId || line.serviceId || undefined,
      vendorId: params.vendorId || undefined,
      bookingId: lineInputs.length === 1 ? params.bookingId || undefined : undefined,
      vendorRoleId: vendor.roleId,
      amount: allocated[i],
      quantity: 1,
      category: line.category || undefined,
      serviceStyle: line.serviceStyle || undefined,
      itemId:
        line.vendorServiceId ||
        line.serviceId ||
        `${params.bookingId || 'service-booking'}-${i}`,
    });
    if (!line.category && category) {
      line.category = category;
    }
    taxItems.push(taxItem);
  }

  const customerKey = resolveGstStateKey(customerLocation?.state, customerLocation?.city);
  const vendorKey = resolveGstStateKey(vendor.location?.state, vendor.location?.city);
  if (classifyGstPlaceOfSupply(customerKey, vendorKey) === 'unknown') {
    throw missingGstPlaceOfSupplyError();
  }

  const firstCategory = taxItems[0]?.category || lineInputs[0]?.category || undefined;
  const taxResult = await taxCalculationService.calculateTax({
    items: taxItems,
    customerLocation: customerLocation
      ? { state: customerLocation.state || customerLocation.city || '', city: customerLocation.city }
      : undefined,
    vendorLocation: vendor.location
      ? { state: vendor.location.state || vendor.location.city || '', city: vendor.location.city }
      : undefined,
    vendorId: params.vendorId || undefined,
    serviceType: firstCategory,
    category: firstCategory,
  });

  const gstLines = gstLinesFromEngineItems(taxResult.items, lineInputs);
  const aggregated = aggregateGstLines(gstLines, Boolean(taxResult.isInterstate));
  return {
    ...aggregated,
    gstLines,
  };
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
  return calculateAuthoritativeMultiServiceGst({
    vendorId: params.vendorId,
    bookingId: params.bookingId,
    customerId: params.customerId,
    addressId: params.addressId,
    customerState: params.customerState,
    customerCity: params.customerCity,
    postDiscountTaxable: taxable,
    lines: [
      {
        serviceId: params.serviceId,
        vendorServiceId: params.serviceId,
        listAmount: taxable,
        category: params.category,
        serviceStyle: params.serviceStyle,
      },
    ],
  });
}
