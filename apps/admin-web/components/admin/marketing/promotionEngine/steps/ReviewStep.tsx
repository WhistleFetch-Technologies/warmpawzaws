'use client';

import type { PromoEngineDraft } from '@/lib/promo-engine/types';
import { PromotionEngineStatusBadge } from '../PromotionEngineStatusBadge';

export function ReviewStep({ draft }: { draft: PromoEngineDraft }) {
  const { basics } = draft;
  return (
    <div className="space-y-3 rounded-xl border bg-slate-50 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-slate-800">Review — Bindu Phase 3 will expand WHEN/THEN/REDEEM</p>
        <PromotionEngineStatusBadge status={draft.status} />
      </div>
      <p>
        <strong>Name:</strong> {basics.name || '—'}
      </p>
      <p>
        <strong>Code:</strong> {basics.code || '—'}
      </p>
      <p>
        <strong>Priority:</strong> {basics.priority}
      </p>
      <p>
        <strong>Window:</strong> {basics.startAt || '—'} → {basics.endAt || '—'}
      </p>
      <p>
        <strong>Funding:</strong> {basics.fundingType}
        {basics.fundingType === 'SHARED'
          ? ` (${basics.fundingSplit.warmpawzPercent}/${basics.fundingSplit.vendorPercent})`
          : ''}
      </p>
      <p>
        <strong>Stacking:</strong> {basics.stackingPolicy}
      </p>
      <p>
        <strong>Services:</strong> {basics.serviceCategories.join(', ') || '—'}
      </p>
      <p className="text-xs text-slate-500">
        Activate stays disabled until Phase 3 + Abhi CRUD. Save draft from the footer.
      </p>
    </div>
  );
}
