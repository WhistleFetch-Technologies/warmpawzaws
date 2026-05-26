/**
 * Live rider/location enrichment via Java delivery-service (never calls Pidge from Lambda).
 */

const FETCH_TIMEOUT_MS = 5000;

export type NormalizedRider = {
  name?: string;
  phone?: string;
  id?: string;
  vehicleType?: string;
  vehicleNumber?: string;
};

export type NormalizedLocation = {
  latitude: number;
  longitude: number;
};

export type DeliveryTrackingEnrichment = {
  rider?: NormalizedRider | null;
  location?: NormalizedLocation | null;
  etaMinutes?: number | null;
  providerTrackingStatus?: string | null;
  trackingUrl?: string | null;
  liveTrackingSource?: string | null;
};

function pickString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return undefined;
}

export function mergeTrackingFromDeliveryService(
  tracking: Record<string, unknown>,
  enriched: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...tracking };
  const rider = enriched.rider as Record<string, unknown> | undefined;
  const location = enriched.location as Record<string, unknown> | undefined;
  const currentLocation = enriched.currentLocation as Record<string, unknown> | undefined;

  if (rider && typeof rider === 'object') {
    out.rider = rider;
    const dp = { ...(out.deliveryPerson as Record<string, unknown> | undefined) };
    const name = pickString(rider.name);
    const phone = pickString(rider.phone);
    if (name) dp.name = name;
    if (phone) dp.phone = phone;
    if (pickString(rider.vehicleNumber)) dp.vehicleNumber = rider.vehicleNumber;
    if (pickString(rider.vehicleType)) dp.vehicleType = rider.vehicleType;
    const photo = pickString(
      (rider as Record<string, unknown>).photo,
      (rider as Record<string, unknown>).img,
      (rider as Record<string, unknown>).image,
    );
    if (photo) dp.photo = photo;
    out.deliveryPerson = dp;
  }

  if (location && typeof location === 'object') {
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.location = { latitude: lat, longitude: lng };
      out.currentLocation = { lat, lng };
    }
  } else if (currentLocation && typeof currentLocation === 'object') {
    const lat = Number(currentLocation.lat);
    const lng = Number(currentLocation.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.currentLocation = { lat, lng };
      out.location = { latitude: lat, longitude: lng };
    }
  }

  const eta = enriched.etaMinutes ?? enriched.eta;
  if (eta != null && Number.isFinite(Number(eta))) {
    out.eta = Number(eta);
    out.etaMinutes = Number(eta);
  }

  if (pickString(enriched.providerTrackingStatus)) {
    out.providerTrackingStatus = enriched.providerTrackingStatus;
  }
  if (pickString(enriched.trackingUrl)) {
    out.trackingUrl = enriched.trackingUrl;
  }
  if (pickString(enriched.liveTrackingSource)) {
    out.liveTrackingSource = enriched.liveTrackingSource;
  }

  return out;
}

/**
 * Fetches live-enriched tracking from Java GET /delivery/order/:orderType/:orderId.
 * Returns null on timeout/unavailable — caller keeps DB-backed tracking.
 */
export async function fetchLiveDeliveryTrackingFromService(
  orderType: 'meal' | 'pharmacy',
  orderId: string
): Promise<Record<string, unknown> | null> {
  const baseUrl = (process.env.DELIVERY_SERVICE_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    return null;
  }

  const url = `${baseUrl}/delivery/order/${orderType}/${encodeURIComponent(orderId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    console.log('[PIDGE TRACKING] customer enrichment fetch start', { orderType, orderId });
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.warn('[PIDGE TRACKING] delivery-service tracking HTTP', resp.status, orderId);
      return null;
    }
    const body = (await resp.json()) as { tracking?: Record<string, unknown> };
    const t = body?.tracking;
    if (!t || typeof t !== 'object') {
      return null;
    }
    return t;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[PIDGE TRACKING] delivery-service fetch failed', { orderId, orderType, error: msg });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Enrich by delivery_tracking UUID via Java GET /delivery/tracking/:id */
export async function fetchLiveTrackingByTrackingId(
  trackingId: string
): Promise<Record<string, unknown> | null> {
  const baseUrl = (process.env.DELIVERY_SERVICE_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) return null;

  const url = `${baseUrl}/delivery/tracking/${encodeURIComponent(trackingId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const body = (await resp.json()) as { tracking?: Record<string, unknown> };
    return body?.tracking && typeof body.tracking === 'object' ? body.tracking : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function applyLiveTrackingEnrichmentForCustomer(
  orderType: 'meal' | 'pharmacy',
  orderId: string,
  deliveryTracking: Record<string, unknown> | null | undefined,
  logisticsPartner: string | null | undefined
): Promise<Record<string, unknown> | null> {
  if (!deliveryTracking) return deliveryTracking ?? null;
  const partner = String(logisticsPartner ?? deliveryTracking.logistics_partner ?? '').trim().toLowerCase();
  if (partner !== 'pidge') {
    return deliveryTracking;
  }

  const live = await fetchLiveDeliveryTrackingFromService(orderType, orderId);
  if (!live) {
    return deliveryTracking;
  }

  return mergeTrackingFromDeliveryService(deliveryTracking, live);
}
