import { buildPayoutLedger, summarizePayoutLedger, type LedgerLink } from '../domain/payout-ledger';
import { periodContaining, todayIst, type PayoutScheduleConfig } from '../domain/payout-periods';
import type { PayoutReceiptInput, PayoutRemindInput, PayoutScheduleInput } from '../dto/insurance-admin.requests';
import type { PayoutOverviewDTO, PayoutPeriodDTO, PayoutScheduleDTO } from '../dto/insurance-admin.responses';
import { dbListAllCommissionTerms } from '../repos/commission-terms.repo';
import {
  dbGetDefaultPayoutSchedule,
  dbListPayoutScheduleOverrides,
  dbSaveDefaultPayoutSchedule,
} from '../repos/payout-schedules.repo';
import {
  dbListIssuedPolicies,
  dbListPayoutPeriodStates,
  dbRecordPayoutReceipt,
  dbRecordPayoutReminder,
} from '../repos/payouts.repo';
import { dbGetVendorLink, dbListVendorLinks } from '../repos/vendor-links.repo';
import { InsuranceAdminError, insuranceNotFound } from '../shared/insurance-admin-response';
import { toPayoutScheduleDTO } from './schedule-dto';

export async function getDefaultPayoutSchedule(): Promise<PayoutScheduleDTO> {
  return toPayoutScheduleDTO(await dbGetDefaultPayoutSchedule());
}

export async function saveDefaultPayoutSchedule(
  input: PayoutScheduleInput,
  actorId: string | null,
): Promise<PayoutScheduleDTO> {
  await dbSaveDefaultPayoutSchedule(input, actorId);
  return getDefaultPayoutSchedule();
}

export async function getPayoutOverview(today: string = todayIst()): Promise<PayoutOverviewDTO> {
  const [links, defaultSchedule, overrides, termsByLink, policies, states] = await Promise.all([
    dbListVendorLinks({}),
    dbGetDefaultPayoutSchedule(),
    dbListPayoutScheduleOverrides(),
    dbListAllCommissionTerms(),
    dbListIssuedPolicies(),
    dbListPayoutPeriodStates(),
  ]);
  const ledgerLinks: LedgerLink[] = links.map((l) => ({
    id: l.id,
    vendorId: l.vendorId,
    vendorName: l.vendorName,
    companyId: l.companyId,
    companyName: l.companyName,
    effectiveFrom: l.effectiveFrom,
    status: l.status,
  }));
  const periods = buildPayoutLedger({
    today,
    links: ledgerLinks,
    defaultSchedule,
    overrides,
    termsByLink,
    policies,
    states,
  });
  return {
    today,
    defaultSchedule: toPayoutScheduleDTO(defaultSchedule),
    summary: summarizePayoutLedger(periods, today, states),
    periods,
  };
}

async function findPeriod(ref: PayoutRemindInput): Promise<PayoutPeriodDTO> {
  const overview = await getPayoutOverview();
  const period = overview.periods.find(
    (p) =>
      p.vendorCompanyId === ref.vendorCompanyId &&
      p.periodStart === ref.periodStart &&
      p.periodEnd === ref.periodEnd,
  );
  if (!period) throw insuranceNotFound('Payout period');
  return period;
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export async function sendPayoutReminder(
  ref: PayoutRemindInput,
  actorId: string | null,
): Promise<PayoutPeriodDTO> {
  const period = await findPeriod(ref);
  if (period.periodEnd >= todayIst()) {
    throw new InsuranceAdminError(422, 'PERIOD_OPEN', 'This period has not ended yet');
  }
  if (period.outstanding <= 0) {
    throw new InsuranceAdminError(422, 'NOTHING_OUTSTANDING', 'Nothing is outstanding for this period');
  }
  const overdue = period.status === 'overdue';
  const policies = `${period.policyCount} ${period.policyCount === 1 ? 'policy' : 'policies'}`;
  await dbRecordPayoutReminder({
    period,
    vendorId: period.vendorId,
    expected: period.outstanding,
    actorId,
    title: overdue ? 'Warmpawz commission overdue' : 'Warmpawz commission due',
    message:
      `Warmpawz commission of ${formatInr(period.outstanding)} for ${policies} with ${period.companyName} ` +
      `issued ${period.periodStart} to ${period.periodEnd} ${overdue ? 'was' : 'is'} due on ${period.dueDate}.`,
    data: {
      type: 'insurance_payout_reminder',
      vendorCompanyId: period.vendorCompanyId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate: period.dueDate,
      amount: period.outstanding,
    },
  });
  return findPeriod(ref);
}

export async function recordPayoutReceipt(
  input: PayoutReceiptInput,
  actorId: string | null,
): Promise<PayoutOverviewDTO> {
  const link = await dbGetVendorLink(input.vendorCompanyId);
  if (!link) throw insuranceNotFound('Vendor link');
  const overrides = await dbListPayoutScheduleOverrides();
  const cfg: PayoutScheduleConfig = overrides.get(link.id) ?? (await dbGetDefaultPayoutSchedule());
  const period = periodContaining(cfg, input.periodStart);
  if (period.start !== input.periodStart || period.end !== input.periodEnd) {
    throw new InsuranceAdminError(
      422,
      'PERIOD_MISMATCH',
      'Period does not match the payout schedule — refresh and try again',
    );
  }
  await dbRecordPayoutReceipt({
    period: {
      vendorCompanyId: link.id,
      periodStart: period.start,
      periodEnd: period.end,
      dueDate: period.dueDate,
    },
    amount: input.amount,
    reference: input.reference,
    receivedOn: input.receivedOn ?? null,
    notes: input.notes,
    actorId,
  });
  return getPayoutOverview();
}
