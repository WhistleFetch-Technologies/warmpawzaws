'use client';

import { formatInr } from '@/lib/pricing/format';
import type { PriceBreakdownLine } from '@/lib/pricing/types';

export type PriceBreakdownProps = {
  lines: PriceBreakdownLine[];
  title?: string;
  className?: string;
  compact?: boolean;
};

function lineAmountClass(line: PriceBreakdownLine): string {
  if (line.emphasis === 'total') return 'font-bold text-slate-900';
  if (line.emphasis === 'discount' || line.amount < 0) return 'font-medium text-emerald-600';
  if (line.emphasis === 'muted') return 'text-slate-500';
  return 'text-slate-700';
}

export function PriceBreakdown({
  lines,
  title = 'Price breakdown',
  className = '',
  compact = false,
}: PriceBreakdownProps) {
  if (!lines.length) return null;

  const padding = compact ? 'py-1.5' : 'py-2';
  const isTotalRow = (line: PriceBreakdownLine) =>
    line.kind === 'final' || line.emphasis === 'total';

  return (
    <div className={`rounded-xl border border-slate-100 bg-white ${className}`}>
      {title ? (
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
      ) : null}
      <div className="divide-y divide-slate-50 px-4">
        {lines.map((line, idx) => (
          <div
            key={line.id ?? `${line.kind}-${idx}`}
            className={`flex items-center justify-between gap-3 ${padding} ${line.indent ? 'pl-3' : ''} ${
              isTotalRow(line) ? 'border-t border-slate-100 bg-slate-50/50 -mx-4 px-4 mt-1' : ''
            }`}
          >
            <span
              className={`text-sm ${line.emphasis === 'muted' ? 'text-slate-500' : 'text-slate-600'} ${
                isTotalRow(line) ? 'font-semibold text-slate-900' : ''
              }`}
            >
              {line.label}
            </span>
            <span className={`text-sm tabular-nums ${lineAmountClass(line)}`}>
              {line.amount < 0 ? `-${formatInr(Math.abs(line.amount))}` : formatInr(line.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
