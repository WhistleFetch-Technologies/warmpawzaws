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
} from './customer-password';
import { select, update, query, insert } from '../../../database/rds-connection';
import { UpdateCustomerProfileRequestSchema } from '@warmpawz/api-contracts';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from '../../../utils/s3-media-presign';
import { regeneratePresignedUrl } from '../../constants/helper';
import { getCustomerByPhoneFromMicroservice } from '../../../lib/services/customer-microservice-client';
/**
 * DB may store bare S3 keys, unsigned HTTPS object URLs, or expired presigned URLs.
 * presignS3GetUrlIfApplicable returns any string that already contains X-Amz-* unchanged,
 * so stale presigned URLs never refresh and the customer app shows a broken profile image.
 */
async function resolveCustomerPhotoForDisplay(raw: string | null | undefined): Promise<string | null> {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('data:')) return s;

  const stripped = stripS3PresignQueryFromUrl(s);

  if (!stripped.includes('://')) {
    const signed = await regeneratePresignedUrl(stripped);
    return signed || stripped;
  }

  const presigned = await presignS3GetUrlIfApplicable(stripped);
  if (presigned && presigned !== stripped) {
    return presigned;
  }
  const regen = await regeneratePresignedUrl(stripped);
  return regen || presigned || stripped;
}

/** Map DB row to API profile with camelCase address detail fields */
function withProfileAddressFields(row: Record<string, any> | null | undefined) {
  if (!row) return row;
  return {
    ...row,
    houseNo: row.house_no ?? null,
    floor: row.floor ?? null,
  };
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function selectCanonicalCustomerRowsByLast10Digits(digits: string): Promise<any[]> {
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
function mergeHouseNoFromPayload(raw: Record<string, any>): {
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

function deriveLatLngFromProfileData(profile: ProfileAddressSyncPayload): {
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

function extractAddressLine1FromCustomerRow(customerRow: Record<string, any>): string {
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

function phoneDigitsForAddressRow(customerRow: Record<string, any>): string {
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
async function syncDefaultCustomerAddressFromProfile(
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
  const state = String(customerRow?.state || '').trim();

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
      setParts.push(`latitude = $${p++}`);
      params.push(rowLat);
      setParts.push(`longitude = $${p++}`);
      params.push(rowLng);
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
    latitude: Number.isFinite(insLat) ? insLat : null,
    longitude: Number.isFinite(insLng) ? insLng : null,
    is_default: true,
    house_no: opts?.updateHouseNo ? opts.houseNo ?? null : customerRow?.house_no ?? null,
    floor: opts?.updateFloor ? opts.floor ?? null : customerRow?.floor ?? null,
  });
}

async function resolveCustomerId(identifier: string): Promise<string | null> {
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

export function registerCustomerProfileEndpoints(app: Hono) {
  // Literal password routes MUST be registered before GET /customer/profile/:identifier or "password-status"
  // is treated as a profile identifier and returns 404 "Customer not found".
  app.get('/customer/profile/password-status', handleCustomerAccountStatus);
  app.post('/customer/profile/set-password', handleCustomerSetPassword);
  app.get('/customer/account/status', handleCustomerAccountStatus);
  app.post('/customer/account/password', handleCustomerSetPassword);

  /**
   * GET /customer/profile/unified/:identifier
   * Get unified customer profile with wallet, addresses, bookings, orders
   */
  app.get("/customer/profile/unified/:identifier", async (c) => {
    try {
      const identifier = c.req.param('identifier');
      console.log('[profile/unified] Request received for identifier:', identifier);

      if (!identifier) {
        console.error('[profile/unified] No identifier provided');
        return c.json({ error: 'Identifier is required' }, 400);
      }

      // Resolve identifier (phone or customer ID)
      let customerId: string | null;
      try {
        console.log('[profile/unified] Resolving customer ID for:', identifier);
        customerId = await resolveCustomerId(identifier);
        console.log('[profile/unified] Resolved customer ID:', customerId);
      } catch (error: any) {
        console.error('[profile/unified] Error resolving customer ID:', error);
        console.error('[profile/unified] Error stack:', error?.stack);
        return c.json({ success: true, profile: null, _degraded: true, error: error?.message }, 200);
      }

      if (!customerId) {
        console.log('[profile/unified] Customer not found for identifier:', identifier);
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Get customer
      let customers: any[];
      try {
        customers = await select('customers', { id: customerId });
      } catch (error: any) {
        console.error('[profile/unified] Error fetching customer:', error);
        return c.json({ success: true, profile: null, _degraded: true }, 200);
      }

      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Fetch Wallet with better error handling
      let wallet: any = { balance: 0, currency: 'INR', status: 'active' };
      try {
        const wallets = await query(
          'SELECT * FROM customer_wallets WHERE customer_id = $1',
          [customerId]
        );
        if (wallets.rows && wallets.rows.length > 0) {
          wallet = wallets.rows[0];
        }
      } catch (error: any) {
        console.warn('Error fetching wallet (using defaults):', error.message);
        // Continue with default wallet
      }

      // Fetch Addresses with better error handling
      let addresses: any = { rows: [] };
      try {
        addresses = await query(
          'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
          [customerId]
        );
      } catch (error: any) {
        console.warn('Error fetching addresses (using empty):', error.message);
        // Continue with empty addresses
      }

      // Fetch Pets with better error handling
      let pets: any = { rows: [] };
      try {
        pets = await query(
          'SELECT id, name, species, breed, age_years, age_months, gender, weight_kg, profile_photo_url, medical_history, created_at FROM pets WHERE customer_id = $1 ORDER BY created_at ASC',
          [customerId]
        );
      } catch (error: any) {
        console.warn('Error fetching pets (using empty):', error.message);
      }

      // Fetch Bookings with better error handling
      let bookings: any = { rows: [] };
      try {
        bookings = await query(
          'SELECT * FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
          [customerId]
        );
      } catch (error: any) {
        console.warn('Error fetching bookings (using empty):', error.message);
        // Continue with empty bookings
      }

      // Fetch Orders with better error handling
      let orders: any = { rows: [] };
      try {
        orders = await query(
          'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
          [customerId]
        );
      } catch (error: any) {
        console.warn('Error fetching orders (using empty):', error.message);
        // Continue with empty orders
      }

      // Calculate stats safely
      const bookingsRows = bookings.rows || [];
      const ordersRows = orders.rows || [];
      const stats = {
        totalBookings: bookingsRows.length,
        activeBookings: bookingsRows.filter((b: any) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length,
        totalEcommerceOrders: ordersRows.length,
        walletBalance: parseFloat(wallet.balance || '0'),
      };

      // Get customer state (onboarding_status, profile_completed)
      let onboardingStatus = customer.onboarding_status || 'INIT';
      let profileCompleted = customer.profile_completed || false;
      const customerStatus = customer.status || 'new';

      // Existing-user fix: treat users with profile/usage as COMPLETED so they are not sent to onboarding again
      const hasName = !!(customer.full_name && String(customer.full_name).trim() && customer.full_name !== `Customer ${(customer.phone || '').slice(-4)}`);
      const hasBookings = (bookingsRows?.length || 0) > 0;
      const hasOrders = (ordersRows?.length || 0) > 0;
      if (onboardingStatus !== 'COMPLETED' && (profileCompleted || hasName)) {
        const effectivelyOnboarded = profileCompleted || hasBookings || hasOrders || hasName;
        if (effectivelyOnboarded) {
          onboardingStatus = 'COMPLETED';
          profileCompleted = true;
          // Persist so we don't infer every time
          try {
            await update('customers', { id: customerId }, { onboarding_status: 'COMPLETED', profile_completed: true });
          } catch (e) {
            // Non-fatal
          }
        }
      }

      console.log('[profile/unified] Successfully fetched profile for customer:', customerId);
      const hasPassword = hasMeaningfulStoredPassword(customer.password_hash);
      const petsRows = (pets.rows || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.species,
        species: p.species,
        breed: p.breed || '',
        age: p.age_years != null ? String(p.age_years) : (p.age_months != null ? String(p.age_months) : ''),
        ageUnit: p.age_years != null ? 'years' : 'months',
        gender: p.gender || '',
        weight: p.weight_kg != null ? String(p.weight_kg) : '',
        photo: p.profile_photo_url || '',
        profile_photo_url: p.profile_photo_url || '',
        medicalHistory: p.medical_history || '',
      }));
      return c.json({
        success: true,
        profile: {
          id: customer.id,
          name: customer.full_name,
          full_name: customer.full_name,
          firstName: (customer.full_name || '').split(' ')[0] || '',
          lastName: (customer.full_name || '').split(' ').slice(1).join(' ') || '',
          email: customer.email,
          phone: customer.phone,
          username: customer.username || null,
          has_password: hasPassword,
          needs_password_setup: !hasPassword,
          status: customerStatus,
          onboarding_status: onboardingStatus,
          profile_completed: profileCompleted,
          onboardingComplete: onboardingStatus === 'COMPLETED',
          profile_photo_url: customer.profile_photo_url || null,
          photo: customer.profile_photo_url || null,
          address: customer.address || null,
          city: customer.city || null,
          state: customer.state || null,
          pincode: customer.pincode || null,
          house_no: customer.house_no || null,
          houseNo: customer.house_no || null,
          floor: customer.floor || null,
          wallet: {
            balance: parseFloat(wallet.balance || '0'),
            currency: wallet.currency || 'INR',
            status: wallet.status || 'active',
          },
          addresses: (addresses.rows || []).map((addr: any) => ({
            id: addr.id,
            label: addr.address_type,
            name: addr.full_name,
            phone: addr.phone,
            addressLine1: addr.address_line1,
            addressLine2: addr.address_line2,
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            landmark: addr.landmark,
            isDefault: addr.is_default,
          })),
          pets: petsRows,
          orders: {
            all: ordersRows,
            total: ordersRows.length,
          },
          bookings: bookingsRows,
          stats,
        },
      });
    } catch (error: any) {
      console.error('[profile/unified] Error fetching unified customer profile:', error);
      console.error('[profile/unified] Error message:', error?.message);
      console.error('[profile/unified] Error stack:', error?.stack);
      console.error('[profile/unified] Error name:', error?.name);
      // Return 200 with degraded response instead of 500
      return c.json({
        success: true,
        profile: null,
        _degraded: true,
        error: error?.message || 'Unknown error'
      }, 200);
    }
  });

  /**
   * GET /customer/profile (query string phone)
   * IMPORTANT: Must be registered BEFORE /customer/profile/:identifier
   * Alias for getting profile with phone as query param
   */
  app.get("/customer/profile", async (c) => {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'Phone number is required as query param' }, 400);
      }

      const cleanPhone = normalizePhone(phone);
      let customers: any[];
      try {
        const customerId = await resolveCustomerId(cleanPhone);
        if (!customerId) {
          return c.json({ error: 'Customer not found' }, 404);
        }
        customers = await select('customers', { id: customerId });
        if (customers.length === 0) return c.json({ error: 'Customer not found' }, 404);

        // Get addresses for this customer
        const addressesResult = await query(
          `SELECT 
      id,
      address_type as label,
      full_name as name,
      phone,
      address_line1 as "addressLine1",
      address_line2 as "addressLine2",
      city,
      state,
      pincode,
      landmark,
      coordinates,
      flat_no as "flatNo",
      house_no as "houseNo",
      floor,
      street_name as "streetName",
      apartment_name as "apartmentName",
      is_default as "isDefault",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM customer_addresses
    WHERE customer_id = $1
    ORDER BY is_default DESC, created_at DESC`,
          [customers[0].id]
        );

        customers[0].addresses = addressesResult.rows;
      } catch (error: any) {
        console.error('[profile] Error fetching customer by phone:', error);
        return c.json({ success: true, profile: null, _degraded: true }, 200);
      }

      const customer = customers[0];
      const defaultAddr = customer.addresses?.[0] || null;

      // Profile edits persist to `customers`; GET used to prefer `customer_addresses` first,
      // so a stale default row hid the updated pincode. Prefer customer row, then saved address.
      const custPin = String(customer.pincode ?? '').trim();
      const addrPin = String(defaultAddr?.pincode ?? '').trim();
      const profilePincode = custPin || addrPin || null;
      const custCity = String(customer.city ?? '').trim();
      const addrCity = defaultAddr?.city != null ? String(defaultAddr.city).trim() : '';
      const profileCity = custCity || addrCity || null;
      const custState = String(customer.state ?? '').trim();
      const addrState = defaultAddr?.state != null ? String(defaultAddr.state).trim() : '';
      const profileState = custState || addrState || null;

      const fullName = (customer.full_name || '').trim();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const addressText =
        typeof customer.address === 'string'
          ? customer.address
          : (customer.address && (customer.address as any).street) || '';

      const profilePhoto = await resolveCustomerPhotoForDisplay(customer.profile_photo_url);

      // Get pets for this customer with error handling
      let pets: any[] = [];
      try {
        pets = await select('pets', { customer_id: customer.id });
      } catch (error: any) {
        console.warn('Error fetching pets (using empty):', error.message);
        // Continue with empty pets array
      }

      const petsOut = await Promise.all(
        pets.map(async (p: any) => {
          const rawPhoto = p.profile_photo_url;
          const signed = (await resolveCustomerPhotoForDisplay(rawPhoto)) || rawPhoto;
          return {
            id: p.id,
            name: p.name,
            type: p.species,
            breed: p.breed,
            age: p.age_years,
            gender: p.gender,
            photo: signed,
            image: signed,
            profile_photo_url: signed,
          };
        })
      );

      return c.json({
        success: true,
        profile: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          firstName,
          lastName,
          email: customer.email,
          address: addressText || customer.address,
          pincode: profilePincode,
          city: profileCity,
          state: profileState,
          houseNo: customer.house_no ?? null,
          floor: customer.floor ?? null,
          photo: profilePhoto,
          profile_photo_url: profilePhoto,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          createdAt: customer.created_at,
          pets: petsOut,
        }
      });
    } catch (error: any) {
      console.error('[profile] Error fetching customer profile by query:', error);
      console.error('[profile] Error stack:', error?.stack);

      // Return 200 with degraded so customer home loads (non-critical for query param profile)
      return c.json({ success: true, profile: null, _degraded: true });
    }
  });

  /**
   * GET /customer/profile/:identifier
   * Get customer profile (basic)
   *
   * NOTE: Hono may match this param route before the literal GET /customer/profile/password-status
   * registered in registerCustomerPasswordEndpoints. Treat reserved segments here so password-status
   * never returns a spurious "Customer not found" 404.
   */
  app.get("/customer/profile/:identifier", async (c) => {
    try {
      const { identifier } = c.req.param();
      if (identifier === 'password-status') {
        return handleCustomerAccountStatus(c);
      }

      const customerId = await resolveCustomerId(identifier);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Map backend fields to UI fields
      const nameParts = (customer.full_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const photoUrl = await resolveCustomerPhotoForDisplay(customer.profile_photo_url);

      // Extract address fields from JSONB (if address is stored as JSONB)
      // Otherwise use address as text
      let addressData: any = {};
      if (typeof customer.address === 'string') {
        // Address is stored as text, use it directly
        addressData = { street: customer.address };
      } else if (customer.address) {
        addressData = customer.address;
      }

      return c.json({
        success: true,
        profile: {
          firstName,
          lastName,
          email: customer.email || '',
          phone: customer.phone || identifier,
          address: addressData.street || '',
          pincode: (customer as any).pincode || addressData.pincode || '',
          city: (customer as any).city || '',
          state: (customer as any).state || '',
          houseNo: (customer as any).house_no ?? null,
          floor: (customer as any).floor ?? null,
          photo: photoUrl || '',
          profile_photo_url: photoUrl || '',
        },
      });
    } catch (error: any) {
      console.error('Error fetching customer profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/profile
   * Create or update customer profile (for frontend compatibility)
   * This endpoint accepts phone in body and creates/updates profile
   */
  app.post("/customer/profile", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));

      // Handle nested profile structure from frontend
      // Frontend sends: { phone, profile: { firstName, lastName, ... }, journeyType }
      // Backend expects: { firstName, lastName, ... }
      const rawProfilePayload = body.profile || body;
      const { hasHouseKey: hasHouseNoField, merged: mergedHouseNo } = mergeHouseNoFromPayload(
        rawProfilePayload as Record<string, any>
      );
      const hasFloorField =
        typeof rawProfilePayload === 'object' && rawProfilePayload !== null && 'floor' in rawProfilePayload;

      // Clean the payload - remove empty strings for optional URL fields (photo)
      // and remove extra fields (phone) that aren't in the schema
      const profilePayload: Record<string, any> = {};
      if (rawProfilePayload.firstName) profilePayload.firstName = rawProfilePayload.firstName;
      if (rawProfilePayload.lastName) profilePayload.lastName = rawProfilePayload.lastName;
      if (rawProfilePayload.email) profilePayload.email = rawProfilePayload.email;
      if (rawProfilePayload.address) profilePayload.address = rawProfilePayload.address;
      if (rawProfilePayload.pincode !== undefined && rawProfilePayload.pincode !== null) {
        profilePayload.pincode = String(rawProfilePayload.pincode).trim();
      }
      if (rawProfilePayload.city) profilePayload.city = rawProfilePayload.city;
      if (rawProfilePayload.state) profilePayload.state = rawProfilePayload.state;
      if (hasHouseNoField) {
        profilePayload.houseNo = mergedHouseNo ?? '';
      } else if (mergedHouseNo) {
        profilePayload.houseNo = mergedHouseNo;
      }
      if (rawProfilePayload.floor !== undefined && rawProfilePayload.floor !== null) {
        profilePayload.floor =
          typeof rawProfilePayload.floor === 'string' ? rawProfilePayload.floor : String(rawProfilePayload.floor);
      }
      if (rawProfilePayload.photo && rawProfilePayload.photo.startsWith('http')) {
        profilePayload.photo = rawProfilePayload.photo;
      }
      if (rawProfilePayload.latitude !== undefined) {
        profilePayload.latitude = rawProfilePayload.latitude;
      }
      if (rawProfilePayload.longitude !== undefined) {
        profilePayload.longitude = rawProfilePayload.longitude;
      }
      if (rawProfilePayload.coordinates !== undefined) {
        profilePayload.coordinates = rawProfilePayload.coordinates;
      }

      const hasGeoPayload =
        rawProfilePayload != null &&
        typeof rawProfilePayload === 'object' &&
        ('latitude' in rawProfilePayload ||
          'longitude' in rawProfilePayload ||
          'coordinates' in rawProfilePayload);

      console.log('[PROFILE] Cleaned payload:', profilePayload);

      // Validate request with Zod schema
      const validationResult = UpdateCustomerProfileRequestSchema.safeParse(profilePayload);
      if (!validationResult.success) {
        console.error('[PROFILE] Validation failed:', validationResult.error.errors);
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              errors: validationResult.error.errors,
            },
          },
        }, 400);
      }

      const profileData = validationResult.data;

      // ✅ Validate email format (RFC-compliant)
      if (profileData.email) {
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
        if (!emailRegex.test(profileData.email.trim())) {
          return c.json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid email format',
              details: {
                field: 'email',
                message: 'Please enter a valid email address',
              },
            },
          }, 400);
        }
      }

      const addrPresentPost = !!(profileData.address && String(profileData.address).trim());
      const effectiveHousePost = String(mergedHouseNo ?? profileData.houseNo ?? '').trim();
      if (addrPresentPost && hasHouseNoField && !effectiveHousePost) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'House / flat number is required',
            details: { field: 'houseNo', message: 'Please enter your house or flat number' },
          },
        }, 400);
      }

      // Get phone from body (required for POST endpoint)
      // Note: phone is not part of the validated schema, it comes from body directly
      const phone = body.phone || (body.profile as any)?.phone;
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      const cleanPhone = normalizePhone(phone);

      // ✅ Validate phone number - must be exactly 10 digits
      if (cleanPhone.length !== 10 || !/^\d{10}$/.test(cleanPhone)) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid phone number',
            details: {
              field: 'phone',
              message: 'Phone number must be exactly 10 digits',
            },
          },
        }, 400);
      }

      let customerId = await resolveCustomerId(cleanPhone);

      if (!customerId) {
        const lateRows = await selectCanonicalCustomerRowsByLast10Digits(cleanPhone);
        if (lateRows.length > 0) customerId = lateRows[0].id;
      }

      if (!customerId) {
        // Customer doesn't exist - create it (for UAT mode or when OTP verification didn't create customer)
        try {
          // Create customer identity first (same pattern as OTP verification)
          const { createOrUpdateCustomerIdentity } = await import('../../../utils/customer-state');
          const identityId = await createOrUpdateCustomerIdentity(cleanPhone, undefined);

          // Create customer record with all required fields (matching OTP verification pattern)
          const fullName = profileData.firstName && profileData.lastName
            ? `${profileData.firstName} ${profileData.lastName}`.trim()
            : `Customer ${cleanPhone.slice(-4)}`;

          const newCustomer = await insert('customers', {
            phone: cleanPhone,
            full_name: fullName,
            email: profileData.email || null,
            is_active: true,
            status: 'new',
            onboarding_status: 'PHONE_VERIFIED',
            profile_completed: false,
            customer_identity_id: identityId,
            // Don't set created_at/updated_at - let database defaults handle it
          });

          customerId = newCustomer[0].id;

          console.log(`[PROFILE] Created new customer ${customerId} for phone ${cleanPhone}`);
        } catch (createError: any) {
          console.error('[PROFILE] Error creating customer:', createError);
          console.error('[PROFILE] Error details:', {
            message: createError.message,
            stack: createError.stack,
            phone: cleanPhone
          });
          return c.json({
            error: 'Failed to create customer. Please try again.',
            code: 'CUSTOMER_CREATION_FAILED',
            details: process.env.NODE_ENV === 'development' ? createError.message : undefined
          }, 500);
        }
      }

      // Use PUT logic to update profile
      const updateData: any = {};

      if (profileData.firstName || profileData.lastName) {
        updateData.full_name = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
      }

      if (profileData.email) {
        updateData.email = profileData.email;
      }

      if (profileData.photo) {
        // Use profile_photo_url column directly instead of storing in preferences
        updateData.profile_photo_url = profileData.photo;
      }

      const { updateProfileCompletion, updateCustomerOnboardingStatus } = await import('../../../utils/customer-state');

      const completionUpdates: any = {};
      if (profileData.firstName || profileData.lastName || profileData.email) {
        completionUpdates.basic_info = true;
      }
      if (profileData.address || profileData.pincode) {
        completionUpdates.address = true;
      }

      // Handle address - customers table has address (TEXT), pincode (TEXT), city (TEXT), state (TEXT) as separate fields
      if (profileData.address) {
        updateData.address = profileData.address;
      }
      if (profileData.pincode !== undefined && String(profileData.pincode).trim() !== '') {
        updateData.pincode = profileData.pincode;
      }
      if (profileData.city) {
        updateData.city = profileData.city;
      }
      if (profileData.state) {
        updateData.state = profileData.state;
      }
      if (hasHouseNoField) {
        updateData.house_no = effectiveHousePost || null;
      }
      if (hasFloorField) {
        updateData.floor = profileData.floor?.trim() || null;
      }

      if (hasGeoPayload) {
        const geo = deriveLatLngFromProfileData(profileData as ProfileAddressSyncPayload);
        updateData.latitude = geo.latitude;
        updateData.longitude = geo.longitude;
      }

      // Ensure we're not trying to update preferences column (it may not exist yet)
      // Remove preferences from updateData if it somehow got added
      if ('preferences' in updateData) {
        delete updateData.preferences;
      }

      const updated = await update('customers', { id: customerId }, updateData);

      try {
        await syncDefaultCustomerAddressFromProfile(
          customerId as string,
          profileData,
          updated[0],
          {
            updateHouseNo: hasHouseNoField,
            houseNo: hasHouseNoField ? effectiveHousePost || null : undefined,
            updateFloor: hasFloorField,
            floor: hasFloorField ? profileData.floor?.trim() || null : undefined,
          }
        );
      } catch (syncErr) {
        console.error('[PROFILE] customer_addresses sync failed:', syncErr);
      }

      if (Object.keys(completionUpdates).length > 0 && customerId) {
        try {
          await updateProfileCompletion(customerId as string, completionUpdates);

          const customers = await select('customers', { id: customerId });
          const customer = customers[0];

          if (customer.onboarding_status === 'PHONE_VERIFIED' && completionUpdates.basic_info) {
            await updateCustomerOnboardingStatus(customerId as string, 'PROFILE_PENDING', 'profile');
          }
        } catch (stateError) {
          console.error('Error updating customer state:', stateError);
        }
      }

      return c.json({
        success: true,
        message: 'Profile updated successfully',
        profile: withProfileAddressFields(updated[0]),
      });
    } catch (error: any) {
      console.error('Error updating customer profile:', error);

      // Check if error is about missing preferences column
      if (error.message && error.message.includes('column "preferences"')) {
        console.error('[PROFILE] Preferences column does not exist. Run migration 139_add_customers_preferences_column.sql');
        return c.json({
          error: 'Database schema mismatch. Please run migration 139_add_customers_preferences_column.sql',
          details: error.message
        }, 500);
      }

      if (error.message && /column "latitude"|column "longitude"/i.test(error.message)) {
        console.error('[PROFILE] customers.latitude/longitude missing. Run migration 1005_customers_latitude_longitude.sql');
        return c.json(
          {
            error: 'Database schema mismatch. Run migration 1005_customers_latitude_longitude.sql on the API database.',
            details: error.message,
          },
          500
        );
      }

      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /customer/profile/:identifier
   * Update customer profile
   */
  app.put("/customer/profile/:identifier", async (c) => {
    try {
      const { identifier } = c.req.param();

      // Parse body from Hono request
      const body = await c.req.json().catch(() => ({}));
      const hasFloorInPut = 'floor' in body;

      const bodyForSchema: Record<string, any> = { ...body };
      const { hasHouseKey, merged: mergedPutHouse } = mergeHouseNoFromPayload(bodyForSchema);
      if (hasHouseKey) {
        bodyForSchema.houseNo = mergedPutHouse ?? '';
      }
      if ('house_no' in bodyForSchema) {
        delete bodyForSchema.house_no;
      }

      // Validate request with Zod schema
      const validationResult = UpdateCustomerProfileRequestSchema.safeParse(bodyForSchema);
      if (!validationResult.success) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              errors: validationResult.error.errors,
            },
          },
        }, 400);
      }

      const profileData = validationResult.data;

      // ✅ Validate email format (RFC-compliant)
      if (profileData.email) {
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
        if (!emailRegex.test(profileData.email.trim())) {
          return c.json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid email format',
              details: {
                field: 'email',
                message: 'Please enter a valid email address',
              },
            },
          }, 400);
        }
      }

      const addrStr = profileData.address !== undefined && profileData.address !== null ? String(profileData.address).trim() : '';
      const effectiveHousePut = String(mergedPutHouse ?? profileData.houseNo ?? '').trim();
      if (addrStr.length > 0 && hasHouseKey && !effectiveHousePut) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'House / flat number is required when address is provided',
            details: { field: 'houseNo', message: 'Please enter your house or flat number' },
          },
        }, 400);
      }

      const customerId = await resolveCustomerId(identifier);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Prepare update data
      const updateData: any = {};

      if (profileData.firstName || profileData.lastName) {
        updateData.full_name = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
      }

      if (profileData.email) {
        updateData.email = profileData.email;
      }

      if (profileData.photo) {
        // Use profile_photo_url column directly instead of storing in preferences
        updateData.profile_photo_url = profileData.photo;
      }

      // Update profile completion status
      const { updateProfileCompletion, updateCustomerOnboardingStatus } = await import('../../../utils/customer-state');

      const completionUpdates: any = {};
      if (profileData.firstName || profileData.lastName || profileData.email) {
        completionUpdates.basic_info = true;
      }
      if (profileData.address || profileData.pincode) {
        completionUpdates.address = true;
      }

      // Handle address - customers table has address (TEXT), pincode (TEXT), city (TEXT), state (TEXT) as separate fields
      if (profileData.address) {
        updateData.address = profileData.address;
      }
      if (profileData.pincode !== undefined && String(profileData.pincode).trim() !== '') {
        updateData.pincode = profileData.pincode;
      }
      if (profileData.city) {
        updateData.city = profileData.city;
      }
      if (profileData.state) {
        updateData.state = profileData.state;
      }
      if (hasHouseKey) {
        updateData.house_no = effectiveHousePut || null;
      }
      if (hasFloorInPut) {
        updateData.floor = profileData.floor?.trim() || null;
      }

      const hasGeoPut =
        'latitude' in bodyForSchema || 'longitude' in bodyForSchema || 'coordinates' in bodyForSchema;
      if (hasGeoPut) {
        const geo = deriveLatLngFromProfileData(profileData as ProfileAddressSyncPayload);
        updateData.latitude = geo.latitude;
        updateData.longitude = geo.longitude;
      }

      // Ensure we're not trying to update preferences column (it may not exist yet)
      // Remove preferences from updateData if it somehow got added
      if ('preferences' in updateData) {
        delete updateData.preferences;
      }

      const updated = await update('customers', { id: customerId }, updateData);

      try {
        await syncDefaultCustomerAddressFromProfile(customerId, profileData, updated[0], {
          updateHouseNo: hasHouseKey,
          houseNo: hasHouseKey ? effectiveHousePut || null : undefined,
          updateFloor: hasFloorInPut,
          floor: hasFloorInPut ? profileData.floor?.trim() || null : undefined,
        });
      } catch (syncErr) {
        console.error('[PROFILE] customer_addresses sync failed:', syncErr);
      }

      // Update profile completion and onboarding status
      if (Object.keys(completionUpdates).length > 0) {
        try {
          await updateProfileCompletion(customerId, completionUpdates);

          // Check if we should update onboarding status
          const customers = await select('customers', { id: customerId });
          const customer = customers[0];

          if (customer.onboarding_status === 'PHONE_VERIFIED' && completionUpdates.basic_info) {
            await updateCustomerOnboardingStatus(customerId, 'PROFILE_PENDING', 'profile');
          }
        } catch (stateError) {
          console.error('Error updating customer state:', stateError);
          // Don't fail profile update if state update fails
        }
      }

      return c.json({
        success: true,
        message: 'Profile updated successfully',
        profile: withProfileAddressFields(updated[0]),
      });
    } catch (error: any) {
      console.error('Error updating customer profile:', error);
      if (error.message && /column "latitude"|column "longitude"/i.test(error.message)) {
        return c.json(
          {
            error: 'Database schema mismatch. Run migration 1005_customers_latitude_longitude.sql on the API database.',
            details: error.message,
          },
          500
        );
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/preferences
   * Get customer preferences
   */
  app.get("/customer/:customerId/preferences", async (c) => {
    try {
      const { customerId } = c.req.param();

      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const preferences = (customers[0].preferences as any) || {};

      return c.json({
        success: true,
        preferences,
      });
    } catch (error: any) {
      console.error('Error fetching customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /customer/:customerId/preferences
   * Update customer preferences
   */
  app.put("/customer/:customerId/preferences", async (c) => {
    try {
      const { customerId } = c.req.param();
      const newPreferences = await c.req.json();

      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const existingPreferences = (customers[0].preferences as any) || {};

      const updated = await update('customers',
        { id: customerId },
        {
          preferences: {
            ...existingPreferences,
            ...newPreferences,
          },
        }
      );

      return c.json({
        success: true,
        message: 'Preferences updated successfully',
        preferences: updated[0].preferences,
      });
    } catch (error: any) {
      console.error('Error updating customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/by-phone
   * Get customer by phone number (query string format)
   */
  app.get("/customer/by-phone", async (c) => {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      const ms = await getCustomerByPhoneFromMicroservice(phone);
      if (ms.kind === 'hit') {
        return c.json(ms.body);
      }

      const customerId = await resolveCustomerId(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found', customer: null }, 404);
      }
      const customers = await select('customers', { id: customerId });

      if (customers.length === 0) {
        return c.json({ error: 'Customer not found', customer: null }, 404);
      }

      const customer = customers[0];
      return c.json({
        success: true,
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          email: customer.email,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          createdAt: customer.created_at,
        }
      });
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('Error fetching customer by phone:', error);
      // Return 503 for pool exhaustion/timeout so clients can retry; 500 for other errors
      if (msg.includes('connection pool') || msg.includes('too many clients') || msg.includes('timeout') || msg.includes('Timeout')) {
        return c.json({ error: 'Service temporarily busy. Please try again in a moment.', code: 'SERVICE_BUSY' }, 503);
      }
      return c.json({ error: msg }, 500);
    }
  });

  /**
   * GET /customer/:customerId/search-history
   * Get customer's search history
   */
  app.get("/customer/:customerId/search-history", async (c) => {
    try {
      const customerId = c.req.param('customerId');

      // Check if customer exists
      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Try to get search history from preferences or a dedicated table
      const customers = await select('customers', { id: customer });
      const preferences = customers[0]?.preferences as any || {};
      const searchHistory = preferences.searchHistory || [];

      return c.json({
        success: true,
        history: searchHistory,
        count: searchHistory.length,
      });
    } catch (error: any) {
      console.error('[search-history] Error fetching search history:', error);
      return c.json({ success: true, history: [], count: 0 }, 200);
    }
  });

  /**
   * POST /customer/:customerId/search-history
   * Add to customer's search history
   */
  app.post("/customer/:customerId/search-history", async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const body = await c.req.json();
      const { query: searchQuery } = body;

      if (!searchQuery) {
        return c.json({ error: 'Search query is required' }, 400);
      }

      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await select('customers', { id: customer });
      const preferences = customers[0]?.preferences as any || {};
      let searchHistory = preferences.searchHistory || [];

      // Add to history (keep last 20)
      searchHistory = [
        { query: searchQuery, timestamp: new Date().toISOString() },
        ...searchHistory.filter((h: any) => h.query !== searchQuery)
      ].slice(0, 20);

      await update('customers', { id: customer }, {
        preferences: { ...preferences, searchHistory }
      });

      return c.json({ success: true, history: searchHistory });
    } catch (error: any) {
      console.error('Error saving search history:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/search-suggestions
   * Get search suggestions for customer
   */
  app.get("/customer/search-suggestions", async (c) => {
    try {
      const customerId = c.req.query('customerId');

      // Get popular services/products as suggestions
      const suggestions = [
        { type: 'service', text: 'Vet Consultation', icon: '🏥' },
        { type: 'service', text: 'Home Grooming', icon: '✂️' },
        { type: 'service', text: 'Dog Walker', icon: '🐕' },
        { type: 'service', text: 'Pet Training', icon: '🎓' },
        { type: 'product', text: 'Dog Food', icon: '🍖' },
        { type: 'product', text: 'Pet Toys', icon: '🧸' },
        { type: 'product', text: 'Grooming Kit', icon: '🛁' },
      ];

      return c.json({
        success: true,
        suggestions,
        count: suggestions.length,
      });
    } catch (error: any) {
      console.error('[search-suggestions] Error fetching suggestions:', error);
      return c.json({ success: true, suggestions: [], count: 0 }, 200);
    }
  });

  /**
   * DELETE /customer/:customerId/search-history
   * Clear customer's search history
   */
  app.delete("/customer/:customerId/search-history", async (c) => {
    try {
      const customerId = c.req.param('customerId');

      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await select('customers', { id: customer });
      const preferences = customers[0]?.preferences as any || {};

      await update('customers', { id: customer }, {
        preferences: { ...preferences, searchHistory: [] }
      });

      return c.json({ success: true, message: 'Search history cleared' });
    } catch (error: any) {
      console.error('Error clearing search history:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

