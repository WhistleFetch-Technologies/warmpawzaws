/** Carrier URL templates and display names for vendor-managed shipping. */

export const CARRIER_PATTERNS: Record<
  string,
  { name: string; trackingUrlTemplate: string; aftershipSlug?: string }
> = {
  bluedart: {
    name: 'Blue Dart',
    trackingUrlTemplate: 'https://www.bluedart.com/tracking?tracknumbers={awb}',
    aftershipSlug: 'bluedart',
  },
  delhivery: {
    name: 'Delhivery',
    trackingUrlTemplate: 'https://www.delhivery.com/track/package/{awb}',
    aftershipSlug: 'delhivery',
  },
  dtdc: {
    name: 'DTDC',
    trackingUrlTemplate:
      'https://tracking.dtdc.com/ctbs-tracking/customerInterface.tr?submitName=showCITrackingDetails&cType=Ref&cnNo={awb}',
    aftershipSlug: 'dtdc',
  },
  shiprocket: {
    name: 'Shiprocket',
    trackingUrlTemplate: 'https://shiprocket.co/tracking/{awb}',
    aftershipSlug: 'shiprocket',
  },
  ekart: {
    name: 'Ekart',
    trackingUrlTemplate: 'https://ekartlogistics.com/shipmenttrack/{awb}',
    aftershipSlug: 'ekart-logistics',
  },
  shadowfax: {
    name: 'Shadowfax',
    trackingUrlTemplate: 'https://tracker.shadowfax.in/#/order/{awb}',
    aftershipSlug: 'shadowfax',
  },
  india_post: {
    name: 'India Post',
    trackingUrlTemplate:
      'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?{awb}',
    aftershipSlug: 'india-post',
  },
  fedex: {
    name: 'FedEx',
    trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={awb}',
    aftershipSlug: 'fedex',
  },
  custom: {
    name: 'Other Carrier',
    trackingUrlTemplate: '{tracking_url}',
  },
};

/** Map vendor UI labels / slugs to internal carrier key. */
export function normalizeCarrierKey(partner: string): string {
  const raw = (partner || '').trim();
  if (!raw) return 'custom';

  const lower = raw.toLowerCase();
  const labelMap: Record<string, string> = {
    bluedart: 'bluedart',
    'blue dart': 'bluedart',
    delhivery: 'delhivery',
    dtdc: 'dtdc',
    shiprocket: 'shiprocket',
    ekart: 'ekart',
    'ekart-logistics': 'ekart',
    shadowfax: 'shadowfax',
    'india post': 'india_post',
    india_post: 'india_post',
    fedex: 'fedex',
    other: 'custom',
    custom: 'custom',
  };

  if (labelMap[lower]) return labelMap[lower];

  for (const [key, val] of Object.entries(CARRIER_PATTERNS)) {
    if (val.name.toLowerCase() === lower) return key;
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

  const pattern = CARRIER_PATTERNS[carrierKey];
  if (!pattern || carrierKey === 'custom') return explicitUrl?.trim() || null;

  return pattern.trackingUrlTemplate.replace('{awb}', trackingNumber);
}

export function getCarrierDisplayName(carrierKey: string): string {
  return CARRIER_PATTERNS[carrierKey]?.name || carrierKey;
}
