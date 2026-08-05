import type { BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';
import {
  boardingListVendorToDiscoverySource,
  mapBoardingListVendorToVendorCardProps,
  resolveBoardingListVendorAddress,
  resolveBoardingListVendorSubtitle,
} from '../map-boarding-list-vendor-to-vendor-card-props';

const mockRouter = {} as import('next/dist/shared/lib/app-router-context.shared-runtime').AppRouterInstance;

jest.mock('@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking', () => ({
  launchWarmpawzPayServiceBooking: jest.fn(),
}));

describe('boardingListVendorToDiscoverySource', () => {
  const vendor: BoardingListVendor = {
    id: 'list-1',
    name: 'Bindu Vet Clinic',
    address: '48 Church Street, Bengaluru',
    rating: 4.6,
    review_count: 12,
    distanceKm: 1.5,
    timing: 'Open now',
    services: [],
    price_label: '₹800+',
    photo: 'https://example.com/vet.jpg',
    isVerified: true,
    planRows: [],
    needsServiceFetch: true,
    raw: {
      roleDisplayName: 'Veterinarian (Solo)',
      nextAvailableSlot: 'Tomorrow 9:00 AM',
      city: 'Bengaluru',
      vendorId: 'vendor-uuid-1',
    },
  };

  it('maps boarding list vendor fields to discovery source', () => {
    const source = boardingListVendorToDiscoverySource(vendor);
    expect(source.name).toBe('Bindu Vet Clinic');
    expect(source.photo).toBe('https://example.com/vet.jpg');
    expect(source.isVerified).toBe(true);
    expect(source.rating).toBe(4.6);
    expect(source.reviewCount).toBe(12);
    expect(source.nextAvailableSlot).toBe('Tomorrow 9:00 AM');
    expect(source.city).toBe('Bengaluru');
    expect(source.vendorId).toBe('vendor-uuid-1');
  });

  it('resolves subtitle and address helpers', () => {
    expect(resolveBoardingListVendorSubtitle(vendor, 'Vet')).toBe('Veterinarian (Solo)');
    expect(resolveBoardingListVendorAddress(vendor)).toBe('48 Church Street, Bengaluru');
    expect(resolveBoardingListVendorAddress({ ...vendor, address: '  ' })).toBe(
      'Location on booking',
    );
  });
});

describe('mapBoardingListVendorToVendorCardProps', () => {
  const vendor: BoardingListVendor = {
    id: 'list-1',
    name: 'Bindu Vet Clinic',
    address: '48 Church Street, Bengaluru',
    rating: 4.6,
    review_count: 12,
    distanceKm: 1.5,
    timing: 'Open now',
    services: [],
    price_label: '₹800+',
    isVerified: true,
    planRows: [],
    needsServiceFetch: false,
    raw: {
      roleDisplayName: 'Veterinarian (Solo)',
      nextAvailableSlot: 'Tomorrow 9:00 AM',
      vendorId: 'vendor-uuid-1',
    },
  };

  it('maps to rich card props with standard hub CTAs', () => {
    const onSelectSlot = jest.fn();
    const onOpenProfile = jest.fn();

    const props = mapBoardingListVendorToVendorCardProps({
      vendor,
      category: 'vet',
      categoryLabelFallback: 'Veterinarian',
      router: mockRouter,
      onSelectSlot,
      onOpenProfile,
    });

    expect(props.name).toBe('Bindu Vet Clinic');
    expect(props.categoryLabel).toBe('Veterinarian (Solo)');
    expect(props.address).toBe('48 Church Street, Bengaluru');
    expect(props.availabilityText).toBe('Next: Tomorrow 9:00 AM');
    expect(props.primaryAction?.label).toBe('Select Slot for Appointment');
    expect(props.primaryAction?.subtitle).toBe('Reserve your slot');
    expect(props.secondaryAction?.label).toBe('Pay with Warmpawz');
    expect(props.secondaryAction?.subtitle).toBe('Get discount');
  });
});
