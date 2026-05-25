/**
 * Shared helpers for meal order live tracking UI (coordinates, polling interval).
 */

export const MEAL_TRACKING_POLL_MS = 18_000;

function parseAddressObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function readCoord(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Rider / partner position from GET /customer/tracking payload. */
export function extractRiderCoordinates(
  tracking: Record<string, unknown> | null | undefined,
): { lat: number; lng: number } | null {
  if (!tracking) return null;

  const location = tracking.location as { latitude?: unknown; longitude?: unknown } | undefined;
  if (location) {
    const lat = readCoord(location as Record<string, unknown>, 'latitude', 'lat');
    const lng = readCoord(location as Record<string, unknown>, 'longitude', 'lng', 'lon');
    if (lat != null && lng != null && !(lat === 0 && lng === 0)) return { lat, lng };
  }

  const current = tracking.currentLocation as
    | { lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown }
    | undefined;
  if (current) {
    const lat = readCoord(current as Record<string, unknown>, 'lat', 'latitude');
    const lng = readCoord(current as Record<string, unknown>, 'lng', 'longitude', 'lon');
    if (lat != null && lng != null && !(lat === 0 && lng === 0)) return { lat, lng };
  }

  return null;
}

/** Customer drop-off coordinates + display label for map destination marker. */
export function extractDestinationCoordinates(
  order: Record<string, unknown>,
  addressText?: string,
): { lat: number; lng: number; address: string } | null {
  const directLat = readCoord(order, 'customer_lat', 'delivery_lat', 'latitude');
  const directLng = readCoord(order, 'customer_lng', 'delivery_lng', 'longitude');
  if (directLat != null && directLng != null) {
    return {
      lat: directLat,
      lng: directLng,
      address: addressText?.trim() || 'Delivery address',
    };
  }

  const raw = order.delivery_address ?? order.deliveryAddress;
  const parsed = parseAddressObject(raw);
  if (parsed) {
    const lat = readCoord(parsed, 'lat', 'latitude');
    const lng = readCoord(parsed, 'lng', 'longitude', 'lon');
    if (lat != null && lng != null) {
      const addr =
        addressText?.trim() ||
        (typeof parsed.address === 'string' ? parsed.address : '') ||
        'Delivery address';
      return { lat, lng, address: addr };
    }
  }

  return null;
}

export function resolveRiderPhoto(tracking: Record<string, unknown> | null | undefined): string | undefined {
  if (!tracking) return undefined;
  const dp = tracking.deliveryPerson as { photo?: string } | undefined;
  if (typeof dp?.photo === 'string' && dp.photo.trim()) return dp.photo.trim();
  const rider = tracking.rider as { photo?: string; img?: string; image?: string } | undefined;
  const fromRider = rider?.photo || rider?.img || rider?.image;
  return typeof fromRider === 'string' && fromRider.trim() ? fromRider.trim() : undefined;
}
