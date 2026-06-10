'use client';

import { useCallback, useState, Fragment } from 'react';
import { apiClient, getApiBaseUrl, isUatMode } from '@/lib/api-client';
import { Button } from '@warmpawz/ui';
import { ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';

function yesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

type BookingLine = {
  bookingId: string;
  vendorId: string;
  bookingDate?: string | null;
  bookingStatus?: string | null;
  serviceName?: string | null;
  customerName?: string | null;
  couponCode?: string | null;
  customerPaidTotal: number;
  serviceBase: number;
  discountAmount: number;
  gstTotal: number;
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  vendorGross: number;
  commissionRate?: number | null;
  commissionAmount: number;
  vendorNet: number;
  feeSource: string;
  realizedAt?: string | null;
};

type DayTotals = {
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
  const [reportDate, setReportDate] = useState(yesterdayYmd());
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [dayTotals, setDayTotals] = useState<DayTotals | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingLine[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVendorSummaries = useCallback(async () => {
    setError(null);
    setLoading(true);
    setSelectedVendorId(null);
    setBookings([]);
    setExpandedBookingId(null);
    try {
      const res = await apiClient.get<any>(
        `/admin/finance/vendor-booking-earnings?reportDate=${encodeURIComponent(reportDate)}`,
      );
      if (!res?.success) {
        setError(res?.error || 'Failed to load report');
        setVendors([]);
        setDayTotals(null);
        return;
      }
      setVendors(res.vendors || []);
      setDayTotals(res.dayTotals || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setVendors([]);
      setDayTotals(null);
    } finally {
      setLoading(false);
    }
  }, [reportDate]);

  const loadVendorBookings = useCallback(
    async (vendorId: string) => {
      setError(null);
      setLoadingBookings(true);
      setExpandedBookingId(null);
      try {
        const res = await apiClient.get<any>(
          `/admin/finance/vendor-booking-earnings?reportDate=${encodeURIComponent(reportDate)}&vendorId=${encodeURIComponent(vendorId)}`,
        );
        if (!res?.success) {
          setError(res?.error || 'Failed to load bookings');
          setBookings([]);
          return;
        }
        setBookings(res.bookings || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load bookings');
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    },
    [reportDate],
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

  const exportCsv = (vendorId?: string) => {
    const base = getApiBaseUrl();
    const uat = isUatMode() ? '&uat=1' : '';
    const vendorPart = vendorId ? `&vendorId=${encodeURIComponent(vendorId)}` : '';
    window.open(
      `${base}/admin/finance/vendor-booking-earnings/export.csv?reportDate=${encodeURIComponent(reportDate)}${vendorPart}${uat}`,
      '_blank',
    );
  };

  const selectedVendor = vendors.find((v) => v.vendorId === selectedVendorId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Per-booking customer-paid waterfall and vendor ledger for the IST day. Discount and coupon columns are
        included for future promos (may be ₹0 today).
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Report date (IST)</span>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <Button onClick={() => void loadVendorSummaries()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Load
        </Button>
        <Button variant="outline" onClick={() => exportCsv()} disabled={!vendors.length}>
          <Download className="mr-2 h-4 w-4" />
          Export vendor summary CSV
        </Button>
        {selectedVendorId && (
          <Button variant="outline" onClick={() => exportCsv(selectedVendorId)}>
            <Download className="mr-2 h-4 w-4" />
            Export booking CSV
          </Button>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {dayTotals && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Vendors</div>
              <div className="text-xl font-semibold">{dayTotals.vendorCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Bookings</div>
              <div className="text-xl font-semibold">{dayTotals.bookingCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Customer paid (day)</div>
              <div className="text-xl font-semibold">{moneyCell(dayTotals.customerPaidTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Vendor net (day)</div>
              <div className="text-xl font-semibold">{moneyCell(dayTotals.vendorNet)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Service base</div>
              <div className="text-sm font-semibold">{moneyCell(dayTotals.serviceBaseTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Discount</div>
              <div className="text-sm font-semibold">{moneyCell(dayTotals.discountTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">GST</div>
              <div className="text-sm font-semibold">{moneyCell(dayTotals.gstTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Platform fees</div>
              <div className="text-sm font-semibold">{moneyCell(dayTotals.platformFeeTotal)}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Commission</div>
              <div className="text-sm font-semibold">{moneyCell(dayTotals.commissionTotal)}</div>
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
                  Pick a date and click <strong>Load</strong> to see vendor day totals. Click a row for per-booking
                  detail.
                </td>
              </tr>
            )}
            {vendors.map((v) => {
              const open = selectedVendorId === v.vendorId;
              return (
                <tr
                  key={v.vendorId}
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
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedVendor && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">
            Bookings — {selectedVendor.businessName || selectedVendor.vendorId}
            {loadingBookings && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-gray-400" />}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.length === 0 && !loadingBookings && (
                  <tr>
                    <td colSpan={14} className="px-3 py-6 text-center text-gray-500">
                      No bookings for this vendor on the selected date.
                    </td>
                  </tr>
                )}
                {bookings.map((b) => {
                  const expanded = expandedBookingId === b.bookingId;
                  return (
                    <Fragment key={b.bookingId}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedBookingId(expanded ? null : b.bookingId);
                        }}
                      >
                        <td className="px-2 py-2 text-gray-400">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs" title={b.bookingId}>
                          {shortId(b.bookingId)}
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={b.serviceName || ''}>
                          {b.serviceName || '—'}
                        </td>
                        <td className="px-3 py-2">{b.customerName || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{moneyCell(b.customerPaidTotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.serviceBase)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.discountAmount)}</td>
                        <td className="px-3 py-2 text-xs">{b.couponCode || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.gstTotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.platformFee)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.deliveryFee)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.vendorGross)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.commissionAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.vendorNet)}</td>
                      </tr>
                      {expanded && (
                        <tr key={`${b.bookingId}-detail`} className="bg-gray-50/80">
                          <td colSpan={14} className="px-6 py-3">
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
                                <div className="text-xs capitalize">{b.feeSource.replace(/_/g, ' ')}</div>
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
      )}
    </div>
  );
}
