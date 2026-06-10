/** Carrier registry aligned with backend carrier-patterns.ts (vendor-managed shipping). */

export interface VendorCarrierOption {
  id: string;
  name: string;
  supportsAutoTrackingUrl: boolean;
}

export const VENDOR_CARRIER_OPTIONS: VendorCarrierOption[] = [
  { id: 'delhivery', name: 'Delhivery', supportsAutoTrackingUrl: true },
  { id: 'bluedart', name: 'Blue Dart', supportsAutoTrackingUrl: true },
  { id: 'dtdc', name: 'DTDC', supportsAutoTrackingUrl: true },
  { id: 'xpressbees', name: 'XpressBees', supportsAutoTrackingUrl: true },
  { id: 'ecomexpress', name: 'Ecom Express', supportsAutoTrackingUrl: true },
  { id: 'shadowfax', name: 'Shadowfax', supportsAutoTrackingUrl: true },
  { id: 'ekart', name: 'Ekart Logistics', supportsAutoTrackingUrl: true },
  { id: 'shiprocket', name: 'Shiprocket', supportsAutoTrackingUrl: true },
  { id: 'amazon_shipping', name: 'Amazon Shipping', supportsAutoTrackingUrl: true },
  { id: 'india_post', name: 'India Post / Speed Post', supportsAutoTrackingUrl: true },
  { id: 'trackon', name: 'Trackon Couriers', supportsAutoTrackingUrl: true },
  { id: 'professional', name: 'Professional Couriers', supportsAutoTrackingUrl: true },
  { id: 'gati', name: 'Gati', supportsAutoTrackingUrl: true },
  { id: 'safexpress', name: 'Safexpress', supportsAutoTrackingUrl: true },
  { id: 'custom', name: 'Other Carrier', supportsAutoTrackingUrl: false },
];

export const CUSTOM_CARRIER_ID = 'custom';

export function validateShipmentForm(input: {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const tracking = input.trackingNumber.trim();

  if (!input.carrierId) {
    errors.carrierId = 'Courier partner is required';
  }

  if (input.carrierId === CUSTOM_CARRIER_ID && !input.carrierName.trim()) {
    errors.carrierName = 'Carrier name is required when selecting Other Carrier';
  }

  if (!tracking) {
    errors.trackingNumber = 'Tracking number is required';
  } else if (tracking.length < 5) {
    errors.trackingNumber = 'Tracking number must be at least 5 characters';
  } else if (tracking.length > 100) {
    errors.trackingNumber = 'Tracking number must be at most 100 characters';
  }

  if (input.carrierId === CUSTOM_CARRIER_ID) {
    const url = input.trackingUrl.trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errors.trackingUrl = 'Tracking URL must start with http:// or https://';
        }
      } catch {
        errors.trackingUrl = 'Tracking URL must be a valid URL';
      }
    }
  }

  return errors;
}

export function buildMarkShippedPayload(input: {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
  notes?: string;
}) {
  const option = VENDOR_CARRIER_OPTIONS.find((c) => c.id === input.carrierId);
  const resolvedName =
    input.carrierId === CUSTOM_CARRIER_ID
      ? input.carrierName.trim()
      : option?.name || input.carrierName.trim();

  const trackingUrl =
    input.carrierId === CUSTOM_CARRIER_ID
      ? input.trackingUrl.trim() || undefined
      : undefined;

  return {
    carrierId: input.carrierId,
    carrierName: resolvedName,
    trackingNumber: input.trackingNumber.trim(),
    trackingUrl,
    notes: input.notes,
  };
}
