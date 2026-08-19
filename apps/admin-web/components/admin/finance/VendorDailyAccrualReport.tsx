'use client';

import { Fragment, useCallback, useState } from 'react';
import { apiClient, getApiBaseUrl, isUatMode } from '@/lib/api-client';
import { Button } from '@warmpawz/ui';
import { ChevronDown, ChevronRight, Download, ExternalLink, Loader2, Play, RefreshCw } from 'lucide-react';
import { buildBookingEarningsFinanceUrl } from '@/lib/finance/settlementAuditExport';
import { VendorPeriodBookingsPanel } from './VendorPeriodBookingsPanel';

function yesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Row = {
  vendor_id: string;
  business_name?: string;
  owner_name?: string;
  vendor_phone?: string;
  gross_amount: string | number;
  commission_amount: string | number;
  net_amount: string | number;
  platform_fee?: string | number;
  convenience_fee?: string | number;
  delivery_fee?: string | number;
  cgst_amount?: string | number;
  sgst_amount?: string | number;
  igst_amount?: string | number;
  gst_total?: string | number;
  currency?: string;
  earnings_line_count: number;
  missing_earnings_booking_count: number;
  delivery_settlement_line_count?: number;
  missing_delivery_settlement_count?: number;
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  bankVerified?: boolean | null;
  bankVerificationStatus?: string | null;
  razorpayFundAccountId?: string | null;
  bankSource?: string | null;
  hasBankOnFile?: boolean;
  computed_at?: string;
};

function moneyCell(v: string | number | undefined | null) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function gstBreakdownCell(
  gstTotal: string | number | undefined | null,
  cgst?: string | number | null,
  sgst?: string | number | null,
  igst?: string | number | null,
) {
  const c = Number(cgst || 0);
  const s = Number(sgst || 0);
  const i = Number(igst || 0);
  return (
    <div className="text-right">
      <div className="tabular-nums">{moneyCell(gstTotal)}</div>
      {i > 0.009 && c + s <= 0.009 ? (
        <div className="text-xs text-gray-500">IGST {moneyCell(i)}</div>
      ) : c + s > 0.009 ? (
        <div className="text-xs text-gray-500">
          CGST {moneyCell(c)} · SGST {moneyCell(s)}
        </div>
      ) : null}
    </div>
  );
}

export function VendorDailyAccrualReport() {
  const [reportDate, setReportDate] = useState(yesterdayYmd());
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{
    gross: number;
    commission: number;
    net: number;
    platformFee: number;
    convenienceFee: number;
    deliveryFee: number;
    gstTotal: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    vendorCount: number;
    platformFundedDiscount?: number;
    vendorFundedDiscount?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.get<any>(
        `/admin/finance/vendor-daily-accrual?reportDate=${encodeURIComponent(reportDate)}`
      );
      if (!res?.success) {
        setError(res?.error || 'Failed to load report');
        setRows([]);
        setTotals(null);
        return;
      }
      setRows(res.rows || []);
      const t = res.totals;
      setTotals(
        t
          ? {
              gross: Number(t.grossAmount) || 0,
              commission: Number(t.commissionAmount) || 0,
              net: Number(t.netAmount) || 0,
              platformFee: Number(t.platformFee) || 0,
              convenienceFee: Number(t.convenienceFee) || 0,
              deliveryFee: Number(t.deliveryFee) || 0,
              gstTotal: Number(t.gstTotal) || 0,
              cgstAmount: Number(t.cgstAmount) || 0,
              sgstAmount: Number(t.sgstAmount) || 0,
              igstAmount: Number(t.igstAmount) || 0,
              vendorCount: Number(t.vendorCount) || 0,
              platformFundedDiscount: Number(t.platformFundedDiscount) || 0,
              vendorFundedDiscount: Number(t.vendorFundedDiscount) || 0,
            }
          : null
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setRows([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [reportDate]);

  const compute = async () => {
    setError(null);
    setComputing(true);
    try {
      const res = await apiClient.post<any>('/admin/finance/vendor-daily-accrual/compute', {
        reportDate: reportDate || undefined,
      });
      if (!res?.success) {
        setError(res?.error || 'Compute failed');
        return;
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Compute failed');
    } finally {
      setComputing(false);
    }
  };

  const downloadCsv = async () => {
    setError(null);
    try {
      const base = getApiBaseUrl().replace(/\/+$/, '');
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('adminAuthToken') ||
            (() => {
              try {
                const { getCognitoIdToken } = require('@/lib/cognito-auth');
                return getCognitoIdToken();
              } catch {
                return null;
              }
            })()
          : null;
      const url = `${base}/admin/finance/vendor-daily-accrual/export.csv?reportDate=${encodeURIComponent(reportDate)}`;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (isUatMode()) {
        headers['X-UAT-Mode'] = 'true';
        if (token?.startsWith('uat-token-')) headers['X-UAT-Token'] = token;
      }
      const res = await fetch(url, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vendor-daily-accrual-${reportDate}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e?.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">IST calendar day accrual</p>
        <p className="mt-1 text-blue-800">
          Gross / commission / net include <code className="rounded bg-blue-100 px-1">vendor_earnings</code> (
          <code className="rounded bg-blue-100 px-1">realized_at</code>) and meal/pharmacy{' '}
          <code className="rounded bg-blue-100 px-1">delivery_settlements</code> (
          <code className="rounded bg-blue-100 px-1">order_delivered_at</code>) in{' '}
          <strong>[report date 00:00, next day 00:00) Asia/Kolkata</strong>. EventBridge{' '}
          <code className="rounded bg-blue-100 px-1">calculate-daily</code> batches eligible delivery rows into{' '}
          <code className="rounded bg-blue-100 px-1">settlements</code> after the tier hold.
        </p>
        <p className="mt-2 text-blue-800">
          <strong>Missing earnings</strong> = completed bookings that day with no{' '}
          <code className="rounded bg-blue-100 px-1">vendor_earnings</code> row.{' '}
          <strong>Missing delivery settlement</strong> = delivered meal orders that day with no{' '}
          <code className="rounded bg-blue-100 px-1">delivery_settlements</code> row. CSV export also
          includes customer checkout <strong>platform fee</strong>, <strong>convenience fee</strong>,{' '}
          <strong>delivery fee</strong>, and <strong>GST (CGST / SGST / IGST)</strong> for investor reporting.
          Expand a vendor row to download the same tax invoice the customer receives for each booking.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Report date (IST)</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Load</span>
        </Button>
        <Button type="button" onClick={() => void compute()} disabled={computing || !reportDate}>
          {computing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          <span className="ml-2">Compute / refresh snapshot</span>
        </Button>
        <Button type="button" variant="outline" onClick={() => void downloadCsv()} disabled={!reportDate}>
          <Download className="h-4 w-4" />
          <span className="ml-2">Export CSV</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {totals && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Vendors in snapshot</div>
              <div className="text-xl font-semibold">{totals.vendorCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Gross</div>
              <div className="text-xl font-semibold">{moneyCell(totals.gross)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Commission</div>
              <div className="text-xl font-semibold">{moneyCell(totals.commission)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Net to vendors</div>
              <div className="text-xl font-semibold">{moneyCell(totals.net)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Platform fee</div>
              <div className="text-sm font-semibold">{moneyCell(totals.platformFee)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Convenience fee</div>
              <div className="text-sm font-semibold">{moneyCell(totals.convenienceFee)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Delivery fee</div>
              <div className="text-sm font-semibold">{moneyCell(totals.deliveryFee)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Customer GST</div>
              <div className="text-sm font-semibold">{moneyCell(totals.gstTotal)}</div>
              {totals.igstAmount > 0.009 && totals.cgstAmount + totals.sgstAmount <= 0.009 ? (
                <div className="text-xs text-gray-500">IGST {moneyCell(totals.igstAmount)}</div>
              ) : totals.cgstAmount + totals.sgstAmount > 0.009 ? (
                <div className="text-xs text-gray-500">
                  CGST {moneyCell(totals.cgstAmount)} · SGST {moneyCell(totals.sgstAmount)}
                </div>
              ) : null}
            </div>
          </div>
          {(totals.platformFundedDiscount != null || totals.vendorFundedDiscount != null) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
                <div className="text-xs text-gray-600">Platform-funded discount</div>
                <div className="text-sm font-semibold">{moneyCell(totals.platformFundedDiscount)}</div>
              </div>
              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
                <div className="text-xs text-gray-600">Vendor-funded discount</div>
                <div className="text-sm font-semibold">{moneyCell(totals.vendorFundedDiscount)}</div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 text-left font-medium text-gray-700">Business</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Owner</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Gross</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Commission</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Net</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Platform</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Convenience</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Delivery</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">GST</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Lines</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Delivery</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Missing VE</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Missing DS</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Bank</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">IFSC</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Verified</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Bookings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={18} className="px-3 py-8 text-center text-gray-500">
                  No rows. Pick a date, run <strong>Compute</strong> (requires migration 732 + 753), then <strong>Load</strong>.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const open = expandedVendorId === r.vendor_id;
              return (
                <Fragment key={r.vendor_id}>
                  <tr
                    className={`cursor-pointer hover:bg-orange-50/60 ${open ? 'bg-orange-50' : ''}`}
                    onClick={() => setExpandedVendorId(open ? null : r.vendor_id)}
                  >
                    <td className="px-2 py-2 text-gray-400">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-3 py-2">{r.business_name || '—'}</td>
                    <td className="px-3 py-2">{r.owner_name || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      ₹{Number(r.gross_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      ₹{Number(r.commission_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(r.net_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(r.platform_fee)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(r.convenience_fee)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(r.delivery_fee)}</td>
                    <td className="px-3 py-2">
                      {gstBreakdownCell(r.gst_total, r.cgst_amount, r.sgst_amount, r.igst_amount)}
                    </td>
                    <td className="px-3 py-2 text-center">{r.earnings_line_count}</td>
                    <td className="px-3 py-2 text-center">{r.delivery_settlement_line_count ?? 0}</td>
                    <td className="px-3 py-2 text-center">{r.missing_earnings_booking_count}</td>
                    <td className="px-3 py-2 text-center">{r.missing_delivery_settlement_count ?? 0}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate" title={r.bankName || ''}>
                      {r.bankName || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.ifscCode || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {r.hasBankOnFile ? (r.bankVerified ? 'Yes' : 'No') : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <a
                        href={buildBookingEarningsFinanceUrl({
                          periodType: 'day',
                          reportDate,
                          vendorId: r.vendor_id,
                        })}
                        className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View bookings
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-orange-50/40">
                      <td colSpan={18} className="px-3 py-3">
                        <VendorPeriodBookingsPanel
                          periodType="day"
                          reportDate={reportDate}
                          vendorId={r.vendor_id}
                          businessName={r.business_name}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
