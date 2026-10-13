import type { CommissionTerms } from '../domain/commission';
import {
  buildPayoutLedger,
  ledgerStateKey,
  summarizePayoutLedger,
  type LedgerPeriodState,
  type LedgerPolicy,
  type PayoutLedgerInput,
} from '../domain/payout-ledger';
import type { PayoutScheduleConfig } from '../domain/payout-periods';

const monthly: PayoutScheduleConfig = {
  frequency: 'monthly',
  anchorDate: '2026-01-01',
  dueDaysAfterPeriodEnd: 7,
  graceDays: 3,
  reminderDaysBefore: [3, 1],
};

const link = {
  id: 'link-1',
  vendorId: 'vendor-1',
  vendorName: 'Paws Cover',
  companyId: 'co-1',
  companyName: 'HDFC ERGO',
  effectiveFrom: '2026-08-01',
  status: 'active' as const,
};

const terms: CommissionTerms[] = [
  { basis: 'percent_of_premium', rate: 5, vendorCommissionRate: null, gstRate: 0, effectiveFrom: '2026-08-01' },
  { basis: 'percent_of_premium', rate: 10, vendorCommissionRate: null, gstRate: 0, effectiveFrom: '2026-09-15' },
];

const policy = (id: string, issuedAt: string, premium: number): LedgerPolicy => ({
  applicationId: id,
  vendorId: 'vendor-1',
  companyId: 'co-1',
  customerName: 'Asha',
  policyNumber: `P-${id}`,
  premium,
  vendorCommissionAmount: null,
  issuedAt,
});

function input(patch: Partial<PayoutLedgerInput> = {}): PayoutLedgerInput {
  return {
    today: '2026-10-11',
    links: [link],
    defaultSchedule: monthly,
    overrides: new Map(),
    termsByLink: new Map([['link-1', terms]]),
    policies: [
      policy('a', '2026-09-10T06:00:00.000Z', 10_000),
      // 20:00 UTC on 14 Sep is 15 Sep in IST, so the new 10% terms apply.
      policy('b', '2026-09-14T20:00:00.000Z', 10_000),
      policy('c', '2026-10-02T06:00:00.000Z', 4_000),
    ],
    states: new Map(),
    ...patch,
  };
}

describe('buildPayoutLedger', () => {
  it('prices each policy with the terms in force on its IST issue date', () => {
    const periods = buildPayoutLedger(input());
    const sept = periods.find((p) => p.periodStart === '2026-09-01');
    expect(sept).toMatchObject({
      policyCount: 2,
      premiumTotal: 20_000,
      expected: 1_500,
      status: 'overdue',
      dueDate: '2026-10-07',
      reminderDueToday: true,
    });
  });

  it('shows the current period as accruing and drops empty past periods', () => {
    const periods = buildPayoutLedger(input());
    expect(periods.map((p) => p.periodStart)).toEqual(['2026-09-01', '2026-10-01']);
    expect(periods[1]).toMatchObject({ isCurrent: true, status: 'open', expected: 400 });
  });

  it('marks a period paid once the receipt covers it', () => {
    const states = new Map<string, LedgerPeriodState>([
      [
        ledgerStateKey('link-1', '2026-09-01', '2026-09-30'),
        {
          receivedAmount: 1_500,
          receivedAt: '2026-10-08T05:00:00.000Z',
          receivedReference: 'UTR123',
          lastRemindedAt: null,
          reminderCount: 0,
        },
      ],
    ]);
    const periods = buildPayoutLedger(input({ states }));
    const sept = periods.find((p) => p.periodStart === '2026-09-01');
    expect(sept).toMatchObject({ status: 'paid', outstanding: 0, receivedReference: 'UTR123' });
    expect(summarizePayoutLedger(periods, '2026-10-11', states)).toMatchObject({
      expectedOutstanding: 0,
      overdue: 0,
      currentPeriodAccruing: 400,
      receivedLast30Days: 1_500,
    });
  });

  it('does not repeat a reminder already sent today', () => {
    const states = new Map<string, LedgerPeriodState>([
      [
        ledgerStateKey('link-1', '2026-09-01', '2026-09-30'),
        {
          receivedAmount: 0,
          receivedAt: null,
          receivedReference: null,
          lastRemindedAt: '2026-10-11T03:00:00.000Z',
          reminderCount: 2,
        },
      ],
    ]);
    const sept = buildPayoutLedger(input({ states })).find((p) => p.periodStart === '2026-09-01');
    expect(sept).toMatchObject({ reminderDueToday: false, reminderCount: 2 });
  });

  it('uses a per-link schedule override when set', () => {
    const periods = buildPayoutLedger(
      input({ overrides: new Map([['link-1', { ...monthly, frequency: 'twice_monthly' as const }]]) }),
    );
    expect(periods.map((p) => `${p.periodStart}..${p.periodEnd}:${p.policyCount}`)).toEqual([
      '2026-09-01..2026-09-15:2',
      '2026-10-01..2026-10-15:1',
    ]);
    expect(periods.every((p) => p.scheduleSource === 'override' && p.frequency === 'twice_monthly')).toBe(true);
    expect(periods[0]).toMatchObject({ dueDate: '2026-09-22', status: 'overdue' });
  });

  it('prices confirmed policies from the frozen snapshot and clawbacks as negative lines', () => {
    const frozen = policy('snap', '2026-09-02T00:00:00.000Z', 10_000);
    const periods = buildPayoutLedger(
      input({
        policies: [
          {
            ...frozen,
            snapshot: { commission: 100, gst: 18, total: 118, termsDescription: '5% of premium + 18% GST' },
          },
          {
            ...policy('claw', '2026-09-20T00:00:00.000Z', 0),
            snapshot: { commission: -100, gst: -18, total: -118, termsDescription: 'clawback' },
          },
        ],
        termsByLink: new Map([
          ['link-1', [{ basis: 'percent_of_premium' as const, rate: 99, vendorCommissionRate: null, gstRate: 18, effectiveFrom: '2026-09-20' }]],
        ]),
      }),
    );
    expect(periods.find((p) => p.periodStart === '2026-09-01')).toMatchObject({
      commission: 0,
      gst: 0,
      expected: 0,
    });
  });

  it('marks a window paid when the receipt plus TDS covers the expected amount', () => {
    const states = new Map<string, LedgerPeriodState>([
      [
        ledgerStateKey('link-1', '2026-09-01', '2026-09-30'),
        {
          receivedAmount: 1_400,
          tdsAmount: 100,
          receivedAt: '2026-10-08T05:00:00.000Z',
          receivedReference: 'UTR-TDS',
          lastRemindedAt: null,
          reminderCount: 0,
        },
      ],
    ]);
    const sept = buildPayoutLedger(input({ states })).find((p) => p.periodStart === '2026-09-01');
    expect(sept).toMatchObject({ status: 'paid', outstanding: 0 });
  });

  it('keeps periods whose policies the terms cannot price so they can be fixed', () => {
    const periods = buildPayoutLedger(input({ termsByLink: new Map() }));
    expect(periods.find((p) => p.periodStart === '2026-09-01')).toMatchObject({
      unpricedPolicies: 2,
      expected: 0,
      status: 'nothing_due',
    });
  });
});
