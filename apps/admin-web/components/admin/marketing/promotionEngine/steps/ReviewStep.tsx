'use client';

import type { PromoEngineDraft } from '@/lib/promo-engine/types';
import { labelsForCatalogSlugs } from '@/lib/promo-engine/catalog-categories';
import { useCatalogServiceCategories } from '@/lib/promo-engine/use-catalog-categories';
import {
  describeBenefits,
  describeConditionGroup,
  describeRedeemScope,
} from '@/lib/promo-engine/plain-language';
import { PromotionEngineStatusBadge } from '../PromotionEngineStatusBadge';

export function ReviewStep({ draft }: { draft: PromoEngineDraft }) {
  const { categories } = useCatalogServiceCategories();
  const { basics } = draft;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-slate-800">Review & activate</p>
        <PromotionEngineStatusBadge status={draft.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReviewBlock title="WHEN" body={describeConditionGroup(draft.conditionJson)} />
        <ReviewBlock title="THEN" body={describeBenefits(draft.benefitJson)} />
        <ReviewBlock title="REDEEM" body={describeRedeemScope(draft.benefitJson)} />
        <ReviewBlock
          title="STACK"
          body={`${basics.stackingPolicy.replace(/_/g, ' ')} · priority ${basics.priority}`}
        />
        <ReviewBlock
          title="LIMITS"
          body="Per-user / budget / daily caps land in Abhi Phase 4"
        />
        <ReviewBlock
          title="FUNDING"
          body={
            basics.fundingType === 'SHARED'
              ? `SHARED ${basics.fundingSplit.warmpawzPercent}/${basics.fundingSplit.vendorPercent}`
              : basics.fundingType
          }
        />
      </div>

      <div className="rounded-xl border border-[#FF8C42]/30 bg-orange-50/50 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF8C42]">Engine model</p>
        <p className="mt-2">
          <strong>IF</strong> {describeConditionGroup(draft.conditionJson)}
        </p>
        <p className="mt-1">
          <strong>THEN</strong> {describeBenefits(draft.benefitJson)}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {basics.name || 'Untitled'} · {basics.startAt || 'no start'} → {basics.endAt || 'no end'} ·{' '}
          {labelsForCatalogSlugs(basics.serviceCategories, categories) || 'no service'}
        </p>
      </div>
    </div>
  );
}

function ReviewBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-slate-800">{body}</p>
    </div>
  );
}
