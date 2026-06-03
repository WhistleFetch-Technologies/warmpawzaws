'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  RefreshCw,
  ChevronRight,
  X,
  Check,
  Ban,
  FileText,
  User,
  Store,
  Truck,
  CreditCard,
  CalendarClock,
  Plus,
} from 'lucide-react';

type HubCase = {
  sourceType: 'refund' | 'meal_case';
  id: string;
  domain: 'booking' | 'meal_order' | 'package';
  stage: string;
  origin: string | null;
  amount: number | null;
  payoutDestination: string | null;
  customerName: string | null;
  vendorName: string | null;
  referenceLabel: string | null;
  referenceId: string | null;
  reason: string | null;
  requestedAt: string | null;
  actedBy: string | null;
  actedAt: string | null;
  createdAt: string;
};

type HubDetail = HubCase & {
  raw?: Record<string, unknown>;
  mealCase?: Record<string, unknown>;
  mealOrder?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  booking?: Record<string, unknown>;
};

const STAGE_TABS = [
  { id: '', label: 'All' },
  { id: 'pending_review', label: 'Pending review' },
  { id: 'pending', label: 'Pending' },
  { id: 'refund_processing', label: 'Processing' },
  { id: 'processing', label: 'Processing (legacy)' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'completed', label: 'Completed' },
  { id: 'refund_failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
];

const DOMAIN_CARDS = [
  { id: 'meal_order', label: 'Meal orders' },
  { id: 'booking', label: 'Bookings' },
  { id: 'package', label: 'Packages' },
] as const;

const ORIGIN_CHIPS = [
  { id: 'system_pidge', label: 'Pidge / logistics' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'customer', label: 'Customer' },
  { id: 'admin', label: 'Support / admin' },
];

type AccentKey = 'orange' | 'amber' | 'blue' | 'emerald' | 'red' | 'violet' | 'sky' | 'rose' | 'slate';

const ACCENT: Record<AccentKey, { bar: string; bg: string; value: string; chip: string; chipActive: string }> = {
  orange: {
    bar: 'border-l-orange-500',
    bg: 'bg-orange-50',
    value: 'text-orange-700',
    chip: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100',
    chipActive: 'bg-orange-600 text-white border-orange-600',
  },
  amber: {
    bar: 'border-l-amber-500',
    bg: 'bg-amber-50',
    value: 'text-amber-800',
    chip: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100',
    chipActive: 'bg-amber-600 text-white border-amber-600',
  },
  blue: {
    bar: 'border-l-blue-500',
    bg: 'bg-blue-50',
    value: 'text-blue-700',
    chip: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
    chipActive: 'bg-blue-600 text-white border-blue-600',
  },
  emerald: {
    bar: 'border-l-emerald-500',
    bg: 'bg-emerald-50',
    value: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    chipActive: 'bg-emerald-600 text-white border-emerald-600',
  },
  red: {
    bar: 'border-l-red-500',
    bg: 'bg-red-50',
    value: 'text-red-700',
    chip: 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100',
    chipActive: 'bg-red-600 text-white border-red-600',
  },
  violet: {
    bar: 'border-l-violet-500',
    bg: 'bg-violet-50',
    value: 'text-violet-700',
    chip: 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100',
    chipActive: 'bg-violet-600 text-white border-violet-600',
  },
  sky: {
    bar: 'border-l-sky-500',
    bg: 'bg-sky-50',
    value: 'text-sky-700',
    chip: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100',
    chipActive: 'bg-sky-600 text-white border-sky-600',
  },
  rose: {
    bar: 'border-l-rose-500',
    bg: 'bg-rose-50',
    value: 'text-rose-700',
    chip: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
    chipActive: 'bg-rose-600 text-white border-rose-600',
  },
  slate: {
    bar: 'border-l-slate-500',
    bg: 'bg-slate-50',
    value: 'text-slate-700',
    chip: 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100',
    chipActive: 'bg-slate-600 text-white border-slate-600',
  },
};

const DOMAIN_ACCENT: Record<(typeof DOMAIN_CARDS)[number]['id'], AccentKey> = {
  meal_order: 'orange',
  booking: 'blue',
  package: 'violet',
};

const ORIGIN_ACCENT: Record<string, AccentKey> = {
  system_pidge: 'sky',
  vendor: 'amber',
  customer: 'emerald',
  admin: 'violet',
};

function money(v: unknown): string {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function stageBadge(stage: string) {
  switch (stage) {
    case 'pending_review':
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'refund_processing':
    case 'processing':
    case 'approved':
      return 'bg-blue-100 text-blue-800';
    case 'refunded':
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'refund_failed':
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function formatDt(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isPendingReview(stage: string) {
  return stage === 'pending_review';
}

function isProcessingStage(stage: string) {
  return ['refund_processing', 'processing', 'approved'].includes(stage);
}

function isRefundedStage(stage: string) {
  return ['refunded', 'completed'].includes(stage);
}

function isFailedStage(stage: string) {
  return ['refund_failed', 'failed'].includes(stage);
}

function matchesStageFilter(row: HubCase, stageFilter: string): boolean {
  if (!stageFilter) return true;
  if (stageFilter === 'refund_processing') return isProcessingStage(row.stage);
  if (stageFilter === 'refunded') return isRefundedStage(row.stage);
  return row.stage === stageFilter;
}

export function UnifiedAdminRefundHub() {
  const [domain, setDomain] = useState('');
  const [stage, setStage] = useState('');
  const [origin, setOrigin] = useState('');
  const [allCases, setAllCases] = useState<HubCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HubCase | null>(null);
  const [detail, setDetail] = useState<HubDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [backfillRef, setBackfillRef] = useState('');
  const [backfillBusy, setBackfillBusy] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{
        success?: boolean;
        cases?: HubCase[];
        total?: number;
      }>('/admin/refund-cases?limit=500&offset=0');
      if (res.success !== false) {
        setAllCases(res.cases ?? []);
      }
    } catch (e: unknown) {
      console.error('[refund-hub]', e);
      toast.error('Failed to load refund cases');
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    return allCases.filter((row) => {
      if (domain && row.domain !== domain) return false;
      if (origin && (row.origin || '').toLowerCase() !== origin.toLowerCase()) return false;
      if (!matchesStageFilter(row, stage)) return false;
      return true;
    });
  }, [allCases, domain, stage, origin]);

  const stats = useMemo(() => {
    const sumAmount = (rows: HubCase[]) =>
      rows.reduce((s, r) => s + (Number.isFinite(r.amount ?? NaN) ? (r.amount as number) : 0), 0);
    const pendingReview = allCases.filter((c) => isPendingReview(c.stage)).length;
    const processing = allCases.filter((c) => isProcessingStage(c.stage)).length;
    const refunded = allCases.filter((c) => isRefundedStage(c.stage)).length;
    const failed = allCases.filter((c) => isFailedStage(c.stage)).length;
    const rejected = allCases.filter((c) => c.stage === 'rejected').length;
    return {
      total: allCases.length,
      pendingReview,
      processing,
      refunded,
      failed,
      rejected,
      filteredVolume: sumAmount(filtered),
      byDomain: DOMAIN_CARDS.map((d) => {
        const rows = allCases.filter((c) => c.domain === d.id);
        return { ...d, count: rows.length, volume: sumAmount(rows) };
      }),
      byOrigin: ORIGIN_CHIPS.map((o) => ({
        ...o,
        count: allCases.filter((c) => (c.origin || '').toLowerCase() === o.id).length,
      })),
    };
  }, [allCases, filtered]);

  const loadDetail = useCallback(async (item: HubCase) => {
    try {
      setDetailLoading(true);
      const res = await apiClient.get<{ success?: boolean; case?: HubDetail }>(
        `/admin/refund-cases/${item.sourceType}/${item.id}`,
      );
      if (res.case) setDetail(res.case);
      else {
        toast.error('Case not found');
        setSelected(null);
      }
    } catch {
      toast.error('Failed to load details');
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  const handleMealApprove = async () => {
    if (!selected || selected.sourceType !== 'meal_case') return;
    setProcessing(true);
    try {
      const res = await apiClient.post<{
        success?: boolean;
        error?: string;
        status?: string;
        refundAmountExecuted?: number;
      }>(`/admin/refund-cases/meal_case/${selected.id}/approve`, {});
      if (res.success !== false) {
        toast.success(
          res.status === 'refunded'
            ? `Refund completed (${money(res.refundAmountExecuted)})`
            : 'Refund initiated — processing',
        );
        void loadList();
        if (selected) void loadDetail(selected);
      } else {
        toast.error(res.error || 'Approve failed');
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Approve failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleMealReject = async () => {
    if (!selected || selected.sourceType !== 'meal_case') return;
    setProcessing(true);
    try {
      const res = await apiClient.post<{ success?: boolean; error?: string }>(
        `/admin/refund-cases/meal_case/${selected.id}/reject`,
        { review_notes: rejectNotes.trim() || undefined },
      );
      if (res.success !== false) {
        toast.success('Refund case rejected');
        setRejectNotes('');
        void loadList();
        if (selected) void loadDetail(selected);
      } else {
        toast.error(res.error || 'Reject failed');
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Reject failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleMealBackfill = async () => {
    const orderNumber = backfillRef.trim();
    if (!orderNumber) {
      toast.error('Enter a meal order number (e.g. ML2606034554)');
      return;
    }
    setBackfillBusy(true);
    try {
      const res = await apiClient.post<{
        success?: boolean;
        error?: string;
        created?: boolean;
        caseId?: string;
        skipped?: string;
        mealOrderId?: string;
      }>('/admin/refund-cases/meal-backfill', { orderNumber });
      if (res.success === false) {
        toast.error(res.error || 'Backfill failed');
        return;
      }
      if (res.created) {
        toast.success(
          res.caseId
            ? `Refund review case created (${res.caseId.slice(0, 8)}…)`
            : 'Refund review case created',
        );
        setBackfillRef('');
        setDomain('meal_order');
        setStage('pending_review');
        void loadList();
      } else {
        const skip = res.skipped || 'unknown';
        const msg =
          skip === 'duplicate_case'
            ? 'A refund case already exists for this order'
            : skip === 'order_not_cancelled'
              ? 'Order is not cancelled — backfill only applies to cancelled orders'
              : skip === 'not_paid'
                ? 'Order is not paid — no refund case created'
                : skip === 'order_not_found'
                  ? 'Order not found'
                  : `Backfill skipped: ${skip}`;
        toast.message(msg);
        void loadList();
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Backfill failed');
    } finally {
      setBackfillBusy(false);
    }
  };

  const handleRefundApprove = async () => {
    if (!selected || selected.sourceType !== 'refund') return;
    setProcessing(true);
    try {
      const res = await apiClient.post<{ success?: boolean; error?: string; message?: string }>(
        `/admin/refunds/${selected.id}/approve`,
        { notes: 'Approved from unified refund hub' },
      );
      if (res.success !== false) {
        toast.success(res.message || 'Refund approved');
        void loadList();
        if (selected) void loadDetail(selected);
      } else {
        toast.error(res.error || 'Approve failed');
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Approve failed');
    } finally {
      setProcessing(false);
    }
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition ${
      active ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-gray-500">
          Bookings, meal orders, and packages — shop/ecommerce excluded.
        </p>
        <button
          type="button"
          onClick={() => void loadList()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border-2 border-l-4 border-l-orange-500 border-orange-200 bg-orange-50/80 p-4">
        <p className="text-sm font-semibold text-orange-900">Meal logistics refund backfill</p>
        <p className="text-xs text-orange-800/90 mt-1 max-w-3xl">
          Use when a paid meal order was cancelled on Pidge (or tracking shows failed) but no review case
          appeared in this hub — for example dashboard cancel without webhook. Creates a{' '}
          <span className="font-medium">pending review</span> meal case; approve here to run the refund.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            value={backfillRef}
            onChange={(e) => setBackfillRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleMealBackfill();
            }}
            placeholder="Meal order number, e.g. ML2606034554"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-orange-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            disabled={backfillBusy}
          />
          <button
            type="button"
            onClick={() => void handleMealBackfill()}
            disabled={backfillBusy || !backfillRef.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="w-4 h-4" />
            {backfillBusy ? 'Creating…' : 'Create refund case'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <StatCard label="Total cases" value={String(stats.total)} accent="slate" />
        <StatCard label="Pending review" value={String(stats.pendingReview)} accent="amber" />
        <StatCard label="Processing" value={String(stats.processing)} accent="blue" />
        <StatCard label="Refunded" value={String(stats.refunded)} accent="emerald" />
        <StatCard label="Failed" value={String(stats.failed)} accent="red" />
        <StatCard label="Rejected" value={String(stats.rejected)} accent="rose" />
        <StatCard label="Volume (filtered)" value={money(stats.filteredVolume)} accent="violet" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-3">By type</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.byDomain.map((d) => {
            const a = ACCENT[DOMAIN_ACCENT[d.id]];
            const active = domain === d.id;
            const hoverBg = a.bg.replace(/^bg-/, 'hover:bg-');
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDomain(active ? '' : d.id)}
                className={`text-left p-3 rounded-xl border-2 border-l-4 transition ${a.bar} ${
                  active
                    ? `${a.bg} border-gray-200 shadow-sm ring-2 ring-offset-1 ring-gray-200/80`
                    : `border-gray-100 bg-white ${hoverBg}`
                }`}
              >
                <p className={`text-sm font-semibold ${a.value}`}>{d.label}</p>
                <p className="text-xs text-gray-600 mt-1">
                  <span className={`font-semibold ${a.value}`}>{d.count}</span> case{d.count === 1 ? '' : 's'} ·{' '}
                  <span className={`font-semibold ${a.value}`}>{money(d.volume)}</span>
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-3">By who asked</p>
        <div className="flex flex-wrap gap-2">
          {stats.byOrigin.map((o) => {
            const key = ORIGIN_ACCENT[o.id] ?? 'slate';
            const a = ACCENT[key];
            const active = origin === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setOrigin(active ? '' : o.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  active ? a.chipActive : a.chip
                }`}
              >
                {o.label} · <span className="tabular-nums">{o.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {STAGE_TABS.filter((t) => t.id !== 'processing' || stats.processing > 0).map((tab) => (
          <button
            key={tab.id || 'all'}
            type="button"
            onClick={() => setStage(tab.id)}
            className={tabClass(stage === tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-2">{filtered.length} shown</span>
        {(domain || stage || origin) ? (
          <button
            type="button"
            onClick={() => {
              setDomain('');
              setStage('');
              setOrigin('');
            }}
            className="text-sm text-orange-600 hover:underline ml-2"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-16 text-sm">No cases match filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">Order</th>
                    <th className="text-left p-3 font-medium text-gray-600">Customer</th>
                    <th className="text-left p-3 font-medium text-gray-600">Vendor</th>
                    <th className="text-right p-3 font-medium text-gray-600">Amount</th>
                    <th className="text-left p-3 font-medium text-gray-600">Status</th>
                    <th className="p-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((row) => (
                    <tr
                      key={`${row.sourceType}:${row.id}`}
                      className={`hover:bg-orange-50/50 cursor-pointer ${
                        selected?.id === row.id && selected?.sourceType === row.sourceType
                          ? 'bg-orange-50'
                          : ''
                      }`}
                      onClick={() => setSelected(row)}
                    >
                      <td className="p-3">
                        <p className="font-medium text-orange-800">
                          {row.referenceLabel || row.referenceId?.slice(0, 8) || '—'}
                        </p>
                        <p className="text-xs text-gray-400 truncate max-w-[180px]">
                          {row.reason || row.origin || '—'}
                        </p>
                      </td>
                      <td className="p-3 text-gray-800">{row.customerName || '—'}</td>
                      <td className="p-3 text-gray-800">{row.vendorName || '—'}</td>
                      <td className="p-3 text-right font-medium">{money(row.amount)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge(row.stage)}`}
                        >
                          {row.stage.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="xl:col-span-2">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-500 text-sm">
              Select a case to view details and approve or reject.
            </div>
          ) : detailLoading ? (
            <div className="bg-white rounded-2xl border p-8 flex justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : detail ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${stageBadge(detail.stage)}`}
                >
                  {detail.stage.replace(/_/g, ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-1 rounded hover:bg-gray-200"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto text-sm">
                <HubDetailSections detail={detail} />

                {detail.sourceType === 'meal_case' && detail.stage === 'pending_review' ? (
                  <div className="pt-3 space-y-3 border-t border-orange-100">
                    <textarea
                      placeholder="Rejection notes (optional)"
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      className="w-full text-sm border border-orange-200 rounded-lg p-3 min-h-[72px]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => void handleMealApprove()}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Approve & refund
                      </button>
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => void handleMealReject()}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      Approve triggers Razorpay or wallet refund for the recommended amount.
                    </p>
                  </div>
                ) : null}

                {detail.sourceType === 'refund' &&
                (detail.stage === 'pending' || detail.stage === 'approved') ? (
                  <div className="pt-3 border-t border-orange-100">
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => void handleRefundApprove()}
                      className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                    >
                      Process booking/package refund
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = 'orange',
}: {
  label: string;
  value: string;
  accent?: AccentKey;
}) {
  const a = ACCENT[accent];
  return (
    <div
      className={`rounded-xl border border-gray-100 border-l-4 p-3 ${a.bar} ${a.bg}`}
    >
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${a.value}`}>{value}</p>
    </div>
  );
}

function HubDetailSections({ detail }: { detail: HubDetail }) {
  const raw = detail.raw ?? {};
  const mc =
    detail.mealCase ??
    (detail.sourceType === 'meal_case' ? (raw as Record<string, unknown>) : undefined);
  const mo = detail.mealOrder ?? {};
  const pay = detail.payment ?? {};
  const booking = detail.booking ?? {};

  const isMeal =
    detail.domain === 'meal_order' || detail.sourceType === 'meal_case' || !!mo.orderNumber;

  if (detail.sourceType === 'meal_case' && mc) {
    return (
      <>
        <DetailSection title="Order" icon={FileText}>
          <DetailRow label="Order #" value={String(mo.orderNumber ?? mc.order_number ?? '')} />
          <DetailRow label="Order status" value={String(mo.orderStatus ?? mc.order_status ?? '')} />
          <DetailRow label="Payment status" value={String(mo.paymentStatus ?? mc.payment_status ?? '')} />
          <DetailRow
            label="Paid amount"
            value={money(mc.payment_amount ?? mo.totalAmount ?? mc.total_amount)}
          />
        </DetailSection>
        <DetailSection title="Customer" icon={User}>
          <DetailRow label="Name" value={String(mc.customer_name ?? detail.customerName ?? '')} />
          <DetailRow label="Phone" value={String(mc.customer_phone ?? '')} />
        </DetailSection>
        <DetailSection title="Vendor" icon={Store}>
          <DetailRow label="Business" value={String(mc.vendor_name ?? detail.vendorName ?? '')} />
        </DetailSection>
        <DetailSection title="Pidge / logistics" icon={Truck}>
          <DetailRow label="Pidge order ID" value={String(mc.pidge_order_id ?? '')} mono />
          <DetailRow label="Cancel source" value={String(mc.cancellation_source ?? detail.origin ?? '')} />
          <DetailRow
            label="Cancellation reason"
            value={String(mc.cancellation_reason ?? raw.order_cancellation_reason ?? detail.reason ?? '')}
          />
          <DetailRow label="Webhook event" value={String(mc.pidge_webhook_event_id ?? '')} mono />
          <DetailRow label="Webhook at" value={formatDt(mc.webhook_processed_at as string)} />
        </DetailSection>
        <DetailSection title="Recommendation" icon={CreditCard}>
          <DetailRow label="Suggested refund" value={money(mc.recommended_refund_amount)} />
          <p className="text-xs text-gray-600 mt-1">
            {String(mc.recommendation_reason ?? detail.reason ?? '—')}
          </p>
        </DetailSection>
        <DetailSection title="Review history" icon={CalendarClock}>
          <DetailRow label="Created" value={formatDt(String(mc.created_at ?? detail.createdAt ?? ''))} />
          <DetailRow label="Reviewed by" value={String(mc.reviewed_by ?? detail.actedBy ?? '')} mono />
          <DetailRow label="Reviewed at" value={formatDt(String(mc.reviewed_at ?? detail.actedAt ?? ''))} />
          {mc.review_notes ? (
            <p className="text-sm text-gray-700 mt-2">
              <span className="font-medium">Notes:</span> {String(mc.review_notes)}
            </p>
          ) : null}
        </DetailSection>
        <DetailSection title="Refund execution" icon={CreditCard}>
          <DetailRow label="Executed amount" value={money(mc.refund_amount_executed)} />
          <DetailRow label="Payout method" value={String(mc.payout_method ?? detail.payoutDestination ?? '')} />
          <DetailRow label="Razorpay refund ID" value={String(mc.razorpay_refund_id ?? '')} mono />
          <DetailRow label="Refunds row ID" value={String(mc.refunds_row_id ?? '')} mono />
          <DetailRow label="Requested at" value={formatDt(mc.refund_requested_at as string)} />
          <DetailRow label="Completed at" value={formatDt(mc.refund_completed_at as string)} />
          <DetailRow label="Failure reason" value={String(mc.refund_failure_reason ?? '')} />
        </DetailSection>
      </>
    );
  }

  return (
    <>
      {isMeal ? (
        <DetailSection title="Order" icon={FileText}>
          <DetailRow
            label="Order #"
            value={String(mo.orderNumber ?? raw.order_number ?? detail.referenceLabel ?? '')}
          />
          <DetailRow label="Order status" value={String(raw.order_status ?? booking.status ?? '')} />
          <DetailRow label="Payment status" value={String(raw.payment_status ?? pay.status ?? '')} />
          <DetailRow label="Paid amount" value={money(pay.amount ?? detail.amount)} />
        </DetailSection>
      ) : detail.domain === 'booking' ? (
        <DetailSection title="Booking" icon={FileText}>
          <DetailRow label="Booking ID" value={String(booking.id ?? raw.booking_ref ?? detail.referenceId ?? '')} mono />
          <DetailRow label="Status" value={String(booking.status ?? raw.booking_status ?? '')} />
          <DetailRow label="Cancelled by" value={String(raw.cancelled_by ?? detail.origin ?? '')} />
        </DetailSection>
      ) : (
        <DetailSection title="Package" icon={FileText}>
          <DetailRow label="Package" value={String(raw.package_name ?? detail.referenceLabel ?? '')} />
          <DetailRow label="Purchase ID" value={String(booking.packagePurchaseId ?? raw.package_purchase_id ?? '')} mono />
        </DetailSection>
      )}

      <DetailSection title="Customer" icon={User}>
        <DetailRow label="Name" value={String(raw.customer_name ?? detail.customerName ?? '')} />
        <DetailRow label="Phone" value={String(raw.customer_phone ?? '')} />
      </DetailSection>

      <DetailSection title="Vendor" icon={Store}>
        <DetailRow label="Business" value={String(raw.vendor_name ?? detail.vendorName ?? '')} />
      </DetailSection>

      {(detail.origin === 'system_pidge' || String(detail.reason ?? '').includes('pidge')) && isMeal ? (
        <DetailSection title="Pidge / logistics" icon={Truck}>
          <DetailRow label="Cancel source" value={detail.origin} />
          <DetailRow label="Reason" value={detail.reason} />
        </DetailSection>
      ) : null}

      <DetailSection title="Refund" icon={CreditCard}>
        <DetailRow label="Type" value={`${detail.sourceType} · ${detail.domain.replace('_', ' ')}`} />
        <DetailRow label="Amount" value={money(detail.amount)} />
        <DetailRow label="Payout" value={detail.payoutDestination} />
        <DetailRow label="Origin" value={detail.origin} />
        <DetailRow label="Reason" value={detail.reason} />
        <DetailRow label="Razorpay payment ID" value={String(pay.razorpayPaymentId ?? raw.razorpay_payment_id ?? '')} mono />
        <DetailRow label="Razorpay refund ID" value={String(raw.razorpay_refund_id ?? '')} mono />
        <DetailRow label="Requested" value={formatDt(detail.requestedAt || detail.createdAt)} />
        <DetailRow label="Processed by" value={detail.actedBy} mono />
        <DetailRow label="Processed at" value={formatDt(detail.actedAt)} />
      </DetailSection>
    </>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-orange-600" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  const v = value != null && String(value).trim() ? String(value) : '—';
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-900 text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {v}
      </span>
    </div>
  );
}
