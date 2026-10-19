import { vendorCanCreatePackages, vendorServiceShowsDelete } from '../vendor-package-access';

describe('vendorCanCreatePackages', () => {
  it('lets solo vendors create packages', () => {
    expect(vendorCanCreatePackages(true)).toBe(true);
  });

  it('lets business vendors create packages', () => {
    expect(vendorCanCreatePackages(false)).toBe(true);
  });
});

describe('vendorServiceShowsDelete', () => {
  it('lets a new published package be unpublished and deleted', () => {
    expect(vendorServiceShowsDelete({ publishStatus: 'published', isPackage: true })).toBe(true);
    expect(vendorServiceShowsDelete({ publishStatus: 'draft', isPackage: true })).toBe(true);
  });

  it('keeps delete off published services that are not packages', () => {
    expect(vendorServiceShowsDelete({ publishStatus: 'published', isPackage: false })).toBe(false);
  });

  it('still allows delete for draft and rejected services', () => {
    expect(vendorServiceShowsDelete({ publishStatus: 'draft', isPackage: false })).toBe(true);
    expect(vendorServiceShowsDelete({ publishStatus: 'rejected', isPackage: false })).toBe(true);
  });
});