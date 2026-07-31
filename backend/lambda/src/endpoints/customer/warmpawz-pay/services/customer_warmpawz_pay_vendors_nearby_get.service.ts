import type { Context } from 'hono';
import { getCustomerCoordinates } from '../../../../utils/customer-coordinates';
import { dbWpayVendorsNearbyList } from '../repos/wpay-vendors-nearby.repo';
import { mapWpayVendorsNearbyRows } from './wpay-vendors-nearby-mapper';
import type { WpayVendorsNearbyGetResponse } from './wpay-vendors-nearby/types';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function parseLimit(raw: string | undefined): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
}

function parseOptionalPositiveFloat(raw: string | undefined | null): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseCoordinate(raw: string | undefined | null): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

async function resolveNearbyCustomerCoordinates(
  c: Context
): Promise<{ ok: true; customerLat: number; customerLng: number } | { ok: false; error: string }> {
  let latitude = c.req.query('latitude') || c.req.query('lat') || null;
  let longitude =
    c.req.query('longitude') || c.req.query('lng') || c.req.query('lon') || null;

  if (!latitude || !longitude) {
    const customerPhone =
      c.req.query('customerPhone')?.trim() || c.req.query('phone')?.trim() || null;
    try {
      const coords = await getCustomerCoordinates(customerPhone || undefined);
      if (coords) {
        latitude = String(coords.latitude);
        longitude = String(coords.longitude);
      }
    } catch (err) {
      console.warn(
        '[customer/warmpawz-pay/vendors/nearby] getCustomerCoordinates failed:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  const customerLat = parseCoordinate(latitude);
  const customerLng = parseCoordinate(longitude);

  if (customerLat == null || customerLng == null) {
    return {
      ok: false,
      error:
        'latitude and longitude are required (query params or resolvable customer location)',
    };
  }

  return { ok: true, customerLat, customerLng };
}

export async function executeCustomerWarmpawzPayVendorsNearbyGet(c: Context) {
  try {
    const coordsResult = await resolveNearbyCustomerCoordinates(c);
    if (!coordsResult.ok) {
      return c.json({ success: false, error: coordsResult.error }, 400);
    }

    const limit = parseLimit(c.req.query('limit'));
    const maxDistanceKm =
      parseOptionalPositiveFloat(c.req.query('maxDistance')) ??
      parseOptionalPositiveFloat(c.req.query('maxDistanceKm'));
    const category = c.req.query('category')?.trim() || null;

    const rows = await dbWpayVendorsNearbyList({
      customerLat: coordsResult.customerLat,
      customerLng: coordsResult.customerLng,
      limit,
      maxDistanceKm,
      category,
    });

    const vendors = await mapWpayVendorsNearbyRows(rows);

    const body: WpayVendorsNearbyGetResponse = {
      success: true,
      vendors,
      total: vendors.length,
    };

    return c.json(body);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load nearby Warmpawz Pay vendors';
    console.error('[customer/warmpawz-pay/vendors/nearby]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
