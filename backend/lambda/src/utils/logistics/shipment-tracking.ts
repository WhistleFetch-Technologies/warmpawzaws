/**
 * Shared shipment tracking validation, immutability checks, and API response shaping.
 * Source of truth for tracking number: shipments.awb_code
 * TODO: Deprecate orders.tracking_number — compatibility mirror only.
 */
import {
  buildTrackingUrl,
  CARRIERS,
  getCarrierDisplayName,
  isRegistryKnownCarrier,
  normalizeCarrierKey,
  supportsAutoTrackingUrl,
} from './carrier-patterns';

export const IDENTIFIER_TYPE_UNKNOWN = 'UNKNOWN';

export interface StructuredTracking {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string | null;
  identifierType: typeof IDENTIFIER_TYPE_UNKNOWN;
  shippedAt: string | null;
  locked: boolean;
}

export interface MarkShippedBodyInput {
  carrierId?: string;
  carrier?: string;
  carrierName?: string;
  deliveryPartner?: string;
  delivery_partner?: string;
  trackingNumber?: string;
  tracking_number?: string;
  trackingIdentifier?: string;
  trackingUrl?: string;
  tracking_url?: string;
  notes?: string;
}

export interface ParsedMarkShippedInput {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl?: string;
  notes?: string;
}

const LOCKED_ORDER_STATUSES = new Set(['shipped', 'out_for_delivery', 'delivered']);

export function listCarriersForVendor(): Array<{
  id: string;
  name: string;
  supportsAutoTrackingUrl: boolean;
}> {
  return CARRIERS.filter((c) => c.id !== 'custom').map((c) => ({
    id: c.id,
    name: c.name,
    supportsAutoTrackingUrl: supportsAutoTrackingUrl(c.id),
  }));
}

export function isValidTrackingUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateMarkShippedInput(input: ParsedMarkShippedInput): string | null {
  const tracking = input.trackingNumber?.trim() || '';
  if (!tracking) return 'Tracking number is required';
  if (tracking.length < 5) return 'Tracking number must be at least 5 characters';
  if (tracking.length > 100) return 'Tracking number must be at most 100 characters';

  if (!input.carrierId) return 'Courier partner is required';

  if (input.carrierId === 'custom') {
    const name = input.carrierName?.trim() || '';
    if (!name) return 'Carrier name is required when selecting Other';
    if (name.length > 120) return 'Carrier name must be at most 120 characters';
  }

  if (isRegistryKnownCarrier(input.carrierId) && input.trackingUrl?.trim()) {
    return 'Tracking URL cannot be set for a known courier partner';
  }

  if (input.trackingUrl?.trim() && !isValidTrackingUrl(input.trackingUrl)) {
    return 'Tracking URL must be a valid http or https URL';
  }

  return null;
}

export function parseMarkShippedBody(body: MarkShippedBodyInput): ParsedMarkShippedInput {
  const rawCarrier =
    body.carrierId ||
    body.carrier ||
    body.deliveryPartner ||
    body.delivery_partner ||
    '';

  const carrierId = normalizeCarrierKey(rawCarrier);
  const registryName = getCarrierDisplayName(carrierId);
  const customName = body.carrierName?.trim();
  const carrierName =
    carrierId === 'custom' && customName ? customName : registryName;

  const rawTrackingUrl = body.trackingUrl || body.tracking_url;

  return {
    carrierId,
    carrierName,
    trackingNumber: (
      body.trackingNumber ||
      body.tracking_number ||
      body.trackingIdentifier ||
      ''
    ).trim(),
    trackingUrl: isRegistryKnownCarrier(carrierId) ? undefined : rawTrackingUrl,
    notes: body.notes,
  };
}

/** Returns error message if tracking is locked and cannot be changed. */
export function getShipmentTrackingLockedError(orderStatus: string): string | null {
  if (LOCKED_ORDER_STATUSES.has(orderStatus)) {
    return 'Tracking already submitted and cannot be changed';
  }
  return null;
}

/** Stricter guard for endpoints that overwrite shipment rows. */
export function getShipmentOverwriteLockedError(
  orderStatus: string,
  existingAwb?: string | null
): string | null {
  const statusError = getShipmentTrackingLockedError(orderStatus);
  if (statusError) return statusError;

  if (existingAwb && String(existingAwb).trim()) {
    return 'Tracking already submitted and cannot be changed';
  }

  return null;
}

export function bodyContainsTrackingFields(body: Record<string, unknown>): boolean {
  const keys = [
    'trackingNumber',
    'tracking_number',
    'trackingIdentifier',
    'trackingUrl',
    'tracking_url',
    'deliveryPartner',
    'delivery_partner',
    'carrierId',
    'carrier',
    'carrierName',
  ];
  return keys.some((k) => body[k] !== undefined && body[k] !== null && body[k] !== '');
}

export function buildStructuredTracking(
  order: {
    order_status?: string;
    tracking_number?: string | null;
    delivery_partner?: string | null;
    shipped_at?: string | null;
  },
  shipment?: {
    awb_code?: string | null;
    logistics_partner?: string | null;
    tracking_url?: string | null;
    courier_name?: string | null;
    shipped_at?: string | null;
    estimated_delivery?: string | null;
  } | null
): StructuredTracking | null {
  const trackingNumber = (
    shipment?.awb_code ||
    order.tracking_number ||
    ''
  ).trim();

  if (!trackingNumber) return null;

  const carrierId = normalizeCarrierKey(
    shipment?.logistics_partner || order.delivery_partner || 'custom'
  );
  const carrierName =
    shipment?.courier_name ||
    order.delivery_partner ||
    getCarrierDisplayName(carrierId);

  const trackingUrl =
    shipment?.tracking_url ||
    buildTrackingUrl(carrierId, trackingNumber) ||
    null;

  const orderStatus = order.order_status || '';
  const locked =
    LOCKED_ORDER_STATUSES.has(orderStatus) ||
    Boolean(shipment?.awb_code?.trim());

  return {
    carrierId,
    carrierName,
    trackingNumber,
    trackingUrl,
    identifierType: IDENTIFIER_TYPE_UNKNOWN,
    shippedAt: shipment?.shipped_at || order.shipped_at || null,
    locked,
  };
}

export function toLegacyTrackingResponse(tracking: StructuredTracking) {
  return {
    carrierId: tracking.carrierId,
    carrierName: tracking.carrierName,
    trackingNumber: tracking.trackingNumber,
    trackingUrl: tracking.trackingUrl,
    identifierType: tracking.identifierType,
    shippedAt: tracking.shippedAt,
    locked: tracking.locked,
    // backward-compatible aliases
    awb: tracking.trackingNumber,
    partner: tracking.carrierId,
    partnerDisplay: tracking.carrierName,
  };
}
