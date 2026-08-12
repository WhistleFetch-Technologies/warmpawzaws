/**
 * ============================================================================
 * CUSTOMER PROFILE MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles customer profile management:
 * - Get customer profile (unified)
 * - Update customer profile
 * - Get customer preferences
 * - Update customer preferences
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import {
  handleCustomerAccountStatus,
  handleCustomerSetPassword,
  hasMeaningfulStoredPassword,
} from '../../password';
import { select, update, query, insert } from '../../../../database/rds-connection';
import { UpdateCustomerProfileRequestSchema } from '@warmpawz/api-contracts';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { resolveCustomerPhotoForDisplay as resolveCustomerPhotoForDisplayShared } from '../../../../services/image';
import { getCustomerByPhoneFromMicroservice } from '../../../../lib/services/customer-microservice-client';
import { geocodeAddress, geocodeIndiaPincode } from '../../../../lib/utils/geocode';

/** Re-export shared resolver — persist target remains customers.profile_photo_url. */
export const resolveCustomerPhotoForDisplay = resolveCustomerPhotoForDisplayShared;

/** Map DB row to API profile with camelCase address detail fields */
export function withProfileAddressFields(row: Record<string, any> | null | undefined) {
  if (!row) return row;
  return {
    ...row,
    houseNo: row.house_no ?? null,
    floor: row.floor ?? null,
  };
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function selectCanonicalCustomerRowsByLast10Digits(digits: string): Promise<any[]> {
  const last10 = normalizePhone(digits).slice(-10);
  if (!last10 || last10.length < 10) return [];
  const res = await query(
    `SELECT * FROM customers
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
     ORDER BY
       LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) ASC,
       (profile_completed IS TRUE) DESC,
       updated_at DESC NULLS LAST,
       created_at DESC NULLS LAST`,
    [last10]
  );
  return (res as any).rows || [];
}

/**
 * Combine house / flat fields from camelCase + snake_case.
 * Clients often send flat-only (`flatNo`) or duplicate empty `houseNo` with real value in `house_no`.
 */
export function mergeHouseNoFromPayload(raw: Record<string, any>): {
  hasHouseKey: boolean;
  merged: string | undefined;
} {
  if (raw == null || typeof raw !== 'object') {
    return { hasHouseKey: false, merged: undefined };
  }
  const hasHouseKey =
    'houseNo' in raw ||
    'house_no' in raw ||
    'flatNo' in raw ||
    'flat_no' in raw;
  const tc =
    raw?.houseNo === undefined || raw?.houseNo === null ? '' : String(raw.houseNo).trim();
  const ts =
    raw?.house_no === undefined || raw?.house_no === null ? '' : String(raw.house_no).trim();
  const tf =
    raw?.flatNo === undefined || raw?.flatNo === null ? '' : String(raw.flatNo).trim();
  const tf2 =
    raw?.flat_no === undefined || raw?.flat_no === null ? '' : String(raw.flat_no).trim();
  const mergedNonEmpty = tc || ts || tf || tf2;

  if (!hasHouseKey) {
    return { hasHouseKey: false, merged: mergedNonEmpty || undefined };
  }
  return { hasHouseKey: true, merged: mergedNonEmpty };
}

/** Fields from profile payload that imply we should sync `customer_addresses` (GET /customer/profile prefers default row pincode). */
type ProfileAddressSyncPayload = {
  pincode?: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: string | { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
};

export function deriveLatLngFromProfileData(profile: ProfileAddressSyncPayload): {
  latitude: number | null;
  longitude: number | null;
} {
  let latitude =
    profile.latitude != null && Number.isFinite(Number(profile.latitude))
      ? Number(profile.latitude)
      : null;
  let longitude =
    profile.longitude != null && Number.isFinite(Number(profile.longitude))
      ? Number(profile.longitude)
      : null;
  const c = profile.coordinates;
  if (c != null) {
    if (typeof c === 'string') {
      try {
        const o = JSON.parse(c) as Record<string, number>;
        if (latitude == null && typeof o.lat === 'number') latitude = o.lat;
        if (latitude == null && typeof o.latitude === 'number') latitude = o.latitude;
        if (longitude == null && typeof o.lng === 'number') longitude = o.lng;
        if (longitude == null && typeof o.longitude === 'number') longitude = o.longitude;
      } catch {
        /* ignore */
      }
    } else if (typeof c === 'object') {
      const o = c as Record<string, number>;
      if (latitude == null && typeof o.lat === 'number') latitude = o.lat;
      if (latitude == null && typeof o.latitude === 'number') latitude = o.latitude;
      if (longitude == null && typeof o.lng === 'number') longitude = o.lng;
      if (longitude == null && typeof o.longitude === 'number') longitude = o.longitude;
    }
  }
  return { latitude, longitude };
}

type SyncDefaultAddressOpts = {
  updateHouseNo?: boolean;
  houseNo?: string | null;
  updateFloor?: boolean;
  floor?: string | null;
};

export function extractAddressLine1FromCustomerRow(customerRow: Record<string, any>): string {
  const a = customerRow?.address;
  if (typeof a === 'string') return a.trim();
  if (a && typeof a === 'object') {
    return String(
      (a as { street?: string; addressLine1?: string; line1?: string }).street ||
        (a as { addressLine1?: string }).addressLine1 ||
        (a as { line1?: string }).line1 ||
        ''
    ).trim();
  }
  return '';
}

export function phoneDigitsForAddressRow(customerRow: Record<string, any>): string {
  const digits = normalizePhone(String(customerRow?.phone || ''));
  if (digits.length >= 10) return digits.slice(-10);
  const raw = String(customerRow?.phone || '').replace(/\D/g, '');
  if (raw.length >= 10) return raw.slice(-10);
  return raw.length > 0 ? raw : '0000000000';
}

/**
 * Keep default/first `customer_addresses` row aligned with `customers` after profile save,
 * so GET /customer/profile?phone= (pincode: defaultAddr?.pincode || customer.pincode) shows fresh data.
 */
export async function syncDefaultCustomerAddressFromProfile(
  customerId: string,
  profileAddressFields: ProfileAddressSyncPayload,
  customerRow: Record<string, any>,
  opts?: SyncDefaultAddressOpts
): Promise<void> {
  const shouldSync =
    profileAddressFields.pincode !== undefined ||
    profileAddressFields.address !== undefined ||
    profileAddressFields.city !== undefined ||
    profileAddressFields.state !== undefined ||
    profileAddressFields.latitude !== undefined ||
    profileAddressFields.longitude !== undefined ||
    profileAddressFields.coordinates !== undefined;
  if (!shouldSync) return;

  const pincode = String(customerRow?.pincode || '').trim();
  if (!/^\d{6}$/.test(pincode)) {
    console.warn('[PROFILE] skip customer_addresses sync: invalid pincode on customer row');
    return;
  }

  const line1 = extractAddressLine1FromCustomerRow(customerRow);
  const city = String(customerRow?.city || '').trim();
  const state = String(customerRow?.state || '').replace(/\s*\d{6}\s*$/, '').trim();

  const pickRes = await query(
    `SELECT id FROM customer_addresses
     WHERE customer_id = $1::uuid
     ORDER BY is_default DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [customerId]
  );
  const targetId = (pickRes as any).rows?.[0]?.id as string | undefined;

  if (targetId) {
    const setParts: string[] = ['pincode = $1', 'updated_at = NOW()'];
    const params: unknown[] = [pincode];
    let p = 2;

    if (profileAddressFields.city !== undefined) {
      setParts.push(`city = $${p++}`);
      params.push(city || '—');
    }
    if (profileAddressFields.state !== undefined) {
      setParts.push(`state = $${p++}`);
      params.push(state || '—');
    }
    if (profileAddressFields.address !== undefined) {
      setParts.push(`address_line1 = $${p++}`);
      params.push(line1 || '—');
    }
    if (opts?.updateHouseNo) {
      setParts.push(`house_no = $${p++}`);
      params.push(opts.houseNo ?? null);
    }
    if (opts?.updateFloor) {
      setParts.push(`floor = $${p++}`);
      params.push(opts.floor ?? null);
    }

    const rowLat = customerRow?.latitude != null ? Number(customerRow.latitude) : NaN;
    const rowLng = customerRow?.longitude != null ? Number(customerRow.longitude) : NaN;
    if (Number.isFinite(rowLat) && Number.isFinite(rowLng)) {
      setParts.push(`coordinates = $${p++}::jsonb`);
      params.push(JSON.stringify({ lat: rowLat, lng: rowLng }));
    }

    params.push(targetId);
    await query(
      `UPDATE customer_addresses SET ${setParts.join(', ')} WHERE id = $${p}::uuid`,
      params
    );
    return;
  }

  await query(
    `UPDATE customer_addresses SET is_default = false, updated_at = NOW()
     WHERE customer_id = $1::uuid AND is_default = true`,
    [customerId]
  );

  const fullName = String(customerRow?.full_name || 'Customer').trim() || 'Customer';
  const phone = phoneDigitsForAddressRow(customerRow);

  const insLat = customerRow?.latitude != null ? Number(customerRow.latitude) : NaN;
  const insLng = customerRow?.longitude != null ? Number(customerRow.longitude) : NaN;
  const insCoords =
    Number.isFinite(insLat) && Number.isFinite(insLng)
      ? JSON.stringify({ lat: insLat, lng: insLng })
      : null;

  await insert('customer_addresses', {
    customer_id: customerId,
    address_type: 'home',
    full_name: fullName,
    phone,
    address_line1: line1 || '—',
    city: city || '—',
    state: state || '—',
    pincode,
    coordinates: insCoords,
    is_default: true,
    house_no: opts?.updateHouseNo ? opts.houseNo ?? null : customerRow?.house_no ?? null,
    floor: opts?.updateFloor ? opts.floor ?? null : customerRow?.floor ?? null,
  });
}

export async function resolveCustomerId(identifier: string): Promise<string | null> {
  // Check if it's a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    const customers = await select('customers', { id: identifier });
    if (customers.length === 0) return null;
    const last10 = normalizePhone(String(customers[0].phone || '')).slice(-10);
    if (last10.length >= 10) {
      const canon = await selectCanonicalCustomerRowsByLast10Digits(last10);
      if (canon.length > 0) return canon[0].id;
    }
    return customers[0].id;
  }

  const rows = await selectCanonicalCustomerRowsByLast10Digits(identifier);
  return rows.length > 0 ? rows[0].id : null;
}

