import { onWapptServiceCompleted } from '../on-wappt-service-completed';
import { isWapptAppointmentBooking } from '../wappt-earnings-policy';

jest.mock('../../../customer/warmpawz-pay/shared/accrue-wpay-settlement', () => ({
  accruePendingWpaySettlementsForWapptBooking: jest.fn(async () => undefined),
}));

const { accruePendingWpaySettlementsForWapptBooking } = jest.requireMock(
  '../../../customer/warmpawz-pay/shared/accrue-wpay-settlement',
);

describe('onWapptServiceCompleted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('releases held settlements for WAPPT bookings only', async () => {
    await onWapptServiceCompleted(
      'booking-1',
      { commerce_mode: 'warmpawz_appointments' },
      '[TEST]',
    );
    expect(accruePendingWpaySettlementsForWapptBooking).toHaveBeenCalledWith('booking-1', '[TEST]');
  });

  it('no-ops for marketplace bookings', async () => {
    await onWapptServiceCompleted('booking-2', { commerce_mode: 'vet' }, '[TEST]');
    expect(accruePendingWpaySettlementsForWapptBooking).not.toHaveBeenCalled();
    expect(isWapptAppointmentBooking({ commerce_mode: 'vet' })).toBe(false);
  });
});
