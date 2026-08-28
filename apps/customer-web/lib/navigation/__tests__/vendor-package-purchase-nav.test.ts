import {
  buildWalkerServiceDataForVendorPackagePurchase,
  clearSkipPackageAutoRedirect,
  isPackagePurchaseTransitScreen,
  markSkipPackageAutoRedirect,
  PACKAGE_PURCHASE_TRANSIT_SCREENS,
  partitionVendorServiceRowsByPackage,
  shouldSkipPackageAutoRedirect,
  stripPackagePurchaseOverlayFields,
  toggleExclusivePackageOrServiceSelection,
} from '@/lib/vendor-package-purchase-nav';

const pkgA = { id: 'pkg-a', serviceId: 'pkg-a', isPackage: true, name: 'Special grooming' };
const pkgB = { id: 'pkg-b', serviceId: 'pkg-b', isPackage: true, name: 'Monthly bundle' };
const svc1 = { id: 'svc-1', serviceId: 'svc-1', isPackage: false, name: 'Haircut' };
const svc2 = { id: 'svc-2', serviceId: 'catalog-2', isPackage: false, name: 'Bath' };
const rows = [pkgA, pkgB, svc1, svc2];

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

  it('toggleExclusivePackageOrServiceSelection unselects a selected row', () => {
    const next = toggleExclusivePackageOrServiceSelection(new Set(['svc-1', 'svc-2']), 'svc-1', rows);
    expect([...next].sort()).toEqual(['svc-2']);
  });

  it('toggleExclusivePackageOrServiceSelection selecting a package clears services and other packages', () => {
    const next = toggleExclusivePackageOrServiceSelection(
      new Set(['svc-1', 'svc-2']),
      'pkg-a',
      rows
    );
    expect([...next]).toEqual(['pkg-a']);
    const replaced = toggleExclusivePackageOrServiceSelection(new Set(['pkg-a']), 'pkg-b', rows);
    expect([...replaced]).toEqual(['pkg-b']);
  });

  it('toggleExclusivePackageOrServiceSelection selecting a service clears packages and keeps other services', () => {
    const next = toggleExclusivePackageOrServiceSelection(new Set(['pkg-a']), 'svc-1', rows);
    expect([...next]).toEqual(['svc-1']);
    const multi = toggleExclusivePackageOrServiceSelection(next, 'svc-2', rows);
    expect([...multi].sort()).toEqual(['svc-1', 'svc-2']);
  });

  it('partitionVendorServiceRowsByPackage splits mixed selection', () => {
    const { packages, services } = partitionVendorServiceRowsByPackage([pkgA, svc1, svc2]);
    expect(packages).toEqual([pkgA]);
    expect(services).toEqual([svc1, svc2]);
  });
});
