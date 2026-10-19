import {
  PACKAGE_HAS_BOOKINGS_DELETE_ERROR,
  SERVICE_HAS_BOOKINGS_DELETE_ERROR,
  vendorServiceDeleteBlockMessage,
  vendorServiceDeleteIsBlocked,
  vendorServiceRowIsPackage,
} from '../vendor-service-delete';

describe('vendorServiceDeleteIsBlocked', () => {
  it('allows delete when the package has no bookings', () => {
    expect(vendorServiceDeleteIsBlocked(0)).toBe(false);
  });

  it('blocks delete when any booking already uses the package', () => {
    expect(vendorServiceDeleteIsBlocked(1)).toBe(true);
    expect(vendorServiceDeleteIsBlocked(4)).toBe(true);
  });
});

describe('vendorServiceDeleteBlockMessage', () => {
  it('uses the package message for package rows', () => {
    expect(vendorServiceDeleteBlockMessage(true)).toBe(PACKAGE_HAS_BOOKINGS_DELETE_ERROR);
  });

  it('uses the service message for other rows', () => {
    expect(vendorServiceDeleteBlockMessage(false)).toBe(SERVICE_HAS_BOOKINGS_DELETE_ERROR);
  });
});

describe('vendorServiceRowIsPackage', () => {
  it('reads isPackage from object and JSON metadata', () => {
    expect(vendorServiceRowIsPackage({ isPackage: true })).toBe(true);
    expect(vendorServiceRowIsPackage('{"isPackage":true}')).toBe(true);
    expect(vendorServiceRowIsPackage({ isPackage: false })).toBe(false);
    expect(vendorServiceRowIsPackage(null)).toBe(false);
  });
});
