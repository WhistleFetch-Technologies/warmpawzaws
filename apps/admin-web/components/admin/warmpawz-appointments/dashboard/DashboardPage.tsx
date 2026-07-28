'use client';

import { useState } from 'react';
import { WarmpawzAppointmentsShell } from '@/components/admin/warmpawz-appointments/shared/WarmpawzAppointmentsShell';
import {
  useWapptBookingsList,
  useWapptDashboardMetrics,
} from '@/hooks/warmpawz-appointments/useDashboard';

const PAGE_SIZE = 20;

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSlot(date: string, time: string): string {
  const d = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  if (Number.isNaN(d.getTime())) {
    return `${date} ${time}`;
  }
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WapptDashboardPage() {
  const [page, setPage] = useState(1);
  const { data: metrics, isLoading: metricsLoading } = useWapptDashboardMetrics();
  const { data: bookingsData, isLoading: bookingsLoading } = useWapptBookingsList(
    page,
    PAGE_SIZE,
  );

  const totalPages = Math.max(1, Math.ceil((bookingsData?.total ?? 0) / PAGE_SIZE));

  return (
    <WarmpawzAppointmentsShell
      title="Dashboard"
      subtitle="Warmpawz Appointments orders and catalogue metrics"
    >
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <MetricCard
          label="Published vendors"
          value={metricsLoading ? '—' : String(metrics?.publishedVendorCount ?? 0)}
        />
        <MetricCard
          label="Avg appointment base fee"
          value={
            metricsLoading ? '—' : formatInr(metrics?.averageAppointmentFee ?? 0)
          }
        />
        <MetricCard
          label="Total appointment revenue"
          value={metricsLoading ? '—' : formatInr(metrics?.totalRevenue ?? 0)}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Appointment orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Slot</th>
                <th className="px-4 py-3 font-medium">Base fee</th>
                <th className="px-4 py-3 font-medium">Booked at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookingsLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : bookingsData?.rows.length ? (
                bookingsData.rows.map((row) => (
                  <tr key={row.bookingId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {row.customerName || '—'}
                      </div>
                      <div className="text-gray-500">{row.customerPhone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{row.merchantDisplayName}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatSlot(row.bookingDate, row.bookingTime)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatInr(row.baseFeePaid)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(row.createdAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No appointment orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-sm text-[#FF8C42] disabled:text-gray-300"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="text-sm text-[#FF8C42] disabled:text-gray-300"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </WarmpawzAppointmentsShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
