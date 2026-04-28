import { assertApplicationKycComplete } from '../vendor-onboarding-kyc';

describe('assertApplicationKycComplete', () => {
  it('allows empty KYC fields', () => {
    expect(assertApplicationKycComplete({})).toEqual({ ok: true });
  });

  it('blocks when Aadhaar filled but not verified', () => {
    const r = assertApplicationKycComplete({
      aadhaarNumber: '123456789012',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Aadhaar/i);
  });

  it('blocks when PAN filled but not verified', () => {
    const r = assertApplicationKycComplete({
      panNumber: 'ABCDE1234F',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/PAN/i);
  });

  it('allows when both verified (owner + pan)', () => {
    expect(
      assertApplicationKycComplete({
        ownerAadhaarNumber: '123456789012',
        ownerAadhaarNumber_verified: true,
        panNumber: 'ABCDE1234F',
        panNumber_verified: true,
      })
    ).toEqual({ ok: true });
  });
});
