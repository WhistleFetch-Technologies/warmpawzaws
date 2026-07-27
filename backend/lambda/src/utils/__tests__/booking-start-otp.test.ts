import {
  bookingStatusEligibleForStartOtp,
  ensureBookingStartOtpIfNeeded,
  isTeleBookingServiceType,
} from '../booking-start-otp';

describe('booking-start-otp', () => {
  describe('isTeleBookingServiceType', () => {
    it('treats tele and video consultation as tele', () => {
      expect(isTeleBookingServiceType('tele')).toBe(true);
      expect(isTeleBookingServiceType('video_consultation')).toBe(true);
      expect(isTeleBookingServiceType('at_home')).toBe(false);
    });
  });

  describe('bookingStatusEligibleForStartOtp', () => {
    it('allows active statuses and blocks terminal ones', () => {
      expect(bookingStatusEligibleForStartOtp('arrived')).toBe(true);
      expect(bookingStatusEligibleForStartOtp('confirmed')).toBe(true);
      expect(bookingStatusEligibleForStartOtp('completed')).toBe(false);
      expect(bookingStatusEligibleForStartOtp('cancelled')).toBe(false);
    });
  });

  describe('ensureBookingStartOtpIfNeeded', () => {
    it('generates OTP for paid at_home booking without otp_code', async () => {
      const execQuery = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              service_type: 'at_home',
              otp_code: null,
              payment_status: 'paid',
              status: 'confirmed',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ otp_code: '5678' }] });

      const result = await ensureBookingStartOtpIfNeeded('b1', {
        execQuery,
        logPrefix: '[TEST]',
      });

      expect(result.generated).toBe(true);
      expect(result.otpCode).toMatch(/^\d{4}$/);
      expect(execQuery).toHaveBeenCalledTimes(2);
    });

    it('skips tele bookings', async () => {
      const execQuery = jest.fn().mockResolvedValueOnce({
        rows: [
          {
            service_type: 'tele',
            otp_code: null,
            payment_status: 'paid',
            status: 'confirmed',
          },
        ],
      });

      const result = await ensureBookingStartOtpIfNeeded('b1', { execQuery });

      expect(result).toEqual({ generated: false, reason: 'tele_service' });
      expect(execQuery).toHaveBeenCalledTimes(1);
    });

    it('returns existing OTP without update', async () => {
      const execQuery = jest.fn().mockResolvedValueOnce({
        rows: [
          {
            service_type: 'at_home',
            otp_code: '4321',
            payment_status: 'paid',
            status: 'arrived',
          },
        ],
      });

      const result = await ensureBookingStartOtpIfNeeded('b1', { execQuery });

      expect(result).toEqual({ generated: false, otpCode: '4321', reason: 'already_set' });
      expect(execQuery).toHaveBeenCalledTimes(1);
    });
  });
});
