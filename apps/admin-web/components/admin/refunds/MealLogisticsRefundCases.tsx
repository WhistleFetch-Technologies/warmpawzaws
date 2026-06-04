'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  RefreshCw,
  ChevronRight,
  X,
  Check,
  Ban,
  Truck,
  User,
  Store,
  CreditCard,
  FileText,
} from 'lucide-react';

type CaseStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'refund_processing'
  | 'refunded'
  | 'refund_failed';

type MealRefundCaseRow = {
  id: string;
  meal_order_id: string;
  pidge_order_id?: string | null;
  status: CaseStatus;
  cancellation_source?: string | null;
  cancellation_reason?: string | null;
  recommended_refund_amount?: string | number | null;
  recommendation_reason?: string | null;
  order_number?: string | null;
  payment_status?: string | null;
  total_amount?: string | number | null;
  customer_name?: string | null;
  vendor_name?: string | null;
  created_at: string;
};

type MealRefundCaseDetail = MealRefundCaseRow & {
  order_status?: string | null;
  cancelled_by?: string | null;
  order_cancellation_reason?: string | null;
  customer_id?: string | null;
  customer_phone?: string | null;
  vendor_id?: string | null;
  payment_amount?: string | number | null;
  gateway_payment_status?: string | null;
  razorpay_payment_id?: string | null;
  webhook_event_id?: string | null;
  webhook_processed_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  updated_at?: string | null;
  refunds_row_id?: string | null;
  razorpay_refund_id?: string | null;
  refund_amount_executed?: string | number | null;
  refund_requested_at?: string | null;
  refund_completed_at?: string | null;
  refund_failure_reason?: string | null;
  payout_method?: string | null;
};

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'pending_review', label: 'Pending review' },
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

function statusBadge(status: string) {
  switch (status) {
    case 'pending_review':
      return 'bg-amber-100 text-amber-800';
    case 'approved':
    case 'refund_processing':
      return 'bg-blue-100 text-blue-800';
    case 'rejected':
    case 'refund_failed':
      return 'bg-red-100 text-red-700';
    case 'refunded':
      return 'bg-emerald-100 text-emerald-800';
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

export function MealLogisticsRefundCases() {
  const [filter, setFilter] = useState('');
  const [cases, setCases] = useState<MealRefundCaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MealRefundCaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const qs = filter ? `?status=${encodeURIComponent(filter)}&limit=50` : '?limit=50';
      const res = await apiClient.get<{
        success?: boolean;
        cases?: MealRefundCaseRow[];
        total?: number;
      }>(`/admin/meal-refund-cases${qs}`);
      if (res.success !== false) {
        setCases(res.cases ?? []);
        setTotal(res.total ?? res.cases?.length ?? 0);
      }
    } catch (e: unknown) {
      console.error('[meal-refund-cases]', e);
      toast.error('Failed to load meal refund cases');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadDetail = useCallback(async (caseId: string) => {
    try {
      setDetailLoading(true);
      const res = await apiClient.get<{
        success?: boolean;
        case?: MealRefundCaseDetail;
      }>(`/admin/meal-refund-cases/${caseId}`);
      if (res.case) {
        setDetail(res.case);
      } else {
        toast.error('Case not found');
        setSelectedId(null);
      }
    } catch (e: unknown) {
      toast.error('Failed to load case details');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const handleApprove = async () => {
    if (!selectedId || !detail) return;
    setProcessing(true);
    try {
      const res = await apiClient.post<{
        success?: boolean;
        error?: string;
        status?: string;
        refundAmountExecuted?: number;
      }>(`/admin/meal-refund-cases/${selectedId}/approve`, {});
      if (res.success !== false) {
        toast.success(
          res.status === 'refunded'
            ? 'Refund completed'
            : 'Refund initiated — processing via Razorpay',
        );
        void loadList();
        void loadDetail(selectedId);
      } else {
        toast.error(res.error || 'Approve failed');
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Approve failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedId) return;
    setProcessing(true);
    try {
      const res = await apiClient.post<{ success?: boolean; error?: string }>(
        `/admin/meal-refund-cases/${selectedId}/reject`,
        { review_notes: rejectNotes.trim() || undefined },
      );
      if (res.success !== false) {
        toast.success('Refund case rejected');
        setRejectNotes('');
        void loadList();
        void loadDetail(selectedId);
      } else {
        toast.error(res.error || 'Reject failed');
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Reject failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Meal logistics refund cases</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pidge cancellations on paid meal orders — approve runs Razorpay/wallet refund (Phase 3).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadList()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.id || 'all'}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === tab.id
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="text-sm text-gray-500 self-center ml-2">{total} case(s)</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : cases.length === 0 ? (
            <p className="text-center text-gray-500 py-16 text-sm">No cases in this filter.</p>
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
                  {cases.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-orange-50/50 cursor-pointer ${
                        selectedId === row.id ? 'bg-orange-50' : ''
                      }`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td className="p-3">
                        <p className="font-medium text-gray-900">
                          {row.order_number || row.meal_order_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-gray-400 truncate max-w-[140px]">
                          {row.cancellation_reason || '—'}
                        </p>
                      </td>
                      <td className="p-3 text-gray-800">{row.customer_name || '—'}</td>
                      <td className="p-3 text-gray-800">{row.vendor_name || '—'}</td>
                      <td className="p-3 text-right font-medium">
                        {money(row.recommended_refund_amount ?? row.total_amount)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(row.status)}`}
                        >
                          {row.status.replace('_', ' ')}
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
          {!selectedId ? (
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
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(detail.status)}`}
                >
                  {detail.status.replace('_', ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="p-1 rounded hover:bg-gray-200"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <Section title="Order" icon={FileText}>
                  <Row label="Order #" value={detail.order_number || detail.meal_order_id} />
                  <Row label="Order status" value={detail.order_status} />
                  <Row label="Payment status" value={detail.payment_status} />
                  <Row label="Paid amount" value={money(detail.payment_amount ?? detail.total_amount)} />
                </Section>

                <Section title="Customer" icon={User}>
                  <Row label="Name" value={detail.customer_name} />
                  <Row label="Phone" value={detail.customer_phone} />
                </Section>

                <Section title="Vendor" icon={Store}>
                  <Row label="Business" value={detail.vendor_name} />
                </Section>

                <Section title="Pidge / logistics" icon={Truck}>
                  <Row label="Pidge order ID" value={detail.pidge_order_id} />
                  <Row label="Cancel source" value={detail.cancellation_source} />
                  <Row
                    label="Cancellation reason"
                    value={detail.cancellation_reason || detail.order_cancellation_reason}
                  />
                  <Row label="Webhook event" value={detail.webhook_event_id} mono />
                  <Row label="Webhook at" value={formatDt(detail.webhook_processed_at)} />
                </Section>

                <Section title="Recommendation" icon={CreditCard}>
                  <Row
                    label="Suggested refund"
                    value={money(detail.recommended_refund_amount)}
                  />
                  <p className="text-xs text-gray-600 mt-1">{detail.recommendation_reason || '—'}</p>
                </Section>

                <Section title="Review history" icon={FileText}>
                  <Row label="Created" value={formatDt(detail.created_at)} />
                  <Row label="Reviewed by" value={detail.reviewed_by} />
                  <Row label="Reviewed at" value={formatDt(detail.reviewed_at)} />
                  {detail.review_notes ? (
                    <p className="text-sm text-gray-700 mt-2">
                      <span className="font-medium">Notes:</span> {detail.review_notes}
                    </p>
                  ) : null}
                </Section>

                <Section title="Refund execution" icon={CreditCard}>
                  <Row label="Executed amount" value={money(detail.refund_amount_executed)} />
                  <Row label="Payout method" value={detail.payout_method} />
                  <Row label="Razorpay refund ID" value={detail.razorpay_refund_id} mono />
                  <Row label="Refunds row ID" value={detail.refunds_row_id} mono />
                  <Row label="Requested at" value={formatDt(detail.refund_requested_at)} />
                  <Row label="Completed at" value={formatDt(detail.refund_completed_at)} />
                  <Row label="Failure reason" value={detail.refund_failure_reason} />
                </Section>

                {detail.status === 'pending_review' ? (
                  <div className="pt-2 space-y-3 border-t">
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
                        onClick={() => void handleApprove()}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => void handleReject()}
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
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({
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

function Row({
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
