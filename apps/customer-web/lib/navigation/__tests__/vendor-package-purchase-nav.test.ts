import {
  isPackagePurchaseTransitScreen,
  PACKAGE_PURCHASE_TRANSIT_SCREENS,
  stripPackagePurchaseOverlayFields,
} from '@/lib/vendor-package-purchase-nav';

describe('vendor-package-purchase-nav', () => {
  it('recognizes booking wizards as package purchase transit screens', () => {
    expect(PACKAGE_PURCHASE_TRANSIT_SCREENS.has('walker-booking')).toBe(true);
    expect(PACKAGE_PURCHASE_TRANSIT_SCREENS.has('vet-booking')).toBe(true);
    expect(isPackagePurchaseTransitScreen('walker-booking')).toBe(true);
    expect(isPackagePurchaseTransitScreen('walker-provider-profile')).toBe(false);
  });

  it('stripPackagePurchaseOverlayFields keeps vendor profile context', () => {
    const stripped = stripPackagePurchaseOverlayFields({
      vendorId: 'v1',
      walker: { name: 'Rex Walker' },
      walkerProfileBackScreen: 'walker',
      serviceType: 'walking',
      vendorServiceId: 'pkg-1',
      serviceName: '10 Walk Bundle',
      totalSessions: 10,
      price: 999,
    });
    expect(stripped).toEqual({
      vendorId: 'v1',
      walker: { name: 'Rex Walker' },
      walkerProfileBackScreen: 'walker',
      serviceType: 'walking',
      price: 999,
    });
  });
});
