import { mapDiscoveryProviderToVendorCardProps } from '../map-discovery-provider-to-vendor-card-props';

describe('mapDiscoveryProviderToVendorCardProps', () => {
  const baseProvider = {
    name: 'Dr. Smith Clinic',
    photo: 'https://example.com/vet.jpg',
    isVerified: true,
    rating: 4.8,
    reviewCount: 24,
    distance: 1.2,
    distanceText: '1 km away',
    nextAvailableSlot: 'Today 4:00 PM',
    experienceYears: 10,
    providerType: 'staff' as const,
    city: 'Mumbai',
  };

  it('maps discovery provider fields to rich card props without side effects', () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const onProfileClick = jest.fn();

    const props = mapDiscoveryProviderToVendorCardProps({
      provider: baseProvider,
      subtitle: 'Veterinarian · Home visit',
      address: '  10 Clinic Road  ',
      footerHint: 'Tap to view profile & book',
      primaryLabel: 'Book Appointment',
      onPrimary,
      onProfileClick,
      secondaryLabel: 'Pay with Warmpawz',
      onSecondary,
    });

    expect(props.variant).toBe('rich');
    expect(props.name).toBe('Dr. Smith Clinic');
    expect(props.imageUrl).toBe('https://example.com/vet.jpg');
    expect(props.subtitle).toBe('Veterinarian · Home visit');
    expect(props.categoryLabel).toBe('Veterinarian · Home visit');
    expect(props.showVerified).toBe(true);
    expect(props.rating).toEqual({ average: 4.8, reviewCount: 24 });
    expect(props.address).toBe('10 Clinic Road');
    expect(props.city).toBe('Mumbai');
    expect(props.distanceText).toBe('1 km away');
    expect(props.availabilityText).toBe('Next: Today 4:00 PM');
    expect(props.experienceText).toBe('10 years experience');
    expect(props.footerHint).toBe('Tap to view profile & book');
    expect(props.onProfileClick).toBe(onProfileClick);
    expect(props.primaryAction?.label).toBe('Book Appointment');
    expect(props.primaryAction?.subtitle).toBe('Reserve your slot');
    expect(props.primaryAction?.icon).toBeDefined();
    expect(props.primaryAction?.variant).toBe('outline');
    expect(props.primaryAction?.onClick).toBe(onPrimary);
    expect(props.secondaryAction?.label).toBe('Pay with Warmpawz');
    expect(props.secondaryAction?.subtitle).toBe('Get discount');
    expect(props.secondaryAction?.icon).toBeDefined();
    expect(props.secondaryAction?.onClick).toBe(onSecondary);
    expect(props.metaItems).toBeUndefined();
  });

  it('hides rating and omits empty address in output', () => {
    const props = mapDiscoveryProviderToVendorCardProps({
      provider: {
        ...baseProvider,
        rating: 0,
        reviewCount: 0,
      },
      subtitle: 'Groomer',
      address: '   ',
      primaryLabel: 'Book',
      onPrimary: jest.fn(),
    });

    expect(props.rating).toBeNull();
    expect(props.address).toBeUndefined();
  });

  it('does not attach secondary action when parent omits secondary handler', () => {
    const props = mapDiscoveryProviderToVendorCardProps({
      provider: baseProvider,
      subtitle: 'Salon',
      address: 'Main St',
      primaryLabel: 'Book Appointment',
      onPrimary: jest.fn(),
    });

    expect(props.secondaryAction).toBeUndefined();
  });

  it('defaults profile chevron handler to primary when onProfileClick omitted', () => {
    const onPrimary = jest.fn();
    const props = mapDiscoveryProviderToVendorCardProps({
      provider: baseProvider,
      subtitle: 'Salon',
      address: 'Main St',
      primaryLabel: 'Book Appointment',
      onPrimary,
    });

    expect(props.onProfileClick).toBe(onPrimary);
  });
});
