import {
  buildTrackingUrl,
  getAftershipSlug,
  normalizeCarrierKey,
} from '../carrier-patterns';
import {
  mapAfterShipTagToShipmentStatus,
  mapShipmentStatusToOrderStatus,
} from '../shipment-order-sync';

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
