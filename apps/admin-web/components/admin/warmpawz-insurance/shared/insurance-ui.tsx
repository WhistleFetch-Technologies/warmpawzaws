'use client';

import type { ReactNode } from 'react';
import type {
  InsuranceStatusStage,
  PayoutPeriodStatus,
} from '@/lib/warmpawz-insurance-admin';

export function formatInr(amount: number | null | undefined, fractionDigits = 0): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount ?? 0);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STAGE_CLASSES: Record<InsuranceStatusStage, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  awaiting_external: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function StagePill({ stage, children }: { stage: InsuranceStatusStage; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STAGE_CLASSES[stage]}`}>
      {children}
    </span>
  );
}

const PAYOUT_STATUS: Record<PayoutPeriodStatus, { label: string; className: string }> = {
  open: { label: 'Accruing', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  due: { label: 'Due', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  grace: { label: 'In grace', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border-red-200' },
  paid: { label: 'Paid', className: 'bg-green-50 text-green-700 border-green-200' },
  nothing_due: { label: 'Nothing due', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function PayoutStatusPill({ status }: { status: PayoutPeriodStatus }) {
  const s = PAYOUT_STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

export function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 whitespace-normal">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#FF8C42] focus:outline-none focus:ring-1 focus:ring-[#FF8C42]';

export const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-md bg-[#FF8C42] px-3 py-2 text-sm font-medium text-white hover:bg-[#e67a35] disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
