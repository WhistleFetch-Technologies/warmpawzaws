'use client';

import { useEffect, useState, type ComponentType } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  IndianRupee,
  Percent,
  Receipt,
} from 'lucide-react';
import {
  formatInr,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import type { ReconciliationSummary as Summary } from '@/lib/warmpawz-insurance-admin';
import { shiftRange, type DateRange } from './reconciliation-format';

const MAX_DAYS = 366;

interface CardSpec {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly tone: string;
}

function SummaryCard({ card }: { card: CardSpec }) {
  const Icon = card.icon;
  return (
    <div className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-600">{card.label}</p>
        <p className="mt-1 truncate text-lg font-semibold text-gray-900">{card.value}</p>
        <p className="mt-0.5 text-xs text-gray-500">{card.hint}</p>
      </div>
    </div>
  );
}

function buildCards(s: Summary | undefined): CardSpec[] {
  const inr = (n: number | undefined) => (n === undefined ? '-' : formatInr(n, 2));
  return [
    {
      label: 'Completed Policies',
      value: s ? String(s.completedPolicies) : '-',
      hint: s?.cancelledPolicies ? `${s.cancelledPolicies} cancelled in free look` : 'Policies confirmed in period',
      icon: FileText,
      tone: 'bg-green-50 text-green-600',
    },
    {
      label: 'Total Premium',
      value: inr(s?.totalPremium),
      hint: 'Paid by customers to insurers',
      icon: IndianRupee,
      tone: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Platform Commission',
      value: inr(s?.commission),
      hint: s ? `Our share, + ${formatInr(s.gst, 2)} GST` : 'Our share for this period',
      icon: Percent,
      tone: 'bg-orange-50 text-orange-600',
    },
    {
      label: 'Commission Due',
      value: inr(s?.commissionDue),
      hint: 'Commission + GST owed by vendors',
      icon: Receipt,
      tone: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Outstanding',
      value: inr(s?.outstanding),
      hint: 'Awaiting payment from vendors',
      icon: Clock,
      tone: 'bg-red-50 text-red-600',
    },
    {
      label: 'Received',
      value: inr(s?.received),
      hint: 'Settled by vendors',
      icon: CheckCircle2,
      tone: 'bg-green-50 text-green-600',
    },
  ];
}

export function ReconciliationSummary({
  range,
  summary,
  exporting,
  onRangeChange,
  onExport,
}: {
  range: DateRange;
  summary: Summary | undefined;
  exporting: boolean;
  onRangeChange: (range: DateRange) => void;
  onExport: () => void;
}) {
  const [draft, setDraft] = useState<DateRange>(range);

  useEffect(() => setDraft(range), [range]);

  const draftValid =
    Boolean(draft.from && draft.to) &&
    draft.from <= draft.to &&
    Date.parse(draft.to) - Date.parse(draft.from) <= MAX_DAYS * 86_400_000;

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#FF8C42]">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Reconciliation Summary</h2>
            <p className="text-sm text-gray-500">Completed policies and vendor commission for the selected period.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              aria-label="From date"
              className="text-sm text-gray-800 focus:outline-none"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              aria-label="To date"
              className="text-sm text-gray-800 focus:outline-none"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </div>
          <button
            type="button"
            className={secondaryButtonClass}
            aria-label="Previous period"
            onClick={() => onRangeChange(shiftRange(range, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            aria-label="Next period"
            onClick={() => onRangeChange(shiftRange(range, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={!draftValid}
            title={draftValid ? undefined : `Choose a start before the end, up to ${MAX_DAYS} days`}
            onClick={() => onRangeChange(draft)}
          >
            Apply
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={exporting}
            title="Downloads a CSV of every policy matching the filters; opens in Excel"
            onClick={onExport}
          >
            <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {buildCards(summary).map((card) => (
          <SummaryCard key={card.label} card={card} />
        ))}
      </div>
    </section>
  );
}
