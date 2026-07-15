/**
 * ============================================================================
 * ADDRESS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles customer address management:
 * - Get customer addresses
 * - Add/update/delete addresses
 * - Set default address
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../../../../database/rds-connection';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

/** Module helpers (move-only). */

/**
 * Geocode an address using Google Maps Geocoding API
 * param addressLine1 - Primary address line
 * param addressLine2 - Secondary address line (optional)
 * param city - City name
 * param state - State name
 * param pincode - PIN code
 * returns Coordinates as JSON string or null if geocoding fails
 */
export async function geocodeAddress(
  addressLine1: string,
  city: string,
  state: string,
  pincode: string,
  addressLine2?: string | null
): Promise<string | null> {
  try {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0';

    // Build full address string for geocoding
    const fullAddress = [
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      'India'
    ].filter(Boolean).join(', ');

    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${googleMapsApiKey}`
    );
    const geocodeData: any = await geocodeResponse.json();

    if (geocodeData.status === 'OK' && geocodeData.results?.[0]?.geometry?.location) {
      const location = geocodeData.results[0].geometry.location;
      const coordinates = JSON.stringify({ lat: location.lat, lng: location.lng });
      console.log('📍 [addresses] Geocoded address:', { lat: location.lat, lng: location.lng });
      return coordinates;
    } else {
      console.warn('⚠️ [addresses] Geocoding failed:', geocodeData.status);
      return null;
    }
  } catch (error) {
    console.error('❌ [addresses] Error geocoding address:', error);
    return null;
  }
}

/**
 * Normalize coordinates to JSON string format
 *  Coordinates as string, object, or null
 * Normalized coordinates as JSON string or null
 */
export function normalizeCoordinates(coordinates: any): string | null {
  if (!coordinates) return null;

  if (typeof coordinates === 'string') {
    // Already a string, validate it's valid JSON
    try {
      JSON.parse(coordinates);
      return coordinates;
    } catch {
      return null;
    }
  }

  if (typeof coordinates === 'object') {
    // Object format, stringify it
    return JSON.stringify(coordinates);
  }

  return null;
}

/** Prefer explicit lat/lng from the client; fall back to JSON coordinates (Google Places). */
export function resolveLatLngForRow(
  finalCoordinates: string | null,
  explicitLat?: unknown,
  explicitLng?: unknown
): { latitude: number | null; longitude: number | null } {
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (finalCoordinates) {
    try {
      const o = JSON.parse(finalCoordinates) as Record<string, unknown>;
      const la =
        typeof o.lat === 'number'
          ? o.lat
          : typeof o.latitude === 'number'
            ? (o.latitude as number)
            : null;
      const lo =
        typeof o.lng === 'number'
          ? o.lng
          : typeof o.longitude === 'number'
            ? (o.longitude as number)
            : typeof o.lon === 'number'
              ? (o.lon as number)
              : null;
      if (la != null && Number.isFinite(la)) latitude = la;
      if (lo != null && Number.isFinite(lo)) longitude = lo;
    } catch {
      /* ignore */
    }
  }
  const nl =
    explicitLat !== undefined && explicitLat !== null && explicitLat !== ''
      ? Number(explicitLat as number | string)
      : NaN;
  const ng =
    explicitLng !== undefined && explicitLng !== null && explicitLng !== ''
      ? Number(explicitLng as number | string)
      : NaN;
  if (Number.isFinite(nl)) latitude = nl;
  if (Number.isFinite(ng)) longitude = ng;
  return { latitude, longitude };
}

/** Build coordinates JSON for DB from existing value and/or explicit client lat/lng. */
export function ensureCoordinatesJson(
  finalCoordinates: string | null,
  explicitLat?: unknown,
  explicitLng?: unknown
): string | null {
  const { latitude, longitude } = resolveLatLngForRow(finalCoordinates, explicitLat, explicitLng);
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return JSON.stringify({ lat: latitude, lng: longitude });
  }
  return finalCoordinates;
}

/** Lat/lng for API responses: DB columns when present, else parse coordinates JSONB. */
export function coordsFromRow(addr: any): { latitude?: number; longitude?: number } {
  let latitude: number | undefined;
  let longitude: number | undefined;
  if (addr?.latitude != null && Number.isFinite(Number(addr.latitude))) {
    latitude = Number(addr.latitude);
  }
  if (addr?.longitude != null && Number.isFinite(Number(addr.longitude))) {
    longitude = Number(addr.longitude);
  }
  if (addr?.coordinates) {
    try {
      const coords =
        typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
      const la = coords?.lat ?? coords?.latitude;
      const lo = coords?.lng ?? coords?.longitude ?? coords?.lon;
      if (latitude === undefined && la != null && Number.isFinite(Number(la))) {
        latitude = Number(la);
      }
      if (longitude === undefined && lo != null && Number.isFinite(Number(lo))) {
        longitude = Number(lo);
      }
    } catch {
      /* ignore */
    }
  }
  return { latitude, longitude };
}

export function mapAddressRow(addr: any) {
  const { latitude, longitude } = coordsFromRow(addr);
  return {
    id: addr.id,
    customerId: addr.customer_id,
    label: addr.address_type,
    name: addr.full_name,
    phone: addr.phone,
    addressLine1: addr.address_line1,
    addressLine2: addr.address_line2,
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    landmark: addr.landmark,
    coordinates: addr.coordinates || null,
    latitude,
    longitude,
    flatNo: addr.flat_no ?? undefined,
    houseNo: addr.house_no ?? undefined,
    floor: addr.floor ?? undefined,
    streetName: addr.street_name ?? undefined,
    apartmentName: addr.apartment_name ?? undefined,
    isDefault: addr.is_default,
    createdAt: addr.created_at,
    updatedAt: addr.updated_at,
  };
}

let _hasLatLngColumnsCache: boolean | null = null;
export async function hasCustomerAddressLatLngColumns(): Promise<boolean> {
  if (_hasLatLngColumnsCache != null) return _hasLatLngColumnsCache;
  try {
    const res = await query(
      `SELECT COUNT(*)::int AS cnt
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'customer_addresses'
         AND column_name IN ('latitude', 'longitude')`
    );
    const cnt = Number(res.rows?.[0]?.cnt || 0);
    _hasLatLngColumnsCache = cnt >= 2;
  } catch {
    _hasLatLngColumnsCache = false;
  }
  return _hasLatLngColumnsCache;
}

