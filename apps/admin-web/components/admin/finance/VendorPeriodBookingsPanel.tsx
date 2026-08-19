'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
import {
  type BookingEarningsLine,
  normalizeBookingLine,
} from '@/lib/finance/settlement-audit-types';
import { BookingInvoiceDownloadButton } from './BookingInvoiceDownloadButton';

function moneyCell(v: string | number | undefined | null) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function shortId(id: string) {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export type VendorPeriodBookingsQuery =
  | { periodType: 'day'; reportDate: string; vendorId: string; businessName?: string }
  | { periodType: 'month'; year: number; month: number; vendorId: string; businessName?: string };

export function VendorPeriodBookingsPanel(query: VendorPeriodBookingsQuery) {
  const [bookings, setBookings] = useState<BookingEarningsLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vendorId = query.vendorId;
  const periodType = query.periodType;
  const reportDate = query.periodType === 'day' ? query.reportDate : '';
  const year = query.periodType === 'month' ? query.year : 0;
  const month = query.periodType === 'month' ? query.month : 0;

  const load = useCallback(async () => {
    const vendorPart = `&vendorId=${encodeURIComponent(vendorId)}`;
    const path =
      periodType === 'month'
        ? `/admin/finance/vendor-booking-earnings?year=${year}&month=${month}${vendorPart}`
        : `/admin/finance/vendor-booking-earnings?reportDate=${encodeURIComponent(reportDate)}${vendorPart}`;
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.get<any>(path);
      if (!res?.success) {
        setError(res?.error || 'Failed to load bookings');
        setBookings([]);
        return;
      }
      setBookings((res.bookings || []).map((b: Record<string, unknown>) => normalizeBookingLine(b)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [periodType, vendorId, reportDate, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = query.businessName || query.vendorId;

  return (
    <div className="space-y-2 rounded-lg border border-orange-100 bg-white p-3">
      <h3 className="text-sm font-semibold text-gray-900">
        Bookings — {title}
        {loading && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-gray-400" />}
      </h3>
      <p className="text-xs text-gray-500">
        Same tax invoice the customer downloads from booking details.
      </p>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Booking</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Service</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Customer</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Customer paid</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  No bookings for this vendor in the selected period.
                </td>
              </tr>
            )}
            {bookings.map((b) => (
              <tr key={b.bookingId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs" title={b.bookingId}>
                  {shortId(b.bookingId)}
                </td>
                <td className="max-w-[200px] truncate px-3 py-2" title={b.serviceName || ''}>
                  {b.serviceName || '—'}
                </td>
                <td className="px-3 py-2">{b.customerName || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyCell(b.customerPaidTotal)}</td>
                <td className="px-3 py-2 text-center">
                  <BookingInvoiceDownloadButton bookingId={b.bookingId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
