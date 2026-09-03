import {
  getWebWalkerDiscoveryChevronNavTarget,
  buildWalkerProviderProfileNavPayload,
} from '@/lib/customer-vendor-profile-navigation';

describe('getWebWalkerDiscoveryChevronNavTarget', () => {
  it('returns walker_embed_vendor_profile with vendorId from vendorId field', () => {
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
    expect(target!.screen).toBe('walker_embed_vendor_profile');
    expect(target!.data.vendorId).toBe('vendor-abc');
    expect(target!.data.serviceStyle).toBe('at_home');
    expect(target!.data.walkerProfileBackScreen).toBe('problem_grid_flow');
    expect(target!.data.specialization).toBe('puppy_walks');
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

describe('buildWalkerProviderProfileNavPayload', () => {
  it('opens walker_home with embedVendorId for shared UniversalServicesByStyle profile', () => {
    const target = buildWalkerProviderProfileNavPayload({
      vendorId: 'walker-vendor-1',
      displayName: 'Rex Walker',
      serviceStyle: 'at_home',
      profileBackScreen: 'problem_grid_flow',
    });
    expect(target.screen).toBe('walker_home');
    expect(target.data).toMatchObject({
      embedVendorId: 'walker-vendor-1',
      vendorId: 'walker-vendor-1',
      serviceType: 'walking',
      serviceStyle: 'at_home',
      walkerProfileBackScreen: 'problem_grid_flow',
      walker: { name: 'Rex Walker', vendorId: 'walker-vendor-1' },
    });
  });
});
