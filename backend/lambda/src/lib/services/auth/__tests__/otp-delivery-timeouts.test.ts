jest.mock('../../../../utils/sms-service', () => ({
  sendSMS: jest.fn(),
}));

import { sendSMS } from '../../../../utils/sms-service';
import { insertOtpWithTimeout, sendResetOtpSmsWithTimeout } from '../otp-delivery-timeouts';

describe('otp-delivery-timeouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('insertOtpWithTimeout returns db_timeout when insert never resolves', async () => {
    const pending = new Promise<void>(() => {});
    const resultPromise = insertOtpWithTimeout(() => pending, 100);
    jest.advanceTimersByTime(100);
    await expect(resultPromise).resolves.toEqual({ ok: false, reason: 'db_timeout' });
  });

  it('insertOtpWithTimeout returns ok when insert completes in time', async () => {
    await expect(insertOtpWithTimeout(async () => undefined, 1000)).resolves.toEqual({ ok: true });
  });

  it('sendResetOtpSmsWithTimeout returns sms_timeout when SNS never resolves', async () => {
    (sendSMS as jest.Mock).mockReturnValue(new Promise(() => {}));
    const resultPromise = sendResetOtpSmsWithTimeout('+919876543210', '123456', 100);
    jest.advanceTimersByTime(100);
    await expect(resultPromise).resolves.toEqual({ ok: false, reason: 'sms_timeout' });
  });

  it('sendResetOtpSmsWithTimeout returns provider_rejected when SNS returns failure', async () => {
    (sendSMS as jest.Mock).mockResolvedValue({ success: false });
    await expect(sendResetOtpSmsWithTimeout('+919876543210', '123456', 5000)).resolves.toEqual({
      ok: false,
      reason: 'provider_rejected',
    });
  });

  it('sendResetOtpSmsWithTimeout returns ok when SNS succeeds', async () => {
    (sendSMS as jest.Mock).mockResolvedValue({ success: true, messageId: 'mid-1' });
    await expect(sendResetOtpSmsWithTimeout('+919876543210', '123456', 5000)).resolves.toEqual({ ok: true });
  });
});
