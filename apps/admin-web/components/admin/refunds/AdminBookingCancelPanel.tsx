'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  useCancelBooking,
  type AdminCancelResult,
  type AdminRefundAmountMode,
  type AdminRefundMethod,
} from '@/hooks/useBookings';

type CancelPreview = {
  booking: {
    id: string;
    status: string;
    paymentStatus: string | null;
    bookingDate: string | null;
    bookingTime: string | null;
    serviceType: string | null;
    totalAmount: number;
    commerceMode: string | null;
    customerName: string | null;
    customerPhone: string | null;
    vendorName: string | null;
    serviceName: string | null;
    isPackage: boolean;
    isPackageSession: boolean;
  };
  action: 'cancel_and_refund' | 'cancel_only' | 'refund_only' | 'blocked';
  blockedReason: string | null;
  refundSkippedReason: string | null;
  paid: boolean;
  priorRefunds: { walletRefunded: number; refundsRecorded: number; pendingRefunds: number; total: number };
  refund: {
    method: AdminRefundMethod;
    amountMode: AdminRefundAmountMode;
    amount: number;
    percentage: number;
    fullAmount: number;
    policyAmount: number;
    policyPercentage: number;
  };
};

const money = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const ACTION_LABEL: Record<CancelPreview['action'], string> = {
  cancel_and_refund: 'Cancel booking & refund',
  cancel_only: 'Cancel booking (no refund)',
  refund_only: 'Issue refund (already cancelled)',
  blocked: 'Not allowed',
};

function optionClass(active: boolean) {
  return `flex-1 px-3 py-2 rounded-lg border text-sm text-left transition ${
    active ? 'border-orange-500 bg-orange-50 text-orange-900 ring-1 ring-orange-400' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
  }`;
}

export function AdminBookingCancelPanel() {
  const [bookingRef, setBookingRef] = useState('');
  const [lookupRef, setLookupRef] = useState('');
  const [refundMethod, setRefundMethod] = useState<AdminRefundMethod>('wallet');
  const [amountMode, setAmountMode] = useState<AdminRefundAmountMode>('full');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<CancelPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<AdminCancelResult | null>(null);
  const cancelMutation = useCancelBooking();

  const loadPreview = useCallback(async (ref: string, method: AdminRefundMethod, mode: AdminRefundAmountMode) => {
    if (!ref) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ refundMethod: method, amountMode: mode });
      const res = await apiClient.get<{ success: boolean; data: CancelPreview }>(
        `/admin/bookings/${encodeURIComponent(ref)}/cancel-preview?${qs.toString()}`,
      );
      setPreview(res.data);
    } catch (e) {
      setPreview(null);
      toast.error((e as Error).message || 'Could not load booking');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setConfirming(false);
    if (lookupRef) void loadPreview(lookupRef, refundMethod, amountMode);
  }, [lookupRef, refundMethod, amountMode, loadPreview]);

  const handleLookup = () => {
    const ref = bookingRef.trim().replace(/^#/, '');
    if (!ref) return;
    setResult(null);
    if (ref === lookupRef) void loadPreview(ref, refundMethod, amountMode);
    else setLookupRef(ref);
  };

  const handleSubmit = async () => {
    if (!preview || preview.action === 'blocked') return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      const data = await cancelMutation.mutateAsync({
        bookingId: preview.booking.id,
        reason: reason.trim(),
        refundMethod,
        amountMode,
      });
      setResult(data);
      setConfirming(false);
      setReason('');
      void loadPreview(preview.booking.id, refundMethod, amountMode);
    } catch {
      setConfirming(false);
    }
  };

  const b = preview?.booking;
  const blocked = preview?.action === 'blocked';
  const showsRefund = preview?.action === 'cancel_and_refund' || preview?.action === 'refund_only';
  const busy = loading || cancelMutation.isPending;
  const canSubmit = Boolean(preview) && !blocked && reason.trim().length >= 3 && !busy;

  return (
    <div className="rounded-2xl border-2 border-l-4 border-l-red-500 border-red-200 bg-red-50/60 p-4 mb-6">
      <p className="text-sm font-semibold text-red-900">Cancel booking &amp; refund</p>
      <p className="text-xs text-red-800/90 mt-1 max-w-3xl">
        For service bookings and appointments. Paste the booking ID (full ID or the first 8 characters the customer
        sees). Cancels pending/confirmed bookings and refunds to the customer&apos;s wallet or original payment. For an
        already-cancelled paid booking with no refund yet, this issues the missing refund.
      </p>

      <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="text"
          value={bookingRef}
          onChange={(e) => setBookingRef(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLookup();
          }}
          placeholder="Booking ID, e.g. 3f2a9c1e or the full UUID"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-red-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300"
          disabled={busy}
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={busy || !bookingRef.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-red-300 text-red-800 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Loading…' : 'Look up'}
        </button>
      </div>

      {preview && b && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Customer</p>
              <p className="font-medium text-gray-900">{b.customerName || '—'}</p>
              <p className="text-xs text-gray-500">{b.customerPhone || ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Provider · service</p>
              <p className="font-medium text-gray-900">{b.vendorName || '—'}</p>
              <p className="text-xs text-gray-500">
                {b.serviceName || '—'}
                {b.isPackage ? ' · package' : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">When</p>
              <p className="font-medium text-gray-900">
                {b.bookingDate || '—'} {b.bookingTime || ''}
              </p>
              <p className="text-xs text-gray-500">{b.serviceType || ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status · paid</p>
              <p className="font-medium text-gray-900 capitalize">{b.status.replace(/_/g, ' ')}</p>
              <p className="text-xs text-gray-500">
                {preview.paid ? 'Paid' : 'Not paid'} · total {money(b.totalAmount)}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 font-mono break-all">{b.id}</p>

          {preview.priorRefunds.total > 0.009 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Already refunded: {money(preview.priorRefunds.walletRefunded)} to wallet,{' '}
              {money(preview.priorRefunds.refundsRecorded)} to original payment.
            </p>
          )}

          {blocked ? (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {preview.blockedReason}
            </p>
          ) : (
            <>
              {preview.paid && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Refund to</p>
                    <div className="flex gap-2">
                      {(['wallet', 'original', 'none'] as AdminRefundMethod[]).map((m) => (
                        <button key={m} type="button" className={optionClass(refundMethod === m)} onClick={() => setRefundMethod(m)} disabled={busy}>
                          {m === 'wallet' ? 'Wallet' : m === 'original' ? 'Original payment' : 'No refund'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {refundMethod !== 'none' && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">Amount</p>
                      <div className="flex gap-2">
                        <button type="button" className={optionClass(amountMode === 'full')} onClick={() => setAmountMode('full')} disabled={busy}>
                          Full · {money(preview.refund.fullAmount)}
                        </button>
                        <button type="button" className={optionClass(amountMode === 'policy')} onClick={() => setAmountMode('policy')} disabled={busy}>
                          As per policy · {money(preview.refund.policyAmount)} ({preview.refund.policyPercentage}%)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                <span className="font-semibold text-gray-900">{ACTION_LABEL[preview.action]}</span>
                {showsRefund && (
                  <span className="text-gray-700">
                    {' '}
                    — {money(preview.refund.amount)} ({preview.refund.percentage}%) to{' '}
                    {refundMethod === 'wallet' ? 'wallet' : 'original payment'}
                  </span>
                )}
                {preview.refundSkippedReason && (
                  <span className="text-gray-600"> — {preview.refundSkippedReason}</span>
                )}
              </div>

              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setConfirming(false);
                }}
                rows={2}
                placeholder="Reason (shown to the provider and customer)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300"
                disabled={busy}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                    confirming ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  {cancelMutation.isPending ? 'Working…' : confirming ? 'Click again to confirm' : ACTION_LABEL[preview.action]}
                </button>
                {confirming && (
                  <button type="button" onClick={() => setConfirming(false)} className="text-sm text-gray-600 hover:underline">
                    Back
                  </button>
                )}
              </div>
            </>
          )}

          {result && (
            <p
              className={`text-sm rounded-lg px-3 py-2 border ${
                result.refund?.status === 'failed'
                  ? 'text-red-800 bg-red-50 border-red-200'
                  : 'text-emerald-800 bg-emerald-50 border-emerald-200'
              }`}
            >
              {result.action === 'refund_only' ? 'Refund processed.' : `Booking ${result.previousStatus} → ${result.status}.`}{' '}
              {result.refund?.message || result.refundSkippedReason || ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
