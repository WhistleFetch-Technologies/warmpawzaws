import { mapServiceKeyToWpayCategory } from '../map-service-to-wpay-category';
import { isWarmpawzPayBookingFlow } from '../launch-warmpawz-pay-service-booking';

describe('mapServiceKeyToWpayCategory', () => {
  it('maps vet services to vet category', () => {
    expect(mapServiceKeyToWpayCategory('vet')).toBe('vet');
    expect(mapServiceKeyToWpayCategory('veterinarian')).toBe('vet');
  });

  it('maps grooming and training', () => {
    expect(mapServiceKeyToWpayCategory('grooming')).toBe('grooming');
    expect(mapServiceKeyToWpayCategory('training')).toBe('training');
  });

  it('defaults unknown services to all', () => {
    expect(mapServiceKeyToWpayCategory('adoption')).toBe('all');
  });
});

describe('isWarmpawzPayBookingFlow', () => {
  it('detects active warmpawz pay booking route', () => {
    expect(
      isWarmpawzPayBookingFlow({
        configuredModelId: 'warmpawz_pay',
        effectiveModelId: 'warmpawz_pay',
        useMarketplaceFlow: false,
        excludedDomain: false,
      })
    ).toBe(true);
  });

  it('rejects marketplace fallback routes', () => {
    expect(
      isWarmpawzPayBookingFlow({
        configuredModelId: 'warmpawz_pay',
        effectiveModelId: 'marketplace',
        useMarketplaceFlow: true,
        excludedDomain: false,
      })
    ).toBe(false);
  });
});
