import {
  buildTrackingUrl,
  getAftershipSlug,
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

describe('carrier-patterns', () => {
  it('normalizes vendor UI labels to carrier keys', () => {
    expect(normalizeCarrierKey('Delhivery')).toBe('delhivery');
    expect(normalizeCarrierKey('BlueDart')).toBe('bluedart');
    expect(normalizeCarrierKey('Other')).toBe('custom');
    expect(normalizeCarrierKey('XpressBees')).toBe('xpressbees');
    expect(normalizeCarrierKey('Amazon Shipping')).toBe('amazon_shipping');
    expect(normalizeCarrierKey('Professional Couriers')).toBe('professional');
  });

  it('builds Delhivery tracking URL from portal base + AWB suffix', () => {
    const url = buildTrackingUrl('delhivery', 'AWB123');
    expect(url).toBe('https://www.delhivery.com/tracking/AWB123');
  });

  it('builds Blue Dart tracking URL from portal base + query suffix', () => {
    const url = buildTrackingUrl('bluedart', 'AWB123');
    expect(url).toBe('https://www.bluedart.com/tracking?tracknumbers=AWB123');
  });

  it('builds XpressBees tracking URL from portal base + path suffix', () => {
    const url = buildTrackingUrl('xpressbees', 'XB999');
    expect(url).toBe('https://www.xpressbees.com/shipment/tracking/XB999');
  });

  it('builds Amazon Shipping tracking URL from portal base + query suffix', () => {
    const url = buildTrackingUrl('amazon_shipping', 'AMZ123');
    expect(url).toBe('https://track.amazon.in?trackingId=AMZ123');
  });

  it('returns null for custom carrier without explicit URL', () => {
    expect(buildTrackingUrl('custom', 'AWB123')).toBeNull();
  });

  it('uses explicit vendor URL when provided', () => {
    expect(
      buildTrackingUrl('delhivery', 'AWB123', 'https://example.com/track/AWB123')
    ).toBe('https://example.com/track/AWB123');
  });

  it('maps carrier keys to AfterShip slugs', () => {
    expect(getAftershipSlug('delhivery')).toBe('delhivery');
    expect(getAftershipSlug('ekart')).toBe('ekart-logistics');
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
