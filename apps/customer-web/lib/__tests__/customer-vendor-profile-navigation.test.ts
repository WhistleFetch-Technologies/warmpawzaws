import {
  getWebWalkerDiscoveryChevronNavTarget,
} from '@/lib/customer-vendor-profile-navigation';

describe('getWebWalkerDiscoveryChevronNavTarget', () => {
  it('returns walker-provider-profile with vendorId from vendorId field', () => {
    const target = getWebWalkerDiscoveryChevronNavTarget({
      provider: {
        vendorId: 'vendor-abc',
        providerId: 'staff-list-id',
        name: 'Test Dog walker',
      },
      providerDisplayName: 'Test Dog walker',
      serviceStyle: 'at_home',
      profileBackScreen: 'problem_grid_flow',
      specialization: 'puppy_walks',
    });

    expect(target).not.toBeNull();
    expect(target!.screen).toBe('walker-provider-profile');
    expect(target!.data.vendorId).toBe('vendor-abc');
    expect(target!.data.serviceType).toBe('walking');
    expect(target!.data.serviceStyle).toBe('at_home');
    expect(target!.data.walkerProfileBackScreen).toBe('problem_grid_flow');
    expect(target!.data.specialization).toBe('puppy_walks');
    expect(target!.data.walker).toMatchObject({ name: 'Test Dog walker' });
  });

  it('prefers vendorId over opaque list id via pickWalkerVendorId', () => {
    const target = getWebWalkerDiscoveryChevronNavTarget({
      provider: {
        id: 'opaque-discover-id',
        vendor_id: 'canonical-vendor',
      },
      serviceStyle: 'at_center',
    });

    expect(target!.data.vendorId).toBe('canonical-vendor');
  });

  it('returns null when no vendor id can be resolved', () => {
    expect(
      getWebWalkerDiscoveryChevronNavTarget({
        provider: {},
        serviceStyle: 'at_home',
      })
    ).toBeNull();
  });
});
