/** Legacy shipments table requires NOT NULL pickup_pincode / delivery_pincode (migration 004). */

const DEFAULT_PICKUP_PINCODE = '560001';
const DEFAULT_DELIVERY_PINCODE = '000000';

function normalizePinDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

function isSixDigitPin(value: unknown): boolean {
  return normalizePinDigits(value).length === 6;
}

export function parseOrderShippingAddress(
  order: Record<string, unknown>
): Record<string, unknown> | null {
  const raw = order.shipping_address;
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function resolveDeliveryPincode(order: Record<string, unknown>): string {
  const addr = parseOrderShippingAddress(order);
  const candidates = [
    addr?.pincode,
    addr?.zip,
    addr?.postal_code,
    addr?.address_pincode,
    order.shipping_pincode,
    order.shippingPincode,
  ];
  for (const candidate of candidates) {
    if (isSixDigitPin(candidate)) return normalizePinDigits(candidate);
  }
  const fallback = String(candidates.find((c) => c != null && String(c).trim()) ?? '').trim();
  return fallback || DEFAULT_DELIVERY_PINCODE;
}

export function resolvePickupPincode(
  order: Record<string, unknown>,
  vendor?: Record<string, unknown> | null
): string {
  if (isSixDigitPin(order.pickup_pincode)) {
    return normalizePinDigits(order.pickup_pincode);
  }
  const vendorCandidates = [vendor?.shipping_origin_pincode, vendor?.pincode];
  for (const candidate of vendorCandidates) {
    if (isSixDigitPin(candidate)) return normalizePinDigits(candidate);
  }
  return DEFAULT_PICKUP_PINCODE;
}

/** Required on INSERT when legacy NOT NULL columns exist on shipments. */
export function shipmentPincodeFieldsForInsert(
  order: Record<string, unknown>,
  vendor?: Record<string, unknown> | null
): { pickup_pincode: string; delivery_pincode: string } {
  return {
    pickup_pincode: resolvePickupPincode(order, vendor),
    delivery_pincode: resolveDeliveryPincode(order),
  };
}
