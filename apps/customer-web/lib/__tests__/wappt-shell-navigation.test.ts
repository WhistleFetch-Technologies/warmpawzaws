import {
  buildWapptShellBookingPayload,
  handleWapptShellScreenNavigate,
} from '@/lib/wappt-shell-navigation';
import { listWapptHubCategories } from '@/lib/wappt-hub-registry';

describe('handleWapptShellScreenNavigate', () => {
  function createActions() {
    return {
      setWapptProfileData: jest.fn(),
      navigateToScreen: jest.fn(),
      routeKeyVendor: (id: string) => `vendor:${id}`,
      handleVetNavigate: jest.fn(),
      mergeVetBookingState: jest.fn(),
      setWalkerBookingState: jest.fn(),
      openBoardingBooking: jest.fn(),
      openSittingBooking: jest.fn(),
    };
  }

  it.each(listWapptHubCategories())(
    'opens wappt-vendor-profile for hub %s',
    (hub) => {
      const actions = createActions();
      handleWapptShellScreenNavigate(
        hub,
        'wappt-vendor-profile',
        { vendorId: 'v-1', vendorName: 'Vendor', serviceStyle: 'at_center' },
        actions,
      );
      expect(actions.setWapptProfileData).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId: 'v-1',
          category: hub,
          profileBackScreen: 'wappt-discovery',
        }),
      );
      expect(actions.navigateToScreen).toHaveBeenCalledWith(
        'wappt-vendor-profile',
        'vendor:v-1',
      );
    },
  );

  it('routes walker booking through walker state', () => {
    const actions = createActions();
    handleWapptShellScreenNavigate(
      'walker',
      'walker-booking',
      { vendorId: 'w-1' },
      actions,
    );
    expect(actions.setWalkerBookingState).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentsMode: true, vendorId: 'w-1' }),
    );
    expect(actions.navigateToScreen).toHaveBeenCalledWith('walker-booking');
  });

  it('routes boarding booking through boarding opener', () => {
    const actions = createActions();
    handleWapptShellScreenNavigate(
      'boarding',
      'boarding-booking',
      { vendorId: 'b-1' },
      actions,
    );
    expect(actions.openBoardingBooking).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentsMode: true, vendorId: 'b-1' }),
    );
  });

  it('routes sitting booking through sitting opener', () => {
    const actions = createActions();
    handleWapptShellScreenNavigate(
      'sitting',
      'pet-sitter-booking',
      { vendorId: 's-1' },
      actions,
    );
    expect(actions.openSittingBooking).toHaveBeenCalledWith(
      expect.objectContaining({ serviceType: 'sitting', vendorId: 's-1' }),
    );
  });

  it('buildWapptShellBookingPayload sets appointmentsMode', () => {
    const payload = buildWapptShellBookingPayload('nutrition', { vendorId: 'n-1' });
    expect(payload.appointmentsMode).toBe(true);
    expect(payload.category).toBe('nutrition');
    expect(payload.returnScreen).toBe('wappt-discovery');
  });
});
