/** Carrier registry: portal-only tracking URLs for vendor-managed shipping (no AWB in URL). */

export interface CarrierDefinition {
  id: string;
  name: string;
  /** Courier tracking portal / homepage URL */
  portalTrackingUrl: string | null;
  aftershipSlug?: string;
}

export const CARRIERS: CarrierDefinition[] = [
  {
    id: 'delhivery',
    name: 'Delhivery',
    portalTrackingUrl: 'https://www.delhivery.com/tracking',
    aftershipSlug: 'delhivery',
  },
  {
    id: 'bluedart',
    name: 'Blue Dart',
    portalTrackingUrl: 'https://www.bluedart.com/tracking',
    aftershipSlug: 'bluedart',
  },
  {
    id: 'dtdc',
    name: 'DTDC',
    portalTrackingUrl: 'https://www.dtdc.com/track-your-shipment/',
    aftershipSlug: 'dtdc',
  },
  {
    id: 'xpressbees',
    name: 'XpressBees',
    portalTrackingUrl: 'https://www.xpressbees.com/shipment/tracking',
  },
  {
    id: 'ecomexpress',
    name: 'Ecom Express',
    portalTrackingUrl: 'https://www.delhivery.com/tracking',
  },
  {
    id: 'shadowfax',
    name: 'Shadowfax',
    portalTrackingUrl: 'https://www.shadowfax.in/track',
    aftershipSlug: 'shadowfax',
  },
  {
    id: 'ekart',
    name: 'Ekart Logistics',
    portalTrackingUrl: 'https://www.ekartlogistics.in/track-order',
    aftershipSlug: 'ekart-logistics',
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    portalTrackingUrl: 'https://www.shiprocket.in/shipment-tracking',
    aftershipSlug: 'shiprocket',
  },
  {
    id: 'amazon_shipping',
    name: 'Amazon Shipping',
    portalTrackingUrl: 'https://track.amazon.in',
  },
  {
    id: 'india_post',
    name: 'India Post / Speed Post',
    portalTrackingUrl: 'https://www.indiapost.gov.in/VAS/Pages/TrackConsignment.aspx',
    aftershipSlug: 'india-post',
  },
  {
    id: 'trackon',
    name: 'Trackon Couriers',
    portalTrackingUrl: 'https://trackon.in',
  },
  {
    id: 'professional',
    name: 'Professional Couriers',
    portalTrackingUrl: 'https://www.tpcindia.com/',
  },
  {
    id: 'gati',
    name: 'Gati',
    portalTrackingUrl: 'https://www.allcargogati.com/track-shipment',
  },
  {
    id: 'safexpress',
    name: 'Safexpress',
    portalTrackingUrl: 'https://www.safexpress.com/track/',
  },
  {
    id: 'custom',
    name: 'Other Carrier',
    portalTrackingUrl: null,
  },
];

/** Legacy FedEx — not in vendor dropdown; kept for normalizeCarrierKey on old orders. */
const LEGACY_CARRIERS: CarrierDefinition[] = [
  {
    id: 'fedex',
    name: 'FedEx',
    portalTrackingUrl: 'https://www.fedex.com/fedextrack/',
    aftershipSlug: 'fedex',
  },
];

export const CARRIER_PATTERNS: Record<string, CarrierDefinition> = Object.fromEntries(
  [...CARRIERS, ...LEGACY_CARRIERS].map((c) => [c.id, c])
);

const REGISTRY_KNOWN_CARRIER_IDS = new Set(
  CARRIERS.filter((c) => c.id !== 'custom').map((c) => c.id)
);

const LABEL_TO_CARRIER_ID: Record<string, string> = {
  bluedart: 'bluedart',
  'blue dart': 'bluedart',
  delhivery: 'delhivery',
  dtdc: 'dtdc',
  xpressbees: 'xpressbees',
  'xpress bees': 'xpressbees',
  ecomexpress: 'ecomexpress',
  'ecom express': 'ecomexpress',
  shadowfax: 'shadowfax',
  ekart: 'ekart',
  'ekart logistics': 'ekart',
  'ekart-logistics': 'ekart',
  shiprocket: 'shiprocket',
  amazon_shipping: 'amazon_shipping',
  'amazon shipping': 'amazon_shipping',
  amazon: 'amazon_shipping',
  india_post: 'india_post',
  'india post': 'india_post',
  'india post / speed post': 'india_post',
  'speed post': 'india_post',
  trackon: 'trackon',
  'trackon couriers': 'trackon',
  professional: 'professional',
  'professional couriers': 'professional',
  tpc: 'professional',
  gati: 'gati',
  safexpress: 'safexpress',
  fedex: 'fedex',
  other: 'custom',
  'other carrier': 'custom',
  custom: 'custom',
};

/** True for vendor-dropdown registry carriers (not Other Carrier). */
export function isRegistryKnownCarrier(carrierKey: string): boolean {
  return REGISTRY_KNOWN_CARRIER_IDS.has(carrierKey);
}

/** Map vendor UI labels / slugs to internal carrier key. */
export function normalizeCarrierKey(partner: string): string {
  const raw = (partner || '').trim();
  if (!raw) return 'custom';

  const lower = raw.toLowerCase();
  if (LABEL_TO_CARRIER_ID[lower]) return LABEL_TO_CARRIER_ID[lower];

  for (const carrier of CARRIERS) {
    if (carrier.name.toLowerCase() === lower) return carrier.id;
  }

  for (const carrier of LEGACY_CARRIERS) {
    if (carrier.name.toLowerCase() === lower) return carrier.id;
  }

  return lower.replace(/\s+/g, '_');
}

export function getAftershipSlug(carrierKey: string): string | undefined {
  return CARRIER_PATTERNS[carrierKey]?.aftershipSlug;
}

export function buildTrackingUrl(
  carrierKey: string,
  _trackingNumber: string,
  explicitUrl?: string
): string | null {
  if (isRegistryKnownCarrier(carrierKey)) {
    return CARRIER_PATTERNS[carrierKey]?.portalTrackingUrl ?? null;
  }

  return explicitUrl?.trim() || null;
}

export function getCarrierDisplayName(carrierKey: string): string {
  return CARRIER_PATTERNS[carrierKey]?.name || carrierKey;
}

export function supportsAutoTrackingUrl(carrierKey: string): boolean {
  if (carrierKey === 'custom') return false;
  return Boolean(CARRIER_PATTERNS[carrierKey]?.portalTrackingUrl);
}

export function isKnownCarrierKey(carrierKey: string): boolean {
  return carrierKey === 'custom' || Boolean(CARRIER_PATTERNS[carrierKey]);
}
