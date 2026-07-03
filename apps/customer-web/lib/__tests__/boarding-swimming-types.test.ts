import {
  boardingSlugMatchesText,
  serviceNameLooksLikeSwimming,
  vendorOffersBoardingSlug,
} from '../boarding-service-types';

describe('boarding swimming discovery', () => {
  it('matches swimming keywords in service names', () => {
    expect(serviceNameLooksLikeSwimming('Pet Swimming Session')).toBe(true);
    expect(boardingSlugMatchesText('swimming', 'Pool playtime')).toBe(true);
    expect(serviceNameLooksLikeSwimming('Overnight Boarding')).toBe(false);
  });

  it('filters vendors that offer swimming plans', () => {
    const vendor = {
      services: [{ service_name: 'Dog Swimming Pool - 60 min' }],
    };
    expect(vendorOffersBoardingSlug(vendor, 'swimming')).toBe(true);
    expect(vendorOffersBoardingSlug(vendor, 'overnight')).toBe(false);
  });
});
