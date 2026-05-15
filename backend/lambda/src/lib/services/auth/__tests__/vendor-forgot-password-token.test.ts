/**
 * Vendor reset JWT: issuer/audience/purpose isolation from customer reset tokens.
 */
jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn(),
  insert: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../../../../utils/sms-service', () => ({
  sendSMS: jest.fn(),
}));

import {
  issueVendorPasswordResetJwt,
  verifyVendorPasswordResetJwt,
} from '../vendor-forgot-password';
import { issuePasswordResetJwt, verifyPasswordResetJwt } from '../customer-forgot-password';

describe('vendor forgot-password reset JWT', () => {
  const prevSecret = process.env.PASSWORD_RESET_JWT_SECRET;

  beforeAll(() => {
    process.env.PASSWORD_RESET_JWT_SECRET = 'test-vendor-reset-jwt-secret-32chars!!';
  });

  afterAll(() => {
    if (prevSecret === undefined) delete process.env.PASSWORD_RESET_JWT_SECRET;
    else process.env.PASSWORD_RESET_JWT_SECRET = prevSecret;
  });

  it('round-trips vendor reset token with bound auth_version', async () => {
    const vid = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
    const tok = await issueVendorPasswordResetJwt(vid, 2);
    const v = await verifyVendorPasswordResetJwt(tok);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.vendorId).toBe(vid);
      expect(v.authVersion).toBe(2);
    }
  });

  it('rejects customer forgot-password JWT on vendor verifier (wrong issuer/audience)', async () => {
    const cid = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
    const customerTok = await issuePasswordResetJwt(cid, 1);
    const v = await verifyVendorPasswordResetJwt(customerTok);
    expect(v.ok).toBe(false);
  });

  it('rejects vendor JWT on customer verifier', async () => {
    const vid = 'cccccccc-dddd-4eee-ffff-000000000001';
    const vendorTok = await issueVendorPasswordResetJwt(vid, 0);
    const c = await verifyPasswordResetJwt(vendorTok);
    expect(c.ok).toBe(false);
  });
});
