'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { RefreshCw, ChevronRight, X, Check, Ban } from 'lucide-react';
import { MealLogisticsRefundCases } from './MealLogisticsRefundCases';

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
};

const DOMAIN_FILTERS = [
  { id: '', label: 'All domains' },
  { id: 'booking', label: 'Booking' },
  { id: 'meal_order', label: 'Meal order' },
  { id: 'package', label: 'Package' },
];

const STAGE_FILTERS = [
  { id: '', label: 'All stages' },
  { id: 'pending_review', label: 'Pending review' },
  { id: 'pending', label: 'Pending' },
  { id: 'refund_processing', label: 'Processing' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'refund_failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
];

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

export function UnifiedAdminRefundHub() {
  const [domain, setDomain] = useState('');
  const [stage, setStage] = useState('');
  const [origin, setOrigin] = useState('');
  const [cases, setCases] = useState<HubCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HubCase | null>(null);
  const [detail, setDetail] = useState<HubDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showMealTools, setShowMealTools] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (domain) params.set('domain', domain);
      if (stage) params.set('stage', stage);
      if (origin.trim()) params.set('origin', origin.trim());
      const res = await apiClient.get<{
        success?: boolean;
        cases?: HubCase[];
        total?: number;
      }>(`/admin/refund-cases?${params.toString()}`);
      if (res.success !== false) {
        setCases(res.cases ?? []);
        setTotal(res.total ?? 0);
      }
    } catch (e: unknown) {
      console.error('[refund-hub]', e);
      toast.error('Failed to load refund cases');
    } finally {
      setLoading(false);
    }
  }, [domain, stage, origin]);

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
      }>(`/admin/meal-refund-cases/${selected.id}/approve`, {});
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
        `/admin/meal-refund-cases/${selected.id}/reject`,
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

  const mc = detail?.mealCase as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Unified refund hub</h2>
          <p className="text-sm text-gray-500 mt-1">
            Bookings, meal orders, and packages — shop/ecommerce excluded.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowMealTools((v) => !v)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {showMealTools ? 'Hide meal tools' : 'Meal backfill'}
          </button>
          <button
            type="button"
            onClick={() => void loadList()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {showMealTools ? (
        <div className="border border-orange-100 rounded-xl p-4 bg-orange-50/50">
          <MealLogisticsRefundCases />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 items-end">
        <FilterSelect label="Domain" value={domain} options={DOMAIN_FILTERS} onChange={setDomain} />
        <FilterSelect label="Stage" value={stage} options={STAGE_FILTERS} onChange={setStage} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Origin</label>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. system_pidge"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-40"
          />
        </div>
        <span className="text-sm text-gray-500 pb-2">{total} case(s)</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : cases.length === 0 ? (
            <p className="text-center text-gray-500 py-16 text-sm">No cases match filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">Reference</th>
                    <th className="text-left p-3 font-medium text-gray-600">Domain</th>
                    <th className="text-left p-3 font-medium text-gray-600">Customer</th>
                    <th className="text-right p-3 font-medium text-gray-600">Amount</th>
                    <th className="text-left p-3 font-medium text-gray-600">Stage</th>
                    <th className="p-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cases.map((row) => (
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
                        <p className="font-medium text-gray-900">
                          {row.referenceLabel || row.referenceId?.slice(0, 8) || '—'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {row.sourceType === 'meal_case' ? 'Meal case' : 'Refund row'} ·{' '}
                          {row.origin || '—'}
                        </p>
                      </td>
                      <td className="p-3 capitalize text-gray-700">{row.domain.replace('_', ' ')}</td>
                      <td className="p-3 text-gray-800">{row.customerName || '—'}</td>
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
              Select a case for details and actions.
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
              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto text-sm">
                <DetailRow label="Type" value={`${detail.sourceType} · ${detail.domain}`} />
                <DetailRow label="Customer" value={detail.customerName} />
                <DetailRow label="Vendor" value={detail.vendorName} />
                <DetailRow label="Amount" value={money(detail.amount)} />
                <DetailRow label="Payout" value={detail.payoutDestination} />
                <DetailRow label="Origin" value={detail.origin} />
                <DetailRow label="Reason" value={detail.reason} />
                <DetailRow label="Requested" value={formatDt(detail.requestedAt || detail.createdAt)} />
                <DetailRow label="Acted by" value={detail.actedBy} />
                <DetailRow label="Acted at" value={formatDt(detail.actedAt)} />
                {mc ? (
                  <>
                    <DetailRow
                      label="Executed amount"
                      value={money(mc.refund_amount_executed)}
                    />
                    <DetailRow label="Razorpay refund ID" value={String(mc.razorpay_refund_id || '')} mono />
                    <DetailRow label="Refunds row" value={String(mc.refunds_row_id || '')} mono />
                    <DetailRow
                      label="Refund requested"
                      value={formatDt(mc.refund_requested_at as string)}
                    />
                    <DetailRow
                      label="Refund completed"
                      value={formatDt(mc.refund_completed_at as string)}
                    />
                    <DetailRow
                      label="Failure reason"
                      value={String(mc.refund_failure_reason || '')}
                    />
                  </>
                ) : null}

                {detail.sourceType === 'meal_case' && detail.stage === 'pending_review' ? (
                  <div className="pt-3 space-y-3 border-t">
                    <textarea
                      placeholder="Rejection notes (optional)"
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg p-3 min-h-[72px]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => void handleMealApprove()}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
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
                  </div>
                ) : null}

                {detail.sourceType === 'refund' &&
                (detail.stage === 'pending' || detail.stage === 'approved') ? (
                  <div className="pt-3 border-t">
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => void handleRefundApprove()}
                      className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
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

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.id || 'all'} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
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
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-900 text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {v}
      </span>
    </div>
  );
}
