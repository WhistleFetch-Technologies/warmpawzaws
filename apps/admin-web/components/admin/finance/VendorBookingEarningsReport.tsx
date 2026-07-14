'use client';

import { useCallback, useEffect, useState, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient, getApiBaseUrl, isUatMode } from '@/lib/api-client';
import { Button } from '@warmpawz/ui';
import { ChevronDown, ChevronRight, Download, Eye, Loader2, RefreshCw } from 'lucide-react';
import {
  type BookingEarningsLine,
  normalizeBookingLine,
} from '@/lib/finance/settlement-audit-types';
import { downloadSettlementAuditCsv } from '@/lib/finance/settlementAuditExport';
import { SettlementBreakdownDrawer } from './settlementAudit/SettlementBreakdownDrawer';

type PeriodType = 'day' | 'month';

function yesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

type VendorSummary = {
  vendorId: string;
  businessName?: string | null;
  ownerName?: string | null;
  bookingCount: number;
  customerPaidTotal: number;
  serviceBaseTotal: number;
  discountTotal: number;
  gstTotal: number;
  platformFeeTotal: number;
  convenienceFeeTotal: number;
  deliveryFeeTotal: number;
  vendorGross: number;
  commissionTotal: number;
  vendorNet: number;
};

type BookingLine = BookingEarningsLine;

type PeriodTotals = {
  vendorCount: number;
  bookingCount: number;
  customerPaidTotal: number;
  serviceBaseTotal: number;
  discountTotal: number;
  gstTotal: number;
  platformFeeTotal: number;
  convenienceFeeTotal: number;
  deliveryFeeTotal: number;
  vendorGross: number;
  commissionTotal: number;
  vendorNet: number;
};

function moneyCell(v: string | number | undefined | null) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function shortId(id: string) {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function VendorBookingEarningsReport() {
  const searchParams = useSearchParams();
  const deepPeriod = searchParams.get('period');
  const deepReportDate = searchParams.get('reportDate');
  const deepYear = searchParams.get('year');
  const deepMonth = searchParams.get('month');
  const deepVendorId = searchParams.get('vendorId');
  const deepBookingId = searchParams.get('bookingId');

  const [periodType, setPeriodType] = useState<PeriodType>(
    deepPeriod === 'month' ? 'month' : 'day',
  );
  const [reportDate, setReportDate] = useState(deepReportDate || yesterdayYmd());
  const [yearMonth, setYearMonth] = useState(
    deepYear && deepMonth
      ? `${deepYear}-${String(deepMonth).padStart(2, '0')}`
      : currentYearMonthValue(),
  );
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [periodTotals, setPeriodTotals] = useState<PeriodTotals | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(deepVendorId);
  const [bookings, setBookings] = useState<BookingLine[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [drawerLine, setDrawerLine] = useState<BookingLine | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const parsedMonth = parseYearMonth(yearMonth);
  const periodWord = periodType === 'day' ? 'day' : 'month';

  const buildListQuery = useCallback(
    (vendorId?: string) => {
      const vendorPart = vendorId ? `&vendorId=${encodeURIComponent(vendorId)}` : '';
      if (periodType === 'month') {
        if (!parsedMonth) return null;
        return `/admin/finance/vendor-booking-earnings?year=${parsedMonth.year}&month=${parsedMonth.month}${vendorPart}`;
      }
      return `/admin/finance/vendor-booking-earnings?reportDate=${encodeURIComponent(reportDate)}${vendorPart}`;
    },
    [periodType, parsedMonth, reportDate],
  );

  const loadVendorSummaries = useCallback(async () => {
    if (periodType === 'month' && !parsedMonth) {
      setError('Pick a valid month (YYYY-MM)');
      return;
    }
    const query = buildListQuery();
    if (!query) return;

    setError(null);
    setLoading(true);
    setSelectedVendorId(null);
    setBookings([]);
    setExpandedBookingId(null);
    try {
      const res = await apiClient.get<any>(query);
      if (!res?.success) {
        setError(res?.error || 'Failed to load report');
        setVendors([]);
        setPeriodTotals(null);
        return;
      }
      setVendors(res.vendors || []);
      setPeriodTotals(res.periodTotals || res.dayTotals || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setVendors([]);
      setPeriodTotals(null);
    } finally {
      setLoading(false);
    }
  }, [periodType, parsedMonth, buildListQuery]);

  const loadVendorBookings = useCallback(
    async (vendorId: string) => {
      const query = buildListQuery(vendorId);
      if (!query) return;

      setError(null);
      setLoadingBookings(true);
      setExpandedBookingId(null);
      try {
        const res = await apiClient.get<any>(query);
        if (!res?.success) {
          setError(res?.error || 'Failed to load bookings');
          setBookings([]);
          return;
        }
        setBookings((res.bookings || []).map((b: Record<string, unknown>) => normalizeBookingLine(b)));
      } catch (e: any) {
        setError(e?.message || 'Failed to load bookings');
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    },
    [buildListQuery],
  );

  const selectVendor = (vendorId: string) => {
    if (selectedVendorId === vendorId) {
      setSelectedVendorId(null);
      setBookings([]);
      return;
    }
    setSelectedVendorId(vendorId);
    void loadVendorBookings(vendorId);
  };

  const openSettlementDrawer = (line: BookingLine) => {
    setDrawerLine(line);
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (deepLinkHandled || !deepVendorId) return;
    void (async () => {
      const vendorQuery = buildListQuery();
      const bookingQuery = buildListQuery(deepVendorId);
      if (!vendorQuery || !bookingQuery) {
        setDeepLinkHandled(true);
        return;
      }
      setLoading(true);
      setLoadingBookings(true);
      try {
        const [vendorRes, bookingRes] = await Promise.all([
          apiClient.get<any>(vendorQuery),
          apiClient.get<any>(bookingQuery),
        ]);
        if (vendorRes?.success) {
          setVendors(vendorRes.vendors || []);
          setPeriodTotals(vendorRes.periodTotals || vendorRes.dayTotals || null);
        }
        if (bookingRes?.success) {
          const loaded = (bookingRes.bookings || []).map((b: Record<string, unknown>) =>
            normalizeBookingLine(b),
          );
          setBookings(loaded);
          setSelectedVendorId(deepVendorId);
          if (deepBookingId) {
            const match = loaded.find((b: BookingLine) => b.bookingId === deepBookingId);
            if (match) {
              setExpandedBookingId(deepBookingId);
              setDrawerLine(match);
              setDrawerOpen(true);
            }
          }
        }
      } finally {
        setLoading(false);
        setLoadingBookings(false);
        setDeepLinkHandled(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time deep link hydration
  }, [deepLinkHandled, deepVendorId, deepBookingId]);

  const exportSettlementAuditCsv = async () => {
    if (periodType === 'month' && !parsedMonth) {
      setError('Pick a valid month (YYYY-MM)');
      return;
    }
    setError(null);
    setExporting(true);
    try {
      if (periodType === 'month' && parsedMonth) {
        await downloadSettlementAuditCsv({
          periodType: 'month',
          year: parsedMonth.year,
          month: parsedMonth.month,
        });
      } else {
        await downloadSettlementAuditCsv({ periodType: 'day', reportDate });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Settlement audit export failed');
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = async (vendorId?: string) => {
    if (periodType === 'month' && !parsedMonth) {
      setError('Pick a valid month (YYYY-MM)');
      return;
    }

    setError(null);
    setExporting(true);
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

      const vendorPart = vendorId ? `&vendorId=${encodeURIComponent(vendorId)}` : '';
      let periodPart = '';
      if (periodType === 'month' && parsedMonth) {
        periodPart = `year=${parsedMonth.year}&month=${parsedMonth.month}`;
      } else {
        periodPart = `reportDate=${encodeURIComponent(reportDate)}`;
      }

      const url = `${base}/admin/finance/vendor-booking-earnings/export.csv?${periodPart}${vendorPart}`;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (isUatMode()) {
        headers['X-UAT-Mode'] = 'true';
        if (token?.startsWith('uat-token-')) headers['X-UAT-Token'] = token;
      }

      const res = await fetch(url, { headers, credentials: 'include' });
      if (!res.ok) {
        const text = await res.text();
        let message = text || `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) message = String(parsed.error);
        } catch {
          /* raw text */
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = /filename="([^"]+)"/i.exec(disposition);
      const fallbackLabel =
        periodType === 'month' && parsedMonth
          ? `${parsedMonth.year}-${String(parsedMonth.month).padStart(2, '0')}`
          : reportDate;
      const filename =
        filenameMatch?.[1] ||
        (vendorId
          ? `vendor-booking-earnings-${fallbackLabel}-bookings.csv`
          : `vendor-booking-earnings-summary-${fallbackLabel}.csv`);

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setExporting(false);
    }
  };

  const switchPeriodType = (next: PeriodType) => {
    if (next === periodType) return;
    setPeriodType(next);
    setSelectedVendorId(null);
    setBookings([]);
    setExpandedBookingId(null);
    setVendors([]);
    setPeriodTotals(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Financial audit report — per-booking customer-paid waterfall, vendor ledger, and settlement breakdown
        (IST {periodWord}). Use <strong>View Settlement</strong> on a booking for funding and commission audit detail.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600">View</span>
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
          <button
            type="button"
            onClick={() => switchPeriodType('day')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              periodType === 'day' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => switchPeriodType('month')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              periodType === 'month' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {periodType === 'day' ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">Report date (IST)</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">Report month (IST)</span>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
        )}
        <Button onClick={() => void loadVendorSummaries()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Load
        </Button>
        <Button variant="outline" onClick={() => void exportCsv()} disabled={!vendors.length || exporting}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export vendor summary CSV
        </Button>
        {selectedVendorId && (
          <Button variant="outline" onClick={() => void exportCsv(selectedVendorId)} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export booking CSV
          </Button>
        )}
        <Button variant="outline" onClick={() => void exportSettlementAuditCsv()} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Settlement audit CSV
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {periodTotals && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Vendors</div>
              <div className="text-xl font-semibold">{periodTotals.vendorCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Bookings</div>
              <div className="text-xl font-semibold">{periodTotals.bookingCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Customer paid ({periodWord})</div>
              <div className="text-xl font-semibold">{moneyCell(periodTotals.customerPaidTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Vendor net ({periodWord})</div>
              <div className="text-xl font-semibold">{moneyCell(periodTotals.vendorNet)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Service base</div>
              <div className="text-sm font-semibold">{moneyCell(periodTotals.serviceBaseTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Discount</div>
              <div className="text-sm font-semibold">{moneyCell(periodTotals.discountTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">GST</div>
              <div className="text-sm font-semibold">{moneyCell(periodTotals.gstTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Platform fees</div>
              <div className="text-sm font-semibold">{moneyCell(periodTotals.platformFeeTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Commission</div>
              <div className="text-sm font-semibold">{moneyCell(periodTotals.commissionTotal)}</div>
            </div>
          </div>
        </>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 text-left font-medium text-gray-700">Business</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Owner</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Bookings</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Customer paid</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Service base</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Discount</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">GST</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Platform</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Gross</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Commission</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Vendor net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vendors.length === 0 && !loading && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                  Pick a {periodWord} and click <strong>Load</strong> to see vendor totals. Click a row for per-booking
                  detail.
                </td>
              </tr>
            )}
            {vendors.map((v) => {
              const open = selectedVendorId === v.vendorId;
              return (
                <Fragment key={v.vendorId}>
                  <tr
                    className={`cursor-pointer hover:bg-orange-50/60 ${open ? 'bg-orange-50' : ''}`}
                    onClick={() => selectVendor(v.vendorId)}
                  >
                    <td className="px-2 py-2 text-gray-400">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-3 py-2 font-medium">{v.businessName || '—'}</td>
                    <td className="px-3 py-2">{v.ownerName || '—'}</td>
                    <td className="px-3 py-2 text-center">{v.bookingCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(v.customerPaidTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(v.serviceBaseTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(v.discountTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(v.gstTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(v.platformFeeTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(v.vendorGross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(v.commissionTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyCell(v.vendorNet)}</td>
                  </tr>
                  {open && (
                    <tr className="bg-orange-50/40">
                      <td colSpan={12} className="px-3 py-3">
                        <div className="space-y-2 rounded-lg border border-orange-100 bg-white p-3">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Bookings — {v.businessName || v.vendorId}
                            {loadingBookings && (
                              <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-gray-400" />
                            )}
                          </h3>
                          <div className="overflow-x-auto rounded-md border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="w-8 px-2 py-2" />
                                  <th className="px-3 py-2 text-left font-medium text-gray-700">Booking</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-700">Service</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-700">Customer</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Customer paid</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Base</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Discount</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-700">Coupon</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">GST</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Platform</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Delivery</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Gross</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Commission</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Net</th>
                                  <th className="px-3 py-2 text-center font-medium text-gray-700">Settlement</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {bookings.length === 0 && !loadingBookings && (
                                  <tr>
                                    <td colSpan={15} className="px-3 py-6 text-center text-gray-500">
                                      No bookings for this vendor in the selected {periodWord}.
                                    </td>
                                  </tr>
                                )}
                                {bookings.map((b) => {
                                  const expanded = expandedBookingId === b.bookingId;
                                  return (
                                    <Fragment key={b.bookingId}>
                                      <tr
                                        className="cursor-pointer hover:bg-gray-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedBookingId(expanded ? null : b.bookingId);
                                        }}
                                      >
                                        <td className="px-2 py-2 text-gray-400">
                                          {expanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs" title={b.bookingId}>
                                          {shortId(b.bookingId)}
                                        </td>
                                        <td
                                          className="max-w-[160px] truncate px-3 py-2"
                                          title={b.serviceName || ''}
                                        >
                                          {b.serviceName || '—'}
                                        </td>
                                        <td className="px-3 py-2">{b.customerName || '—'}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                                          {moneyCell(b.customerPaidTotal)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {moneyCell(b.serviceBase)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {moneyCell(b.discountAmount)}
                                        </td>
                                        <td className="px-3 py-2 text-xs">{b.couponCode || '—'}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {moneyCell(b.gstTotal)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {moneyCell(b.platformFee)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {moneyCell(b.deliveryFee)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {moneyCell(b.vendorGross)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {moneyCell(b.commissionAmount)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {moneyCell(b.vendorNet)}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openSettlementDrawer(b);
                                            }}
                                          >
                                            <Eye className="mr-1 h-3.5 w-3.5" />
                                            View Settlement
                                          </Button>
                                        </td>
                                      </tr>
                                      {expanded && (
                                        <tr className="bg-gray-50/80">
                                          <td colSpan={15} className="px-6 py-3">
                                            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                              <div>
                                                <span className="text-gray-500">Customer paid</span>
                                                <div className="font-semibold">{moneyCell(b.customerPaidTotal)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Service base</span>
                                                <div>{moneyCell(b.serviceBase)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Discount</span>
                                                <div>{moneyCell(b.discountAmount)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Coupon</span>
                                                <div>{b.couponCode || '—'}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">GST</span>
                                                <div>{moneyCell(b.gstTotal)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Platform fee</span>
                                                <div>{moneyCell(b.platformFee)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Convenience fee</span>
                                                <div>{moneyCell(b.convenienceFee)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Delivery fee</span>
                                                <div>{moneyCell(b.deliveryFee)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Vendor gross</span>
                                                <div>{moneyCell(b.vendorGross)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Commission</span>
                                                <div>
                                                  {moneyCell(b.commissionAmount)}
                                                  {b.commissionRate != null ? ` (${b.commissionRate}%)` : ''}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Vendor net</span>
                                                <div className="font-semibold">{moneyCell(b.vendorNet)}</div>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Fee source</span>
                                                <div className="text-xs capitalize">
                                                  {b.feeSource.replace(/_/g, ' ')}
                                                </div>
                                              </div>
                                              <div className="sm:col-span-2 lg:col-span-4">
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openSettlementDrawer(b);
                                                  }}
                                                >
                                                  <Eye className="mr-1 h-3.5 w-3.5" />
                                                  View Settlement
                                                </Button>
                                              </div>
                                            </div>
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <SettlementBreakdownDrawer
        open={drawerOpen}
        line={drawerLine}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerLine(null);
        }}
      />
    </div>
  );
}
