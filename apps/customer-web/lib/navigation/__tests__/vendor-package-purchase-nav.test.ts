import {
  buildWalkerServiceDataForVendorPackagePurchase,
  clearSkipPackageAutoRedirect,
  isPackagePurchaseTransitScreen,
  markSkipPackageAutoRedirect,
  PACKAGE_PURCHASE_TRANSIT_SCREENS,
  shouldSkipPackageAutoRedirect,
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

  it('builds package purchase payload from metadata packageDetails', () => {
    const nav = buildWalkerServiceDataForVendorPackagePurchase({
      vendorId: 'vendor-1',
      vendorName: 'Puppy Pro',
      serviceTypeCategory: 'walking',
      serviceRow: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Puppy Walking Monthly Package',
        metadata: {
          isPackage: true,
          packageDetails: { totalSessions: 48, price: 12712, sessionsPerDay: 2 },
        },
      },
    });
    expect(nav).toMatchObject({
      vendorId: 'vendor-1',
      vendorServiceId: '11111111-1111-4111-8111-111111111111',
      totalSessions: 48,
      sessionsPerDay: 2,
      price: 12712,
    });
  });

  it('clears skip flag so a second explicit package open is not blocked', () => {
    const vid = 'v-skip';
    const sid = 's-skip';
    markSkipPackageAutoRedirect(vid, sid);
    expect(shouldSkipPackageAutoRedirect(vid, sid)).toBe(true);
    clearSkipPackageAutoRedirect(vid, sid);
    expect(shouldSkipPackageAutoRedirect(vid, sid)).toBe(false);
  });
});
