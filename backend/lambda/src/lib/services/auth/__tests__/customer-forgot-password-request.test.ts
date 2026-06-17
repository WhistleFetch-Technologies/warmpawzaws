jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn(),
  insert: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../../../../utils/sms-service', () => ({
  sendSMS: jest.fn(),
}));

jest.mock('../customer-username-lookup', () => ({
  dialablePhoneForCustomerAuth: jest.fn((phone: string) => phone),
  findCustomerForPasswordLogin: jest.fn(),
  normalizePhoneForOtp: jest.fn((phone: string) => phone.replace(/\D/g, '').slice(-10)),
}));

import { query, insert } from '../../../../database/rds-connection';
import { sendSMS } from '../../../../utils/sms-service';
import { findCustomerForPasswordLogin } from '../customer-username-lookup';
import { handleCustomerForgotPasswordRequest } from '../customer-forgot-password';

describe('handleCustomerForgotPasswordRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 429 with dynamic Retry-After when cooldown active', async () => {
    (findCustomerForPasswordLogin as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
      phone: '+919876543210',
    });
    (query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('last_password_reset_at')) return { rows: [{ last_password_reset_at: null }] };
      if (sql.includes('COUNT(*)')) return { rows: [{ c: 0 }] };
      if (sql.includes('ORDER BY created_at DESC LIMIT 1')) {
        return { rows: [{ created_at: new Date(Date.now() - 20_000) }] };
      }
      return { rows: [] };
    });

    const out = await handleCustomerForgotPasswordRequest({
      body: { username: '9876543210' },
      requestId: 'req-cooldown',
      headers: {},
    });

    expect(out.status).toBe(429);
    expect(out.headers?.['Retry-After']).toBeDefined();
    expect(Number(out.body.retryAfterSeconds)).toBeGreaterThan(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns 429 RESET_RECENTLY when password reset completed within rolling 24h', async () => {
    (findCustomerForPasswordLogin as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
      phone: '+919876543210',
    });
    (query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('last_password_reset_at')) {
        return { rows: [{ last_password_reset_at: new Date(Date.now() - 60 * 60 * 1000) }] };
      }
      return { rows: [] };
    });

    const out = await handleCustomerForgotPasswordRequest({
      body: { username: '9876543210' },
      requestId: 'req-reset-recent',
      headers: {},
    });

    expect(out.status).toBe(429);
    expect((out.body as any).error?.code).toBe('RESET_RECENTLY');
    expect(Number(out.body.retryAfterSeconds)).toBeGreaterThan(3600);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('returns 503 on infrastructure error during lookup', async () => {
    (findCustomerForPasswordLogin as jest.Mock).mockRejectedValue(new Error('connection refused'));

    const out = await handleCustomerForgotPasswordRequest({
      body: { username: '9876543210' },
      requestId: 'req-503',
      headers: {},
    });

    expect(out.status).toBe(503);
    expect((out.body as any).error?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 503 OTP_DELIVERY_FAILED when SMS is rejected and does not record send rate event', async () => {
    const prevStage = process.env.STAGE;
    const prevUat = process.env.UAT_MODE;
    process.env.STAGE = 'prod';
    delete process.env.UAT_MODE;

    (findCustomerForPasswordLogin as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
      phone: '+919876543210',
    });
    (query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('last_password_reset_at')) return { rows: [{ last_password_reset_at: null }] };
      if (sql.includes('COUNT(*)')) return { rows: [{ c: 0 }] };
      if (sql.includes('ORDER BY created_at DESC LIMIT 1')) return { rows: [] };
      return { rows: [] };
    });
    (insert as jest.Mock).mockResolvedValue(undefined);
    (sendSMS as jest.Mock).mockResolvedValue({ success: false });

    try {
      const out = await handleCustomerForgotPasswordRequest({
        body: { username: '9876543210' },
        requestId: 'req-sms-fail',
        headers: {},
      });

      expect(out.status).toBe(503);
      expect((out.body as any).error?.code).toBe('OTP_DELIVERY_FAILED');
      const rateEventInserts = (insert as jest.Mock).mock.calls.filter(
        (call) => call[0] === 'auth_operation_rate_events'
      );
      expect(rateEventInserts).toHaveLength(0);
    } finally {
      if (prevStage === undefined) delete process.env.STAGE;
      else process.env.STAGE = prevStage;
      if (prevUat === undefined) delete process.env.UAT_MODE;
      else process.env.UAT_MODE = prevUat;
    }
  });

  it('returns generic 200 and retryAfterSeconds on successful send', async () => {
    (findCustomerForPasswordLogin as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
      phone: '+919876543210',
    });
    (query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('last_password_reset_at')) return { rows: [{ last_password_reset_at: null }] };
      if (sql.includes('COUNT(*)')) return { rows: [{ c: 0 }] };
      if (sql.includes('ORDER BY created_at DESC LIMIT 1')) return { rows: [] };
      return { rows: [] };
    });
    (insert as jest.Mock).mockResolvedValue(undefined);
    (sendSMS as jest.Mock).mockResolvedValue({ success: true, messageId: 'sns-1' });

    const out = await handleCustomerForgotPasswordRequest({
      body: { username: '9876543210' },
      requestId: 'req-200',
      headers: {},
    });

    expect(out.status).toBe(200);
    const payload = (out.body as any).data?.data;
    expect(payload?.message).toMatch(/If an account exists/);
    expect(payload?.retryAfterSeconds).toBe(60);
    const rateEventInserts = (insert as jest.Mock).mock.calls.filter(
      (call) => call[0] === 'auth_operation_rate_events'
    );
    expect(rateEventInserts.length).toBeGreaterThan(0);
  });
});
