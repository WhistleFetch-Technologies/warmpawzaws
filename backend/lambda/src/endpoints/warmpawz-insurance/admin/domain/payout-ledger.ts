import { estimateCommission, describeTerms, termsInForce, type CommissionTerms } from './commission';
import {
  addDays,
  daysBetween,
  isReminderDay,
  istDateOf,
  listPeriods,
  payoutPeriodStatus,
  periodContaining,
  type PayoutPeriodStatus,
  type PayoutScheduleConfig,
} from './payout-periods';
import type { PayoutPeriodDTO, PayoutPolicyDTO } from '../dto/insurance-admin.responses';

export interface LedgerLink {
  readonly id: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly companyId: string;
  readonly companyName: string;
  readonly effectiveFrom: string;
  readonly status: 'active' | 'suspended' | 'ended';
}

export interface LedgerPolicy {
  readonly applicationId: string;
  readonly vendorId: string;
  readonly companyId: string;
  readonly customerName: string | null;
  readonly policyNumber: string;
  readonly premium: number;
  readonly vendorCommissionAmount: number | null;
  readonly issuedAt: string;
}

export interface LedgerPeriodState {
  readonly receivedAmount: number;
  readonly receivedAt: string | null;
  readonly receivedReference: string | null;
  readonly lastRemindedAt: string | null;
  readonly reminderCount: number;
}

export interface PayoutLedgerInput {
  readonly today: string;
  readonly links: readonly LedgerLink[];
  readonly defaultSchedule: PayoutScheduleConfig;
  readonly overrides: ReadonlyMap<string, PayoutScheduleConfig>;
  readonly termsByLink: ReadonlyMap<string, readonly CommissionTerms[]>;
  readonly policies: readonly LedgerPolicy[];
  readonly states: ReadonlyMap<string, LedgerPeriodState>;
  /** Paid / nothing-due periods older than this many days are hidden. */
  readonly historyDays?: number;
}

const STATUS_ORDER: Record<PayoutPeriodStatus, number> = {
  overdue: 0,
  grace: 1,
  due: 2,
  open: 3,
  paid: 4,
  nothing_due: 5,
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function ledgerStateKey(linkId: string, start: string, end: string): string {
  return `${linkId}|${start}|${end}`;
}

function pricePolicy(terms: readonly CommissionTerms[], policy: LedgerPolicy): PayoutPolicyDTO {
  const issuedOn = istDateOf(policy.issuedAt);
  const inForce = termsInForce(terms, issuedOn);
  return {
    applicationId: policy.applicationId,
    customerName: policy.customerName,
    policyNumber: policy.policyNumber,
    premium: policy.premium,
    vendorCommissionAmount: policy.vendorCommissionAmount,
    issuedOn,
    termsDescription: inForce ? describeTerms(inForce) : null,
    estimate: estimateCommission(inForce, policy),
  };
}

function linkPeriods(input: PayoutLedgerInput, link: LedgerLink): PayoutPeriodDTO[] {
  const cfg = input.overrides.get(link.id) ?? input.defaultSchedule;
  const terms = input.termsByLink.get(link.id) ?? [];
  const priced = input.policies
    .filter((p) => p.vendorId === link.vendorId && p.companyId === link.companyId)
    .map((p) => pricePolicy(terms, p));

  const earliest = priced.reduce((min, p) => (p.issuedOn < min ? p.issuedOn : min), link.effectiveFrom);
  const from = earliest < input.today ? earliest : input.today;
  const historyCutoff = addDays(input.today, -(input.historyDays ?? 365));
  const current = periodContaining(cfg, input.today);

  const out: PayoutPeriodDTO[] = [];
  for (const period of listPeriods(cfg, from, input.today)) {
    const policies = priced.filter((p) => p.issuedOn >= period.start && p.issuedOn <= period.end);
    const state = input.states.get(ledgerStateKey(link.id, period.start, period.end));
    const commission = round2(policies.reduce((s, p) => s + p.estimate.commission, 0));
    const gst = round2(policies.reduce((s, p) => s + p.estimate.gst, 0));
    const expected = round2(commission + gst);
    const received = state?.receivedAmount ?? 0;
    const status = payoutPeriodStatus({ period, today: input.today, expected, received });
    const isCurrent = period.start === current.start;
    const unpricedPolicies = policies.filter((p) => p.estimate.missingBase).length;

    const keep =
      (isCurrent && link.status !== 'ended') ||
      (expected > 0.004 && status !== 'paid') ||
      unpricedPolicies > 0 ||
      ((policies.length > 0 || received > 0) && period.end >= historyCutoff);
    if (!keep) continue;

    out.push({
      vendorCompanyId: link.id,
      vendorId: link.vendorId,
      vendorName: link.vendorName,
      companyName: link.companyName,
      frequency: cfg.frequency,
      scheduleSource: input.overrides.has(link.id) ? 'override' : 'default',
      periodStart: period.start,
      periodEnd: period.end,
      dueDate: period.dueDate,
      graceEndsOn: period.graceEndsOn,
      isCurrent,
      status,
      policyCount: policies.length,
      premiumTotal: round2(policies.reduce((s, p) => s + p.premium, 0)),
      commission,
      gst,
      expected,
      received,
      outstanding: round2(Math.max(0, expected - received)),
      hasEstimates: policies.some((p) => p.estimate.isEstimate),
      unpricedPolicies,
      reminderCount: state?.reminderCount ?? 0,
      lastRemindedAt: state?.lastRemindedAt ?? null,
      reminderDueToday:
        ['due', 'grace', 'overdue'].includes(status) &&
        isReminderDay(cfg, period, input.today) &&
        (!state?.lastRemindedAt || istDateOf(state.lastRemindedAt) !== input.today),
      receivedReference: state?.receivedReference ?? null,
      policies,
    });
  }
  return out;
}

export function buildPayoutLedger(input: PayoutLedgerInput): PayoutPeriodDTO[] {
  return input.links
    .flatMap((link) => linkPeriods(input, link))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.dueDate.localeCompare(b.dueDate) ||
        a.vendorName.localeCompare(b.vendorName),
    );
}

export function summarizePayoutLedger(
  periods: readonly PayoutPeriodDTO[],
  today: string,
  states: ReadonlyMap<string, LedgerPeriodState>,
) {
  let expectedOutstanding = 0;
  let overdue = 0;
  let dueNext7Days = 0;
  let currentPeriodAccruing = 0;
  for (const p of periods) {
    if (p.isCurrent) currentPeriodAccruing += p.expected;
    if (p.periodEnd >= today) continue;
    expectedOutstanding += p.outstanding;
    if (p.status === 'overdue') overdue += p.outstanding;
    if ((p.status === 'due' || p.status === 'grace') && daysBetween(today, p.dueDate) <= 7) {
      dueNext7Days += p.outstanding;
    }
  }
  let receivedLast30Days = 0;
  for (const s of states.values()) {
    if (s.receivedAt && daysBetween(istDateOf(s.receivedAt), today) <= 30) {
      receivedLast30Days += s.receivedAmount;
    }
  }
  return {
    expectedOutstanding: round2(expectedOutstanding),
    overdue: round2(overdue),
    dueNext7Days: round2(dueNext7Days),
    currentPeriodAccruing: round2(currentPeriodAccruing),
    receivedLast30Days: round2(receivedLast30Days),
  };
}
