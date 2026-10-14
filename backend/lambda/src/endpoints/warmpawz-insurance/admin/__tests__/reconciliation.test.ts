import {
  buildReconciliationRows,
  reconciliationCsv,
  summarizeReconciliation,
  type CompletedPolicyRecord,
} from '../domain/reconciliation';
import type { PayoutPeriodDTO, PayoutPolicyDTO } from '../dto/insurance-admin.responses';
import type { PayoutPeriodStatus } from '../domain/payout-periods';

function record(id: string, overrides: Partial<CompletedPolicyRecord> = {}): CompletedPolicyRecord {
  return {
    applicationId: id,
    applicationStatus: 'policy_confirmed',
    policyNumber: `POL-${id}`,
    policyDate: '2026-10-05',
    addedAt: '2026-10-05T10:00:00.000Z',
    premium: 10_000,
    customerName: 'Asha Rao',
    customerPhone: '9800000000',
    petName: 'Bruno',
    petSpecies: 'dog',
    companyId: 'company-1',
    companyName: 'HDFC ERGO',
    companyLogoUrl: null,
    vendorId: 'vendor-1',
    vendorName: 'Pawsure',
    ...overrides,
  };
}

function line(id: string, commission: number, gst: number, extra: Partial<PayoutPolicyDTO['estimate']> = {}): PayoutPolicyDTO {
  return {
    applicationId: id,
    customerName: null,
    policyNumber: `POL-${id}`,
    premium: 10_000,
    vendorCommissionAmount: null,
    issuedOn: '2026-10-05',
    termsDescription: null,
    estimate: { base: 10_000, commission, gst, total: commission + gst, isEstimate: false, missingBase: false, ...extra },
  };
}

function period(status: PayoutPeriodStatus, policies: PayoutPolicyDTO[]): PayoutPeriodDTO {
  return {
    vendorCompanyId: 'link-1',
    vendorId: 'vendor-1',
    vendorName: 'Pawsure',
    companyName: 'HDFC ERGO',
    frequency: 'monthly',
    scheduleSource: 'default',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    dueDate: '2026-11-07',
    graceEndsOn: '2026-11-10',
    isCurrent: true,
    status,
    policyCount: policies.length,
    premiumTotal: 0,
    commission: 0,
    gst: 0,
    expected: 0,
    received: 0,
    outstanding: 0,
    hasEstimates: false,
    unpricedPolicies: 0,
    reminderCount: 0,
    lastRemindedAt: null,
    reminderDueToday: false,
    receivedReference: null,
    policies,
  };
}

describe('buildReconciliationRows', () => {
  it('takes amounts and status from the payout period the policy falls in', () => {
    const rows = buildReconciliationRows(
      [record('a'), record('b')],
      [period('paid', [line('a', 2500, 450)]), period('overdue', [line('b', 1000, 180)])],
    );
    expect(rows[0]).toMatchObject({ commission: 2500, gst: 450, total: 2950, status: 'settled', unpriced: false });
    expect(rows[0].period).toEqual({ start: '2026-10-01', end: '2026-10-31', dueDate: '2026-11-07' });
    expect(rows[1].status).toBe('overdue');
  });

  it('maps open, due and grace periods to pending', () => {
    for (const status of ['open', 'due', 'grace'] as const) {
      const [row] = buildReconciliationRows([record('a')], [period(status, [line('a', 100, 18)])]);
      expect(row.status).toBe('pending');
    }
  });

  it('flags policies with no vendor link or no pricing base as unpriced', () => {
    const rows = buildReconciliationRows(
      [record('orphan'), record('nobase')],
      [period('open', [line('nobase', 0, 0, { missingBase: true })])],
    );
    expect(rows[0]).toMatchObject({ unpriced: true, status: 'pending', commission: 0, period: null });
    expect(rows[1]).toMatchObject({ unpriced: true, status: 'pending' });
  });

  it('marks free-look cancellations as cancelled whatever the period status', () => {
    const [row] = buildReconciliationRows(
      [record('a', { applicationStatus: 'free_look_cancelled' })],
      [period('paid', [line('a', 0, 0)])],
    );
    expect(row).toMatchObject({ status: 'cancelled', unpriced: false });
  });

  it('omits the pet when neither name nor species is known', () => {
    const [row] = buildReconciliationRows([record('a', { petName: null, petSpecies: null })], []);
    expect(row.pet).toBeNull();
  });
});

describe('summarizeReconciliation', () => {
  it('splits commission owed into received and outstanding and leaves cancellations out of totals', () => {
    const rows = buildReconciliationRows(
      [
        record('paid'),
        record('due'),
        record('late'),
        record('zero'),
        record('cancelled', { applicationStatus: 'free_look_cancelled', premium: 99_999 }),
      ],
      [
        period('paid', [line('paid', 2500, 450)]),
        period('due', [line('due', 1000, 180)]),
        period('overdue', [line('late', 500, 90)]),
        period('nothing_due', [line('zero', 0, 0)]),
        period('paid', [line('cancelled', 0, 0)]),
      ],
    );
    expect(summarizeReconciliation(rows)).toEqual({
      completedPolicies: 4,
      cancelledPolicies: 1,
      totalPremium: 40_000,
      commission: 4000,
      gst: 720,
      commissionDue: 4720,
      outstanding: 1770,
      received: 2950,
    });
  });
});

describe('reconciliationCsv', () => {
  it('writes a BOM, a header row and one quoted row per policy', () => {
    const rows = buildReconciliationRows([record('a')], [period('paid', [line('a', 2500, 450)])]);
    const lines = reconciliationCsv(rows).split('\r\n');
    expect(lines[0].startsWith('\uFEFF"Policy Date"')).toBe(true);
    expect(lines[1]).toContain('"POL-a"');
    expect(lines[1]).toContain('"2950"');
    expect(lines[1]).toContain('"Settled"');
    expect(lines[1]).toContain('"2026-10-01 to 2026-10-31"');
  });

  it('neutralises formulas and escapes quotes in user-entered text', () => {
    const rows = buildReconciliationRows(
      [record('a', { customerName: '=HYPERLINK("x")', vendorName: 'Paw "Care"' })],
      [],
    );
    const csv = reconciliationCsv(rows);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Paw ""Care"""');
  });
});
