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
  });

  it('builds Delhivery tracking URL from AWB', () => {
    const url = buildTrackingUrl('delhivery', 'AWB123');
    expect(url).toBe('https://www.delhivery.com/track/package/AWB123');
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
