jest.mock('@/lib/warmpawz-appointments-customer', () => ({
  isWarmpawzAppointmentsHubEnabled: jest.fn(),
}));

import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';
import {
  shouldUseWapptDiscoveryFeed,
  shouldUseWapptPayVendorCardUi,
} from '../commerce-switch-routing/should-use-wappt-vendor-card-ui';

describe('shouldUseWapptPayVendorCardUi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to isWarmpawzAppointmentsHubEnabled', () => {
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(true);
    expect(shouldUseWapptPayVendorCardUi('vet')).toBe(true);
    expect(isWarmpawzAppointmentsHubEnabled).toHaveBeenCalledWith('vet');
  });

  it('returns false for marketplace', () => {
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(false);
    expect(shouldUseWapptPayVendorCardUi('grooming')).toBe(false);
  });
});

describe('shouldUseWapptDiscoveryFeed', () => {
  it('matches shouldUseWapptPayVendorCardUi', () => {
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(true);
    expect(shouldUseWapptDiscoveryFeed('training')).toBe(true);
  });
});
