import { vendorCanCreatePackages } from '../vendor-package-access';

describe('vendorCanCreatePackages', () => {
  it('lets solo vendors create packages', () => {
    expect(vendorCanCreatePackages(true)).toBe(true);
  });

  it('lets business vendors create packages', () => {
    expect(vendorCanCreatePackages(false)).toBe(true);
  });
});