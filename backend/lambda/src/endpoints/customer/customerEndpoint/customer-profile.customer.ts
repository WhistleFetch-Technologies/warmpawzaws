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
import { select, update, updateCustomersCompatible, query, insert } from '../../../database/rds-connection';
import { UpdateCustomerProfileRequestSchema } from '@warmpawz/api-contracts';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { presignS3GetUrlIfApplicable } from '../../../utils/s3-media-presign';

/** Remove control / BOM chars that break inputs (e.g. "orange blocks" in floor field). */
function sanitizeProfileDetailText(v: unknown): string {
  if (v == null) return '';
  return String(v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFEFF\uFFFE\uFFFF]/g, '')
    .trim();
}

/**
 * Prefer first non-empty house / flat: customers row (house_no, houseno, flat*, etc.), then every saved
 * customer_addresses row in default-first order. `??` would wrongly skip empty strings on legacy fields.
 */
function pickHouseNoFromCustomerAndAddr(customer: any, allAddresses?: any[] | null): string | null {
  const customerParts = [
    customer?.house_no,
    customer?.houseno,
    customer?.houseNo,
    customer?.HouseNo,
    customer?.flat_no,
    customer?.flatNo,
    customer?.flatno,
    customer?.FlatNo,
  ];
  for (const p of customerParts) {
    const s = sanitizeProfileDetailText(p);
    if (s !== '') return s;
  }
  if (Array.isArray(allAddresses)) {
    for (const addr of allAddresses) {
      const addrParts = [
        addr?.houseNo,
        addr?.house_no,
        addr?.flatNo,
        addr?.flat_no,
        addr?.flatno,
      ];
      for (const p of addrParts) {
        const s = sanitizeProfileDetailText(p);
        if (s !== '') return s;
      }
    }
  }
  return null;
}

function pickFloorFromCustomerAndAddr(customer: any, allAddresses?: any[] | null): string | null {
  const customerParts = [customer?.floor, customer?.Floor];
  for (const p of customerParts) {
    const s = sanitizeProfileDetailText(p);
    if (s !== '') return s;
  }
  if (Array.isArray(allAddresses)) {
    for (const addr of allAddresses) {
      const addrParts = [addr?.floor, addr?.Floor, addr?.floor_no, addr?.floorNo];
      for (const p of addrParts) {
        const s = sanitizeProfileDetailText(p);
        if (s !== '') return s;
      }
    }
  }
  return null;
}

/** Map DB row to API profile with camelCase address detail fields */
function withProfileAddressFields(
  row: Record<string, any> | null | undefined,
  allAddresses?: any[] | null
) {
  if (!row) return row;
  const houseNo = pickHouseNoFromCustomerAndAddr(row, allAddresses);
  const floor = pickFloorFromCustomerAndAddr(row, allAddresses);
  return {
    ...row,
    houseNo: houseNo ?? '',
    floor: floor ?? '',
  };
}

/** Same shape as GET /customer/profile address rows (camelCase aliases for node-pg). */
async function fetchCustomerAddressesOrdered(customerId: string): Promise<any[]> {
  try {
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
      [customerId]
    );
    return addressesResult.rows || [];
  } catch {
    return [];
  }
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

function payloadHasHouseNoKey(o: unknown): boolean {
  if (!o || typeof o !== 'object') return false;
  return ['houseNo', 'house_no', 'HouseNo', 'flatNo', 'flat_no', 'flatno'].some((k) =>
    Object.prototype.hasOwnProperty.call(o, k)
  );
}

function payloadHasFloorKey(o: unknown): boolean {
  if (!o || typeof o !== 'object') return false;
  return ['floor', 'Floor'].some((k) => Object.prototype.hasOwnProperty.call(o, k));
}

/** Read house / flat number from coerced profile object (camel + snake + Pascal + legacy flat*). */
function readHouseNoForDb(o: Record<string, unknown>): string | null {
  const v =
    o.houseNo ??
    o.house_no ??
    (o as any).HouseNo ??
    o.flatNo ??
    o.flat_no ??
    (o as any).flatno;
  if (v == null) return null;
  const s = sanitizeProfileDetailText(v);
  return s === '' ? null : s;
}

/** Coerce profile fields from clients (e.g. pincode as number from Google Places) before Zod validation. */
function coerceProfileUpdateShape(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  const src = raw as any;
  if (out.houseNo === undefined && out.house_no === undefined && src.HouseNo !== undefined) {
    out.houseNo = src.HouseNo;
  }
  if (
    out.houseNo === undefined &&
    out.house_no === undefined &&
    (src.flatNo !== undefined || src.flat_no !== undefined || src.flatno !== undefined)
  ) {
    out.houseNo = src.flatNo ?? src.flat_no ?? src.flatno;
  }
  if (out.floor === undefined && src.Floor !== undefined) {
    out.floor = src.Floor;
  }
  if (out.pincode !== undefined && out.pincode !== null && out.pincode !== '') {
    const digits = String(out.pincode).replace(/\D/g, '').slice(0, 6);
    out.pincode = digits.length > 0 ? digits : undefined;
  }
  if (out.pincode === '' || out.pincode === undefined) {
    delete out.pincode;
  }
  for (const key of [
    'firstName',
    'lastName',
    'email',
    'address',
    'city',
    'state',
    'houseNo',
    'house_no',
    'flatNo',
    'flat_no',
    'floor',
  ] as const) {
    const v = out[key];
    if (v != null && typeof v !== 'string') {
      out[key] = String(v);
    }
  }
  return out;
}

/**
 * Combine camelCase + snake_case house fields. `houseNo ?? house_no` is wrong when `houseNo` is ""
 * (empty string is not nullish) but `house_no` has the real value — common with mixed API/client payloads.
 */
function mergeHouseNoFromPayload(raw: Record<string, any>): {
  hasHouseKey: boolean;
  merged: string | undefined;
} {
  const hasHouseKey =
    raw != null && typeof raw === 'object' && ('houseNo' in raw || 'house_no' in raw);
  const tc =
    raw?.houseNo === undefined || raw?.houseNo === null ? '' : String(raw.houseNo).trim();
  const ts =
    raw?.house_no === undefined || raw?.house_no === null ? '' : String(raw.house_no).trim();
  const mergedNonEmpty = tc || ts;

  if (!hasHouseKey) {
    return { hasHouseKey: false, merged: mergedNonEmpty || undefined };
  }
  return { hasHouseKey: true, merged: mergedNonEmpty };
}

async function resolveCustomerId(identifier: string): Promise<string | null> {
  // Check if it's a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    const customers = await select('customers', { id: identifier });
    return customers.length > 0 ? customers[0].id : null;
  }

  // Check if it's a phone number
  const cleanPhone = normalizePhone(identifier);
  const customers = await select('customers', { phone: cleanPhone });
  return customers.length > 0 ? customers[0].id : null;
}

export function registerCustomerProfileEndpoints(app: Hono) {
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
      const addrRowsUnified = addresses.rows || [];
      const unifiedHouseNo = pickHouseNoFromCustomerAndAddr(customer, addrRowsUnified);
      const unifiedFloor = pickFloorFromCustomerAndAddr(customer, addrRowsUnified);
      return c.json({
        success: true,
        profile: {
          id: customer.id,
          name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          houseNo: unifiedHouseNo ?? '',
          floor: unifiedFloor ?? '',
          status: customerStatus,
          onboarding_status: onboardingStatus,
          profile_completed: profileCompleted,
          onboardingComplete: onboardingStatus === 'COMPLETED',
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
            houseNo: addr.house_no ?? addr.houseNo ?? '',
            floor: addr.floor ?? '',
            flatNo: addr.flat_no ?? addr.flatNo ?? '',
            isDefault: addr.is_default,
          })),
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
      // Lines 239-264: Replace with this
      let customers: any[];
      try {
        // Get customer profile
        const customerResult = await query(
          `SELECT *, house_no AS "houseNo" FROM customers WHERE phone = $1`,
          [cleanPhone]
        );
        customers = customerResult.rows;

        if (customers.length === 0) {
          return c.json({ error: 'Customer not found' }, 404);
        }

        customers[0].addresses = await fetchCustomerAddressesOrdered(customers[0].id);
      } catch (error: any) {
        console.error('[profile] Error fetching customer by phone:', error);
        return c.json({ success: true, profile: null, _degraded: true }, 200);
      }

      const customer = customers[0];
      const addrList = customer.addresses || [];
      const defaultAddr = addrList[0] || null;
      const resolvedHouseNo = pickHouseNoFromCustomerAndAddr(customer, addrList);
      const resolvedFloor = pickFloorFromCustomerAndAddr(customer, addrList);

      console.log('[PROFILE GET ?phone] houseNo/floor for response:', {
        houseNo: resolvedHouseNo,
        floor: resolvedFloor,
        db_house_no: customer.house_no,
        db_floor: customer.floor,
        db_houseno: customer.houseno,
      });

      const fullName = (customer.full_name || '').trim();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const addressText =
        typeof customer.address === 'string'
          ? customer.address
          : (customer.address && (customer.address as any).street) || '';

      const profilePhoto =
        (await presignS3GetUrlIfApplicable(customer.profile_photo_url)) ||
        customer.profile_photo_url ||
        null;

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
          const signed = (await presignS3GetUrlIfApplicable(rawPhoto)) || rawPhoto;
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
          pincode: defaultAddr?.pincode || customer.pincode || null,
          city: defaultAddr?.city || customer.city || null,
          state: defaultAddr?.state || customer.state || null,
          houseNo: resolvedHouseNo ?? '',
          floor: resolvedFloor ?? '',
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
   */
  app.get("/customer/profile/:identifier", async (c) => {
    try {
      const { identifier } = c.req.param();

      const customerId = await resolveCustomerId(identifier);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const idCustomerResult = await query(
        `SELECT *, house_no AS "houseNo" FROM customers WHERE id = $1::uuid`,
        [customerId]
      );
      const customers = idCustomerResult.rows || [];
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      const idAddrRows = await fetchCustomerAddressesOrdered(customerId);

      // Map backend fields to UI fields
      const nameParts = (customer.full_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Use profile_photo_url directly (preferences column may not exist yet)
      const photoUrl = customer.profile_photo_url || null;

      // Extract address fields from JSONB (if address is stored as JSONB)
      // Otherwise use address as text
      let addressData: any = {};
      if (typeof customer.address === 'string') {
        // Address is stored as text, use it directly
        addressData = { street: customer.address };
      } else if (customer.address) {
        addressData = customer.address;
      }

      const idProfileHouseNo = pickHouseNoFromCustomerAndAddr(customer, idAddrRows);
      const idProfileFloor = pickFloorFromCustomerAndAddr(customer, idAddrRows);
      console.log('[PROFILE GET :identifier] houseNo/floor:', {
        identifier,
        houseNo: idProfileHouseNo,
        floor: idProfileFloor,
      });

      return c.json({
        success: true,
        profile: {
          id: customer.id,
          firstName,
          lastName,
          email: customer.email || '',
          phone: customer.phone || identifier,
          address: addressData.street || '',
          pincode: (customer as any).pincode || addressData.pincode || '',
          city: (customer as any).city || '',
          state: (customer as any).state || '',
          houseNo: idProfileHouseNo ?? '',
          floor: idProfileFloor ?? '',
          photo: photoUrl || '',
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
      if (rawProfilePayload.pincode) profilePayload.pincode = rawProfilePayload.pincode;
      if (rawProfilePayload.city) profilePayload.city = rawProfilePayload.city;
      if (rawProfilePayload.state) profilePayload.state = rawProfilePayload.state;
      if (hasHouseNoField) {
        profilePayload.houseNo = mergedHouseNo ?? '';
      } else if (mergedHouseNo) {
        profilePayload.houseNo = mergedHouseNo;
      }
      if (coercedSource.floor !== undefined && coercedSource.floor !== null) {
        const fl = sanitizeProfileDetailText(coercedSource.floor);
        if (fl !== '') profilePayload.floor = fl;
      }
      if (coercedSource.photo && String(coercedSource.photo).startsWith('http')) {
        profilePayload.photo = String(coercedSource.photo);
      }

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

      // House / flat number is optional; do not reject when address is present but houseNo is empty.

      // Get phone from body (required for POST endpoint)
      // Note: phone is not part of the validated schema, it comes from body directly
      const phone = body.phone || (body.profile as any)?.phone;
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      const cleanPhone = normalizePhone(String(phone));

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
      if (profileData.pincode) {
        updateData.pincode = profileData.pincode;
      }
      if (profileData.city) {
        updateData.city = profileData.city;
      }
      if (profileData.state) {
        updateData.state = profileData.state;
      }
      const applyHouseNoPost =
        hasHouseNoField || Object.prototype.hasOwnProperty.call(profilePayload, 'houseNo');
      const applyFloorPost =
        hasFloorField || Object.prototype.hasOwnProperty.call(profilePayload, 'floor');
      if (applyHouseNoPost) {
        updateData.house_no = readHouseNoForDb(coercedSource as Record<string, unknown>);
      }
      if (applyFloorPost) {
        const fl = coercedSource.floor;
        if (fl !== undefined && fl !== null) {
          updateData.floor = sanitizeProfileDetailText(fl) || null;
        }
      }

      // Ensure we're not trying to update preferences column (it may not exist yet)
      // Remove preferences from updateData if it somehow got added
      if ('preferences' in updateData) {
        delete updateData.preferences;
      }

      await updateCustomersCompatible({ id: customerId }, updateData);
      const refreshedRows = await select('customers', { id: customerId });
      const savedCustomer = refreshedRows[0];
      if (!savedCustomer) {
        return c.json({ error: 'Customer not found after update' }, 500);
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

      const postAddrRows = await fetchCustomerAddressesOrdered(customerId as string);
      const outProfile = withProfileAddressFields(savedCustomer, postAddrRows);
      console.log('[PROFILE POST] GET-style houseNo/floor after save:', {
        houseNo: outProfile?.houseNo,
        floor: outProfile?.floor,
      });

      return c.json({
        success: true,
        message: 'Profile updated successfully',
        profile: outProfile,
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
      const normalizedBody = coerceProfileUpdateShape(body as Record<string, unknown>);
      const hasHouseNoInPut = payloadHasHouseNoKey(body);
      const hasFloorInPut = payloadHasFloorKey(body);
      console.log('[PROFILE PUT] update request houseNo/floor:', {
        houseNo: normalizedBody.houseNo ?? (body as any).house_no,
        floor: normalizedBody.floor,
      });

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

      // House / flat number is optional for profile updates.

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
      if (profileData.pincode) {
        updateData.pincode = profileData.pincode;
      }
      if (profileData.city) {
        updateData.city = profileData.city;
      }
      if (profileData.state) {
        updateData.state = profileData.state;
      }
      const applyHouseNoPut =
        hasHouseNoInPut ||
        Object.prototype.hasOwnProperty.call(normalizedBody, 'houseNo') ||
        Object.prototype.hasOwnProperty.call(normalizedBody, 'house_no') ||
        Object.prototype.hasOwnProperty.call(normalizedBody, 'flatNo') ||
        Object.prototype.hasOwnProperty.call(normalizedBody, 'flat_no');
      const applyFloorPut =
        hasFloorInPut ||
        Object.prototype.hasOwnProperty.call(normalizedBody, 'floor') ||
        Object.prototype.hasOwnProperty.call(normalizedBody, 'Floor');
      if (applyHouseNoPut) {
        updateData.house_no = readHouseNoForDb(normalizedBody);
      }
      if (applyFloorPut) {
        const fl = normalizedBody.floor ?? (body as any).Floor;
        if (fl !== undefined && fl !== null) {
          updateData.floor = sanitizeProfileDetailText(fl) || null;
        }
      }

      // Ensure we're not trying to update preferences column (it may not exist yet)
      // Remove preferences from updateData if it somehow got added
      if ('preferences' in updateData) {
        delete updateData.preferences;
      }

      await updateCustomersCompatible({ id: customerId }, updateData);
      const refreshedPut = await select('customers', { id: customerId });
      const savedPut = refreshedPut[0];
      if (!savedPut) {
        return c.json({ error: 'Customer not found after update' }, 500);
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

      const putAddrRows = await fetchCustomerAddressesOrdered(customerId);
      const putOutProfile = withProfileAddressFields(savedPut, putAddrRows);
      console.log('[PROFILE PUT] houseNo/floor after save:', {
        houseNo: putOutProfile?.houseNo,
        floor: putOutProfile?.floor,
      });

      return c.json({
        success: true,
        message: 'Profile updated successfully',
        profile: putOutProfile,
      });
    } catch (error: any) {
      console.error('Error updating customer profile:', error);
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

      const cleanPhone = normalizePhone(phone);
      const customers = await select('customers', { phone: cleanPhone });

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

