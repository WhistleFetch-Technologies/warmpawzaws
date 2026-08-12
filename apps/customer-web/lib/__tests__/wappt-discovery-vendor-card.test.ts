import { buildWapptDiscoveryVendorCardProps } from '../wappt-discovery-vendor-card';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
};

jest.mock('@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking', () => ({
  launchWarmpawzPayServiceBooking: jest.fn(),
}));

import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';

describe('buildWapptDiscoveryVendorCardProps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds dual CTA props for WAPPT discovery vendor cards', () => {
    const onPrimary = jest.fn();
    const props = buildWapptDiscoveryVendorCardProps({
      provider: {
        name: 'Happy Paws Training',
        providerId: 'prov-1',
        vendorId: 'vendor-1',
        rating: 4.5,
        reviewCount: 12,
        isVerified: true,
        city: 'Mumbai',
      },
      subtitle: 'Trainer',
      address: '123 Main St',
      category: 'training',
      onPrimary,
      router: mockRouter as never,
    });

    expect(props.primaryAction?.label).toBe('Select Slot for Appointment');
    expect(props.secondaryAction?.label).toBe('Pay with Warmpawz');
    expect(props.name).toBe('Happy Paws Training');
  });

  it('builds walker Available Walkers card props with Pay CTA', () => {
    const onPrimary = jest.fn();
    const onProfileClick = jest.fn();
    const props = buildWapptDiscoveryVendorCardProps({
      provider: {
        name: 'private walker',
        providerId: 'vendor-w-1',
        vendorId: 'vendor-w-1',
        isVerified: true,
        rating: 0,
        reviewCount: 0,
        nextAvailableSlot: 'Today 1:30 PM',
      },
      subtitle: 'Pet Walker',
      address: 'Location on booking',
      category: 'walker',
      serviceKey: 'walker',
      onPrimary,
      onProfileClick,
      router: mockRouter as never,
    });

    expect(props.primaryAction?.label).toBe('Select Slot for Appointment');
    expect(props.secondaryAction?.label).toBe('Pay with Warmpawz');
    expect(props.subtitle).toBe('Pet Walker');
    props.primaryAction?.onClick?.({ stopPropagation: jest.fn() } as never);
    expect(onPrimary).toHaveBeenCalled();
  });

  it('launches WPay booking on secondary CTA', () => {
    const props = buildWapptDiscoveryVendorCardProps({
      provider: {
        name: 'Boarding Co',
        providerId: 'prov-2',
        vendorId: 'vendor-2',
        rating: 4,
        reviewCount: 3,
      },
      subtitle: 'Boarding',
      address: '',
      category: 'boarding',
      onPrimary: jest.fn(),
      router: mockRouter as never,
    });

    props.secondaryAction?.onClick?.({ stopPropagation: jest.fn() } as never);
    expect(launchWarmpawzPayServiceBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceKey: 'boarding',
        category: 'boarding',
        vendorId: 'vendor-2',
      }),
    );
  });
});
