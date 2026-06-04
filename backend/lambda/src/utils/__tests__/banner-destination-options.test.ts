import { vendorMatchesBannerDestinationCategory } from '../banner-destination-options';

describe('vendorMatchesBannerDestinationCategory', () => {
  it('matches veterinary catalog id to vet_clinic vendor category', () => {
    expect(
      vendorMatchesBannerDestinationCategory('veterinary', 'vet_clinic', null)
    ).toBe(true);
  });

  it('rejects unrelated vendor category for veterinary', () => {
    expect(
      vendorMatchesBannerDestinationCategory('veterinary', 'grooming_solo', null)
    ).toBe(false);
  });

  it('matches vet launch id to vet_clinic vendor category', () => {
    expect(vendorMatchesBannerDestinationCategory('vet', 'vet_clinic', null)).toBe(
      true
    );
  });

  it('matches via role name when vendor category is empty', () => {
    expect(
      vendorMatchesBannerDestinationCategory('veterinary', null, 'veterinarian')
    ).toBe(true);
  });
});
