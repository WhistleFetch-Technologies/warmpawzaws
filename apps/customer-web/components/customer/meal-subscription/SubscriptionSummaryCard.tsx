'use client';

import { Badge } from '@/components/ui/badge';

export function SubscriptionSummaryCard({
  planName,
  vendorLabel,
  recurrenceLabel,
  nextDeliveryLabel,
  autoRenew,
}: {
  planName: string;
  vendorLabel: string;
  recurrenceLabel: string;
  nextDeliveryLabel: string;
  autoRenew: boolean;
}) {
  return (
    <div className="rounded-2xl ring-1 ring-orange-100 bg-gradient-to-br from-white to-orange-50/40 p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-snug">{planName}</h2>
          <p className="text-sm text-slate-600">{vendorLabel}</p>
        </div>
        <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0">Subscription</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Rhythm</dt>
          <dd className="font-semibold text-slate-900">{recurrenceLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">First delivery</dt>
          <dd className="font-semibold text-slate-900">{nextDeliveryLabel}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-400">Renewal</dt>
          <dd className="font-semibold text-slate-900">{autoRenew ? 'Auto-renew on' : 'Manual renewal'}</dd>
        </div>
      </dl>
    </div>
  );
}
