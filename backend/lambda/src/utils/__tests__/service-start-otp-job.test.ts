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
    mockedNotify.mockResolvedValue({ sent: false });
  });

  it('does not mark booking sent when start OTP notify is disabled', async () => {
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

    expect(result).toEqual({ processed: 1, sent: 0, skipped: 1 });
    expect(mockedNotify).toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalledWith(
      'bookings',
      { id: 'b1' },
      expect.objectContaining({ start_otp_notification_sent: true }),
    );
  });
});
