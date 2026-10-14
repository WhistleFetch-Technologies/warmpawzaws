/** Completed-policy reconciliation: per-policy commission and settlement for a date range. */

import type {
  PayoutPeriodDTO,
  PayoutPolicyDTO,
  ReconciliationPolicyDTO,
  ReconciliationStatus,
  ReconciliationSummaryDTO,
} from '../dto/insurance-admin.responses';
import type { PayoutPeriodStatus } from './payout-periods';

export interface CompletedPolicyRecord {
  readonly applicationId: string;
  readonly applicationStatus: string;
  readonly policyNumber: string;
  readonly policyDate: string;
  readonly addedAt: string | null;
  readonly premium: number;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly petName: string | null;
  readonly petSpecies: string | null;
  readonly companyId: string;
  readonly companyName: string;
  readonly companyLogoUrl: string | null;
  readonly vendorId: string;
  readonly vendorName: string;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const STATUS_FROM_PERIOD: Record<PayoutPeriodStatus, ReconciliationStatus> = {
  open: 'pending',
  due: 'pending',
  grace: 'pending',
  overdue: 'overdue',
  paid: 'settled',
  nothing_due: 'nothing_due',
};

interface PricedLine {
  readonly period: PayoutPeriodDTO;
  readonly line: PayoutPolicyDTO;
}

function indexLedger(periods: readonly PayoutPeriodDTO[]): Map<string, PricedLine> {
  const out = new Map<string, PricedLine>();
  for (const period of periods) {
    for (const line of period.policies) out.set(line.applicationId, { period, line });
  }
  return out;
}

/** Joins completed policies to the payout ledger. Policies outside every vendor link come back unpriced. */
export function buildReconciliationRows(
  records: readonly CompletedPolicyRecord[],
  periods: readonly PayoutPeriodDTO[],
): ReconciliationPolicyDTO[] {
  const ledger = indexLedger(periods);
  return records.map((r) => {
    const priced = ledger.get(r.applicationId);
    const estimate = priced?.line.estimate;
    const cancelled = r.applicationStatus === 'free_look_cancelled';
    let status: ReconciliationStatus = priced ? STATUS_FROM_PERIOD[priced.period.status] : 'pending';
    if (cancelled) status = 'cancelled';
    return {
      applicationId: r.applicationId,
      policyNumber: r.policyNumber,
      policyDate: r.policyDate,
      addedAt: r.addedAt,
      customer: { name: r.customerName, phone: r.customerPhone },
      pet: r.petName || r.petSpecies ? { name: r.petName, species: r.petSpecies } : null,
      company: { id: r.companyId, name: r.companyName, logoUrl: r.companyLogoUrl },
      vendor: { id: r.vendorId, name: r.vendorName },
      premium: r.premium,
      commission: estimate?.commission ?? 0,
      gst: estimate?.gst ?? 0,
      total: estimate?.total ?? 0,
      isEstimate: estimate?.isEstimate ?? false,
      unpriced: !cancelled && (!estimate || estimate.missingBase),
      status,
      period: priced
        ? { start: priced.period.periodStart, end: priced.period.periodEnd, dueDate: priced.period.dueDate }
        : null,
    };
  });
}

export function summarizeReconciliation(rows: readonly ReconciliationPolicyDTO[]): ReconciliationSummaryDTO {
  let completedPolicies = 0;
  let cancelledPolicies = 0;
  let totalPremium = 0;
  let commission = 0;
  let gst = 0;
  let outstanding = 0;
  let received = 0;
  for (const r of rows) {
    if (r.status === 'cancelled') {
      cancelledPolicies += 1;
      continue;
    }
    completedPolicies += 1;
    totalPremium += r.premium;
    commission += r.commission;
    gst += r.gst;
    if (r.status === 'settled') received += r.total;
    else if (r.status === 'pending' || r.status === 'overdue') outstanding += r.total;
  }
  return {
    completedPolicies,
    cancelledPolicies,
    totalPremium: round2(totalPremium),
    commission: round2(commission),
    gst: round2(gst),
    commissionDue: round2(commission + gst),
    outstanding: round2(outstanding),
    received: round2(received),
  };
}

const STATUS_LABELS: Record<ReconciliationStatus, string> = {
  pending: 'Pending',
  overdue: 'Overdue',
  settled: 'Settled',
  nothing_due: 'Nothing due',
  cancelled: 'Cancelled (free look)',
};

/** Quotes every cell and neutralises spreadsheet formulas in user-entered text. */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return '""';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const CSV_HEADERS = [
  'Policy Date',
  'Added On',
  'Customer',
  'Customer Phone',
  'Pet',
  'Species',
  'Insurance Company',
  'Vendor',
  'Policy No.',
  'Premium (INR)',
  'Platform Commission (INR)',
  'GST (INR)',
  'Commission incl. GST (INR)',
  'Estimated',
  'Status',
  'Payout Period',
  'Due Date',
];

export function reconciliationCsv(rows: readonly ReconciliationPolicyDTO[]): string {
  const lines = [CSV_HEADERS.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.policyDate,
        r.addedAt,
        r.customer.name,
        r.customer.phone,
        r.pet?.name,
        r.pet?.species,
        r.company.name,
        r.vendor.name,
        r.policyNumber,
        r.premium,
        r.commission,
        r.gst,
        r.total,
        r.unpriced ? 'No terms' : r.isEstimate ? 'Yes' : 'No',
        STATUS_LABELS[r.status],
        r.period ? `${r.period.start} to ${r.period.end}` : '',
        r.period?.dueDate,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
