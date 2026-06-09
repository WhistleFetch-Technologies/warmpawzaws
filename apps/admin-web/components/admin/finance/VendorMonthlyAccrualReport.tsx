'use client';

import { useCallback, useState } from 'react';
import { apiClient, getApiBaseUrl, isUatMode } from '@/lib/api-client';
import { Button } from '@warmpawz/ui';
import { Download, Loader2, Play, RefreshCw } from 'lucide-react';

function currentYearMonthValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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
  const [totals, setTotals] = useState<{ gross: number; commission: number; net: number; vendorCount: number } | null>(
    null
  );
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
              vendorCount: Number(t.vendorCount) || 0,
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
          <strong>Load</strong> reads existing daily snapshots only (faster if days were already computed).
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
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {totals && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Vendors in month</div>
            <div className="text-xl font-semibold">{totals.vendorCount}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Gross</div>
            <div className="text-xl font-semibold">₹{totals.gross.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Commission</div>
            <div className="text-xl font-semibold">
              ₹{totals.commission.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Net to vendors</div>
            <div className="text-xl font-semibold">₹{totals.net.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
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
                <td colSpan={13} className="px-3 py-8 text-center text-gray-500">
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
                <td className="px-3 py-2 text-right tabular-nums">
                  ₹{Number(r.net_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
