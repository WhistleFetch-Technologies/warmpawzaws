'use client';

import { useCallback, useState } from 'react';
import { apiClient, getApiBaseUrl, isUatMode } from '@/lib/api-client';
import { Button } from '@warmpawz/ui';
import { Download, Loader2, Play, RefreshCw } from 'lucide-react';
import { downloadReconciliationPack } from '@/lib/finance/settlementAuditExport';

function currentYearMonthValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

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

function parseYearMonth(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  return { year, month };
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
  snapshot_day_count?: number;
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

export function VendorMonthlyAccrualReport() {
  const [yearMonth, setYearMonth] = useState(currentYearMonthValue());
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
  const [packDownloading, setPackDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseYearMonth(yearMonth);

  const load = useCallback(async () => {
    if (!parsed) {
      setError('Pick a valid month (YYYY-MM)');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.get<any>(
        `/admin/finance/vendor-daily-accrual/monthly?year=${parsed.year}&month=${parsed.month}`
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
  }, [parsed?.year, parsed?.month]);

  const compute = async () => {
    if (!parsed) {
      setError('Pick a valid month (YYYY-MM)');
      return;
    }
    setError(null);
    setComputing(true);
    try {
      const res = await apiClient.post<any>('/admin/finance/vendor-daily-accrual/monthly/compute', {
        year: parsed.year,
        month: parsed.month,
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
    if (!parsed) {
      setError('Pick a valid month (YYYY-MM)');
      return;
    }
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
      const url = `${base}/admin/finance/vendor-daily-accrual/monthly/export.csv?year=${parsed.year}&month=${parsed.month}`;
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
      a.download = `vendor-monthly-accrual-${yearMonth}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e?.message || 'Download failed');
    }
  };

  const downloadReconciliationPackAction = async () => {
    if (!parsed) {
      setError('Pick a valid month (YYYY-MM)');
      return;
    }
    setError(null);
    setPackDownloading(true);
    try {
      await downloadReconciliationPack(parsed.year, parsed.month);
    } catch (e: any) {
      setError(e?.message || 'Reconciliation pack download failed');
    } finally {
      setPackDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">IST calendar month accrual</p>
        <p className="mt-1 text-blue-800">
          Aggregates daily <code className="rounded bg-blue-100 px-1">vendor_daily_accrual</code> snapshots for each
          vendor across the selected month. Each daily snapshot covers{' '}
          <strong>[day 00:00, next day 00:00) Asia/Kolkata</strong> from{' '}
          <code className="rounded bg-blue-100 px-1">vendor_earnings</code> and{' '}
          <code className="rounded bg-blue-100 px-1">delivery_settlements</code>.
        </p>
        <p className="mt-2 text-blue-800">
          <strong>Compute</strong> refreshes every daily snapshot in the month, then reloads the aggregated view.{' '}
          <strong>Load</strong> reads existing daily snapshots only (faster if days were already computed). CSV export
          adds <strong>platform / convenience / delivery fees</strong> and <strong>GST (CGST, SGST, IGST)</strong> for
          investor reporting.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Report month (IST)</label>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading || !parsed}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Load</span>
        </Button>
        <Button type="button" onClick={() => void compute()} disabled={computing || !parsed}>
          {computing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          <span className="ml-2">Compute / refresh snapshots</span>
        </Button>
        <Button type="button" variant="outline" onClick={() => void downloadCsv()} disabled={!parsed}>
          <Download className="h-4 w-4" />
          <span className="ml-2">Export CSV</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void downloadReconciliationPackAction()}
          disabled={!parsed || packDownloading}
        >
          {packDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="ml-2">Download reconciliation pack</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {totals && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Vendors in month</div>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
              <div className="text-xs text-gray-600">Platform discount total</div>
              <div className="text-sm font-semibold">{moneyCell(totals.platformFundedDiscount)}</div>
            </div>
            <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
              <div className="text-xs text-gray-600">Vendor discount total</div>
              <div className="text-sm font-semibold">{moneyCell(totals.vendorFundedDiscount)}</div>
            </div>
          </div>
        </>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
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
              <th className="px-3 py-2 text-center font-medium text-gray-700">Days</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Bank</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">IFSC</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Verified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={17} className="px-3 py-8 text-center text-gray-500">
                  No rows. Pick a month, run <strong>Compute</strong> (requires migration 732 + 753), then{' '}
                  <strong>Load</strong>.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.vendor_id} className="hover:bg-gray-50">
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
                <td className="px-3 py-2 text-center">{r.snapshot_day_count ?? '—'}</td>
                <td className="px-3 py-2 max-w-[140px] truncate" title={r.bankName || ''}>
                  {r.bankName || '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.ifscCode || '—'}</td>
                <td className="px-3 py-2 text-center">
                  {r.hasBankOnFile ? (r.bankVerified ? 'Yes' : 'No') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
