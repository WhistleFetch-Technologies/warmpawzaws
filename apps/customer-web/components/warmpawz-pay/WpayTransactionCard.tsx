'use client';

import type { WpayTransactionCard } from '@/lib/warmpawz-pay/wpay-api';

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPaidAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function WpayTransactionCardView({ row }: { row: WpayTransactionCard }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
      <p className="truncate text-sm font-semibold text-gray-900">{row.vendorName}</p>
      <div className="mt-1.5 space-y-0.5 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">Quoted</span>
          <span className="text-gray-800">{formatInr(row.originalAmount)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">Discount ({row.discountPercent}%)</span>
          <span className="text-green-700">- {formatInr(row.discountAmount)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="font-medium text-gray-700">Paid</span>
          <span className="font-semibold text-gray-900">{formatInr(row.payableAmount)}</span>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400">{formatPaidAt(row.paidAt)}</p>
    </div>
  );
}
