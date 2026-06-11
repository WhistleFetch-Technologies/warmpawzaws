import { processServiceStartOtpNotifications } from '../service-start-otp-job';
import { notifyBookingStartOtp } from '../booking-notifications';
import { query, update } from '../../database/rds-connection';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../booking-notifications', () => ({
  notifyBookingStartOtp: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedUpdate = update as jest.MockedFunction<typeof update>;
const mockedNotify = notifyBookingStartOtp as jest.MockedFunction<typeof notifyBookingStartOtp>;

describe('processServiceStartOtpNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUpdate.mockResolvedValue([] as never);
    mockedNotify.mockResolvedValue({ sent: true });
  });

  it('sends start OTP and marks booking when rows match', async () => {
    mockedQuery.mockResolvedValue({
      rows: [
        {
          id: 'b1',
          customer_id: 'c1',
          otp_code: '1234',
          vendor_name: 'Groomer',
          service_name: 'Bath',
        },
      ],
    } as never);

    const result = await processServiceStartOtpNotifications();

    expect(result).toEqual({ processed: 1, sent: 1, skipped: 0 });
    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'b1',
        customerId: 'c1',
        otp: '1234',
      }),
    );
    expect(mockedUpdate).toHaveBeenCalledWith(
      'bookings',
      { id: 'b1' },
      expect.objectContaining({ start_otp_notification_sent: true }),
    );
  });

  it('skips marking when notify returns sent false', async () => {
    mockedQuery.mockResolvedValue({
      rows: [{ id: 'b2', customer_id: 'c2', otp_code: null, vendor_name: 'V', service_name: 'S' }],
    } as never);
    mockedNotify.mockResolvedValue({ sent: false });

    const result = await processServiceStartOtpNotifications();

    expect(result).toEqual({ processed: 1, sent: 0, skipped: 1 });
    expect(mockedUpdate).not.toHaveBeenCalledWith(
      'bookings',
      { id: 'b2' },
      expect.objectContaining({ start_otp_notification_sent: true }),
    );
  });
});
