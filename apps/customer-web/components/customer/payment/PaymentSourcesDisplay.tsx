'use client';

import { CreditCard, Smartphone, Wallet, Landmark, Banknote, CheckCircle2 } from 'lucide-react';
import type { PaymentSource } from '@/lib/payment-display-utils';
import { totalFromPaymentSources } from '@/lib/payment-display-utils';

function PaymentSourceIcon({ method }: { method: string }) {
  const m = method.toLowerCase();
  if (m === 'wallet') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
        <Wallet className="h-4 w-4 text-green-600" />
      </div>
    );
  }
  if (m === 'upi') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100">
        <Smartphone className="h-4 w-4 text-purple-600" />
      </div>
    );
  }
  if (m === 'card' || m.includes('card')) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
        <CreditCard className="h-4 w-4 text-blue-600" />
      </div>
    );
  }
  if (m === 'netbanking') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100">
        <Landmark className="h-4 w-4 text-indigo-600" />
      </div>
    );
  }
  if (m === 'cod') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
        <Banknote className="h-4 w-4 text-amber-700" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100">
      <CreditCard className="h-4 w-4 text-[#FF8C42]" />
    </div>
  );
}

interface PaymentSourcesDisplayProps {
  sources: PaymentSource[];
  totalPaid?: number;
  compact?: boolean;
  className?: string;
}

export function PaymentSourcesDisplay({
  sources,
  totalPaid,
  compact = false,
  className = '',
}: PaymentSourcesDisplayProps) {
  if (!sources.length) return null;

  const total = totalPaid ?? totalFromPaymentSources(sources);

  return (
    <div className={`rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white ${compact ? 'p-3' : 'p-4'} ${className}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
        <p className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>Payment</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Paid
        </span>
      </div>

      <div className="space-y-2">
        {sources.map((source, idx) => (
          <div
            key={`${source.method}-${idx}`}
            className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              <PaymentSourceIcon method={source.method} />
              <span className="truncate text-sm font-medium text-gray-800">{source.label}</span>
            </div>
            <span className="shrink-0 text-sm font-bold text-gray-900">₹{source.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {sources.length > 1 && (
        <div className={`flex items-center justify-between border-t border-gray-200 ${compact ? 'mt-2 pt-2' : 'mt-3 pt-3'}`}>
          <span className="text-sm font-medium text-gray-600">Total paid</span>
          <span className="text-base font-bold text-[#FF8C42]">₹{total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
