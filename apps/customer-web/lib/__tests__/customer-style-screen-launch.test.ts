jest.mock('@/lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/lib/customer-location', () => ({
  resolveCustomerLocation: jest.fn(async () => ({ state: 'KA', city: 'Bangalore' })),
}));

import { resolveStyleLaunchTargetForScreen } from '../customer-style-screen-launch';

describe('resolveStyleLaunchTargetForScreen', () => {
  it('maps fixed vet style screens', () => {
    expect(resolveStyleLaunchTargetForScreen('vet-clinic-list')).toEqual({
      serviceId: 'vet',
      serviceStyle: 'at_center',
    });
    expect(resolveStyleLaunchTargetForScreen('vet-tele-consultation')).toEqual({
      serviceId: 'vet',
      serviceStyle: 'tele',
    });
  });

  it('maps vet-services-by-style from navigation data', () => {
    expect(
      resolveStyleLaunchTargetForScreen('vet-services-by-style', {
        category: 'vet',
        serviceStyle: 'at_home',
      })
    ).toEqual({
      serviceId: 'vet',
      serviceStyle: 'at_home',
    });
  });

  it('returns null for non-style screens', () => {
    expect(resolveStyleLaunchTargetForScreen('vet')).toBeNull();
    expect(resolveStyleLaunchTargetForScreen('shop')).toBeNull();
  });
});
