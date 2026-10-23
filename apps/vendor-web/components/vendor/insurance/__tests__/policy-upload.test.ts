import { isPdfPolicy, policyUploadBody } from '../policy-upload';

describe('policy upload body', () => {
  it('sends the policy number, pdf, and a one-year cover window', () => {
    const body = policyUploadBody({
      policyNumber: ' OR-100 ',
      amount: '1500',
      fileName: 'policy.pdf',
      fileType: 'application/pdf',
      fileSize: 2048,
      s3Key: 'insurance-policies/app/policy.pdf',
      now: new Date('2026-10-23T12:00:00.000Z'),
    });
    expect(body.policyNumber).toBe('OR-100');
    expect(body.issuedPremium).toBe(1500);
    expect(body.startDate).toBe('2026-10-23');
    expect(body.endDate).toBe('2027-10-23');
    expect(body.documents[0]).toMatchObject({ name: 'policy.pdf', mime: 'application/pdf', s3Key: 'insurance-policies/app/policy.pdf' });
  });

  it('accepts a pdf and rejects other files', () => {
    expect(isPdfPolicy({ type: 'application/pdf', name: 'a.pdf' })).toBe(true);
    expect(isPdfPolicy({ type: '', name: 'scan.PDF' })).toBe(true);
    expect(isPdfPolicy({ type: 'image/png', name: 'scan.png' })).toBe(false);
  });
});
