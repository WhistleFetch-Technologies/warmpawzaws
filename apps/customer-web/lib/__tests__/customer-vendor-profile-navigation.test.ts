import {
  getWebWalkerDiscoveryChevronNavTarget,
  buildWalkerProviderProfileNavPayload,
  buildWalkerWapptProfileNavFromRow,
} from '@/lib/customer-vendor-profile-navigation';
import { WAPPT_VENDOR_PROFILE_SCREEN } from '@/lib/warmpawz-appointments-customer';

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

describe('buildWalkerWapptProfileNavFromRow', () => {
  it('opens wappt-vendor-profile for Available Walkers hub rows', () => {
    const target = buildWalkerWapptProfileNavFromRow({
      walker: {
        vendorId: 'w-avail-1',
        name: 'private walker',
      },
      profileBackScreen: 'walker',
      serviceStyle: 'at_home',
    });

    expect(target).not.toBeNull();
    expect(target!.screen).toBe(WAPPT_VENDOR_PROFILE_SCREEN);
    expect(target!.data).toMatchObject({
      vendorId: 'w-avail-1',
      vendorName: 'private walker',
      category: 'walker',
      serviceStyle: 'at_home',
      profileBackScreen: 'walker',
    });
  });

  it('returns null when no vendor id can be resolved', () => {
    expect(buildWalkerWapptProfileNavFromRow({ walker: {} })).toBeNull();
  });
});

describe('buildWalkerProviderProfileNavPayload', () => {
  it('builds walker-provider-profile redirect for UniversalServicesByStyle vendorId embed', () => {
    const target = buildWalkerProviderProfileNavPayload({
      vendorId: 'walker-vendor-1',
      displayName: 'Rex Walker',
      serviceStyle: 'at_home',
      profileBackScreen: 'problem_grid_flow',
    });
    expect(target.screen).toBe('walker-provider-profile');
    expect(target.data).toMatchObject({
      vendorId: 'walker-vendor-1',
      serviceType: 'walking',
      serviceStyle: 'at_home',
      walkerProfileBackScreen: 'problem_grid_flow',
      walker: { name: 'Rex Walker', vendorId: 'walker-vendor-1' },
    });
  });
});
