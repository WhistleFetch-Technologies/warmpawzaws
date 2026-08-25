import type { Context } from 'hono';
import { getCustomerCoordinates } from '../../../../utils/customer-coordinates';
import { decodeDiscoveryCursor, encodeDiscoveryCursor } from '../../../../utils/discovery-cursor';
import { dbWpayVendorsNearbyPage } from '../repos/wpay-vendors-nearby.repo';
import { mapWpayVendorsNearbyRows } from './wpay-vendors-nearby-mapper';
import type { WpayVendorsNearbyGetResponse } from './wpay-vendors-nearby/types';
import {
  WALK_IN_AT_CENTER_RADIUS_KM,
  parseWalkInQueryTightenKm,
} from '../shared/walk-in-discovery-radius';

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

function parseLimit(raw: string | undefined): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
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
    const { s: sqlOffset } = decodeDiscoveryCursor(c.req.query('cursor'));
    const queryTightenKm = parseWalkInQueryTightenKm({
      radiusKm: c.req.query('radiusKm'),
      maxDistance: c.req.query('maxDistance'),
      maxDistanceKm: c.req.query('maxDistanceKm'),
    });
    const category = c.req.query('category')?.trim() || null;

    const page = await dbWpayVendorsNearbyPage({
      customerLat: coordsResult.customerLat,
      customerLng: coordsResult.customerLng,
      limit,
      offset: sqlOffset,
      queryTightenKm,
      category,
    });

    const vendors = await mapWpayVendorsNearbyRows(page.rows);
    const nextCursor = page.hasMore
      ? encodeDiscoveryCursor({ o: 0, s: sqlOffset + vendors.length })
      : null;

    const body: WpayVendorsNearbyGetResponse = {
      success: true,
      vendors,
      total: vendors.length,
      nextCursor,
      appliedFilters: {
        atCenterRadiusKm: WALK_IN_AT_CENTER_RADIUS_KM,
        queryTightenKm,
        category,
        limit,
      },
    };

    return c.json(body);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load nearby Walk-in vendors';
    console.error('[customer/warmpawz-pay/vendors/nearby]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
