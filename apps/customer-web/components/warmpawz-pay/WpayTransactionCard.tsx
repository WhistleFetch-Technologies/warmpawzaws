'use client';

import type { WpayTransactionCard } from '@/lib/warmpawz-pay/wpay-api';
import { buildWpayHistoryBreakdownLines } from '@/lib/warmpawz-pay/wpay-history-breakdown';

function formatInr(n: number): string {
  const abs = Math.abs(n);
  const formatted = `₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `- ${formatted}` : formatted;
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
  const lines = buildWpayHistoryBreakdownLines(row);
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
      <p className="truncate text-sm font-semibold text-gray-900">{row.vendorName}</p>
      <div className="mt-1.5 space-y-0.5 text-xs">
        {lines.map((line) => (
          <div
            key={line.label}
            className={`flex justify-between gap-2 ${
              line.tone === 'total' ? 'mt-1 border-t border-gray-100 pt-1' : ''
            }`}
          >
            <span
              className={
                line.tone === 'total'
                  ? 'font-medium text-gray-700'
                  : line.tone === 'discount'
                    ? 'text-green-700'
                    : 'text-gray-500'
              }
            >
              {line.label}
            </span>
            <span
              className={
                line.tone === 'total'
                  ? 'font-semibold text-gray-900'
                  : line.tone === 'discount'
                    ? 'text-green-700'
                    : 'text-gray-800'
              }
            >
              {formatInr(line.amount)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400">{formatPaidAt(row.paidAt)}</p>
    </div>
  );
}
