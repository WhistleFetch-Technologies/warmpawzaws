import {
  buildTrackingUrl,
  getAftershipSlug,
  isRegistryKnownCarrier,
  normalizeCarrierKey,
} from '../carrier-patterns';
import {
  mapAfterShipTagToShipmentStatus,
  mapShipmentStatusToOrderStatus,
} from '../shipment-order-sync';
import {
  resolveDeliveryPincode,
  resolvePickupPincode,
  shipmentPincodeFieldsForInsert,
} from '../shipment-pincodes';
import {
  buildStructuredTracking,
  parseMarkShippedBody,
  validateMarkShippedInput,
} from '../shipment-tracking';

const SAMPLE_AWB = 'AWB123456';

describe('carrier-patterns', () => {
  it('normalizes vendor UI labels to carrier keys', () => {
    expect(normalizeCarrierKey('Delhivery')).toBe('delhivery');
    expect(normalizeCarrierKey('BlueDart')).toBe('bluedart');
    expect(normalizeCarrierKey('Other')).toBe('custom');
    expect(normalizeCarrierKey('XpressBees')).toBe('xpressbees');
    expect(normalizeCarrierKey('Amazon Shipping')).toBe('amazon_shipping');
    expect(normalizeCarrierKey('Professional Couriers')).toBe('professional');
  });

  it('identifies registry known carriers', () => {
    expect(isRegistryKnownCarrier('dtdc')).toBe(true);
    expect(isRegistryKnownCarrier('custom')).toBe(false);
    expect(isRegistryKnownCarrier('unknown_courier')).toBe(false);
  });

  it('builds portal-only Delhivery tracking URL without AWB', () => {
    const url = buildTrackingUrl('delhivery', SAMPLE_AWB);
    expect(url).toBe('https://www.delhivery.com/tracking');
    expect(url).not.toContain(SAMPLE_AWB);
  });

  it('builds portal-only DTDC tracking URL without AWB', () => {
    const url = buildTrackingUrl('dtdc', SAMPLE_AWB);
    expect(url).toBe('https://www.dtdc.com/track-your-shipment/');
    expect(url).not.toContain('cnNo');
    expect(url).not.toContain(SAMPLE_AWB);
  });

  it('builds portal-only Blue Dart tracking URL without AWB suffix', () => {
    const url = buildTrackingUrl('bluedart', SAMPLE_AWB);
    expect(url).toBe('https://www.bluedart.com/tracking');
    expect(url).not.toContain('tracknumbers');
  });

  it('builds portal-only Ecom Express URL via Delhivery portal', () => {
    const url = buildTrackingUrl('ecomexpress', SAMPLE_AWB);
    expect(url).toBe('https://www.delhivery.com/tracking');
  });

  it('builds portal-only Shadowfax URL without path suffix', () => {
    const url = buildTrackingUrl('shadowfax', SAMPLE_AWB);
    expect(url).toBe('https://www.shadowfax.in/track');
    expect(url).not.toContain(SAMPLE_AWB);
  });

  it('ignores explicit vendor URL for known couriers', () => {
    expect(
      buildTrackingUrl('delhivery', SAMPLE_AWB, 'https://example.com/track/AWB123')
    ).toBe('https://www.delhivery.com/tracking');
  });

  it('returns null for custom carrier without explicit URL', () => {
    expect(buildTrackingUrl('custom', SAMPLE_AWB)).toBeNull();
  });

  it('uses explicit vendor URL for custom carrier', () => {
    expect(
      buildTrackingUrl('custom', SAMPLE_AWB, 'https://example.com/track/AWB123')
    ).toBe('https://example.com/track/AWB123');
  });

  it('maps carrier keys to AfterShip slugs', () => {
    expect(getAftershipSlug('delhivery')).toBe('delhivery');
    expect(getAftershipSlug('ekart')).toBe('ekart-logistics');
  });
});

describe('mark-shipped validation', () => {
  it('rejects tracking URL for known courier', () => {
    const error = validateMarkShippedInput({
      carrierId: 'dtdc',
      carrierName: 'DTDC',
      trackingNumber: SAMPLE_AWB,
      trackingUrl: 'https://example.com/track',
    });
    expect(error).toBe('Tracking URL cannot be set for a known courier partner');
  });

  it('allows optional tracking URL for Other Carrier', () => {
    const error = validateMarkShippedInput({
      carrierId: 'custom',
      carrierName: 'Fast Cargo',
      trackingNumber: SAMPLE_AWB,
      trackingUrl: 'https://example.com/track',
    });
    expect(error).toBeNull();
  });

  it('strips tracking URL when parsing known courier body', () => {
    const parsed = parseMarkShippedBody({
      carrierId: 'dtdc',
      trackingNumber: SAMPLE_AWB,
      trackingUrl: 'https://example.com/track',
    });
    expect(parsed.trackingUrl).toBeUndefined();
  });
});

describe('shipment-order-sync', () => {
  it('maps AfterShip tags to shipment statuses', () => {
    expect(mapAfterShipTagToShipmentStatus('Delivered')).toBe('delivered');
    expect(mapAfterShipTagToShipmentStatus('InTransit')).toBe('in_transit');
    expect(mapAfterShipTagToShipmentStatus('OutForDelivery')).toBe('out_for_delivery');
  });

  it('maps shipment statuses to order statuses', () => {
    expect(mapShipmentStatusToOrderStatus('in_transit')).toBe('shipped');
    expect(mapShipmentStatusToOrderStatus('delivered')).toBe('delivered');
    expect(mapShipmentStatusToOrderStatus('out_for_delivery')).toBe('out_for_delivery');
  });
});

describe('shipment-pincodes', () => {
  it('uses vendor shipping origin then pincode for pickup', () => {
    const fields = shipmentPincodeFieldsForInsert(
      { shipping_pincode: '110001' },
      { shipping_origin_pincode: '400001', pincode: '560002' }
    );
    expect(fields.pickup_pincode).toBe('400001');
    expect(fields.delivery_pincode).toBe('110001');
  });

  it('falls back to defaults when pincodes are missing', () => {
    const fields = shipmentPincodeFieldsForInsert({}, {});
    expect(fields.pickup_pincode).toBe('560001');
    expect(fields.delivery_pincode).toBe('000000');
  });

  it('reads delivery pincode from shipping_address JSON', () => {
    expect(
      resolveDeliveryPincode({
        shipping_address: JSON.stringify({ pincode: '700001' }),
      })
    ).toBe('700001');
    expect(resolvePickupPincode({}, { pincode: '560078' })).toBe('560078');
  });
});

describe('buildStructuredTracking', () => {
  it('overrides stale stored deep link with registry portal for known couriers', () => {
    const tracking = buildStructuredTracking(
      { order_status: 'shipped', tracking_number: 'FALLBACK123' },
      {
        awb_code: 'AWB999',
        logistics_partner: 'delhivery',
        courier_name: 'Delhivery',
        tracking_url: 'https://www.delhivery.com/tracking/AWB999',
        shipped_at: '2026-06-01T10:00:00.000Z',
      }
    );

    expect(tracking).toMatchObject({
      carrierId: 'delhivery',
      carrierName: 'Delhivery',
      trackingNumber: 'AWB999',
      trackingUrl: 'https://www.delhivery.com/tracking',
      shippedAt: '2026-06-01T10:00:00.000Z',
      locked: true,
    });
    expect(tracking).not.toHaveProperty('estimatedDelivery');
  });

  it('overrides legacy DTDC stored URL with current portal', () => {
    const tracking = buildStructuredTracking(
      { order_status: 'shipped' },
      {
        awb_code: 'C14535860',
        logistics_partner: 'dtdc',
        courier_name: 'DTDC',
        tracking_url:
          'https://www.dtdc.in/tracking/shipment-tracking.asp?cnNo=C14535860',
        shipped_at: '2026-06-10T05:41:14.857Z',
      }
    );

    expect(tracking?.trackingUrl).toBe('https://www.dtdc.com/track-your-shipment/');
    expect(tracking?.trackingUrl).not.toContain('shipment-tracking.asp');
    expect(tracking?.trackingUrl).not.toContain('C14535860');
  });

  it('falls back to portal-only URL when shipment has no stored tracking_url', () => {
    const tracking = buildStructuredTracking(
      { order_status: 'shipped' },
      {
        awb_code: 'C14535860',
        logistics_partner: 'dtdc',
        courier_name: 'DTDC',
        shipped_at: '2026-06-01T10:00:00.000Z',
      }
    );

    expect(tracking?.trackingUrl).toBe('https://www.dtdc.com/track-your-shipment/');
    expect(tracking?.trackingUrl).not.toContain('C14535860');
  });

  it('returns null when no tracking number is available', () => {
    expect(buildStructuredTracking({ order_status: 'processing' }, null)).toBeNull();
  });
});
