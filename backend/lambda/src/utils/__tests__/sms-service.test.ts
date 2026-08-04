const mockSnsSend = jest.fn();

jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => mockSnsSend(...args),
  })),
  PublishCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { sendSMS } from '../sms-service';

describe('sendSMS', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('skips SNS when UAT_MODE=true', async () => {
    process.env.UAT_MODE = 'true';

    const result = await sendSMS({
      to: '9876543210',
      message: 'Warmpawz: test appointment SMS',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^uat-mock-/);
    expect(mockSnsSend).not.toHaveBeenCalled();
  });

  it('calls SNS when UAT_MODE is not true', async () => {
    delete process.env.UAT_MODE;
    process.env.SMS_SENDER_ID = 'WARMPZ';
    mockSnsSend.mockResolvedValue({ MessageId: 'sns-msg-1' });

    const result = await sendSMS({
      to: '9876543210',
      message: 'Warmpawz: test appointment SMS',
      type: 'transactional',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('sns-msg-1');
    expect(mockSnsSend).toHaveBeenCalledTimes(1);
  });
});
