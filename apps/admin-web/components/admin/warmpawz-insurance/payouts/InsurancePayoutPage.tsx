'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, BellRing, ChevronDown, ChevronRight } from 'lucide-react';
import { WarmpawzInsuranceShell } from '@/components/admin/warmpawz-insurance/shared/WarmpawzInsuranceShell';
import {
  errorMessage,
  formatDate,
  formatDateTime,
  formatInr,
  inputClass,
  MetricTile,
  PayoutStatusPill,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { usePayoutOverview, useSendPayoutReminder } from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import { canManageInsurancePayouts } from '@/lib/admin-permissions';
import type { PayoutPeriod } from '@/lib/warmpawz-insurance-admin';
import { PayoutScheduleCard } from './PayoutScheduleCard';
import { RecordReceiptDialog } from './RecordReceiptDialog';

type View = 'action' | 'open' | 'paid' | 'all';

const VIEW_OPTIONS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'action', label: 'Needs action (due, grace, overdue)' },
  { value: 'open', label: 'Current period (accruing)' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All periods' },
];

function matchesView(p: PayoutPeriod, view: View): boolean {
  if (view === 'action') return p.status === 'due' || p.status === 'grace' || p.status === 'overdue';
  if (view === 'open') return p.status === 'open';
  if (view === 'paid') return p.status === 'paid';
  return true;
}

const periodKey = (p: PayoutPeriod) => `${p.vendorCompanyId}|${p.periodStart}|${p.periodEnd}`;

export function InsurancePayoutPage({ embedded = false }: { embedded?: boolean }) {
  const { data, isLoading, isError, error } = usePayoutOverview();
  const remind = useSendPayoutReminder();
  const [view, setView] = useState<View>('action');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<PayoutPeriod | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => setCanEdit(canManageInsurancePayouts()), []);

  const periods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.periods ?? []).filter(
      (p) =>
        matchesView(p, view) &&
        (!q || p.vendorName.toLowerCase().includes(q) || p.companyName.toLowerCase().includes(q)),
    );
  }, [data, view, search]);

  const remindersDue = (data?.periods ?? []).filter((p) => p.reminderDueToday).length;

  const sendReminder = async (p: PayoutPeriod) => {
    try {
      await remind.mutateAsync({
        vendorCompanyId: p.vendorCompanyId,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
      });
      toast.success(`Reminder sent to ${p.vendorName}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const body = (
    <>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Failed to load payouts'}</p>
      ) : (
        <div className="space-y-6">
          <PayoutScheduleCard schedule={data.defaultSchedule} canEdit={canEdit} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricTile
              label="Outstanding (closed periods)"
              value={formatInr(data.summary.expectedOutstanding)}
            />
            <MetricTile label="Overdue" value={formatInr(data.summary.overdue)} hint="Past due date and grace" />
            <MetricTile label="Due in next 7 days" value={formatInr(data.summary.dueNext7Days)} />
            <MetricTile
              label="Accruing this period"
              value={formatInr(data.summary.currentPeriodAccruing)}
              hint="Policies issued so far in the current period"
            />
            <MetricTile label="Received (last 30 days)" value={formatInr(data.summary.receivedLast30Days)} />
          </div>

          {remindersDue > 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <BellRing className="h-4 w-4" />
              {remindersDue} vendor period{remindersDue === 1 ? ' is' : 's are'} due a reminder today.
            </div>
          ) : null}

          <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex flex-col gap-2 px-4 py-3 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Payout periods</h2>
                <p className="text-xs text-gray-500">
                  Expected amounts use each vendor link&apos;s commission terms —{' '}
                  <Link href="/warmpawz-insurance/companies" className="text-[#FF8C42] hover:underline">
                    edit terms
                  </Link>
                  . Today is {formatDate(data.today)} (IST).
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  className={`${inputClass} sm:w-56`}
                  placeholder="Vendor or company"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className={`${inputClass} sm:w-72`}
                  value={view}
                  onChange={(e) => setView(e.target.value as View)}
                >
                  {VIEW_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="w-8 px-2 py-3" />
                    <th className="px-4 py-3 font-medium">Vendor · company</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium text-right">Policies</th>
                    <th className="px-4 py-3 font-medium text-right">Premium</th>
                    <th className="px-4 py-3 font-medium text-right">Expected</th>
                    <th className="px-4 py-3 font-medium text-right">Received</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periods.length ? (
                    periods.map((p) => {
                      const key = periodKey(p);
                      const open = expanded === key;
                      const ended = p.periodEnd < data.today;
                      return (
                        <Fragment key={key}>
                          <tr
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpanded(open ? null : key)}
                          >
                            <td className="px-2 py-3 text-gray-400">
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{p.vendorName}</div>
                              <div className="text-xs text-gray-500">
                                {p.companyName}
                                {p.scheduleSource === 'override' ? ' · custom schedule' : ''}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                            </td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(p.dueDate)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{p.policyCount}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{formatInr(p.premiumTotal)}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {formatInr(p.expected, 2)}
                              {p.hasEstimates || p.unpricedPolicies ? (
                                <AlertTriangle
                                  className="ml-1 inline h-3.5 w-3.5 text-amber-500"
                                  aria-label="Includes estimates or unpriced policies"
                                />
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">{formatInr(p.received, 2)}</td>
                            <td className="px-4 py-3">
                              <PayoutStatusPill status={p.status} />
                              {p.reminderCount ? (
                                <div className="mt-1 text-xs text-gray-500">
                                  Reminded {p.reminderCount}× · {formatDateTime(p.lastRemindedAt)}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {canEdit && ended && p.outstanding > 0 ? (
                                <button
                                  type="button"
                                  disabled={remind.isPending}
                                  onClick={() => sendReminder(p)}
                                  className={`mr-3 inline-flex items-center gap-1 text-sm hover:underline disabled:text-gray-300 ${
                                    p.reminderDueToday ? 'font-semibold text-red-600' : 'text-[#FF8C42]'
                                  }`}
                                >
                                  <BellRing className="h-3.5 w-3.5" />
                                  Send reminder
                                </button>
                              ) : null}
                              {canEdit && (p.expected > 0 || p.received > 0) ? (
                                <button
                                  type="button"
                                  onClick={() => setReceiptFor(p)}
                                  className="text-sm text-gray-600 hover:text-gray-900"
                                >
                                  Record receipt
                                </button>
                              ) : null}
                            </td>
                          </tr>
                          {open ? (
                            <tr className="bg-gray-50">
                              <td colSpan={10} className="px-6 py-4">
                                <PeriodDetail period={p} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                        {data.periods.length
                          ? 'No periods match this view.'
                          : 'No issued policies yet. Periods appear once linked vendors issue policies.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      <RecordReceiptDialog period={receiptFor} onClose={() => setReceiptFor(null)} />
    </>
  );

  if (embedded) return body;

  return (
    <WarmpawzInsuranceShell
      title="Premium payout"
      subtitle="Warmpawz commission expected from insurance vendors on the policies they issue"
    >
      {body}
    </WarmpawzInsuranceShell>
  );
}

function PeriodDetail({ period }: { period: PayoutPeriod }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
        <span>Commission {formatInr(period.commission, 2)}</span>
        <span>GST {formatInr(period.gst, 2)}</span>
        <span>Outstanding {formatInr(period.outstanding, 2)}</span>
        <span>Grace ends {formatDate(period.graceEndsOn)}</span>
        {period.receivedReference ? <span>Reference {period.receivedReference}</span> : null}
      </div>
      {period.unpricedPolicies ? (
        <Notice>
          {period.unpricedPolicies} polic{period.unpricedPolicies === 1 ? 'y has' : 'ies have'} no commission —
          add commission terms (or the vendor&apos;s expected commission rate) for this link.
        </Notice>
      ) : null}
      {period.hasEstimates ? (
        <Notice>
          Some amounts are estimated from the vendor&apos;s expected commission rate because the actual commission
          was not recorded on the policy.
        </Notice>
      ) : null}
      {period.policies.length ? (
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-1 pr-4 font-medium">Customer</th>
              <th className="py-1 pr-4 font-medium">Policy no.</th>
              <th className="py-1 pr-4 font-medium">Issued</th>
              <th className="py-1 pr-4 font-medium text-right">Premium</th>
              <th className="py-1 pr-4 font-medium">Terms</th>
              <th className="py-1 pr-4 font-medium text-right">Commission</th>
              <th className="py-1 pr-4 font-medium text-right">GST</th>
              <th className="py-1 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {period.policies.map((pol) => (
              <tr key={pol.applicationId}>
                <td className="py-1.5 pr-4 text-gray-900">{pol.customerName ?? '—'}</td>
                <td className="py-1.5 pr-4 font-mono text-xs text-gray-700">{pol.policyNumber}</td>
                <td className="py-1.5 pr-4 text-gray-700">{formatDate(pol.issuedOn)}</td>
                <td className="py-1.5 pr-4 text-right text-gray-700">{formatInr(pol.premium, 2)}</td>
                <td className="py-1.5 pr-4 text-gray-600">{pol.termsDescription ?? 'No terms'}</td>
                <td className="py-1.5 pr-4 text-right text-gray-900">
                  {formatInr(pol.estimate.commission, 2)}
                  {pol.estimate.isEstimate ? <span className="ml-1 text-xs text-amber-600">est.</span> : null}
                </td>
                <td className="py-1.5 pr-4 text-right text-gray-700">{formatInr(pol.estimate.gst, 2)}</td>
                <td className="py-1.5 text-right font-medium text-gray-900">{formatInr(pol.estimate.total, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-500">No policies issued in this period yet.</p>
      )}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
