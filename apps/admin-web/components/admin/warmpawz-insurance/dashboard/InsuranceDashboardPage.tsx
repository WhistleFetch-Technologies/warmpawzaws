'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { WarmpawzInsuranceShell } from '@/components/admin/warmpawz-insurance/shared/WarmpawzInsuranceShell';
import {
  formatDate,
  formatDateTime,
  formatInr,
  inputClass,
  MetricTile,
  StagePill,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import {
  useApplicationEvents,
  useInsuranceCompanies,
  useInsuranceDashboard,
  useInsuranceOutreach,
} from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import {
  INSURANCE_STATUS_OPTIONS,
  type InsuranceApplicationStatus,
  type OutreachRow,
} from '@/lib/warmpawz-insurance-admin';

const PAGE_SIZE = 20;

export function InsuranceDashboardPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InsuranceApplicationStatus | ''>('');
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const range = { from: from || undefined, to: to || undefined };
  const { data: metrics, isLoading: metricsLoading } = useInsuranceDashboard(range.from, range.to);
  const { data: companies } = useInsuranceCompanies();
  const { data: outreach, isLoading, isError, error } = useInsuranceOutreach({
    page,
    pageSize: PAGE_SIZE,
    status: status || undefined,
    companyId: companyId || undefined,
    search: search.trim() || undefined,
    ...range,
  });

  const totalPages = Math.max(1, Math.ceil((outreach?.total ?? 0) / PAGE_SIZE));
  const metric = (n: number | undefined) => (metricsLoading ? '—' : String(n ?? 0));
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <WarmpawzInsuranceShell
      title="Dashboard"
      subtitle="Customers who reached out to Warmpawz insurance vendors, and where each application stands"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <MetricTile label="Customer outreach" value={metric(metrics?.outreach)} hint="Consultations + applications" />
        <MetricTile label="Upcoming consultations" value={metric(metrics?.upcomingConsultations)} />
        <MetricTile label="With vendor" value={metric(metrics?.inProgress)} hint="Information, preparation, review" />
        <MetricTile
          label="Waiting on customer / insurer"
          value={metric(metrics?.awaitingExternal)}
          hint="Payment and documents"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricTile label="Policies issued" value={metric(metrics?.policiesIssued)} />
        <MetricTile
          label="Premium issued"
          value={metricsLoading ? '—' : formatInr(metrics?.premiumIssued)}
        />
        <MetricTile label="Active companies" value={metric(metrics?.activeCompanies)} />
        <MetricTile label="Active vendor links" value={metric(metrics?.activeVendorLinks)} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Customer outreach</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input
              className={inputClass}
              placeholder="Customer, phone, vendor or policy no."
              value={search}
              onChange={(e) => resetPage(setSearch)(e.target.value)}
            />
            <select
              className={inputClass}
              value={status}
              onChange={(e) => resetPage(setStatus)(e.target.value as InsuranceApplicationStatus | '')}
            >
              <option value="">All statuses</option>
              {INSURANCE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={companyId}
              onChange={(e) => resetPage(setCompanyId)(e.target.value)}
            >
              <option value="">All companies</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className={inputClass}
              value={from}
              max={to || undefined}
              onChange={(e) => resetPage(setFrom)(e.target.value)}
              aria-label="Reached out from"
            />
            <input
              type="date"
              className={inputClass}
              value={to}
              min={from || undefined}
              onChange={(e) => resetPage(setTo)(e.target.value)}
              aria-label="Reached out to"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Consultation</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <EmptyRow>Loading…</EmptyRow>
              ) : isError ? (
                <EmptyRow>
                  <span className="text-red-600">{error instanceof Error ? error.message : 'Failed to load'}</span>
                </EmptyRow>
              ) : outreach?.items.length ? (
                outreach.items.map((row) => {
                  const open = expanded === row.rowId;
                  return (
                    <Fragment key={row.rowId}>
                      <tr
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpanded(open ? null : row.rowId)}
                      >
                        <td className="px-2 py-3 text-gray-400">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.customer.name || '—'}</div>
                          <div className="text-gray-500">{row.customer.phone || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-900">{row.vendor.name}</td>
                        <td className="px-4 py-3 text-gray-700">{row.company?.name ?? 'Not chosen yet'}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {row.booking ? `${formatDate(row.booking.date)} ${row.booking.time ?? ''}` : 'No booking'}
                        </td>
                        <td className="px-4 py-3">
                          <StagePill stage={row.stage}>{row.statusLabel}</StagePill>
                          {row.statusDerived ? (
                            <div className="mt-1 text-xs text-gray-500">No vendor update yet</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDateTime(row.lastActivityAt)}</td>
                      </tr>
                      {open ? (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-4">
                            <OutreachDetail row={row} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <EmptyRow>No customer outreach yet for these filters.</EmptyRow>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-sm text-[#FF8C42] disabled:text-gray-300"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages} · {outreach?.total ?? 0} total
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="text-sm text-[#FF8C42] disabled:text-gray-300"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </WarmpawzInsuranceShell>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
        {children}
      </td>
    </tr>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function OutreachDetail({ row }: { row: OutreachRow }) {
  const { data: events, isLoading } = useApplicationEvents(row.applicationId);
  const pet = row.pet ? [row.pet.name, row.pet.species].filter(Boolean).join(' · ') : '—';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Current status</h3>
          <div className="mt-2 flex items-center gap-2">
            <StagePill stage={row.stage}>{row.statusLabel}</StagePill>
            <span className="text-xs text-gray-500">
              {row.statusDerived ? 'From the consultation booking' : 'Set by the vendor'}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <DetailItem label="Pet" value={pet} />
          <DetailItem label="Reached out" value={formatDateTime(row.reachedOutAt)} />
          <DetailItem
            label="Consultation"
            value={row.booking ? `${formatDate(row.booking.date)} ${row.booking.time ?? ''}` : 'No booking'}
          />
          <DetailItem
            label="Booking status"
            value={row.booking ? `${row.booking.status ?? '—'} · payment ${row.booking.paymentStatus ?? '—'}` : '—'}
          />
          <DetailItem label="Consultation fee" value={row.booking ? formatInr(row.booking.fee) : '—'} />
          <DetailItem label="Booking ID" value={<span className="font-mono text-xs">{row.bookingId ?? '—'}</span>} />
        </dl>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Policy</h3>
          {row.policy.number ? (
            <dl className="mt-2 grid grid-cols-2 gap-3">
              <DetailItem label="Policy number" value={row.policy.number} />
              <DetailItem label="Premium" value={formatInr(row.policy.premium, 2)} />
              <DetailItem label="Issued" value={formatDate(row.policy.issuedAt)} />
              <DetailItem
                label="Document"
                value={
                  row.policy.documentUrl ? (
                    <a
                      href={row.policy.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#FF8C42] hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
          ) : (
            <p className="mt-1 text-sm text-gray-500">Not issued yet.</p>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Status history</h3>
        {!row.applicationId ? (
          <p className="mt-2 text-sm text-gray-500">
            The vendor has not started an application for this consultation yet.
          </p>
        ) : isLoading ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : events?.length ? (
          <ol className="mt-2 space-y-3 border-l border-gray-200 pl-4">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#FF8C42]" />
                <div className="text-sm text-gray-900">
                  {e.fromLabel ? `${e.fromLabel} → ` : ''}
                  <span className="font-medium">{e.toLabel}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDateTime(e.createdAt)} · by {e.actorType}
                </div>
                {e.note ? <div className="mt-0.5 text-sm text-gray-700">{e.note}</div> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No status changes recorded yet.</p>
        )}
      </div>
    </div>
  );
}
