/** Carrier registry: portal base URL + AWB suffix concatenation for vendor-managed shipping. */

export interface CarrierDefinition {
  id: string;
  name: string;
  /** Portal tracking page base URL */
  portalTrackingUrl: string | null;
  /** Appended to portal URL; must contain {awb}. null = no auto URL (custom / portal-only). */
  awbSuffix: string | null;
  aftershipSlug?: string;
}

export const CARRIERS: CarrierDefinition[] = [
  {
    id: 'delhivery',
    name: 'Delhivery',
    portalTrackingUrl: 'https://www.delhivery.com/tracking',
    awbSuffix: '/{awb}',
    aftershipSlug: 'delhivery',
  },
  {
    id: 'bluedart',
    name: 'Blue Dart',
    portalTrackingUrl: 'https://www.bluedart.com/tracking',
    awbSuffix: '?tracknumbers={awb}',
    aftershipSlug: 'bluedart',
  },
  {
    id: 'dtdc',
    name: 'DTDC',
    portalTrackingUrl: 'https://www.dtdc.in/tracking/shipment-tracking.asp',
    awbSuffix: '?cnNo={awb}',
    aftershipSlug: 'dtdc',
  },
  {
    id: 'xpressbees',
    name: 'XpressBees',
    portalTrackingUrl: 'https://www.xpressbees.com/shipment/tracking',
    awbSuffix: '/{awb}',
  },
  {
    id: 'ecomexpress',
    name: 'Ecom Express',
    portalTrackingUrl: 'https://ecomexpress.in/tracking',
    awbSuffix: '/{awb}',
  },
  {
    id: 'shadowfax',
    name: 'Shadowfax',
    portalTrackingUrl: 'https://www.shadowfax.in/tracking',
    awbSuffix: '/{awb}',
    aftershipSlug: 'shadowfax',
  },
  {
    id: 'ekart',
    name: 'Ekart Logistics',
    portalTrackingUrl: 'https://ekartlogistics.com',
    awbSuffix: '/shipmenttrack/{awb}',
    aftershipSlug: 'ekart-logistics',
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    portalTrackingUrl: 'https://www.shiprocket.in/shipment-tracking',
    awbSuffix: '/{awb}',
    aftershipSlug: 'shiprocket',
  },
  {
    id: 'amazon_shipping',
    name: 'Amazon Shipping',
    portalTrackingUrl: 'https://track.amazon.in',
    awbSuffix: '?trackingId={awb}',
  },
  {
    id: 'india_post',
    name: 'India Post / Speed Post',
    portalTrackingUrl:
      'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx',
    awbSuffix: '?{awb}',
    aftershipSlug: 'india-post',
  },
  {
    id: 'trackon',
    name: 'Trackon Couriers',
    portalTrackingUrl: 'https://trackon.in',
    awbSuffix: '/?track={awb}',
  },
  {
    id: 'professional',
    name: 'Professional Couriers',
    portalTrackingUrl: 'https://www.tpcindia.com/Tracking.aspx',
    awbSuffix: '?TrackingNo={awb}',
  },
  {
    id: 'gati',
    name: 'Gati',
    portalTrackingUrl: 'https://www.gati.com/tracking',
    awbSuffix: '/{awb}',
  },
  {
    id: 'safexpress',
    name: 'Safexpress',
    portalTrackingUrl: 'https://www.safexpress.com',
    awbSuffix: '/?awb={awb}',
  },
  {
    id: 'custom',
    name: 'Other Carrier',
    portalTrackingUrl: null,
    awbSuffix: null,
  },
];

/** Legacy FedEx — not in vendor dropdown; kept for normalizeCarrierKey on old orders. */
const LEGACY_CARRIERS: CarrierDefinition[] = [
  {
    id: 'fedex',
    name: 'FedEx',
    portalTrackingUrl: 'https://www.fedex.com/fedextrack/',
    awbSuffix: '?trknbr={awb}',
    aftershipSlug: 'fedex',
  },
];

export const CARRIER_PATTERNS: Record<string, CarrierDefinition> = Object.fromEntries(
  [...CARRIERS, ...LEGACY_CARRIERS].map((c) => [c.id, c])
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
  trackingNumber: string,
  explicitUrl?: string
): string | null {
  if (explicitUrl?.trim()) return explicitUrl.trim();

  const carrier = CARRIER_PATTERNS[carrierKey];
  if (!carrier?.portalTrackingUrl || !carrier.awbSuffix || carrierKey === 'custom') {
    return explicitUrl?.trim() || null;
  }

  const awb = encodeURIComponent(trackingNumber.trim());
  return `${carrier.portalTrackingUrl}${carrier.awbSuffix.replace('{awb}', awb)}`;
}

export function getCarrierDisplayName(carrierKey: string): string {
  return CARRIER_PATTERNS[carrierKey]?.name || carrierKey;
}

export function supportsAutoTrackingUrl(carrierKey: string): boolean {
  const carrier = CARRIER_PATTERNS[carrierKey];
  return Boolean(carrier?.portalTrackingUrl && carrier.awbSuffix && carrierKey !== 'custom');
}

export function isKnownCarrierKey(carrierKey: string): boolean {
  return carrierKey === 'custom' || Boolean(CARRIER_PATTERNS[carrierKey]);
}
