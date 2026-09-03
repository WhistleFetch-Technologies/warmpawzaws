import {
  isVendorServicePackagePayload,
  isVendorServicePackageRow,
  normalizePackageCommerceMode,
} from '../vendor-service-is-package';

describe('vendor-service-is-package', () => {
  it('detects metadata.isPackage', () => {
    expect(isVendorServicePackageRow({ metadata: { isPackage: true } })).toBe(true);
    expect(isVendorServicePackageRow({ isPackage: true })).toBe(true);
    expect(isVendorServicePackageRow({ price: 100 })).toBe(false);
  });

  it('detects packageDetails session bundles', () => {
    expect(
      isVendorServicePackageRow({
        metadata: { packageDetails: { totalSessions: 8, price: 4000 } },
      }),
    ).toBe(true);
  });

  it('detects package payload for lock exception', () => {
    expect(isVendorServicePackagePayload({ isPackage: true, customPrice: 5000 })).toBe(true);
    expect(isVendorServicePackagePayload({ customPrice: 500 })).toBe(false);
  });

  it('normalizes commerce mode', () => {
    expect(normalizePackageCommerceMode('warmpawz_pay')).toBe('warmpawz_pay');
    expect(normalizePackageCommerceMode('marketplace')).toBe('marketplace');
    expect(normalizePackageCommerceMode(undefined)).toBe('marketplace');
  });
});
