import { deriveDistanceKmFromLocations } from './customer-delivery-fee-quote';

function finiteCoord(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function parseDeliveryAddress(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return { address: raw };
    }
  }
  return null;
}

/** Short area label for vendor order cards (first line / landmark / city). */
export function shortDeliveryAreaLabel(rawAddress: unknown): string | null {
  const addr = parseDeliveryAddress(rawAddress);
  if (!addr) return null;

  const line1 = addr.addressLine1 ?? addr.address_line1;
  if (typeof line1 === 'string' && line1.trim()) return line1.trim();

  const landmark = addr.landmark;
  if (typeof landmark === 'string' && landmark.trim()) return landmark.trim();

  const full = addr.address;
  if (typeof full === 'string' && full.trim()) {
    const first = full.split(',')[0]?.trim();
    if (first) return first;
  }

  const city = addr.city;
  if (typeof city === 'string' && city.trim()) return city.trim();

  return null;
}

export function customerCoordsFromMealOrder(row: Record<string, unknown>): {
  lat: number;
  lng: number;
} | null {
  const lat =
    finiteCoord(row.customer_lat) ??
    finiteCoord(row.customerLat);
  const lng =
    finiteCoord(row.customer_lng) ??
    finiteCoord(row.customerLng);
  if (lat != null && lng != null) return { lat, lng };

  const addr = parseDeliveryAddress(row.delivery_address);
  if (!addr) return null;

  const coords = addr.coordinates;
  const coordObj =
    coords && typeof coords === 'object' && !Array.isArray(coords)
      ? (coords as Record<string, unknown>)
      : null;

  const dropLat =
    finiteCoord(addr.lat) ??
    finiteCoord(addr.latitude) ??
    (coordObj ? finiteCoord(coordObj.lat) : null);
  const dropLng =
    finiteCoord(addr.lng) ??
    finiteCoord(addr.longitude) ??
    (coordObj ? finiteCoord(coordObj.lng) : null);

  if (dropLat != null && dropLng != null) return { lat: dropLat, lng: dropLng };
  return null;
}

export function enrichVendorMealOrderDeliveryLocation(
  row: Record<string, unknown>,
  vendorLat: unknown,
  vendorLng: unknown,
): Record<string, unknown> {
  const area = shortDeliveryAreaLabel(row.delivery_address);
  const customer = customerCoordsFromMealOrder(row);
  const distanceKm = customer
    ? deriveDistanceKmFromLocations({
        pickupLat: vendorLat,
        pickupLng: vendorLng,
        dropLat: customer.lat,
        dropLng: customer.lng,
      })
    : null;

  const next = { ...row };
  if (area) next.delivery_area_label = area;
  if (distanceKm != null && Number.isFinite(distanceKm)) {
    next.delivery_distance_km = Math.round(distanceKm * 10) / 10;
  }
  return next;
}
