'use client';

import { Info } from 'lucide-react';
import { MARKETPLACE_CARD_CLASS } from '@/lib/marketplace/types';

export function MarketplacePolicies({
  cancellation,
  refund,
  supportNote,
}: {
  cancellation?: string;
  refund?: string;
  supportNote?: string;
}) {
  if (!cancellation && !refund && !supportNote) return null;
  return (
    <div className={`${MARKETPLACE_CARD_CLASS} p-4 space-y-3`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Info className="h-4 w-4 text-orange-500" />
        Policies
      </div>
      {cancellation ? (
        <div>
          <p className="text-xs font-medium text-slate-700">Cancellation</p>
          <p className="text-xs text-slate-500 mt-0.5">{cancellation}</p>
        </div>
      ) : null}
      {refund ? (
        <div>
          <p className="text-xs font-medium text-slate-700">Refund</p>
          <p className="text-xs text-slate-500 mt-0.5">{refund}</p>
        </div>
      ) : null}
      {supportNote ? (
        <p className="text-xs text-slate-400 border-t border-slate-100 pt-2">{supportNote}</p>
      ) : null}
    </div>
  );
}

/** Cancellation / refund status block for history & tracking */
export function MarketplaceRefundStatus({
  status,
  amount,
  reason,
  timeline,
}: {
  status: string;
  amount?: number;
  reason?: string;
  timeline?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-sm space-y-1">
      <p className="font-semibold text-amber-900">Refund: {status}</p>
      {amount != null ? (
        <p className="text-amber-800">Expected refund: ₹{amount.toLocaleString('en-IN')}</p>
      ) : null}
      {reason ? <p className="text-xs text-amber-800/90">Reason: {reason}</p> : null}
      {timeline ? <p className="text-xs text-amber-700/80">{timeline}</p> : null}
    </div>
  );
}
