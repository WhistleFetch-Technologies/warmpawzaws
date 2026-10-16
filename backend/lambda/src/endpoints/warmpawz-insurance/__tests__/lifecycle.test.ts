import {
  buildCommissionSnapshot,
  canRegenerateReport,
  clawbackSnapshot,
  closeWindowOnFrequencyChange,
  paymentLinkIssues,
  policyDocumentIssues,
  receiptCoversExpected,
  reportVariance,
  shouldAutoConfirm,
  shouldExpirePaymentLink,
  transitionBlockReason,
} from '../shared/lifecycle';

const now = new Date('2026-10-13T10:00:00.000Z');

describe('insurance lifecycle guards', () => {
  it('accepts an allowlisted https host and a subdomain, and rejects the rest', () => {
    const ok = paymentLinkIssues({
      url: 'https://pay.insurer.example/p/1',
      domains: ['insurer.example'],
      expiresAt: '2026-10-16T10:00:00.000Z',
      now,
    });
    expect(ok).toEqual([]);
    expect(
      paymentLinkIssues({
        url: 'http://insurer.example/p',
        domains: ['insurer.example'],
        expiresAt: '2026-10-16T10:00:00.000Z',
        now,
      }),
    ).toContain('Payment link must use https');
    expect(
      paymentLinkIssues({
        url: 'https://evil.example/p',
        domains: ['insurer.example'],
        expiresAt: '2026-10-16T10:00:00.000Z',
        now,
      })[0],
    ).toMatch(/allowlist/);
    expect(
      paymentLinkIssues({
        url: 'https://insurer.example/p',
        domains: ['insurer.example'],
        expiresAt: '2026-10-01T10:00:00.000Z',
        now,
      })[0],
    ).toMatch(/future/);
  });

  it('blocks a policy upload without number, premium, dates, or a valid document', () => {
    expect(
      policyDocumentIssues({
        policyNumber: '',
        issuedPremium: -1,
        startDate: '2026-10-01',
        endDate: '2026-09-01',
        documents: [],
      }).length,
    ).toBeGreaterThan(0);
    expect(
      policyDocumentIssues({
        policyNumber: 'P1',
        issuedPremium: 1000,
        startDate: '2026-10-01',
        endDate: '2027-10-01',
        documents: [{ name: 'a.exe', mime: 'application/octet-stream', size: 10 }],
      })[0],
    ).toMatch(/PDF/);
  });

  it('refuses a snapshot when GST is missing and ignores later term edits', () => {
    expect(buildCommissionSnapshot({ terms: null, premium: 1000, vendorCommissionAmount: null })).toEqual({
      error: 'GST rate is required before a policy can be confirmed',
    });
    const snap = buildCommissionSnapshot({
      terms: { id: 't1', basis: 'percent_of_premium', rate: 25, vendorCommissionRate: null, gstRate: 18, effectiveFrom: '2026-10-01' },
      premium: 1000,
      vendorCommissionAmount: null,
    });
    expect(snap).toMatchObject({ commissionAmount: 250, gstAmount: 45, totalAmount: 295, gstRate: 18 });
    if ('error' in snap) throw new Error('expected snapshot');
    expect(clawbackSnapshot(snap).totalAmount).toBe(-295);
  });

  it('blocks disallowed edges and allows the payment and policy edges', () => {
    expect(transitionBlockReason('consultation_booked', 'policy_confirmed')).toMatch(/Cannot move/);
    expect(transitionBlockReason('form_confirmed', 'payment_link_sent')).toBeNull();
    expect(transitionBlockReason('policy_uploaded', 'policy_confirmed')).toBeNull();
    expect(transitionBlockReason('cancelled', 'consulted')).toMatch(/Cannot move/);
  });

  it('blocks consulted until the booking is marked complete', () => {
    expect(
      transitionBlockReason('consultation_booked', 'consulted', [
        { ok: false, reason: 'Mark the tele consultation complete in Bookings before marking consulted' },
      ]),
    ).toMatch(/complete in Bookings/);
    expect(
      transitionBlockReason('consultation_booked', 'consulted', [
        { ok: true, reason: 'Mark the tele consultation complete in Bookings before marking consulted' },
      ]),
    ).toBeNull();
  });

  it('auto-confirms and expires links once, and locks a submitted report', () => {
    expect(shouldAutoConfirm('2026-10-01T10:00:00.000Z', 7, now, false)).toBe(true);
    expect(shouldAutoConfirm('2026-10-01T10:00:00.000Z', 7, now, true)).toBe(false);
    expect(shouldExpirePaymentLink('2026-10-12T10:00:00.000Z', now, false)).toBe(true);
    expect(shouldExpirePaymentLink('2026-10-12T10:00:00.000Z', now, true)).toBe(false);
    expect(canRegenerateReport('draft')).toBe(true);
    expect(canRegenerateReport('submitted')).toBe(false);
    expect(reportVariance(295, 200)).toBe(-95);
    expect(receiptCoversExpected(200, 95, 295)).toBe(true);
    expect(closeWindowOnFrequencyChange('2026-10-31', '2026-10-15')).toBe('2026-10-14');
  });
});
